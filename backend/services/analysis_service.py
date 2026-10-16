import requests
import json
import re
import sys
from typing import Optional, Dict, Any, List
from domain.interfaces import IAnalyzer
from core.config import Config, DEFAULT_OLLAMA_MODEL

OLLAMA_BASE_URL = "http://localhost:11434"

LOCAL_UNAVAILABLE_MSG = (
    "El modelo local no está disponible. Inicia Ollama o activa el uso de la nube en Ajustes."
)


class LocalModelUnavailableError(RuntimeError):
    """Ollama no responde y el usuario no activó el respaldo en la nube."""


# ──────────────────────────────────────────────────────────────────────
# PROMPTS Y CONSTANTES COMUNES
# ──────────────────────────────────────────────────────────────────────

DIARIZE_PROMPT_TEMPLATE = """Eres un asistente de transcripción experto en diarización para reuniones en español.
Analiza la siguiente lista de segmentos de diálogo y determina qué hablante está hablando en cada uno.
Usa etiquetas genéricas como "Hablante A", "Hablante B". Si se mencionan nombres propios, usa sus nombres reales.

Responde ÚNICAMENTE con un objeto JSON que asocie el índice del segmento con el nombre del hablante identificado.
No agregues explicaciones, markdown, ni código.

EJEMPLO DE RESPUESTA:
{{
  "0": "Hablante A",
  "1": "Juan",
  "2": "Hablante A"
}}

SEGMENTOS A DIARIZAR:
{segments_text}
"""

ANALYZE_PROMPT_TEMPLATE = """Eres un asistente especializado en análisis de reuniones. Analiza la siguiente transcripción y responde EXCLUSIVAMENTE en el formato JSON indicado. No incluyas texto adicional fuera del JSON.{focus_instruction}{bookmarks_instruction}

TRANSCRIPCIÓN:
\"\"\"
{transcript}
\"\"\"

Responde SOLO con este JSON (sin markdown):
{{
  "summary": ["Punto clave 1", "Punto clave 2", "Punto clave 3"],
  "action_items": [
    {{"task": "Descripción", "assignee": "Responsable o 'Sin asignar'", "deadline": "Fecha o 'Sin fecha'"}}
  ],
  "tone": "Formal / Informal / Tenso / Colaborativo / Técnico / Motivacional",
  "category": "Revisión de Sprint / Planificación / Toma de Decisiones / Lluvia de Ideas / Otro",
  "key_decisions": ["Decisión 1", "Decisión 2"],
  "duration_insight": "Breve observación sobre la densidad"
}}"""


def format_bookmarks_instruction(bookmarks: Optional[List[Dict[str, Any]]]) -> str:
    if not bookmarks:
        return ""
    lines = ["\nMOMENTOS CLAVE MARCADOS POR EL USUARIO DURANTE LA REUNIÓN (Presta especial atención a estos momentos para incluirlos con prioridad en el resumen y decisiones clave):"]
    for bm in bookmarks:
        t = bm.get("time", 0.0)
        mins = int(t // 60)
        secs = int(t % 60)
        time_str = f"{mins:02d}:{secs:02d}"
        note = bm.get("note", "").strip()
        if note:
            lines.append(f"- [{time_str}] {note}")
        else:
            lines.append(f"- [{time_str}] Momento relevante marcado")
    return "\n" + "\n".join(lines) + "\n"


CHAT_TRANSCRIPT_SYSTEM = """Eres un asistente de inteligencia artificial experto y altamente confiable para el análisis de reuniones.
Tu misión es responder preguntas del usuario basándote con máxima fidelidad en el contenido y metadatos de la reunión provista a continuación.

DIRECTRICES OBLIGATORIAS DE RESPUESTA:
1. GROUNDING Y VERACIDAD ESTRICTA:
   - Responde ÚNICAMENTE basándote en la información que aparece en los datos y transcripción de esta reunión.
   - NUNCA inventes hechos, opiniones, participantes, acuerdos ni tareas que no hayan sido discutidos.
   - Si la información preguntada no fue tratada en la reunión, indícalo claramente con total honestidad (por ejemplo: "Ese tema no fue discutido en esta reunión").
   - Distingue claramente entre acuerdos tomados, dudas expresadas y simples comentarios de los participantes.

2. MARCAS TEMPORALES Y HABLANTES:
   - Cuando menciones una frase, intervención o acuerdo importante, cita la marca temporal aproximada usando el formato [MM:SS] (por ejemplo: [04:20] Carlos señaló que...).
   - Si los hablantes están identificados por su nombre, menciónalos explícitamente para dar claridad a la respuesta.

3. ESTRUCTURA Y FORMATO DE CALIDAD:
   - Utiliza Markdown limpio: negritas para términos y personas clave, viñetas para desglosar puntos y listas ordenadas para cronologías o prioridades.
   - Si se preguntan compromisos o tareas, indícalos con: Tarea, Responsable, Plazo/Fecha y Estado si se conoce.

4. PREGUNTAS SUGERIDAS DE SEGUIMIENTO:
   - Al final de tu respuesta (separado por una línea `---`), incluye exactamente 2 o 3 preguntas de seguimiento breves y naturales que ayuden al usuario a profundizar sobre lo conversado en esta reunión.
   - Utiliza estrictamente este formato al final:
---
**Preguntas sugeridas:**
- ¿[Pregunta de seguimiento 1]?
- ¿[Pregunta de seguimiento 2]?

DATOS Y TRANSCRIPCIÓN DE LA REUNIÓN:
\"\"\"
{transcript}
\"\"\"
"""

CHAT_HISTORY_SYSTEM = """Eres un asistente de inteligencia artificial experto y altamente confiable para el análisis de reuniones.
Tu misión es responder preguntas del usuario consultando el historial consolidado de sus reuniones grabadas.

DIRECTRICES OBLIGATORIAS DE RESPUESTA:
1. GROUNDING Y VERACIDAD ESTRICTA:
   - Basa tus respuestas ÚNICAMENTE en la información explícita del "CONTEXTO DE REUNIONES" provisto abajo.
   - NUNCA inventes nombres, fechas, acuerdos, compromisos ni tareas que no figuren en los datos.
   - Si la información solicitada no se encuentra en el contexto, indícalo con total honestidad y claridad (por ejemplo: "No encontré menciones o acuerdos sobre este tema en tus reuniones registradas").
   - Si la información es parcial, aclara con precisión qué partes están registradas y cuáles no.

2. CITAS Y REFERENCIAS A REUNIONES:
   - Para cada hecho, decisión o compromiso mencionado, DEBES citar la reunión de origen y su fecha usando el formato en negrita:
     **[Reunión: <Nombre o título> - <Fecha>]**
   - Si el contexto incluye fragmentos de conversación con marcas de tiempo (por ejemplo: [03:45] Carlos: ...), menciónalos para respaldar tu respuesta con evidencia concreta.

3. ESTRUCTURA Y FORMATO:
   - Utiliza Markdown limpio y legible: viñetas claras para desgloses, negritas para conceptos/personas clave y listas ordenadas para pasos o prioridades.
   - Si se preguntan tareas o pendientes, estructúralos detallando: Tarea, Responsable, Estado ([PENDIENTE] o [COMPLETADA]) y Plazo/Fecha.
   - Si varias reuniones abordan el tema, compara o resume su evolución cronológica.

4. PREGUNTAS SUGERIDAS DE SEGUIMIENTO:
   - Al final de tu respuesta (tras responder en detalle la consulta), agrega una línea separadora `---` seguida de exactamente 2 o 3 preguntas de seguimiento breves y naturales que ayuden al usuario a seguir profundizando en su historial.
   - Utiliza estrictamente este formato al final:
---
**Preguntas sugeridas:**
- ¿[Pregunta de seguimiento 1]?
- ¿[Pregunta de seguimiento 2]?

CONTEXTO DE REUNIONES:
\"\"\"
{context}
\"\"\"
"""

_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def strip_think_blocks(text: str) -> str:
    """
    Elimina el razonamiento interno de modelos tipo Qwen3/DeepSeek (<think>...</think>).
    """
    if not text:
        return text
    text = _THINK_BLOCK_RE.sub("", text)
    lowered = text.lower()
    if "</think>" in lowered:
        text = text[lowered.rfind("</think>") + len("</think>"):]
    open_idx = text.lower().find("<think>")
    if open_idx != -1:
        text = text[:open_idx]
    return text.strip()


def parse_json_response(raw_response: str, fallback_value: Dict[str, Any]) -> Dict[str, Any]:
    raw_response = strip_think_blocks(raw_response)
    try:
        return json.loads(raw_response)
    except json.JSONDecodeError:
        json_match = re.search(r'\{.*\}', raw_response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except Exception:
                pass
        return fallback_value


# ──────────────────────────────────────────────────────────────────────
# PROVEEDOR ESTRATEGIA: OLLAMA LOCAL
# ──────────────────────────────────────────────────────────────────────

class LocalOllamaProvider(IAnalyzer):
    def __init__(self, config: Config):
        self._model = config.get("ollama_model", DEFAULT_OLLAMA_MODEL) or DEFAULT_OLLAMA_MODEL
        self.analysis_focus = config.get("analysis_focus", "")
        self.api_url = f"{OLLAMA_BASE_URL}/api/generate"

    @property
    def model(self) -> str:
        return self._model

    @property
    def ai_provider(self) -> str:
        return "local"

    def set_config(self, config: Config):
        self._model = config.get("ollama_model", self._model) or self._model
        self.analysis_focus = config.get("analysis_focus", self.analysis_focus)

    def is_running(self) -> bool:
        try:
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
            return response.status_code == 200
        except Exception:
            return False

    def _call_ollama(self, prompt: str, temperature: float = 0.3) -> str:
        payload = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,
            "think": False,
            "options": {
                "temperature": temperature,
                "num_predict": 1024,
                "num_ctx": 8192
            }
        }
        try:
            response = requests.post(self.api_url, json=payload, timeout=120)
            response.raise_for_status()
            return strip_think_blocks(response.json().get("response", "")).strip()
        except requests.exceptions.ConnectionError:
            raise RuntimeError("Ollama no está corriendo localmente.")
        except Exception as e:
            raise RuntimeError(f"Error en Ollama: {e}")

    def diarize_transcript(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not segments:
            return []
        
        formatted_segments = [
            f"[{idx}] {seg.get('start', 0.0):.1f}s - {seg.get('end', 0.0):.1f}s: {seg.get('text', '').strip()}" 
            for idx, seg in enumerate(segments)
        ]
        segments_text = "\n".join(formatted_segments)
        prompt = DIARIZE_PROMPT_TEMPLATE.format(segments_text=segments_text)
        
        raw_response = self._call_ollama(prompt)
        speaker_map = parse_json_response(raw_response, {})
        
        diarized_segments = []
        for idx, seg in enumerate(segments):
            speaker = speaker_map.get(str(idx)) or speaker_map.get(idx) or "Hablante A"
            diarized_segments.append({
                "start": seg.get("start", 0.0),
                "end": seg.get("end", 0.0),
                "text": seg.get("text", "").strip(),
                "speaker": speaker
            })
        return diarized_segments

    def analyze(self, transcript: str, bookmarks: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        focus_instruction = f"\nENFOQUE REQUERIDO: {self.analysis_focus}\n" if self.analysis_focus else ""
        bookmarks_instruction = format_bookmarks_instruction(bookmarks)
        prompt = ANALYZE_PROMPT_TEMPLATE.format(
            focus_instruction=focus_instruction, 
            bookmarks_instruction=bookmarks_instruction,
            transcript=transcript
        )
        
        raw_response = self._call_ollama(prompt)
        fallback = {
            "summary": ["No se pudo generar el resumen automáticamente."],
            "action_items": [],
            "tone": "Desconocido",
            "category": "Sin categorizar",
            "key_decisions": [],
            "duration_insight": "Análisis no disponible en modo Local."
        }
        return parse_json_response(raw_response, fallback)

    def chat_with_transcript(self, transcript: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        prompt = CHAT_TRANSCRIPT_SYSTEM.format(transcript=transcript) + "\n\n"
        for msg in messages:
            role = "Usuario" if msg["role"] == "user" else "Asistente"
            prompt += f"{role}: {msg['content']}\n\n"
        prompt += f"Usuario: {new_question}\nAsistente:"
        return self._call_ollama(prompt, temperature=0.4)

    def _stream_ollama(self, prompt: str, temperature: float = 0.3):
        payload = {
            "model": self._model,
            "prompt": prompt,
            "stream": True,
            "think": False,
            "options": {
                "temperature": temperature,
                "num_predict": 1024,
                "num_ctx": 8192
            }
        }
        try:
            response = requests.post(self.api_url, json=payload, stream=True, timeout=120)
            response.raise_for_status()
            in_think = False
            for line in response.iter_lines(decode_unicode=True):
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except Exception:
                    continue
                chunk = data.get("response", "")
                if "<think>" in chunk:
                    in_think = True
                    chunk = chunk.replace("<think>", "")
                if "</think>" in chunk:
                    in_think = False
                    chunk = chunk.split("</think>")[-1]
                if not in_think and chunk:
                    yield chunk
                if data.get("done", False):
                    break
        except requests.exceptions.ConnectionError:
            raise RuntimeError("Ollama no está corriendo localmente.")
        except Exception as e:
            raise RuntimeError(f"Error en streaming de Ollama: {e}")

    def stream_chat_with_transcript(self, transcript: str, messages: List[Dict[str, Any]], new_question: str):
        prompt = CHAT_TRANSCRIPT_SYSTEM.format(transcript=transcript) + "\n\n"
        for msg in messages:
            role = "Usuario" if msg["role"] == "user" else "Asistente"
            prompt += f"{role}: {msg['content']}\n\n"
        prompt += f"Usuario: {new_question}\nAsistente:"
        yield from self._stream_ollama(prompt, temperature=0.4)

    def chat_with_history(self, context: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        prompt = CHAT_HISTORY_SYSTEM.format(context=context) + "\n\n"
        for msg in messages:
            role = "Usuario" if msg["role"] == "user" else "Asistente"
            prompt += f"{role}: {msg['content']}\n\n"
        prompt += f"Usuario: {new_question}\nAsistente:"
        return self._call_ollama(prompt, temperature=0.4)

    def stream_chat_with_history(self, context: str, messages: List[Dict[str, Any]], new_question: str):
        prompt = CHAT_HISTORY_SYSTEM.format(context=context) + "\n\n"
        for msg in messages:
            role = "Usuario" if msg["role"] == "user" else "Asistente"
            prompt += f"{role}: {msg['content']}\n\n"
        prompt += f"Usuario: {new_question}\nAsistente:"
        yield from self._stream_ollama(prompt, temperature=0.4)


# ──────────────────────────────────────────────────────────────────────
# PROVEEDOR ESTRATEGIA: CLOUD OPENAI
# ──────────────────────────────────────────────────────────────────────

class CloudOpenAIProvider(IAnalyzer):
    def __init__(self, config: Config):
        self._model = config.get("openai_model", "gpt-4o-mini")
        self.analysis_focus = config.get("analysis_focus", "")
        self.openai_api_key = config.get("openai_api_key", "")
        self.openai_client = None
        self._setup_client()

    @property
    def model(self) -> str:
        return self._model

    @property
    def ai_provider(self) -> str:
        return "openai"

    def set_config(self, config: Config):
        self._model = config.get("openai_model", self._model)
        self.analysis_focus = config.get("analysis_focus", self.analysis_focus)
        self.openai_api_key = config.get("openai_api_key", self.openai_api_key)
        self._setup_client()

    def _setup_client(self):
        if self.openai_api_key:
            try:
                import openai
                self.openai_client = openai.OpenAI(api_key=self.openai_api_key)
            except ImportError:
                print("[CloudOpenAIProvider] Error: módulo openai no está instalado.")
        else:
            self.openai_client = None

    def is_running(self) -> bool:
        return self.openai_client is not None

    def _call_openai(self, prompt: str, temperature: float = 0.3) -> str:
        if not self.openai_client:
            raise RuntimeError("El cliente de OpenAI no está configurado (API Key faltante).")
        try:
            response = self.openai_client.chat.completions.create(
                model=self._model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            raise RuntimeError(f"Error de OpenAI: {e}")

    def diarize_transcript(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not segments:
            return []
        
        formatted_segments = [
            f"[{idx}] {seg.get('start', 0.0):.1f}s - {seg.get('end', 0.0):.1f}s: {seg.get('text', '').strip()}" 
            for idx, seg in enumerate(segments)
        ]
        segments_text = "\n".join(formatted_segments)
        prompt = DIARIZE_PROMPT_TEMPLATE.format(segments_text=segments_text)
        
        raw_response = self._call_openai(prompt)
        speaker_map = parse_json_response(raw_response, {})
        
        diarized_segments = []
        for idx, seg in enumerate(segments):
            speaker = speaker_map.get(str(idx)) or speaker_map.get(idx) or "Hablante A"
            diarized_segments.append({
                "start": seg.get("start", 0.0),
                "end": seg.get("end", 0.0),
                "text": seg.get("text", "").strip(),
                "speaker": speaker
            })
        return diarized_segments

    def analyze(self, transcript: str, bookmarks: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        focus_instruction = f"\nENFOQUE REQUERIDO: {self.analysis_focus}\n" if self.analysis_focus else ""
        bookmarks_instruction = format_bookmarks_instruction(bookmarks)
        prompt = ANALYZE_PROMPT_TEMPLATE.format(
            focus_instruction=focus_instruction, 
            bookmarks_instruction=bookmarks_instruction,
            transcript=transcript
        )
        
        raw_response = self._call_openai(prompt)
        fallback = {
            "summary": ["No se pudo generar el resumen automáticamente."],
            "action_items": [],
            "tone": "Desconocido",
            "category": "Sin categorizar",
            "key_decisions": [],
            "duration_insight": "Análisis no disponible en modo Cloud."
        }
        return parse_json_response(raw_response, fallback)

    def chat_with_transcript(self, transcript: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        if not self.openai_client:
            raise RuntimeError("Cliente de OpenAI no configurado.")
        system_prompt = CHAT_TRANSCRIPT_SYSTEM.format(transcript=transcript)
        openai_messages = [{"role": "system", "content": system_prompt}] + messages + [{"role": "user", "content": new_question}]
        try:
            response = self.openai_client.chat.completions.create(
                model=self._model,
                messages=openai_messages,
                temperature=0.4
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            raise RuntimeError(f"Error OpenAI (Chat): {e}")

    def stream_chat_with_transcript(self, transcript: str, messages: List[Dict[str, Any]], new_question: str):
        if not self.openai_client:
            raise RuntimeError("Cliente de OpenAI no configurado.")
        system_prompt = CHAT_TRANSCRIPT_SYSTEM.format(transcript=transcript)
        openai_messages = [{"role": "system", "content": system_prompt}] + messages + [{"role": "user", "content": new_question}]
        try:
            response = self.openai_client.chat.completions.create(
                model=self._model,
                messages=openai_messages,
                temperature=0.4,
                stream=True
            )
            for chunk in response:
                delta = chunk.choices[0].delta.content if chunk.choices and chunk.choices[0].delta else ""
                if delta:
                    yield delta
        except Exception as e:
            raise RuntimeError(f"Error OpenAI (Chat Stream): {e}")

    def chat_with_history(self, context: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        if not self.openai_client:
            raise RuntimeError("Cliente de OpenAI no configurado.")
        system_prompt = CHAT_HISTORY_SYSTEM.format(context=context)
        openai_messages = [{"role": "system", "content": system_prompt}] + messages + [{"role": "user", "content": new_question}]
        try:
            response = self.openai_client.chat.completions.create(
                model=self._model,
                messages=openai_messages,
                temperature=0.4
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            raise RuntimeError(f"Error OpenAI (Chat Historial): {e}")

    def stream_chat_with_history(self, context: str, messages: List[Dict[str, Any]], new_question: str):
        if not self.openai_client:
            raise RuntimeError("Cliente de OpenAI no configurado.")
        system_prompt = CHAT_HISTORY_SYSTEM.format(context=context)
        openai_messages = [{"role": "system", "content": system_prompt}] + messages + [{"role": "user", "content": new_question}]
        try:
            response = self.openai_client.chat.completions.create(
                model=self._model,
                messages=openai_messages,
                temperature=0.4,
                stream=True
            )
            for chunk in response:
                delta = chunk.choices[0].delta.content if chunk.choices and chunk.choices[0].delta else ""
                if delta:
                    yield delta
        except Exception as e:
            raise RuntimeError(f"Error OpenAI (Chat Historial Stream): {e}")


# ──────────────────────────────────────────────────────────────────────
# PROVEEDOR ESTRATEGIA: CLOUD ANTHROPIC (CLAUDE)
# ──────────────────────────────────────────────────────────────────────

class CloudClaudeProvider(IAnalyzer):
    def __init__(self, config: Config):
        self._model = config.get("claude_model", "claude-3-5-haiku-20241022") or "claude-3-5-haiku-20241022"
        self.analysis_focus = config.get("analysis_focus", "")
        self.anthropic_api_key = (config.get("anthropic_api_key", "") or "").strip()

    @property
    def model(self) -> str:
        return self._model

    @property
    def ai_provider(self) -> str:
        return "claude"

    def set_config(self, config: Config):
        self._model = config.get("claude_model", self._model) or self._model
        self.analysis_focus = config.get("analysis_focus", self.analysis_focus)
        self.anthropic_api_key = (config.get("anthropic_api_key", self.anthropic_api_key) or "").strip()

    def is_running(self) -> bool:
        return bool(self.anthropic_api_key)

    def _call_claude(self, prompt: str, system_prompt: Optional[str] = None, temperature: float = 0.3) -> str:
        if not self.anthropic_api_key:
            raise RuntimeError("La clave API de Anthropic (Claude) no está configurada.")
        
        headers = {
            "x-api-key": self.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        body: Dict[str, Any] = {
            "model": self._model,
            "max_tokens": 4096,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}]
        }
        if system_prompt:
            body["system"] = system_prompt

        try:
            resp = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=body, timeout=120)
            if resp.status_code != 200:
                err_detail = resp.text
                try:
                    err_json = resp.json()
                    err_detail = err_json.get("error", {}).get("message", resp.text)
                except Exception:
                    pass
                raise RuntimeError(f"Error de Claude (Anthropic {resp.status_code}): {err_detail}")
            
            data = resp.json()
            content = data.get("content", [])
            for block in content:
                if block.get("type") == "text":
                    return block.get("text", "").strip()
            return ""
        except requests.exceptions.Timeout:
            raise RuntimeError("Tiempo de espera agotado al conectar con Claude (Anthropic).")
        except Exception as e:
            if isinstance(e, RuntimeError):
                raise e
            raise RuntimeError(f"Error al conectar con Claude (Anthropic): {e}")

    def diarize_transcript(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not segments:
            return []
        
        formatted_segments = [
            f"[{idx}] {seg.get('start', 0.0):.1f}s - {seg.get('end', 0.0):.1f}s: {seg.get('text', '').strip()}" 
            for idx, seg in enumerate(segments)
        ]
        segments_text = "\n".join(formatted_segments)
        prompt = DIARIZE_PROMPT_TEMPLATE.format(segments_text=segments_text)
        
        raw_response = self._call_claude(prompt)
        speaker_map = parse_json_response(raw_response, {})
        
        diarized_segments = []
        for idx, seg in enumerate(segments):
            speaker = speaker_map.get(str(idx)) or speaker_map.get(idx) or "Hablante A"
            diarized_segments.append({
                "start": seg.get("start", 0.0),
                "end": seg.get("end", 0.0),
                "text": seg.get("text", "").strip(),
                "speaker": speaker
            })
        return diarized_segments

    def analyze(self, transcript: str, bookmarks: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        focus_instruction = f"\nENFOQUE REQUERIDO: {self.analysis_focus}\n" if self.analysis_focus else ""
        bookmarks_instruction = format_bookmarks_instruction(bookmarks)
        prompt = ANALYZE_PROMPT_TEMPLATE.format(
            focus_instruction=focus_instruction, 
            bookmarks_instruction=bookmarks_instruction,
            transcript=transcript
        )
        raw_response = self._call_claude(prompt)
        fallback = {
            "summary": ["No se pudo generar el resumen automáticamente."],
            "action_items": [],
            "tone": "Desconocido",
            "category": "Sin categorizar",
            "key_decisions": [],
            "duration_insight": "Análisis no disponible en Claude."
        }
        return parse_json_response(raw_response, fallback)

    def chat_with_transcript(self, transcript: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        system_prompt = CHAT_TRANSCRIPT_SYSTEM.format(transcript=transcript)
        claude_messages = []
        for msg in messages:
            claude_messages.append({
                "role": "user" if msg.get("role") == "user" else "assistant",
                "content": msg.get("content", "")
            })
        claude_messages.append({"role": "user", "content": new_question})
        
        headers = {
            "x-api-key": self.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        body = {
            "model": self._model,
            "max_tokens": 4096,
            "temperature": 0.4,
            "system": system_prompt,
            "messages": claude_messages
        }
        resp = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=body, timeout=120)
        if resp.status_code != 200:
            raise RuntimeError(f"Error Claude Chat ({resp.status_code}): {resp.text}")
        content = resp.json().get("content", [])
        for block in content:
            if block.get("type") == "text":
                return block.get("text", "").strip()
        return ""

    def chat_with_history(self, context: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        system_prompt = CHAT_HISTORY_SYSTEM.format(context=context)
        claude_messages = []
        for msg in messages:
            claude_messages.append({
                "role": "user" if msg.get("role") == "user" else "assistant",
                "content": msg.get("content", "")
            })
        claude_messages.append({"role": "user", "content": new_question})
        
        headers = {
            "x-api-key": self.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        body = {
            "model": self._model,
            "max_tokens": 4096,
            "temperature": 0.4,
            "system": system_prompt,
            "messages": claude_messages
        }
        resp = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=body, timeout=120)
        if resp.status_code != 200:
            raise RuntimeError(f"Error Claude Chat Historial ({resp.status_code}): {resp.text}")
        content = resp.json().get("content", [])
        for block in content:
            if block.get("type") == "text":
                return block.get("text", "").strip()
        return ""


# ──────────────────────────────────────────────────────────────────────
# PROVEEDOR ESTRATEGIA: CLOUD GOOGLE (GEMINI)
# ──────────────────────────────────────────────────────────────────────

class CloudGeminiProvider(IAnalyzer):
    def __init__(self, config: Config):
        self._model = config.get("gemini_model", "gemini-2.0-flash") or "gemini-2.0-flash"
        self.analysis_focus = config.get("analysis_focus", "")
        self.gemini_api_key = (config.get("gemini_api_key", "") or "").strip()

    @property
    def model(self) -> str:
        return self._model

    @property
    def ai_provider(self) -> str:
        return "gemini"

    def set_config(self, config: Config):
        self._model = config.get("gemini_model", self._model) or self._model
        self.analysis_focus = config.get("analysis_focus", self.analysis_focus)
        self.gemini_api_key = (config.get("gemini_api_key", self.gemini_api_key) or "").strip()

    def is_running(self) -> bool:
        return bool(self.gemini_api_key)

    def _call_gemini(self, prompt: str, system_instruction: Optional[str] = None, temperature: float = 0.3) -> str:
        if not self.gemini_api_key:
            raise RuntimeError("La clave API de Google Gemini no está configurada.")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self._model}:generateContent?key={self.gemini_api_key}"
        headers = {"Content-Type": "application/json"}
        
        contents = [{"role": "user", "parts": [{"text": prompt}]}]
        body: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 4096
            }
        }
        if system_instruction:
            body["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        try:
            resp = requests.post(url, headers=headers, json=body, timeout=120)
            if resp.status_code != 200:
                err_detail = resp.text
                try:
                    err_json = resp.json()
                    err_detail = err_json.get("error", {}).get("message", resp.text)
                except Exception:
                    pass
                raise RuntimeError(f"Error de Google Gemini ({resp.status_code}): {err_detail}")
            
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates and "content" in candidates[0]:
                parts = candidates[0]["content"].get("parts", [])
                text_parts = [p.get("text", "") for p in parts if "text" in p]
                return "".join(text_parts).strip()
            return ""
        except requests.exceptions.Timeout:
            raise RuntimeError("Tiempo de espera agotado al conectar con Google Gemini.")
        except Exception as e:
            if isinstance(e, RuntimeError):
                raise e
            raise RuntimeError(f"Error al conectar con Google Gemini: {e}")

    def diarize_transcript(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not segments:
            return []
        
        formatted_segments = [
            f"[{idx}] {seg.get('start', 0.0):.1f}s - {seg.get('end', 0.0):.1f}s: {seg.get('text', '').strip()}" 
            for idx, seg in enumerate(segments)
        ]
        segments_text = "\n".join(formatted_segments)
        prompt = DIARIZE_PROMPT_TEMPLATE.format(segments_text=segments_text)
        
        raw_response = self._call_gemini(prompt)
        speaker_map = parse_json_response(raw_response, {})
        
        diarized_segments = []
        for idx, seg in enumerate(segments):
            speaker = speaker_map.get(str(idx)) or speaker_map.get(idx) or "Hablante A"
            diarized_segments.append({
                "start": seg.get("start", 0.0),
                "end": seg.get("end", 0.0),
                "text": seg.get("text", "").strip(),
                "speaker": speaker
            })
        return diarized_segments

    def analyze(self, transcript: str, bookmarks: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        focus_instruction = f"\nENFOQUE REQUERIDO: {self.analysis_focus}\n" if self.analysis_focus else ""
        bookmarks_instruction = format_bookmarks_instruction(bookmarks)
        prompt = ANALYZE_PROMPT_TEMPLATE.format(
            focus_instruction=focus_instruction, 
            bookmarks_instruction=bookmarks_instruction,
            transcript=transcript
        )
        raw_response = self._call_gemini(prompt)
        fallback = {
            "summary": ["No se pudo generar el resumen automáticamente."],
            "action_items": [],
            "tone": "Desconocido",
            "category": "Sin categorizar",
            "key_decisions": [],
            "duration_insight": "Análisis no disponible en Gemini."
        }
        return parse_json_response(raw_response, fallback)

    def chat_with_transcript(self, transcript: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        system_prompt = CHAT_TRANSCRIPT_SYSTEM.format(transcript=transcript)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self._model}:generateContent?key={self.gemini_api_key}"
        headers = {"Content-Type": "application/json"}
        
        gemini_contents = []
        for msg in messages:
            role = "user" if msg.get("role") == "user" else "model"
            gemini_contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})
        gemini_contents.append({"role": "user", "parts": [{"text": new_question}]})
        
        body = {
            "contents": gemini_contents,
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 4096}
        }
        resp = requests.post(url, headers=headers, json=body, timeout=120)
        if resp.status_code != 200:
            raise RuntimeError(f"Error Gemini Chat ({resp.status_code}): {resp.text}")
        data = resp.json()
        candidates = data.get("candidates", [])
        if candidates and "content" in candidates[0]:
            parts = candidates[0]["content"].get("parts", [])
            return "".join([p.get("text", "") for p in parts if "text" in p]).strip()
        return ""

    def chat_with_history(self, context: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        system_prompt = CHAT_HISTORY_SYSTEM.format(context=context)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self._model}:generateContent?key={self.gemini_api_key}"
        headers = {"Content-Type": "application/json"}
        
        gemini_contents = []
        for msg in messages:
            role = "user" if msg.get("role") == "user" else "model"
            gemini_contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})
        gemini_contents.append({"role": "user", "parts": [{"text": new_question}]})
        
        body = {
            "contents": gemini_contents,
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 4096}
        }
        resp = requests.post(url, headers=headers, json=body, timeout=120)
        if resp.status_code != 200:
            raise RuntimeError(f"Error Gemini Chat Historial ({resp.status_code}): {resp.text}")
        data = resp.json()
        candidates = data.get("candidates", [])
        if candidates and "content" in candidates[0]:
            parts = candidates[0]["content"].get("parts", [])
            return "".join([p.get("text", "") for p in parts if "text" in p]).strip()
        return ""


# ──────────────────────────────────────────────────────────────────────
# CONTEXTO DE LA ESTRATEGIA: ANALYSIS SERVICE
# ──────────────────────────────────────────────────────────────────────

class AnalysisService(IAnalyzer):
    """
    Selecciona el proveedor de IA según la configuración (local, openai, claude, gemini).

    Privacidad: con ai_provider = "local" NUNCA se envía nada a la nube, salvo que el usuario
    haya activado explícitamente `allow_cloud_fallback` (y exista una clave de API configurada).
    """

    def __init__(self, config: Config):
        self._config = config
        self._provider_type = config.get("ai_provider", "local")

        self.local_provider = LocalOllamaProvider(config)
        self.openai_provider = CloudOpenAIProvider(config)
        self.claude_provider = CloudClaudeProvider(config)
        self.gemini_provider = CloudGeminiProvider(config)
        
        # Alias retrocompatible con pruebas existentes
        self.cloud_provider = self.openai_provider

    def _cloud_fallback_allowed(self) -> bool:
        """True solo si el usuario activó el respaldo en la nube y hay algún motor de nube listo."""
        if not bool(self._config.get("allow_cloud_fallback", False)):
            return False
        return (self.openai_provider.is_running() or 
                self.gemini_provider.is_running() or 
                self.claude_provider.is_running())

    def _get_cloud_fallback_provider(self) -> Optional[IAnalyzer]:
        if self.openai_provider.is_running():
            return self.openai_provider
        if self.gemini_provider.is_running():
            return self.gemini_provider
        if self.claude_provider.is_running():
            return self.claude_provider
        return None

    def _pick_provider(self) -> Optional[IAnalyzer]:
        """Proveedor a usar según la configuración actual."""
        if self._provider_type == "openai":
            return self.openai_provider
        elif self._provider_type == "claude":
            return self.claude_provider
        elif self._provider_type == "gemini":
            return self.gemini_provider
        
        # Modo local por defecto
        if self.local_provider.is_running():
            return self.local_provider
        if self._cloud_fallback_allowed():
            fallback = self._get_cloud_fallback_provider()
            if fallback:
                print(f"[AnalysisService] FALLBACK: Ollama no responde. Usando {fallback.ai_provider} (activado por el usuario en Ajustes).")
                return fallback
        return None

    @property
    def active_provider(self) -> IAnalyzer:
        """Proveedor activo (no lanza excepción). En modo local sin Ollama y sin respaldo devuelve el local."""
        return self._pick_provider() or self.local_provider

    def _require_provider(self) -> IAnalyzer:
        """Como active_provider, pero lanza un error claro si no hay ningún motor permitido."""
        provider = self.active_provider
        if provider is self.local_provider and not self.local_provider.is_running():
            raise LocalModelUnavailableError(LOCAL_UNAVAILABLE_MSG)
        return provider

    @property
    def model(self) -> str:
        if self._provider_type == "openai":
            return self.openai_provider.model
        elif self._provider_type == "claude":
            return self.claude_provider.model
        elif self._provider_type == "gemini":
            return self.gemini_provider.model
        if self._cloud_fallback_allowed():
            return self.active_provider.model
        return self.local_provider.model

    @property
    def ai_provider(self) -> str:
        return self._provider_type

    def set_config(self, config: Config):
        self._config = config
        self._provider_type = config.get("ai_provider", self._provider_type)
        self.local_provider.set_config(config)
        self.openai_provider.set_config(config)
        self.claude_provider.set_config(config)
        self.gemini_provider.set_config(config)
        self.cloud_provider = self.openai_provider

    def is_running(self) -> bool:
        if self._provider_type == "openai":
            return self.openai_provider.is_running()
        elif self._provider_type == "claude":
            return self.claude_provider.is_running()
        elif self._provider_type == "gemini":
            return self.gemini_provider.is_running()
        return self.local_provider.is_running() or self._cloud_fallback_allowed()

    def _execute(self, method_name: str, *args, **kwargs):
        """Ejecuta una operación en el proveedor activo; reintenta en la nube solo si está permitido."""
        provider = self._require_provider()
        try:
            return getattr(provider, method_name)(*args, **kwargs)
        except Exception as e:
            print(f"[AnalysisService] Error en {method_name} con {provider.ai_provider}: {e}")
            if provider is self.local_provider and self._cloud_fallback_allowed():
                fallback = self._get_cloud_fallback_provider()
                if fallback:
                    print(f"[AnalysisService] Reintentando {method_name} con {fallback.ai_provider} (activado por el usuario en Ajustes)...")
                    return getattr(fallback, method_name)(*args, **kwargs)
            raise

    def diarize_transcript(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        try:
            return self._execute("diarize_transcript", segments)
        except Exception as e:
            print(f"[AnalysisService] Diarización no disponible, se usará un único hablante: {e}")
            return [{
                "start": seg.get("start", 0.0),
                "end": seg.get("end", 0.0),
                "text": seg.get("text", "").strip(),
                "speaker": "Hablante A"
            } for seg in segments]

    def analyze(self, transcript: str, bookmarks: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        try:
            return self._execute("analyze", transcript, bookmarks=bookmarks)
        except Exception as e:
            return {
                "summary": [f"Error durante el análisis: {e}"],
                "action_items": [],
                "tone": "Desconocido",
                "category": "Error",
                "key_decisions": [],
                "duration_insight": "Revisa el proveedor de IA en Configuración."
            }

    def chat_with_transcript(self, transcript: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        return self._execute("chat_with_transcript", transcript, messages, new_question)

    def chat_with_history(self, context: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        return self._execute("chat_with_history", context, messages, new_question)

    def _execute_stream(self, method_name: str, *args, **kwargs):
        """Ejecuta una operación generadora/streaming en el proveedor activo con fallback automático."""
        provider = self._require_provider()
        try:
            if hasattr(provider, method_name):
                yield from getattr(provider, method_name)(*args, **kwargs)
                return
            # Fallback a método no-stream
            non_stream = method_name.replace("stream_", "")
            res = getattr(provider, non_stream)(*args, **kwargs)
            yield res
            return
        except Exception as e:
            print(f"[AnalysisService] Error en streaming {method_name} con {provider.ai_provider}: {e}")
            if provider is self.local_provider and self._cloud_fallback_allowed():
                fallback = self._get_cloud_fallback_provider()
                if fallback:
                    print(f"[AnalysisService] Reintentando streaming con {fallback.ai_provider}...")
                    if hasattr(fallback, method_name):
                        yield from getattr(fallback, method_name)(*args, **kwargs)
                        return
                    non_stream = method_name.replace("stream_", "")
                    res = getattr(fallback, non_stream)(*args, **kwargs)
                    yield res
                    return
            raise

    def stream_chat_with_transcript(self, transcript: str, messages: List[Dict[str, Any]], new_question: str):
        yield from self._execute_stream("stream_chat_with_transcript", transcript, messages, new_question)

    def stream_chat_with_history(self, context: str, messages: List[Dict[str, Any]], new_question: str):
        yield from self._execute_stream("stream_chat_with_history", context, messages, new_question)
