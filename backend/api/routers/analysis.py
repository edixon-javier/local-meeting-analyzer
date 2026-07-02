import os
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional
from domain.interfaces import ITranscriber, IAnalyzer, IMetadataRepository
from services.session_manager import SessionManager
from api.routers.system import get_transcriber, get_analyzer, get_session_manager
from api.routers.history import get_metadata_repo

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
def chat_transcript(
    request: ChatRequest,
    analyzer: IAnalyzer = Depends(get_analyzer),
    session: SessionManager = Depends(get_session_manager),
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """Envía un mensaje de chat sobre la transcripción actual."""
    transcript = ""
    json_path = request.audio_path.replace(".wav", ".json").replace(".mp3", ".json")
    
    meta = repo.get_metadata(json_path)
    if meta:
        transcript = meta.get("transcript", "")
            
    if not transcript:
        transcript = session.get_transcript() or ""
        
    if not transcript:
        raise HTTPException(status_code=400, detail="No se encontró la transcripción de la reunión.")

    if analyzer.ai_provider == "local":
        word_count = len(transcript.split())
        if word_count > 6000:
            raise HTTPException(
                status_code=400,
                detail="La reunión es demasiado larga para chatear en modo Local (+45 min). Cambia el motor de IA a OpenAI."
            )
        
    try:
        response = analyzer.chat_with_transcript(transcript, request.messages, request.question)
        return {"status": "done", "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transcribe")
def transcribe_audio(
    request: TranscribeRequest,
    background_tasks: BackgroundTasks,
    transcriber: ITranscriber = Depends(get_transcriber),
    analyzer: IAnalyzer = Depends(get_analyzer),
    session: SessionManager = Depends(get_session_manager)
):
    """Transcribe un archivo de audio con Whisper local. Puede tardar unos segundos."""
    if not os.path.exists(request.audio_path):
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {request.audio_path}")

    if session.is_processing():
        raise HTTPException(status_code=400, detail="Ya hay un proceso de transcripción en curso.")

    session.set_processing(True)
    try:
        result = transcriber.transcribe(request.audio_path, language=request.language)
        
        segments = result.get("segments", [])
        if request.diarize:
            diarized_segments = analyzer.diarize_transcript(segments)
            segments = diarized_segments
            rebuilt_text = ""
            for seg in diarized_segments:
                rebuilt_text += f"{seg['speaker']}: {seg['text']}\n\n"
            session.set_transcript(rebuilt_text.strip())
        else:
            session.set_transcript(result["text"])
            
        session.set_processing(False)
        return {
            "status": "done",
            "text": session.get_transcript(),
            "language": result["language"],
            "segments": segments
        }
    except Exception as e:
        session.set_processing(False)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze")
def analyze_transcript(
    request: AnalyzeRequest,
    analyzer: IAnalyzer = Depends(get_analyzer),
    session: SessionManager = Depends(get_session_manager),
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """Analiza el texto de la reunión con Ollama (Phi-3 local) u OpenAI."""
    if not request.transcript.strip():
        print("[API] Transcripción vacía. Generando análisis 'Dummy'.")
        dummy_analysis = {
            "summary": ["No se detectó diálogo o voz en esta grabación."],
            "action_items": [],
            "tone": "Silencioso",
            "category": "Vacía",
            "key_decisions": ["El sistema procesó el archivo de audio pero no encontró palabras reconocibles."],
            "duration_insight": "La grabación no contiene audio analizable."
        }
        
        audio_path = request.audio_path if request.audio_path else session.get_audio_path()
        repo.save_meeting_metadata(
            audio_path=audio_path,
            transcript=request.transcript,
            analysis=dummy_analysis,
            language=None,
            segments=request.segments
        )
        return {"status": "empty", "analysis": dummy_analysis}

    if analyzer.ai_provider == "local":
        if not analyzer.is_running():
            raise HTTPException(
                status_code=503,
                detail="Ollama no está corriendo. Inicia Ollama y vuelve a intentarlo."
            )
        
        word_count = len(request.transcript.split())
        if word_count > 6000:
            raise HTTPException(
                status_code=400,
                detail="La reunión es demasiado larga para análisis Local (+45 min). Cambia a OpenAI."
            )

    session.set_processing(True)
    try:
        result = analyzer.analyze(request.transcript)
        session.set_analysis(result)
        session.set_processing(False)
        
        audio_path = request.audio_path if request.audio_path else session.get_audio_path()
        
        repo.save_meeting_metadata(
            audio_path=audio_path,
            transcript=request.transcript,
            analysis=result,
            language=None,
            segments=request.segments
        )
        
        return {"status": "done", "analysis": result}
    except Exception as e:
        session.set_processing(False)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/processing/cancel")
def cancel_processing(session: SessionManager = Depends(get_session_manager)):
    """Cancela el proceso activo restableciendo el estado de procesamiento."""
    session.set_processing(False)
    print("[API] Procesamiento cancelado por petición del usuario.")
    return {"status": "cancelled"}
