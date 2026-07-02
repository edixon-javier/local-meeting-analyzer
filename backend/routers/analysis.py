import os
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from state import transcriber, analyzer, session_state
from config_manager import save_meeting_metadata

router = APIRouter()

class TranscribeRequest(BaseModel):
    audio_path: str
    language: Optional[str] = None
    diarize: Optional[bool] = False

class AnalyzeRequest(BaseModel):
    transcript: str
    segments: Optional[list] = None
    audio_path: Optional[str] = None

class ChatRequest(BaseModel):
    audio_path: str
    messages: list
    question: str

@router.post("/chat")
def chat_transcript(request: ChatRequest):
    """Envía un mensaje de chat sobre la transcripción actual."""
    import json
    
    transcript = ""
    # Soportar ambas extensiones
    json_path = request.audio_path.replace(".wav", ".json").replace(".mp3", ".json")
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                transcript = data.get("transcript", "")
        except Exception as e:
            print(f"[Backend] Error cargando metadatos para chat: {e}")
            
    if not transcript:
        transcript = session_state.get("transcript", "")
        
    if not transcript:
        raise HTTPException(status_code=400, detail="No se encontró la transcripción de la reunión.")

    # Validación de límite de memoria local (OOM)
    if analyzer.ai_provider == "local":
        word_count = len(transcript.split())
        if word_count > 6000:
            raise HTTPException(
                status_code=400,
                detail="La reunión es demasiado larga para chatear en modo Local (+45 min). Cambia el motor de IA a OpenAI en Configuración para evitar colapsar la PC."
            )
        
    try:
        response = analyzer.chat_with_transcript(transcript, request.messages, request.question)
        return {"status": "done", "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transcribe")
def transcribe_audio(request: TranscribeRequest, background_tasks: BackgroundTasks):
    """Transcribe un archivo de audio con Whisper local. Puede tardar unos segundos."""
    if not os.path.exists(request.audio_path):
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {request.audio_path}")

    if session_state["processing"]:
        raise HTTPException(status_code=400, detail="Ya hay un proceso de transcripción en curso.")

    session_state["processing"] = True
    try:
        result = transcriber.transcribe(request.audio_path, language=request.language)
        
        segments = result.get("segments", [])
        if request.diarize:
            diarized_segments = analyzer.diarize_transcript(segments)
            segments = diarized_segments
            # Reconstruir la transcripción con formato de diálogo
            rebuilt_text = ""
            for seg in diarized_segments:
                rebuilt_text += f"{seg['speaker']}: {seg['text']}\n\n"
            session_state["transcript"] = rebuilt_text.strip()
        else:
            session_state["transcript"] = result["text"]
            
        session_state["processing"] = False
        return {
            "status": "done",
            "text": session_state["transcript"],
            "language": result["language"],
            "segments": segments
        }
    except Exception as e:
        session_state["processing"] = False
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze")
def analyze_transcript(request: AnalyzeRequest):
    """Analiza el texto de la reunión con Ollama (Phi-3 local) u OpenAI."""
    if not request.transcript.strip():
        print("[Backend] Transcripción vacía. Generando análisis 'Dummy'.")
        dummy_analysis = {
            "summary": ["No se detectó diálogo o voz en esta grabación."],
            "action_items": [],
            "tone": "Silencioso",
            "category": "Vacía",
            "key_decisions": ["El sistema procesó el archivo de audio pero no encontró palabras reconocibles."],
            "duration_insight": "La grabación no contiene audio analizable."
        }
        
        audio_path = request.audio_path if request.audio_path else session_state.get("audio_path")
        save_meeting_metadata(
            audio_path=audio_path,
            transcript=request.transcript,
            analysis=dummy_analysis,
            language=None,
            segments=request.segments
        )
        return {"status": "empty", "analysis": dummy_analysis}

    if analyzer.ai_provider == "local":
        if not analyzer.is_ollama_running():
            raise HTTPException(
                status_code=503,
                detail="Ollama no está corriendo. Inicia Ollama y vuelve a intentarlo."
            )
        
        word_count = len(request.transcript.split())
        if word_count > 6000:
            raise HTTPException(
                status_code=400,
                detail="La reunión es demasiado larga para análisis Local (+45 min). Cambia a OpenAI en Configuración para procesarla sin colapsar tu PC."
            )

    session_state["processing"] = True
    try:
        result = analyzer.analyze(request.transcript)
        session_state["analysis"] = result
        session_state["processing"] = False
        
        # Usar la ruta de audio provista por la UI, o el session_state como fallback
        audio_path = request.audio_path if request.audio_path else session_state.get("audio_path")
        
        # Guardar automáticamente los metadatos en formato JSON
        save_meeting_metadata(
            audio_path=audio_path,
            transcript=request.transcript,
            analysis=result,
            language=None,
            segments=request.segments
        )
        
        return {"status": "done", "analysis": result}
    except Exception as e:
        session_state["processing"] = False
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/processing/cancel")
def cancel_processing():
    """Cancela el proceso activo restableciendo el estado de procesamiento."""
    session_state["processing"] = False
    print("[Backend] Procesamiento cancelado por petición del usuario.")
    return {"status": "cancelled"}
