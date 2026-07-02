import requests
import json
import re
from typing import Optional, Dict, Any, List
from domain.interfaces import IAnalyzer
from core.config import Config

OLLAMA_BASE_URL = "http://localhost:11434"

class AnalysisService(IAnalyzer):
    def __init__(self, config: Config):
        self._model = config.get("ollama_model", "phi3")
        self.api_url = f"{OLLAMA_BASE_URL}/api/generate"
        self.analysis_focus = config.get("analysis_focus", "")
        self._ai_provider = config.get("ai_provider", "local")
        self.openai_api_key = config.get("openai_api_key", "")
        self.openai_model = config.get("openai_model", "gpt-4o-mini")
        self.openai_client = None
        self._setup_openai()

    @property
    def model(self) -> str:
        return self._model

    @property
    def ai_provider(self) -> str:
        return self._ai_provider

    def set_config(self, config: Config):
        self._model = config.get("ollama_model", self._model)
        self.analysis_focus = config.get("analysis_focus", self.analysis_focus)
        self._ai_provider = config.get("ai_provider", self._ai_provider)
        self.openai_api_key = config.get("openai_api_key", self.openai_api_key)
        self.openai_model = config.get("openai_model", self.openai_model)
        self._setup_openai()

    def _setup_openai(self):
        if self._ai_provider == "openai" and self.openai_api_key:
            try:
                import openai
                self.openai_client = openai.OpenAI(api_key=self.openai_api_key)
            except ImportError:
                print("[AnalysisService] Error: módulo openai no está instalado.")

    def is_running(self) -> bool:
        if self._ai_provider == "openai":
            return True # Asumimos OpenAI online
        try:
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
            return response.status_code == 200
        except:
            return False

    def diarize_transcript(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not segments:
            return []

        print(f"[AnalysisService] Diarizando con {self._model} (diarización de texto)...")
        
        formatted_segments = [f"[{idx}] {seg.get('start', 0.0):.1f}s - {seg.get('end', 0.0):.1f}s: {seg.get('text', '').strip()}" for idx, seg in enumerate(segments)]
        segments_text = "\n".join(formatted_segments)
        
        prompt = f"""Eres un asistente de transcripción experto en diarización para reuniones en español.
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
        try:
            if self._ai_provider == "openai":
                raw_response = self._call_openai(prompt)
            else:
                raw_response = self._call_ollama(prompt)
                
            json_match = re.search(r'\{.*\}', raw_response, re.DOTALL)
            speaker_map = json.loads(json_match.group()) if json_match else json.loads(raw_response)
            
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
        except Exception as e:
            print(f"[AnalysisService] Error durante diarización: {e}. Usando fallback.")
            return [{
                "start": seg.get("start", 0.0),
                "end": seg.get("end", 0.0),
                "text": seg.get("text", "").strip(),
                "speaker": "Hablante A"
            } for seg in segments]

    def analyze(self, transcript: str) -> Dict[str, Any]:
        print(f"[AnalysisService] Analizando con {self._model}...")

        focus_instruction = f"\nENFOQUE REQUERIDO: {self.analysis_focus}\n" if self.analysis_focus else ""

        prompt = f"""Eres un asistente especializado en análisis de reuniones. Analiza la siguiente transcripción y responde EXCLUSIVAMENTE en el formato JSON indicado. No incluyas texto adicional fuera del JSON.{focus_instruction}

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

        if self._ai_provider == "openai":
            raw_response = self._call_openai(prompt)
        else:
            raw_response = self._call_ollama(prompt)

        try:
            return json.loads(raw_response)
        except json.JSONDecodeError:
            json_match = re.search(r'\{.*\}', raw_response, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except:
                    pass
            return self._fallback_analysis()

    def chat_with_transcript(self, transcript: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        system_prompt = f"""Eres un asistente de IA experto que responde preguntas basándose ÚNICAMENTE en la transcripción de una reunión.
TRANSCRIPCIÓN:
\"\"\"
{transcript}
\"\"\"
"""
        if self._ai_provider == "openai":
            if not self.openai_client:
                raise RuntimeError("Cliente de OpenAI no configurado.")
            openai_messages = [{"role": "system", "content": system_prompt}] + messages + [{"role": "user", "content": new_question}]
            
            try:
                response = self.openai_client.chat.completions.create(
                    model=self.openai_model,
                    messages=openai_messages,
                    temperature=0.4
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                raise RuntimeError(f"Error OpenAI (Chat): {e}")
        else:
            prompt = system_prompt + "\n\n"
            for msg in messages:
                role = "Usuario" if msg["role"] == "user" else "Asistente"
                prompt += f"{role}: {msg['content']}\n\n"
            prompt += f"Usuario: {new_question}\nAsistente:"
            
            return self._call_ollama(prompt, temperature=0.4)

    def chat_with_history(self, context: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        system_prompt = f"""Eres un asistente de IA experto que responde preguntas sobre el historial de reuniones del usuario basándose en el siguiente contexto de reuniones.
Para cada dato o respuesta, debes citar explícitamente el nombre de la reunión y la fecha correspondiente.
Si el contexto no contiene la información para responder, dilo claramente.

CONTEXTO DE REUNIONES:
\"\"\"
{context}
\"\"\"
"""
        if self._ai_provider == "openai":
            if not self.openai_client:
                raise RuntimeError("Cliente de OpenAI no configurado.")
            openai_messages = [{"role": "system", "content": system_prompt}] + messages + [{"role": "user", "content": new_question}]
            
            try:
                response = self.openai_client.chat.completions.create(
                    model=self.openai_model,
                    messages=openai_messages,
                    temperature=0.4
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                raise RuntimeError(f"Error OpenAI (Chat Historial): {e}")
        else:
            prompt = system_prompt + "\n\n"
            for msg in messages:
                role = "Usuario" if msg["role"] == "user" else "Asistente"
                prompt += f"{role}: {msg['content']}\n\n"
            prompt += f"Usuario: {new_question}\nAsistente:"
            
            return self._call_ollama(prompt, temperature=0.4)

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
            raise RuntimeError("Ollama no está corriendo.")
        except Exception as e:
            raise RuntimeError(f"Error Ollama: {e}")

    def _call_openai(self, prompt: str) -> str:
        if not self.openai_client:
            raise RuntimeError("Cliente OpenAI no configurado.")
        try:
            response = self.openai_client.chat.completions.create(
                model=self.openai_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            raise RuntimeError(f"Error OpenAI: {e}")

    def _fallback_analysis(self) -> Dict[str, Any]:
        return {
            "summary": ["No se pudo generar el resumen automáticamente."],
            "action_items": [],
            "tone": "Desconocido",
            "category": "Sin categorizar",
            "key_decisions": [],
            "duration_insight": "Análisis no disponible."
        }
