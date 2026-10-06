import requests
import json
import re
import sys
from typing import Optional, Dict, Any, List
from domain.interfaces import IAnalyzer
from core.config import Config

OLLAMA_BASE_URL = "http://localhost:11434"

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

CHAT_TRANSCRIPT_SYSTEM = """Eres un asistente de IA experto que responde preguntas basándose ÚNICAMENTE en la transcripción de una reunión.
TRANSCRIPCIÓN:
\"\"\"
{transcript}
\"\"\"
"""

CHAT_HISTORY_SYSTEM = """Eres un asistente de IA experto que responde preguntas sobre el historial de reuniones del usuario basándose en el siguiente contexto de reuniones.
Para cada dato o respuesta, debes citar explícitamente el nombre de la reunión y la fecha correspondiente.
Si el contexto no contiene la información para responder, dilo claramente.

CONTEXTO DE REUNIONES:
\"\"\"
{context}
\"\"\"
"""

def parse_json_response(raw_response: str, fallback_value: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return json.loads(raw_response)
    except json.JSONDecodeError:
        json_match = re.search(r'\{.*\}', raw_response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except:
                pass
        return fallback_value

# ──────────────────────────────────────────────────────────────────────
# PROVEEDOR ESTRATEGIA: OLLAMA LOCAL
# ──────────────────────────────────────────────────────────────────────

class LocalOllamaProvider(IAnalyzer):
    def __init__(self, config: Config):
        self._model = config.get("ollama_model", "phi3")
        self.analysis_focus = config.get("analysis_focus", "")
        self.api_url = f"{OLLAMA_BASE_URL}/api/generate"

    @property
    def model(self) -> str:
        return self._model

    @property
    def ai_provider(self) -> str:
        return "local"

    def set_config(self, config: Config):
        self._model = config.get("ollama_model", self._model)
        self.analysis_focus = config.get("analysis_focus", self.analysis_focus)

    def is_running(self) -> bool:
        try:
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
            return response.status_code == 200
        except:
            return False

    def _call_ollama(self, prompt: str, temperature: float = 0.3) -> str:
        payload = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": 1024,
                "num_ctx": 8192
            }
        }
        try:
            response = requests.post(self.api_url, json=payload, timeout=120)
            response.raise_for_status()
            return response.json().get("response", "").strip()
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

    def chat_with_history(self, context: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        prompt = CHAT_HISTORY_SYSTEM.format(context=context) + "\n\n"
        for msg in messages:
            role = "Usuario" if msg["role"] == "user" else "Asistente"
            prompt += f"{role}: {msg['content']}\n\n"
        prompt += f"Usuario: {new_question}\nAsistente:"
        return self._call_ollama(prompt, temperature=0.4)


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

    def is_running(self) -> bool:
        # Asumimos que OpenAI está operativo si el cliente tiene API key
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


# ──────────────────────────────────────────────────────────────────────
# CONTEXTO DE LA ESTRATEGIA: ANALYSIS SERVICE
# ──────────────────────────────────────────────────────────────────────

class AnalysisService(IAnalyzer):
    def __init__(self, config: Config):
        self._config = config
        self._provider_type = config.get("ai_provider", "local")
        
        self.local_provider = LocalOllamaProvider(config)
        self.cloud_provider = CloudOpenAIProvider(config)

    @property
    def active_provider(self) -> IAnalyzer:
        # Retorna el proveedor activo. Si se pide local pero no está corriendo,
        # e ingresó API Key, hace fallback automático a OpenAI.
        if self._provider_type == "local":
            if self.local_provider.is_running():
                return self.local_provider
            elif self.cloud_provider.is_running():
                print("[AnalysisService] FALLBACK: Ollama está caído. Redirigiendo a OpenAI temporalmente.")
                return self.cloud_provider
        return self.cloud_provider

    @property
    def model(self) -> str:
        return self.active_provider.model

    @property
    def ai_provider(self) -> str:
        # Devuelve el proveedor configurado (no necesariamente el de fallback en uso,
        # para respetar la UI, pero el comportamiento interno será dinámico)
        return self._provider_type

    def set_config(self, config: Config):
        self._config = config
        self._provider_type = config.get("ai_provider", self._provider_type)
        self.local_provider.set_config(config)
        self.cloud_provider.set_config(config)

    def is_running(self) -> bool:
        # Retorna True si el proveedor seleccionado está listo o si el fallback es viable
        if self._provider_type == "local":
            return self.local_provider.is_running() or self.cloud_provider.is_running()
        return self.cloud_provider.is_running()

    def diarize_transcript(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        provider = self.active_provider
        try:
            return provider.diarize_transcript(segments)
        except Exception as e:
            print(f"[AnalysisService] Error en diarización con {provider.ai_provider}: {e}")
            # Si falló local, intentar fallback forzado a cloud
            if provider == self.local_provider and self.cloud_provider.is_running():
                print("[AnalysisService] Reintentando diarización con Cloud OpenAI...")
                try:
                    return self.cloud_provider.diarize_transcript(segments)
                except Exception as ex:
                    print(f"[AnalysisService] Falló también diarización cloud: {ex}")
            
            # Fallback a un único hablante
            return [{
                "start": seg.get("start", 0.0),
                "end": seg.get("end", 0.0),
                "text": seg.get("text", "").strip(),
                "speaker": "Hablante A"
            } for seg in segments]

    def analyze(self, transcript: str, bookmarks: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        provider = self.active_provider
        try:
            return provider.analyze(transcript, bookmarks=bookmarks)
        except Exception as e:
            print(f"[AnalysisService] Error en análisis con {provider.ai_provider}: {e}")
            # Fallback en caliente
            if provider == self.local_provider and self.cloud_provider.is_running():
                print("[AnalysisService] Reintentando análisis con Cloud OpenAI...")
                try:
                    return self.cloud_provider.analyze(transcript, bookmarks=bookmarks)
                except Exception as ex:
                    print(f"[AnalysisService] Falló también análisis cloud: {ex}")
            
            return {
                "summary": [f"Error durante el análisis: {e}"],
                "action_items": [],
                "tone": "Desconocido",
                "category": "Error",
                "key_decisions": [],
                "duration_insight": "Intenta cambiar de motor de IA en Configuración."
            }

    def chat_with_transcript(self, transcript: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        provider = self.active_provider
        try:
            return provider.chat_with_transcript(transcript, messages, new_question)
        except Exception as e:
            if provider == self.local_provider and self.cloud_provider.is_running():
                print("[AnalysisService] Fallback de Chat a OpenAI...")
                return self.cloud_provider.chat_with_transcript(transcript, messages, new_question)
            raise e

    def chat_with_history(self, context: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        provider = self.active_provider
        try:
            return provider.chat_with_history(context, messages, new_question)
        except Exception as e:
            if provider == self.local_provider and self.cloud_provider.is_running():
                print("[AnalysisService] Fallback de Chat Historial a OpenAI...")
                return self.cloud_provider.chat_with_history(context, messages, new_question)
            raise e
