"""
mcp_server.py - Servidor Model Context Protocol (MCP) para Local Meeting Analyzer.

Permite a agentes y LLMs (Claude Desktop, Cursor, Antigravity, etc.) interactuar
de forma local, controlada y privada con las reuniones grabadas, transcribir,
consultar resúmenes ejecutivos, decisiones y tareas pendientes.

Uso:
    python mcp_server.py                # Ejecuta en modo stdio (por defecto)
    python mcp_server.py --transport sse # Ejecuta en modo SSE (puerto configurable)
"""

import os
import sys
import json
import string
from typing import Optional, List, Dict, Any

# Asegurar que el directorio de backend esté en el sys.path
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from core.paths import get_recordings_dir
from services.metadata_repository import MetadataRepository
from services.task_export_service import TaskExportService, normalize_action_item
from mcp.server.mcpserver import MCPServer

# Inicializar servidor MCP
mcp = MCPServer("Local Meeting Analyzer")
_repo = MetadataRepository()

SUPPORTED_AUDIO_EXTS = (".wav", ".mp3", ".m4a", ".mp4", ".ogg", ".aac", ".flac")


def _resolve_json_path(meeting_identifier: str) -> Optional[str]:
    """
    Resuelve el identificador de una reunión (nombre de archivo, título o ruta)
    al archivo JSON de metadatos correspondiente.
    """
    clean_id = meeting_identifier.strip()
    recordings_dir = get_recordings_dir()

    # Si es ruta absoluta a un .json existente
    if os.path.isabs(clean_id) and clean_id.lower().endswith(".json") and os.path.isfile(clean_id):
        return clean_id

    # Si es ruta absoluta a un archivo de audio
    if os.path.isabs(clean_id):
        base, _ = os.path.splitext(clean_id)
        candidate = base + ".json"
        if os.path.isfile(candidate):
            return candidate

    # Si es nombre de archivo directo (ej: reunion.wav o reunion.json)
    filename = os.path.basename(clean_id)
    base, ext = os.path.splitext(filename)
    if ext.lower() == ".json":
        candidate = os.path.join(recordings_dir, filename)
        if os.path.isfile(candidate):
            return candidate
    else:
        candidate = os.path.join(recordings_dir, base + ".json")
        if os.path.isfile(candidate):
            return candidate

    # Búsqueda por coincidencia en carpeta de grabaciones
    if os.path.exists(recordings_dir):
        for f in os.listdir(recordings_dir):
            if f.lower().endswith(".json"):
                json_path = os.path.join(recordings_dir, f)
                # Comparar con nombre base o con filename guardado en JSON
                if base.lower() == os.path.splitext(f)[0].lower():
                    return json_path
                meta = _repo.get_metadata(json_path)
                if meta:
                    if meta.get("filename", "").lower() == filename.lower():
                        return json_path

    return None


def _get_summary_preview(analysis: dict) -> Optional[str]:
    """Extrae el primer punto de resumen como previsualización."""
    summary = analysis.get("summary") if isinstance(analysis, dict) else None
    if isinstance(summary, list) and summary:
        first = str(summary[0]).strip()
        return (first[:157] + "…") if len(first) > 160 else first
    elif isinstance(summary, str) and summary.strip():
        first = summary.strip()
        return (first[:157] + "…") if len(first) > 160 else first
    return None


@mcp.tool()
def list_meetings() -> List[Dict[str, Any]]:
    """
    Lista todas las reuniones grabadas o importadas con su información básica,
    categoría, tono y resumen preliminar.
    """
    recordings_dir = get_recordings_dir()
    if not os.path.exists(recordings_dir):
        return []

    meetings = []
    for f in sorted(os.listdir(recordings_dir), reverse=True):
        if f.lower().endswith(SUPPORTED_AUDIO_EXTS):
            audio_path = os.path.join(recordings_dir, f)
            base, _ = os.path.splitext(audio_path)
            json_path = base + ".json"
            meta = _repo.get_metadata(json_path)

            category = None
            tone = None
            preview = None
            bookmarks_count = 0
            tasks_count = 0
            pending_tasks_count = 0

            if meta:
                analysis = meta.get("analysis") or {}
                if isinstance(analysis, dict):
                    category = analysis.get("category")
                    tone = analysis.get("tone")
                    preview = _get_summary_preview(analysis)
                    action_items = analysis.get("action_items") or []
                    if isinstance(action_items, list):
                        tasks_count = len(action_items)
                        pending_tasks_count = sum(
                            1 for t in action_items
                            if (isinstance(t, dict) and not t.get("completed")) or isinstance(t, str)
                        )
                bookmarks = meta.get("bookmarks")
                if isinstance(bookmarks, list):
                    bookmarks_count = len(bookmarks)

            meetings.append({
                "filename": f,
                "audio_path": audio_path,
                "created": os.path.getctime(audio_path),
                "size_mb": round(os.path.getsize(audio_path) / 1024 / 1024, 2),
                "has_metadata": meta is not None,
                "category": category,
                "tone": tone,
                "summary_preview": preview,
                "bookmarks_count": bookmarks_count,
                "tasks_count": tasks_count,
                "pending_tasks_count": pending_tasks_count
            })

    return meetings


@mcp.tool()
def get_meeting_summary(meeting_identifier: str) -> Dict[str, Any]:
    """
    Obtiene el resumen ejecutivo estructurado, acuerdos, tareas y notas de una reunión.
    
    Args:
        meeting_identifier: Nombre del archivo de la reunión (ej: 'grabacion_2026-10-07.wav'),
                           su nombre JSON o ruta completa.
    """
    json_path = _resolve_json_path(meeting_identifier)
    if not json_path:
        return {
            "error": f"Reunión no encontrada: '{meeting_identifier}'. Usa list_meetings para ver las disponibles."
        }

    meta = _repo.get_metadata(json_path)
    if not meta:
        return {"error": f"No se encontraron metadatos para '{meeting_identifier}'."}

    analysis = meta.get("analysis") or {}
    return {
        "filename": meta.get("filename") or os.path.basename(json_path),
        "created": meta.get("created"),
        "category": analysis.get("category", "General"),
        "tone": analysis.get("tone", "Profesional"),
        "duration_insight": analysis.get("duration_insight", ""),
        "summary": analysis.get("summary", []),
        "key_decisions": analysis.get("key_decisions", []),
        "action_items": analysis.get("action_items", []),
        "bookmarks": meta.get("bookmarks", [])
    }


@mcp.tool()
def get_meeting_transcript(meeting_identifier: str, include_segments: bool = False) -> Dict[str, Any]:
    """
    Obtiene la transcripción completa de una reunión y opcionalmente los segmentos
    desglosados por hablante con marcas de tiempo.
    
    Args:
        meeting_identifier: Nombre de archivo de audio o JSON de la reunión.
        include_segments: Si es True, incluye la lista detallada de turnos de diálogo
                          con hablante y marcas de tiempo (segundos inicio/fin).
    """
    json_path = _resolve_json_path(meeting_identifier)
    if not json_path:
        return {"error": f"Reunión no encontrada: '{meeting_identifier}'."}

    meta = _repo.get_metadata(json_path)
    if not meta:
        return {"error": f"No se encontraron metadatos para '{meeting_identifier}'."}

    result = {
        "filename": meta.get("filename") or os.path.basename(json_path),
        "transcript": meta.get("transcript", "")
    }

    if include_segments:
        result["segments"] = meta.get("segments", [])

    return result


@mcp.tool()
def get_all_action_items(filter_completed: Optional[bool] = None) -> List[Dict[str, Any]]:
    """
    Extrae y consolida todas las tareas y compromisos (action items) identificados
    en todas las reuniones del historial.
    
    Args:
        filter_completed: Opcional. Si es True, retorna solo tareas completadas.
                          Si es False, retorna solo tareas pendientes.
                          Si es None, retorna todas las tareas.
    """
    recordings_dir = get_recordings_dir()
    if not os.path.exists(recordings_dir):
        return []

    all_tasks = []
    for f in sorted(os.listdir(recordings_dir), reverse=True):
        if f.lower().endswith(".json"):
            json_path = os.path.join(recordings_dir, f)
            meta = _repo.get_metadata(json_path)
            if not meta:
                continue

            analysis = meta.get("analysis") or {}
            items = analysis.get("action_items") or []
            filename = meta.get("filename") or f
            base_title = os.path.splitext(os.path.basename(filename))[0]

            for idx, raw_item in enumerate(items):
                norm = normalize_action_item(raw_item, default_meeting_title=base_title)
                is_completed = norm["completed"]
                if filter_completed is not None and is_completed != filter_completed:
                    continue

                all_tasks.append({
                    "meeting_filename": filename,
                    "task_index": idx,
                    "task": norm["task"],
                    "assignee": norm["assignee"],
                    "deadline": norm["deadline"],
                    "completed": is_completed
                })

    return all_tasks


@mcp.tool()
def export_action_items(
    format: str = "csv",
    filter_completed: Optional[bool] = None,
    meeting_identifier: Optional[str] = None
) -> str:
    """
    Exporta compromisos en formato iCalendar (.ics conforme a RFC 5545) o CSV (con BOM UTF-8 para Excel).
    Puede exportar para una reunión específica o consolidado para todo el historial.

    Args:
        format: Formato de exportación: 'csv' o 'ics' (por defecto 'csv').
        filter_completed: True para solo completadas, False para solo pendientes, None para todas.
        meeting_identifier: Nombre o ruta de reunión para exportar sólo esa reunión. Si es None, exporta consolidado.
    """
    recordings_dir = get_recordings_dir()
    status_filter = "all"
    if filter_completed is True:
        status_filter = "completed"
    elif filter_completed is False:
        status_filter = "pending"

    if meeting_identifier:
        json_path = _resolve_json_path(meeting_identifier)
        if not json_path:
            return f"Error: No se encontró la reunión '{meeting_identifier}'."
        meta = _repo.get_metadata(json_path) or {}
        base_name = os.path.splitext(os.path.basename(json_path))[0]
        tasks = TaskExportService.get_meeting_tasks_for_export(meta, meeting_title=base_name, status_filter=status_filter)
        if format.lower() == "ics":
            return TaskExportService.export_to_ics(tasks, meeting_title=base_name, is_consolidated=False)
        return TaskExportService.export_to_csv(tasks, meeting_title=base_name, is_consolidated=False)

    tasks = TaskExportService.get_consolidated_tasks_for_export(
        recordings_dir=recordings_dir,
        metadata_repo=_repo,
        status_filter=status_filter
    )
    if format.lower() == "ics":
        return TaskExportService.export_to_ics(tasks, is_consolidated=True, calendar_name="Compromisos Consolidados")
    return TaskExportService.export_to_csv(tasks, is_consolidated=True)


@mcp.tool()
def search_meetings(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Búsqueda por palabras clave y relevancia semántica en las transcripciones y
    resúmenes ejecutivos de todo el historial de reuniones.
    
    Args:
        query: Término o frase de búsqueda (ej: 'presupuesto q3', 'carlos arquitectura').
        max_results: Número máximo de reuniones a devolver (por defecto 5).
    """
    recordings_dir = get_recordings_dir()
    if not os.path.exists(recordings_dir):
        return []

    # Normalizar términos de búsqueda
    clean_q = query.lower().strip()
    translator = str.maketrans('', '', string.punctuation)
    clean_no_punct = clean_q.translate(translator)
    stop_words = {"para", "como", "con", "una", "uno", "unos", "unas", "este", "esta", "estos", "estas", "todo", "toda", "todos", "todas", "pero", "sino", "sobre", "entre", "desde", "hacia", "hasta"}
    query_terms = [w for w in clean_no_punct.split() if len(w) > 2 and w not in stop_words]
    if not query_terms and clean_q:
        query_terms = [clean_q]

    meetings_with_score = []

    for f in os.listdir(recordings_dir):
        if f.lower().endswith(SUPPORTED_AUDIO_EXTS):
            audio_path = os.path.join(recordings_dir, f)
            base, _ = os.path.splitext(audio_path)
            json_path = base + ".json"
            meta = _repo.get_metadata(json_path)
            if not meta:
                continue

            transcript = (meta.get("transcript") or "").lower()
            analysis = meta.get("analysis") or {}
            summary_text = " ".join(analysis.get("summary", [])).lower() if isinstance(analysis.get("summary"), list) else str(analysis.get("summary", "")).lower()
            decisions_text = " ".join(analysis.get("key_decisions", [])).lower() if isinstance(analysis.get("key_decisions"), list) else ""
            category_text = (analysis.get("category") or "").lower()
            filename_text = f.lower()

            # Extraer compromisos/tareas
            action_items = analysis.get("action_items") or []
            action_texts = []
            if isinstance(action_items, list):
                for t_obj in action_items:
                    if isinstance(t_obj, dict):
                        action_texts.append(f"{t_obj.get('task', '')} {t_obj.get('assignee', '')} {t_obj.get('deadline', '')}")
                    elif isinstance(t_obj, str):
                        action_texts.append(t_obj)
            tasks_text = " ".join(action_texts).lower()

            # Extraer notas de marcadores
            bookmarks = meta.get("bookmarks") or []
            bm_notes = " ".join([b.get("note", "") for b in bookmarks if isinstance(b, dict)]).lower() if isinstance(bookmarks, list) else ""

            score = 0.0
            matched_terms = []

            for term in query_terms:
                term_matches = 0
                if term in filename_text:
                    score += 5.0
                    term_matches += 1
                if term in category_text:
                    score += 4.0
                    term_matches += 1
                if term in tasks_text:
                    score += 4.0
                    term_matches += 1
                if term in bm_notes:
                    score += 3.0
                    term_matches += 1
                if term in decisions_text:
                    score += 3.0
                    term_matches += 1
                if term in summary_text:
                    score += 2.0
                    term_matches += 1
                count_in_transcript = transcript.count(term)
                if count_in_transcript > 0:
                    score += min(5.0, count_in_transcript * 0.5)
                    term_matches += 1

                if term_matches > 0:
                    matched_terms.append(term)

            if score > 0:
                meetings_with_score.append({
                    "filename": f,
                    "score": round(score, 2),
                    "matched_terms": list(set(matched_terms)),
                    "category": analysis.get("category"),
                    "summary_preview": _get_summary_preview(analysis),
                    "created": os.path.getctime(audio_path)
                })

    meetings_with_score.sort(key=lambda m: m["score"], reverse=True)
    return meetings_with_score[:max_results]


@mcp.resource("meeting://summary/{filename}")
def meeting_summary_resource(filename: str) -> str:
    """Recurso URI que devuelve la minuta ejecutiva en texto markdown."""
    summary_data = get_meeting_summary(filename)
    if "error" in summary_data:
        return f"# Error\n\n{summary_data['error']}"

    md_lines = [
        f"# Minuta Ejecutiva: {summary_data['filename']}",
        f"**Categoría:** {summary_data.get('category')} | **Tono:** {summary_data.get('tone')}\n"
    ]
    if summary_data.get("duration_insight"):
        md_lines.append(f"> 💡 {summary_data['duration_insight']}\n")

    md_lines.append("## Resumen")
    for pt in summary_data.get("summary", []):
        md_lines.append(f"- {pt}")

    if summary_data.get("key_decisions"):
        md_lines.append("\n## Decisiones Clave")
        for dec in summary_data["key_decisions"]:
            md_lines.append(f"- {dec}")

    if summary_data.get("action_items"):
        md_lines.append("\n## Tareas y Compromisos")
        for it in summary_data["action_items"]:
            chk = "[x]" if it.get("completed") else "[ ]"
            md_lines.append(f"- {chk} **{it.get('task')}** ({it.get('assignee', 'Sin asignar')} - {it.get('deadline', 'Sin fecha')})")

    return "\n".join(md_lines)


@mcp.resource("meeting://transcript/{filename}")
def meeting_transcript_resource(filename: str) -> str:
    """Recurso URI que devuelve la transcripción completa de la reunión."""
    transcript_data = get_meeting_transcript(filename, include_segments=False)
    if "error" in transcript_data:
        return f"# Error\n\n{transcript_data['error']}"
    return transcript_data.get("transcript", "")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Servidor MCP de Local Meeting Analyzer")
    parser.add_argument("--transport", choices=["stdio", "sse", "streamable-http"], default="stdio",
                        help="Transporte del servidor MCP (por defecto: stdio)")
    args = parser.parse_args()

    print(f"[MCP] Iniciando servidor 'Local Meeting Analyzer' sobre transporte '{args.transport}'...", file=sys.stderr)
    mcp.run(transport=args.transport)
