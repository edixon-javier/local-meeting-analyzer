"""
analyzer.py
Analiza el texto de una reunión usando Ollama (LLM local).
Genera: Resumen, Tareas Pendientes, Tono, Categoría.
"""

import requests
import json
import re
from typing import Optional

OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "phi3"

class Analyzer:
    def __init__(self, model: str = DEFAULT_MODEL):
        self.model = model
        self.api_url = f"{OLLAMA_BASE_URL}/api/generate"
        self.analysis_focus = ""
        self.ai_provider = "local"
        self.openai_api_key = ""
        self.openai_model = "gpt-4o-mini"
        self.openai_client = None

    def set_config(self, config: dict):
        """Configura el modelo y el enfoque de análisis de forma dinámica."""
        self.model = config.get("ollama_model", self.model)
        self.analysis_focus = config.get("analysis_focus", self.analysis_focus)
        self.ai_provider = config.get("ai_provider", self.ai_provider)
        self.openai_api_key = config.get("openai_api_key", self.openai_api_key)
        self.openai_model = config.get("openai_model", self.openai_model)
        
        if self.ai_provider == "openai" and self.openai_api_key:
            try:
                import openai
                self.openai_client = openai.OpenAI(api_key=self.openai_api_key)
            except ImportError:
                print("[Analyzer] Error: módulo openai no está instalado.")

    def diarize_transcript(self, segments: list) -> list:
        """
        Utiliza Ollama para realizar diarización textual (separación de hablantes)
        a partir de los segmentos y sus marcas de tiempo.
        """
        if not segments:
            return []

        print(f"[Analyzer] Diarizando transcripción con {self.model} (diarización de texto)...")
        
        # Formatear segmentos para la consulta
        formatted_segments = []
        for idx, seg in enumerate(segments):
            formatted_segments.append(f"[{idx}] {seg.get('start', 0.0):.1f}s - {seg.get('end', 0.0):.1f}s: {seg.get('text', '').strip()}")
        
        segments_text = "\n".join(formatted_segments)
        
        prompt = f"""Eres un asistente de transcripción experto en diarización (separación de hablantes) para reuniones en español.
Analiza la siguiente lista de segmentos de diálogo y determina qué hablante está hablando en cada uno.
Usa etiquetas genéricas como "Hablante A", "Hablante B", "Hablante C", etc. Si en el diálogo se mencionan nombres propios de forma clara e identificable con el hablante, usa sus nombres reales.

Responde ÚNICAMENTE con un objeto JSON que asocie el índice del segmento (como cadena de texto) con el nombre del hablante identificado.
No agregues explicaciones, markdown, ni código. Devuelve SOLO el JSON crudo.

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
            if self.ai_provider == "openai":
                raw_response = self._call_openai(prompt)
            else:
                raw_response = self._call_ollama(prompt)
            # Extraer JSON si hay texto extra
            json_match = re.search(r'\{.*\}', raw_response, re.DOTALL)
            if json_match:
                speaker_map = json.loads(json_match.group())
            else:
                speaker_map = json.loads(raw_response)
            
            # Mapear los hablantes a los segmentos correspondientes
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
            print(f"[Analyzer] Error durante la diarización: {e}. Usando fallback.")
            # Fallback
            diarized_segments = []
            for seg in segments:
                diarized_segments.append({
                    "start": seg.get("start", 0.0),
                    "end": seg.get("end", 0.0),
                    "text": seg.get("text", "").strip(),
                    "speaker": "Hablante A"
                })
            return diarized_segments

    def _call_ollama(self, prompt: str) -> str:
        """Realiza una llamada a la API local de Ollama."""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,  # Respuestas más deterministas y consistentes
                "num_predict": 1024,
                "num_ctx": 8192       # Evita que Ollama reserve 50GB de caché de contexto para Phi-3
            }
        }
        try:
            response = requests.post(self.api_url, json=payload, timeout=120)
            response.raise_for_status()
            return response.json().get("response", "").strip()
        except requests.exceptions.ConnectionError:
            raise RuntimeError("Ollama no está corriendo. Asegúrate de que el servicio esté activo.")
        except Exception as e:
            raise RuntimeError(f"Error al comunicarse con Ollama: {e}")

    def _call_openai(self, prompt: str) -> str:
        """Realiza una llamada a la API de OpenAI."""
        if not self.openai_client:
            raise RuntimeError("El cliente de OpenAI no está configurado (API Key faltante).")
        try:
            response = self.openai_client.chat.completions.create(
                model=self.openai_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            raise RuntimeError(f"Error al comunicarse con OpenAI: {e}")

    def is_ollama_running(self) -> bool:
        """Verifica si Ollama está disponible."""
        try:
            response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
            return response.status_code == 200
        except:
            return False

    def analyze(self, transcript: str) -> dict:
        """
        Realiza un análisis completo del texto de la reunión.
        
        Returns:
            dict con: summary, action_items, tone, category, key_decisions
        """
        print(f"[Analyzer] Analizando transcripción con {self.model}...")

        focus_instruction = ""
        if hasattr(self, "analysis_focus") and self.analysis_focus:
            focus_instruction = f"\nENFOQUE DE ANÁLISIS REQUERIDO POR EL USUARIO: {self.analysis_focus}\n(Debes priorizar este enfoque al generar el resumen, las decisiones clave y las tareas pendientes)."

        # Prompt principal con todo el análisis en un solo call para eficiencia
        prompt = f"""Eres un asistente especializado en análisis de reuniones. Analiza la siguiente transcripción y responde EXCLUSIVAMENTE en el formato JSON indicado. No incluyas texto adicional fuera del JSON.{focus_instruction}

TRANSCRIPCIÓN:
\"\"\"
{transcript}
\"\"\"

Responde SOLO con este JSON (sin markdown, sin explicaciones extra):
{{
  "summary": ["Punto clave 1 de la reunión", "Punto clave 2 de la reunión", "Punto clave 3 de la reunión"],
  "action_items": [
    {{"task": "Descripción de la tarea", "assignee": "Persona responsable o 'Sin asignar'", "deadline": "Fecha mencionada o 'Sin fecha'"}}
  ],
  "tone": "Una palabra que describe el tono general: Formal / Informal / Tenso / Colaborativo / Técnico / Motivacional",
  "category": "Tipo de reunión: Revisión de Sprint / Planificación / Toma de Decisiones / Actualización de Equipo / Lluvia de Ideas / Cliente / Otro",
  "key_decisions": ["Decisión 1 tomada en la reunión", "Decisión 2"],
  "duration_insight": "Breve observación sobre el contenido o densidad de la reunión"
}}"""

        if self.ai_provider == "openai":
            raw_response = self._call_openai(prompt)
        else:
            raw_response = self._call_ollama(prompt)

        try:
            # Intentar parsear el JSON directamente
            result = json.loads(raw_response)
        except json.JSONDecodeError:
            # Si hay texto extra, intentar extraer el bloque JSON con regex
            json_match = re.search(r'\{.*\}', raw_response, re.DOTALL)
            if json_match:
                try:
                    result = json.loads(json_match.group())
                except:
                    result = self._fallback_analysis(transcript)
            else:
                result = self._fallback_analysis(transcript)

        print(f"[Analyzer] Análisis completado.")
        return result

    def chat_with_transcript(self, transcript: str, messages: list, new_question: str) -> str:
        """
        Permite hacer Q&A sobre la transcripción de la reunión.
        """
        system_prompt = f"""Eres un asistente de IA experto que responde preguntas basándose ÚNICAMENTE en la siguiente transcripción de una reunión.
Si la transcripción no contiene la respuesta, indica que no se menciona en la reunión. Responde de forma clara, directa y estructurada.

TRANSCRIPCIÓN:
\"\"\"
{transcript}
\"\"\"
"""
        if self.ai_provider == "openai":
            if not self.openai_client:
                raise RuntimeError("El cliente de OpenAI no está configurado (API Key faltante).")
            openai_messages = [{"role": "system", "content": system_prompt}]
            for msg in messages:
                openai_messages.append({"role": msg["role"], "content": msg["content"]})
            openai_messages.append({"role": "user", "content": new_question})
            
            try:
                response = self.openai_client.chat.completions.create(
                    model=self.openai_model,
                    messages=openai_messages,
                    temperature=0.4
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                raise RuntimeError(f"Error al comunicarse con OpenAI (Chat): {e}")
        else:
            prompt = system_prompt + "\n\n"
            for msg in messages:
                role = "Usuario" if msg["role"] == "user" else "Asistente"
                prompt += f"{role}: {msg['content']}\n\n"
            prompt += f"Usuario: {new_question}\nAsistente:"
            
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.4,
                    "num_predict": 1024,
                    "num_ctx": 8192
                }
            }
            try:
                response = requests.post(self.api_url, json=payload, timeout=120)
                response.raise_for_status()
                return response.json().get("response", "").strip()
            except Exception as e:
                raise RuntimeError(f"Error al comunicarse con Ollama (Chat): {e}")

    def _fallback_analysis(self, transcript: str) -> dict:
        """Análisis de respaldo si Ollama no retorna JSON válido."""
        return {
            "summary": ["No se pudo generar el resumen automáticamente.", "Revisa la transcripción manualmente.", "Verifica que el modelo esté correctamente configurado."],
            "action_items": [],
            "tone": "Desconocido",
            "category": "Sin categorizar",
            "key_decisions": [],
            "duration_insight": "Análisis no disponible."
        }
