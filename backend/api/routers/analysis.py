import os
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional
from domain.interfaces import ITranscriber, IAnalyzer, IMetadataRepository
from services.session_manager import SessionManager
from api.routers.system import get_transcriber, get_analyzer, get_session_manager
from api.routers.history import get_metadata_repo, _get_json_path, _get_recordings_dir, SUPPORTED_AUDIO_EXTS

router = APIRouter()

class TranscribeRequest(BaseModel):
    audio_path: str
    language: Optional[str] = None
    diarize: Optional[bool] = False

class AnalyzeRequest(BaseModel):
    transcript: str
    segments: Optional[list] = None
    audio_path: Optional[str] = None
    bookmarks: Optional[list] = None

class ChatRequest(BaseModel):
    audio_path: str
    messages: list
    question: str

class HistoryChatRequest(BaseModel):
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
    json_path = _get_json_path(request.audio_path)
    
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

@router.post("/chat/history")
def chat_history(
    request: HistoryChatRequest,
    analyzer: IAnalyzer = Depends(get_analyzer),
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """Envía un mensaje de chat consultando todo el historial de reuniones usando RAG."""
    from api.routers.history import _get_recordings_dir, _get_json_path
    recordings_dir = _get_recordings_dir()
    
    if not os.path.exists(recordings_dir):
        return {
            "status": "done", 
            "response": "No tienes grabaciones en el historial todavía. Graba o importa una reunión para empezar a chatear.", 
            "referenced_meetings": []
        }
    
    # Cargar metadatos de todas las reuniones
    meetings = []
    for f in os.listdir(recordings_dir):
        if f.lower().endswith(SUPPORTED_AUDIO_EXTS):
            audio_path = os.path.join(recordings_dir, f)
            json_path = _get_json_path(audio_path)
            meta = repo.get_metadata(json_path)
            if meta and meta.get("transcript"):
                meetings.append(meta)
                
    if not meetings:
        return {
            "status": "done", 
            "response": "No hay reuniones transcritas ni analizadas en tu historial para realizar la consulta.", 
            "referenced_meetings": []
        }
        
    # RAG: Algoritmo de ranking de relevancia por palabra clave
    query = request.question.lower().strip()
    import string
    translator = str.maketrans('', '', string.punctuation)
    query_clean = query.translate(translator)
    query_terms = [word for word in query_clean.split() if len(word) > 2]
    
    # Stop words comunes en español
    stop_words = {"para", "como", "con", "una", "uno", "unos", "unas", "este", "esta", "estos", "estas", "todo", "toda", "todos", "todas", "pero", "sino", "sobre", "entre", "desde", "hacia", "hasta"}
    query_terms = [term for term in query_terms if term not in stop_words]
    
    if not query_terms and query:
        query_terms = [query]
        
    scored_meetings = []
    for meeting in meetings:
        score = 0.0
        filename = meeting.get("filename", "").lower()
        transcript = meeting.get("transcript", "").lower()
        analysis = meeting.get("analysis") or {}
        category = analysis.get("category", "").lower()
        tone = analysis.get("tone", "").lower()
        summary = " ".join(analysis.get("summary", [])).lower()
        decisions = " ".join(analysis.get("key_decisions", [])).lower()
        
        matched_snippets = []
        
        for term in query_terms:
            if term in filename:
                score += 5.0
            if term in category or term in tone:
                score += 2.0
            if term in summary:
                score += 3.0
            if term in decisions:
                score += 3.0
            matches_in_trans = transcript.count(term)
            if matches_in_trans > 0:
                score += min(matches_in_trans * 0.5, 5.0)
                
                # Extraer fragmentos
                start_idx = 0
                for _ in range(3):
                    pos = transcript.find(term, start_idx)
                    if pos == -1:
                        break
                    left = max(0, pos - 70)
                    right = min(len(transcript), pos + len(term) + 70)
                    snippet = meeting["transcript"][left:right].strip()
                    if left > 0:
                        snippet = "..." + snippet
                    if right < len(transcript):
                        snippet = snippet + "..."
                    matched_snippets.append(snippet)
                    start_idx = pos + len(term) + 1
                    
        scored_meetings.append({
            "meeting": meeting,
            "score": score,
            "snippets": matched_snippets[:3]
        })
        
    scored_meetings.sort(key=lambda x: x["score"], reverse=True)
    
    top_entries = []
    if scored_meetings and scored_meetings[0]["score"] > 0:
        top_entries = [item for item in scored_meetings if item["score"] > 0][:3]
    else:
        # Fallback: las 2 más recientes
        sorted_by_date = sorted(scored_meetings, key=lambda x: x["meeting"].get("created", 0), reverse=True)
        top_entries = sorted_by_date[:2]
        
    context_parts = []
    referenced_meetings = []
    
    for entry in top_entries:
        meet = entry["meeting"]
        filename = meet.get("filename", "")
        created = meet.get("created")
        import datetime
        date_str = datetime.datetime.fromtimestamp(created).strftime('%d/%m/%Y %H:%M') if created else "Fecha desconocida"
        
        meet_analysis = meet.get("analysis") or {}
        category = meet_analysis.get("category", "Sin categoría")
        summary_points = "\n".join([f"- {p}" for p in meet_analysis.get("summary", [])])
        decisions_points = "\n".join([f"- {d}" for d in meet_analysis.get("key_decisions", [])])
        
        snippets_text = ""
        if entry["snippets"]:
            snippets_text = "\nFragmentos coincidentes de la transcripción:\n" + "\n".join([f"  * {s}" for s in entry["snippets"]])
            
        context_parts.append(
            f"REUNIÓN: {filename}\n"
            f"FECHA: {date_str}\n"
            f"CATEGORÍA: {category}\n"
            f"RESUMEN:\n{summary_points}\n"
            f"DECISIONES CLAVE:\n{decisions_points}"
            f"{snippets_text}\n"
            f"---"
        )
        
        referenced_meetings.append({
            "filename": filename,
            "created": created,
            "path": meet.get("audio_path"),
            "category": category,
            "tone": meet_analysis.get("tone", "Desconocido")
        })
        
    context_str = "\n\n".join(context_parts)
    
    if analyzer.ai_provider == "local":
        word_count = len(context_str.split())
        if word_count > 6000:
            context_words = context_str.split()[:5000]
            context_str = " ".join(context_words) + "\n...[Contexto truncado por límite de tamaño]..."
            
    try:
        response = analyzer.chat_with_history(context_str, request.messages, request.question)
        return {
            "status": "done",
            "response": response,
            "referenced_meetings": referenced_meetings
        }
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
            
        # Guardar metadatos parciales para permitir reanudación si se corta la conexión
        from api.routers.history import get_metadata_repo
        repo = get_metadata_repo()
        repo.save_meeting_metadata(
            audio_path=request.audio_path,
            transcript=session.get_transcript(),
            analysis=None,
            language=result["language"],
            segments=segments,
            bookmarks=session.get_bookmarks()
        )
            
        session.set_processing(False)
        return {
            "status": "done",
            "text": session.get_transcript(),
            "language": result["language"],
            "segments": segments
        }
    except Exception as e:
        session.set_processing(False)
        if "cancelad" in str(e).lower():
            return {
                "status": "cancelled",
                "text": "",
                "language": None,
                "segments": []
            }
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze")
def analyze_transcript(
    request: AnalyzeRequest,
    analyzer: IAnalyzer = Depends(get_analyzer),
    session: SessionManager = Depends(get_session_manager),
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """Analiza el texto de la reunión con Ollama (modelo local) u OpenAI."""
    audio_path = request.audio_path if request.audio_path else session.get_audio_path()

    # Resolver bookmarks: desde el request, o desde la sesión activa, o desde el archivo existente
    bookmarks = request.bookmarks
    if bookmarks is None:
        bookmarks = session.get_bookmarks()
    if (not bookmarks) and audio_path:
        json_path = _get_json_path(audio_path)
        existing_meta = repo.get_metadata(json_path)
        if existing_meta and existing_meta.get("bookmarks"):
            bookmarks = existing_meta.get("bookmarks")

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
        
        repo.save_meeting_metadata(
            audio_path=audio_path,
            transcript=request.transcript,
            analysis=dummy_analysis,
            language=None,
            segments=request.segments,
            bookmarks=bookmarks
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
        result = analyzer.analyze(request.transcript, bookmarks=bookmarks)
        session.set_analysis(result)
        session.set_processing(False)
        
        repo.save_meeting_metadata(
            audio_path=audio_path,
            transcript=request.transcript,
            analysis=result,
            language=None,
            segments=request.segments,
            bookmarks=bookmarks
        )
        
        return {"status": "done", "analysis": result, "bookmarks": bookmarks}
    except Exception as e:
        session.set_processing(False)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/processing/cancel")
def cancel_processing(session: SessionManager = Depends(get_session_manager)):
    """Cancela el proceso activo restableciendo el estado de procesamiento."""
    session.set_processing(False)
    print("[API] Procesamiento cancelado por petición del usuario.")
    return {"status": "cancelled"}
