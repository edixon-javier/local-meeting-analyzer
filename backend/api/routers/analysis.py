import os
import re
import json
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
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

def _build_meeting_chat_context(
    audio_path: str,
    question: str,
    repo: IMetadataRepository,
    session: SessionManager,
    analyzer: IAnalyzer
) -> str:
    transcript = ""
    json_path = _get_json_path(audio_path)
    
    meta = repo.get_metadata(json_path) or {}
    transcript = meta.get("transcript") or session.get_transcript() or ""
        
    if not transcript:
        raise HTTPException(status_code=400, detail="No se encontró la transcripción de la reunión.")

    # 1. Recuperar metadatos complementarios
    filename = meta.get("filename") or os.path.basename(audio_path)
    created = meta.get("created")
    import datetime
    try:
        if created is not None:
            date_str = datetime.datetime.fromtimestamp(float(created)).strftime('%d/%m/%Y %H:%M')
        else:
            date_str = "Fecha desconocida"
    except Exception:
        date_str = str(created) if created else "Fecha desconocida"

    analysis = meta.get("analysis") or session.get_analysis() or {}
    if not isinstance(analysis, dict):
        analysis = {}

    category = analysis.get("category") or "General"
    tone = analysis.get("tone") or "Neutro"

    # Resumen
    summary_raw = analysis.get("summary") or []
    summary_list = summary_raw if isinstance(summary_raw, list) else [str(summary_raw)]
    summary_points = "\n".join([f"- {p}" for p in summary_list if p])

    # Decisiones
    decisions_raw = analysis.get("key_decisions") or []
    decisions_list = decisions_raw if isinstance(decisions_raw, list) else [str(decisions_raw)]
    decisions_points = "\n".join([f"- {d}" for d in decisions_list if d])

    # Tareas / Compromisos
    action_items = analysis.get("action_items") or []
    tasks_lines = []
    if isinstance(action_items, list):
        for t in action_items:
            if isinstance(t, dict):
                is_done = bool(t.get("completed"))
                status_str = "[COMPLETADA]" if is_done else "[PENDIENTE]"
                assignee = t.get("assignee") or "Sin asignar"
                deadline = t.get("deadline") or "Sin fecha"
                task_desc = t.get("task") or "Sin descripción"
                tasks_lines.append(f"- {status_str} {task_desc} (Responsable: {assignee}, Plazo: {deadline})")
            elif isinstance(t, str):
                tasks_lines.append(f"- [PENDIENTE] {t}")
    tasks_section = "\n".join(tasks_lines)

    # Bookmarks
    bookmarks = meta.get("bookmarks") or session.get_bookmarks() or []
    bm_lines = []
    if isinstance(bookmarks, list):
        for bm in bookmarks:
            if isinstance(bm, dict):
                t_sec = float(bm.get("time", 0.0) or 0.0)
                m, s = int(t_sec // 60), int(t_sec % 60)
                note = str(bm.get("note", "")).strip() or "Momento relevante marcado"
                bm_lines.append(f"- [{m:02d}:{s:02d}] {note}")
    bookmarks_section = "\n".join(bm_lines)

    # 2. Formatear el diálogo con timestamps si hay segmentos
    segments = meta.get("segments") or []
    formatted_dialogue = ""
    if isinstance(segments, list) and segments:
        dialogue_lines = []
        for seg in segments:
            if isinstance(seg, dict):
                start_sec = float(seg.get("start", 0.0) or 0.0)
                m, s = int(start_sec // 60), int(start_sec % 60)
                spk = seg.get("speaker") or "Hablante"
                txt = (seg.get("text") or "").strip()
                dialogue_lines.append(f"[{m:02d}:{s:02d}] {spk}: {txt}")
        formatted_dialogue = "\n".join(dialogue_lines)
    else:
        formatted_dialogue = transcript

    # 3. Manejo inteligente de longitud para modelos locales (condensación semántica)
    if analyzer.ai_provider == "local":
        word_count = len(formatted_dialogue.split())
        if word_count > 4500:
            import string
            translator = str.maketrans('', '', string.punctuation)
            q_clean = question.lower().translate(translator)
            q_words = [w for w in q_clean.split() if len(w) > 2]

            dialogue_lines = formatted_dialogue.split("\n")
            if len(dialogue_lines) > 20 and q_words:
                selected_indices = set()
                for idx in range(min(4, len(dialogue_lines))):
                    selected_indices.add(idx)
                for idx in range(max(0, len(dialogue_lines) - 4), len(dialogue_lines)):
                    selected_indices.add(idx)

                for idx, line in enumerate(dialogue_lines):
                    line_lower = line.lower()
                    if any(w in line_lower for w in q_words):
                        selected_indices.add(idx)
                        if idx > 0:
                            selected_indices.add(idx - 1)
                        if idx < len(dialogue_lines) - 1:
                            selected_indices.add(idx + 1)

                ordered_indices = sorted(selected_indices)
                condensed_lines = []
                last_idx = -1
                for idx in ordered_indices:
                    if last_idx != -1 and idx > last_idx + 1:
                        condensed_lines.append("... [segmentos intermedios omitidos] ...")
                    condensed_lines.append(dialogue_lines[idx])
                    last_idx = idx

                formatted_dialogue = "\n".join(condensed_lines)
                if len(formatted_dialogue.split()) > 4500:
                    formatted_dialogue = " ".join(formatted_dialogue.split()[:4000]) + "\n... [truncado por límite de contexto local] ..."
            else:
                formatted_dialogue = " ".join(formatted_dialogue.split()[:4000]) + "\n... [truncado por límite de contexto local] ..."

    # 4. Construcción del bloque de contexto integral
    context_blocks = [
        f"REUNIÓN: {filename} ({date_str})\nCATEGORÍA: {category} | TONO: {tone}"
    ]
    if summary_points:
        context_blocks.append(f"RESUMEN REGISTRADO:\n{summary_points}")
    if decisions_points:
        context_blocks.append(f"DECISIONES CLAVE:\n{decisions_points}")
    if tasks_section:
        context_blocks.append(f"COMPROMISOS Y TAREAS:\n{tasks_section}")
    if bookmarks_section:
        context_blocks.append(f"MOMENTOS CLAVE MARCADOS:\n{bookmarks_section}")
    context_blocks.append(f"TRANSCRIPCIÓN Y DIÁLOGO:\n{formatted_dialogue}")

    return "\n\n".join(context_blocks)

def _compute_meeting_grounding(response_text: str, context: str, question: str) -> dict:
    if not response_text:
        return {"level": "general", "label": "Respuesta general", "score": 0.5, "has_timestamps": False}
    
    resp_lower = response_text.lower()
    negation_phrases = [
        "no se menciona", "no se mencionó", "no se habla", "no se habló",
        "no aparece en la transcripción", "no encontré información",
        "no se especifica", "no hay registro", "no hay información",
        "no se trata en la reunión", "no se discutió"
    ]
    if any(p in resp_lower for p in negation_phrases):
        return {
            "level": "unmentioned",
            "label": "Sin mención directa en la grabación",
            "score": 0.2,
            "has_timestamps": False
        }

    timestamps_found = re.findall(r'\[\d{1,2}:\d{2}(?::\d{2})?\]', response_text)
    has_timestamps = len(timestamps_found) > 0

    stop_words = {
        "para", "como", "pero", "porque", "cuando", "donde", "sobre", "entre",
        "este", "esta", "estos", "estas", "cual", "cuales", "tiene", "tienen",
        "hacer", "hecho", "puede", "pueden", "tambien", "ademas", "despues",
        "antes", "tanto", "mucho", "mismo", "cada", "otro", "otra", "otros"
    }
    clean_resp_words = [w for w in re.findall(r'\b[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}\b', resp_lower) if w not in stop_words]
    context_lower = context.lower() if context else ""
    
    overlap_count = sum(1 for w in clean_resp_words if w in context_lower)
    overlap_ratio = (overlap_count / len(clean_resp_words)) if clean_resp_words else 0.0

    if has_timestamps or overlap_ratio >= 0.35:
        label = "Alta concordancia con la grabación"
        if has_timestamps:
            label += f" ({len(timestamps_found)} {'cita' if len(timestamps_found) == 1 else 'citas'} con timestamp)"
        return {
            "level": "high",
            "label": label,
            "score": 0.92 if has_timestamps else 0.85,
            "has_timestamps": has_timestamps
        }
    elif overlap_ratio >= 0.18:
        return {
            "level": "medium",
            "label": "Concordancia moderada con la grabación",
            "score": 0.68,
            "has_timestamps": False
        }
    else:
        return {
            "level": "general",
            "label": "Respuesta contextual",
            "score": 0.45,
            "has_timestamps": False
        }

@router.post("/chat")
def chat_transcript(
    request: ChatRequest,
    analyzer: IAnalyzer = Depends(get_analyzer),
    session: SessionManager = Depends(get_session_manager),
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """Envía un mensaje de chat sobre la transcripción actual con contexto enriquecido y grounding."""
    full_meeting_context = _build_meeting_chat_context(
        request.audio_path, request.question, repo, session, analyzer
    )
    try:
        response = analyzer.chat_with_transcript(full_meeting_context, request.messages, request.question)
        grounding = _compute_meeting_grounding(response, full_meeting_context, request.question)
        return {"status": "done", "response": response, "grounding": grounding}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat/stream")
def chat_transcript_stream(
    request: ChatRequest,
    analyzer: IAnalyzer = Depends(get_analyzer),
    session: SessionManager = Depends(get_session_manager),
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """Envía un mensaje de chat sobre la reunión transmitiendo tokens en streaming vía SSE."""
    full_meeting_context = _build_meeting_chat_context(
        request.audio_path, request.question, repo, session, analyzer
    )

    def stream_generator():
        collected_chunks = []
        try:
            for chunk in analyzer.stream_chat_with_transcript(full_meeting_context, request.messages, request.question):
                collected_chunks.append(chunk)
                yield f"data: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
            full_text = "".join(collected_chunks)
            grounding = _compute_meeting_grounding(full_text, full_meeting_context, request.question)
            yield f"data: {json.dumps({'done': True, 'grounding': grounding}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")

def _build_history_chat_context(
    request: HistoryChatRequest,
    repo: IMetadataRepository,
    analyzer: IAnalyzer
):
    from api.routers.history import _get_recordings_dir, _get_json_path
    recordings_dir = _get_recordings_dir()
    
    if not os.path.exists(recordings_dir):
        return (
            {
                "status": "done", 
                "response": "No tienes grabaciones en el historial todavía. Graba o importa una reunión para empezar a chatear.", 
                "referenced_meetings": []
            },
            None,
            None
        )
    
    # Cargar metadatos de todas las reuniones
    meetings = []
    for f in os.listdir(recordings_dir):
        if f.lower().endswith(SUPPORTED_AUDIO_EXTS):
            audio_path = os.path.join(recordings_dir, f)
            json_path = _get_json_path(audio_path)
            meta = repo.get_metadata(json_path)
            if meta and (meta.get("transcript") or meta.get("analysis")):
                meetings.append(meta)
                
    if not meetings:
        return (
            {
                "status": "done", 
                "response": "No hay reuniones transcritas ni analizadas en tu historial para realizar la consulta.", 
                "referenced_meetings": []
            },
            None,
            None
        )
        
    # RAG: Algoritmo de ranking de relevancia semántico y contextual
    query = request.question.lower().strip()
    import string
    translator = str.maketrans('', '', string.punctuation)
    query_clean = query.translate(translator)
    query_terms = [word for word in query_clean.split() if len(word) > 2]
    
    # Stop words comunes en español
    stop_words = {"para", "como", "con", "una", "uno", "unos", "unas", "este", "esta", "estos", "estas", "todo", "toda", "todos", "todas", "pero", "sino", "sobre", "entre", "desde", "hacia", "hasta", "cual", "cuales", "quien", "quienes", "cuando", "donde", "por", "que", "los", "las", "les"}
    query_terms = [term for term in query_terms if term not in stop_words]

    # Intención temporal en la consulta ("última", "reciente", "últimas", etc.)
    temporal_markers = {"ultima", "ultimas", "ultimo", "ultimos", "reciente", "recientes", "ayer", "hoy", "semana"}
    has_temporal_intent = any(marker in query_clean.split() for marker in temporal_markers)

    # Multi-turn context expansion: incluir términos del turno anterior para preguntas de seguimiento
    history_terms = []
    if request.messages and isinstance(request.messages, list):
        recent_texts = []
        for msg in request.messages[-2:]:
            if isinstance(msg, dict) and msg.get("content"):
                recent_texts.append(str(msg.get("content", "")))
        if recent_texts:
            recent_clean = (" ".join(recent_texts)).lower().translate(translator)
            history_terms = [w for w in recent_clean.split() if len(w) > 3 and w not in stop_words and w not in query_terms][:8]
    
    if not query_terms and query:
        query_terms = [query]
        
    scored_meetings = []
    for meeting in meetings:
        score = 0.0
        filename = (meeting.get("filename") or "").lower()
        transcript = (meeting.get("transcript") or "").lower()
        analysis = meeting.get("analysis") or {}
        if not isinstance(analysis, dict):
            analysis = {}
        category = (analysis.get("category") or "").lower()
        tone = (analysis.get("tone") or "").lower()
        summary_raw = analysis.get("summary") or []
        summary = (" ".join(summary_raw) if isinstance(summary_raw, list) else str(summary_raw)).lower()
        decisions_raw = analysis.get("key_decisions") or []
        decisions = (" ".join(decisions_raw) if isinstance(decisions_raw, list) else str(decisions_raw)).lower()
        
        # Extraer tareas/action_items para búsqueda RAG
        action_items = analysis.get("action_items") or []
        action_texts = []
        if isinstance(action_items, list):
            for t_obj in action_items:
                if isinstance(t_obj, dict):
                    action_texts.append(f"{t_obj.get('task', '')} {t_obj.get('assignee', '')} {t_obj.get('deadline', '')}")
                elif isinstance(t_obj, str):
                    action_texts.append(t_obj)
        tasks_combined = " ".join(action_texts).lower()

        # Extraer notas de marcadores (bookmarks)
        bookmarks = meeting.get("bookmarks") or []
        bm_notes = " ".join([b.get("note", "") for b in bookmarks if isinstance(b, dict)]).lower() if isinstance(bookmarks, list) else ""

        matched_snippets = []
        
        # 1. Puntuación de términos de la pregunta actual (peso principal)
        for term in query_terms:
            if term in filename:
                score += 5.0
            if term in category or term in tone:
                score += 2.0
            if term in summary:
                score += 3.0
            if term in decisions:
                score += 3.0
            if term in tasks_combined:
                score += 4.0
            if term in bm_notes:
                score += 3.0
            matches_in_trans = transcript.count(term)
            if matches_in_trans > 0:
                score += min(matches_in_trans * 0.5, 5.0)

        # 2. Puntuación contextual de términos del historial reciente (multi-turn follow-up)
        for h_term in history_terms:
            if h_term in filename:
                score += 2.0
            if h_term in summary or h_term in decisions:
                score += 1.5
            if h_term in tasks_combined:
                score += 1.5

        # 3. Intentar extraer fragmentos precisos desde segmentos con timestamps y hablantes
        segments = meeting.get("segments") or []
        segment_snippets = []
        if isinstance(segments, list) and segments:
            for seg in segments:
                if not isinstance(seg, dict):
                    continue
                seg_text = (seg.get("text") or "").strip()
                seg_lower = seg_text.lower()
                if any(t in seg_lower for t in query_terms):
                    start_sec = float(seg.get("start", 0.0) or 0.0)
                    mins = int(start_sec // 60)
                    secs = int(start_sec % 60)
                    spk = seg.get("speaker") or "Hablante"
                    segment_snippets.append(f"[{mins:02d}:{secs:02d}] {spk}: \"{seg_text}\"")
                    if len(segment_snippets) >= 3:
                        break

        if segment_snippets:
            matched_snippets = segment_snippets
        else:
            # Fallback a búsqueda en texto plano
            raw_trans = meeting.get("transcript") or ""
            start_idx = 0
            for term in query_terms:
                for _ in range(2):
                    pos = transcript.find(term, start_idx)
                    if pos == -1:
                        break
                    left = max(0, pos - 70)
                    right = min(len(transcript), pos + len(term) + 70)
                    snippet = raw_trans[left:right].strip()
                    if left > 0:
                        snippet = "..." + snippet
                    if right < len(transcript):
                        snippet = snippet + "..."
                    matched_snippets.append(snippet)
                    start_idx = pos + len(term) + 1
                    if len(matched_snippets) >= 3:
                        break
                if len(matched_snippets) >= 3:
                    break
                    
        scored_meetings.append({
            "meeting": meeting,
            "score": score,
            "snippets": matched_snippets[:3]
        })

    def _safe_ts(m_obj: dict) -> float:
        val = m_obj.get("created")
        if val is None:
            return 0.0
        try:
            return float(val)
        except (ValueError, TypeError):
            return 0.0

    # Si hay intención temporal ("última reunión", "recientes"), bonificar las más recientes
    if has_temporal_intent and scored_meetings:
        max_ts = max((_safe_ts(m["meeting"]) for m in scored_meetings), default=0.0)
        if max_ts > 0:
            for item in scored_meetings:
                ts = _safe_ts(item["meeting"])
                # Ponderación según cercanía al timestamp más reciente
                if ts == max_ts:
                    item["score"] += 6.0
                elif ts > max_ts - 86400 * 7: # última semana
                    item["score"] += 3.0
        
    scored_meetings.sort(key=lambda x: x["score"], reverse=True)
    
    top_entries = []
    if scored_meetings and scored_meetings[0]["score"] > 0:
        top_entries = [item for item in scored_meetings if item["score"] > 0][:3]
    else:
        # Fallback: las 2 más recientes
        sorted_by_date = sorted(scored_meetings, key=lambda x: _safe_ts(x["meeting"]), reverse=True)
        top_entries = sorted_by_date[:2]
        
    context_parts = []
    referenced_meetings = []
    
    for entry in top_entries:
        meet = entry["meeting"]
        filename = meet.get("filename", "")
        created = meet.get("created")
        import datetime
        try:
            if created is not None:
                date_str = datetime.datetime.fromtimestamp(float(created)).strftime('%d/%m/%Y %H:%M')
            else:
                date_str = "Fecha desconocida"
        except Exception:
            date_str = str(created) if created else "Fecha desconocida"
        
        meet_analysis = meet.get("analysis") or {}
        if not isinstance(meet_analysis, dict):
            meet_analysis = {}
        category = meet_analysis.get("category", "Sin categoría")
        summary_raw = meet_analysis.get("summary") or []
        summary_list = summary_raw if isinstance(summary_raw, list) else [str(summary_raw)]
        summary_points = "\n".join([f"- {p}" for p in summary_list]) if summary_list else "- Sin resumen disponible"

        decisions_raw = meet_analysis.get("key_decisions") or []
        decisions_list = decisions_raw if isinstance(decisions_raw, list) else [str(decisions_raw)]
        decisions_points = "\n".join([f"- {d}" for d in decisions_list]) if decisions_list else "- Sin decisiones registradas"

        # Tareas / Compromisos estructurados
        action_items = meet_analysis.get("action_items") or []
        tasks_lines = []
        pending_count = 0
        if isinstance(action_items, list):
            for t in action_items:
                if isinstance(t, dict):
                    is_done = bool(t.get("completed"))
                    if not is_done:
                        pending_count += 1
                    status_str = "[COMPLETADA]" if is_done else "[PENDIENTE]"
                    assignee = t.get("assignee") or "Sin asignar"
                    deadline = t.get("deadline") or "Sin fecha"
                    task_desc = t.get("task") or "Sin descripción"
                    tasks_lines.append(f"- {status_str} {task_desc} (Responsable: {assignee}, Plazo: {deadline})")
                elif isinstance(t, str):
                    tasks_lines.append(f"- [PENDIENTE] {t}")
                    pending_count += 1
        tasks_section = ("\nCOMPROMISOS Y TAREAS:\n" + "\n".join(tasks_lines)) if tasks_lines else ""

        # Momentos clave marcados (Live Bookmarks)
        bookmarks = meet.get("bookmarks") or []
        bm_lines = []
        if isinstance(bookmarks, list):
            for bm in bookmarks:
                if isinstance(bm, dict):
                    t_sec = float(bm.get("time", 0.0) or 0.0)
                    m, s = int(t_sec // 60), int(t_sec % 60)
                    note = str(bm.get("note", "")).strip() or "Momento relevante marcado"
                    bm_lines.append(f"- [{m:02d}:{s:02d}] {note}")
        bookmarks_section = ("\nMOMENTOS CLAVE:\n" + "\n".join(bm_lines)) if bm_lines else ""
        
        snippets_text = ""
        if entry["snippets"]:
            snippets_text = "\nFragmentos coincidentes de la transcripción:\n" + "\n".join([f"  * {s}" for s in entry["snippets"]])
            
        context_parts.append(
            f"REUNIÓN: {filename}\n"
            f"FECHA: {date_str}\n"
            f"CATEGORÍA: {category}\n"
            f"RESUMEN:\n{summary_points}\n"
            f"DECISIONES CLAVE:\n{decisions_points}"
            f"{tasks_section}"
            f"{bookmarks_section}"
            f"{snippets_text}\n"
            f"---"
        )
        
        referenced_meetings.append({
            "filename": filename,
            "created": created,
            "path": meet.get("audio_path"),
            "category": category,
            "tone": meet_analysis.get("tone", "Desconocido"),
            "action_items_count": len(tasks_lines),
            "pending_tasks_count": pending_count,
            "snippets": entry.get("snippets") or []
        })
        
    context_str = "\n\n".join(context_parts)
    
    if analyzer.ai_provider == "local":
        word_count = len(context_str.split())
        if word_count > 6000:
            context_words = context_str.split()[:5000]
            context_str = " ".join(context_words) + "\n...[Contexto truncado por límite de tamaño]..."
            
    return (None, context_str, referenced_meetings)

def _compute_history_grounding(response_text: str, referenced_meetings: list, question: str) -> dict:
    if not response_text:
        return {"level": "general", "label": "Respuesta general", "score": 0.5}

    resp_lower = response_text.lower()
    negation_phrases = [
        "no se menciona", "no se mencionó", "no se encontró", "no encontré",
        "no hay registro", "ninguna reunión", "ninguna de las grabaciones",
        "no se especifica", "no hay datos"
    ]
    if any(p in resp_lower for p in negation_phrases):
        return {
            "level": "unmentioned",
            "label": "Sin registros coincidentes en el historial",
            "score": 0.2
        }

    count = len(referenced_meetings) if referenced_meetings else 0
    if count > 0:
        meet_word = "reunión" if count == 1 else "reuniones"
        has_snippets = any(len(m.get("snippets", [])) > 0 for m in referenced_meetings if isinstance(m, dict))
        if has_snippets:
            return {
                "level": "high",
                "label": f"Alta concordancia ({count} {meet_word} y fragmentos verificados)",
                "score": 0.90
            }
        return {
            "level": "medium",
            "label": f"Basado en {count} {meet_word} del historial",
            "score": 0.72
        }
    
    return {
        "level": "general",
        "label": "Respuesta general",
        "score": 0.45
    }

@router.post("/chat/history")
def chat_history(
    request: HistoryChatRequest,
    analyzer: IAnalyzer = Depends(get_analyzer),
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """Envía un mensaje de chat consultando todo el historial de reuniones usando RAG."""
    early_resp, context_str, referenced_meetings = _build_history_chat_context(request, repo, analyzer)
    if early_resp is not None:
        early_resp["grounding"] = {"level": "unmentioned", "label": "Sin grabaciones analizadas en el historial", "score": 0.0}
        return early_resp

    try:
        response = analyzer.chat_with_history(context_str, request.messages, request.question)
        grounding = _compute_history_grounding(response, referenced_meetings, request.question)
        return {
            "status": "done",
            "response": response,
            "referenced_meetings": referenced_meetings,
            "grounding": grounding
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat/history/stream")
def chat_history_stream(
    request: HistoryChatRequest,
    analyzer: IAnalyzer = Depends(get_analyzer),
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """Envía un mensaje consultando el historial transmitiendo tokens en streaming vía SSE."""
    early_resp, context_str, referenced_meetings = _build_history_chat_context(request, repo, analyzer)
    if early_resp is not None:
        def immediate_generator():
            yield f"data: {json.dumps({'text': early_resp['response']}, ensure_ascii=False)}\n\n"
            grounding = {"level": "unmentioned", "label": "Sin grabaciones analizadas en el historial", "score": 0.0}
            yield f"data: {json.dumps({'done': True, 'referenced_meetings': [], 'grounding': grounding}, ensure_ascii=False)}\n\n"
        return StreamingResponse(immediate_generator(), media_type="text/event-stream")

    def stream_generator():
        collected = []
        try:
            for chunk in analyzer.stream_chat_with_history(context_str, request.messages, request.question):
                collected.append(chunk)
                yield f"data: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
            full_text = "".join(collected)
            grounding = _compute_history_grounding(full_text, referenced_meetings, request.question)
            yield f"data: {json.dumps({'done': True, 'referenced_meetings': referenced_meetings, 'grounding': grounding}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")

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
