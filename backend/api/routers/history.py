import os
import re
import json
import shutil
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Query, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from domain.interfaces import IMetadataRepository
from services.metadata_repository import MetadataRepository
from services.task_export_service import TaskExportService
from core.paths import get_recordings_dir


router = APIRouter()

class RenameRequest(BaseModel):
    new_name: str

class RenameSpeakerRequest(BaseModel):
    old_speaker: str
    new_speaker: str

class BookmarkRequest(BaseModel):
    time: float
    note: Optional[str] = ""

class TaskStatusRequest(BaseModel):
    completed: bool

SUPPORTED_AUDIO_EXTS = (".wav", ".mp3", ".m4a", ".mp4", ".ogg", ".aac", ".flac")

def get_metadata_repo() -> IMetadataRepository:
    return MetadataRepository()

def _get_json_path(audio_path: str) -> str:
    base_path, _ = os.path.splitext(audio_path)
    return base_path + ".json"

def _get_recordings_dir() -> str:
    return get_recordings_dir()

# Caracteres no válidos en nombres de archivo de Windows (y separadores de ruta)
_INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')

def _sanitize_filename(name: str) -> str:
    """Convierte un título escrito por el usuario en un nombre de archivo válido."""
    clean = _INVALID_FILENAME_CHARS.sub("-", name)
    clean = re.sub(r"\s+", " ", clean).strip(" .")
    return clean[:120]

# Duración en segundos por (ruta, mtime): leer la cabecera es rápido, pero se evita repetirlo
_duration_cache: dict = {}

def _get_audio_duration(path: str) -> Optional[float]:
    """Duración real del audio leída con PyAV (dependencia de faster-whisper). None si no se puede leer."""
    try:
        key = (path, os.path.getmtime(path))
        if key in _duration_cache:
            return _duration_cache[key]
        import av
        with av.open(path) as container:
            duration = round(container.duration / av.time_base, 1) if container.duration else None
        _duration_cache[key] = duration
        return duration
    except Exception:
        return None

def _summary_preview(analysis: dict) -> Optional[str]:
    """Primer punto del resumen: sirve para reconocer de qué trató la reunión sin abrirla."""
    summary = analysis.get("summary") if isinstance(analysis, dict) else None
    if isinstance(summary, list) and summary:
        first = str(summary[0]).strip()
    elif isinstance(summary, str):
        first = summary.strip()
    else:
        return None
    if not first:
        return None
    return (first[:157] + "…") if len(first) > 160 else first

def _is_safe_recording_path(path: str) -> bool:
    try:
        real_path = os.path.realpath(path)
        real_recordings = os.path.realpath(_get_recordings_dir())
        return real_path == real_recordings or real_path.startswith(real_recordings + os.sep)
    except Exception:
        return False

@router.get("")
@router.get("/")
def list_recordings(repo: IMetadataRepository = Depends(get_metadata_repo)):
    """Lista todos los archivos de grabación guardados y sus metadatos si existen."""
    recordings_dir = _get_recordings_dir()
    if not os.path.exists(recordings_dir):
        return {"recordings": []}

    files = []
    for f in sorted(os.listdir(recordings_dir), reverse=True):
        if f.lower().endswith(SUPPORTED_AUDIO_EXTS):
            path = os.path.join(recordings_dir, f)
            json_path = _get_json_path(path)
            
            meta = repo.get_metadata(json_path)
            has_metadata = meta is not None
            
            category = None
            tone = None
            preview = None
            tasks_count = 0
            pending_tasks_count = 0
            if meta:
                analysis = meta.get("analysis") or {}
                if isinstance(analysis, dict):
                    category = analysis.get("category")
                    tone = analysis.get("tone")
                    preview = _summary_preview(analysis)
                    action_items = analysis.get("action_items") or []
                    if isinstance(action_items, list):
                        tasks_count = len(action_items)
                        pending_tasks_count = sum(
                            1 for t in action_items
                            if (isinstance(t, dict) and not t.get("completed")) or isinstance(t, str)
                        )
            
            files.append({
                "filename": f,
                "path": path,
                "size_mb": round(os.path.getsize(path) / 1024 / 1024, 2),
                "created": os.path.getctime(path),
                "has_metadata": has_metadata,
                "category": category,
                "tone": tone,
                "summary_preview": preview,
                "duration": _get_audio_duration(path),
                "bookmarks_count": len(meta.get("bookmarks", [])) if (meta and isinstance(meta.get("bookmarks"), list)) else 0,
                "tasks_count": tasks_count,
                "pending_tasks_count": pending_tasks_count
            })

    return {"recordings": files}

@router.get("/metadata")
def get_recording_metadata(path: str, repo: IMetadataRepository = Depends(get_metadata_repo)):
    """Obtiene los metadatos guardados (transcripción, análisis, etc.) para una grabación."""
    if not _is_safe_recording_path(path):
        raise HTTPException(status_code=403, detail="Acceso denegado a metadatos fuera del directorio de grabaciones.")
    json_path = _get_json_path(path)
    meta = repo.get_metadata(json_path)
    if meta is None:
        return {"exists": False}
    return meta

@router.get("/tasks")
def list_consolidated_tasks(
    status: str = Query("all", pattern="^(all|pending|completed)$"),
    category: Optional[str] = Query(None),
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """
    Retorna la lista consolidada de compromisos de todas las reuniones guardadas.
    Permite filtrar por estado ('all', 'pending', 'completed') y categoría.
    """
    recordings_dir = _get_recordings_dir()
    tasks = TaskExportService.get_consolidated_tasks_for_export(
        recordings_dir=recordings_dir,
        metadata_repo=repo,
        status_filter=status,
        category_filter=category
    )
    return {
        "status": "ok",
        "total": len(tasks),
        "pending": sum(1 for t in tasks if not t.get("completed")),
        "completed": sum(1 for t in tasks if t.get("completed")),
        "tasks": tasks
    }

@router.get("/tasks/export")
def export_consolidated_tasks(
    format: str = Query("csv", pattern="^(csv|ics)$"),
    status: str = Query("all", pattern="^(all|pending|completed)$"),
    category: Optional[str] = Query(None),
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """
    Descarga los compromisos consolidados del historial en formato CSV (con UTF-8 BOM para Excel)
    o en formato iCalendar (.ics conforme a RFC 5545).
    """
    recordings_dir = _get_recordings_dir()
    tasks = TaskExportService.get_consolidated_tasks_for_export(
        recordings_dir=recordings_dir,
        metadata_repo=repo,
        status_filter=status,
        category_filter=category
    )

    fmt = format.lower()
    if fmt == "csv":
        content = TaskExportService.export_to_csv(tasks, is_consolidated=True)
        media_type = "text/csv; charset=utf-8"
        filename = "compromisos_consolidados.csv"
    else:
        content = TaskExportService.export_to_ics(tasks, is_consolidated=True, calendar_name="Compromisos Consolidados")
        media_type = "text/calendar; charset=utf-8"
        filename = "compromisos_consolidados.ics"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.delete("/{filename}")
def delete_recording(filename: str):
    """Elimina físicamente una grabación y sus metadatos asociados."""
    safe_filename = os.path.basename(filename)
    recordings_dir = _get_recordings_dir()
    audio_path = os.path.join(recordings_dir, safe_filename)
    json_path = _get_json_path(audio_path)
    
    deleted_audio = False
    deleted_json = False
    
    if os.path.exists(audio_path):
        try:
            os.remove(audio_path)
            deleted_audio = True
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al eliminar audio: {e}")
            
    if os.path.exists(json_path):
        try:
            os.remove(json_path)
            deleted_json = True
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al eliminar JSON: {e}")
            
    if not deleted_audio and not deleted_json:
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
        
    return {"status": "deleted", "deleted_audio": deleted_audio, "deleted_json": deleted_json}

@router.post("/{filename}/rename")
def rename_recording(filename: str, request: RenameRequest, repo: IMetadataRepository = Depends(get_metadata_repo)):
    """Renombra una grabación y su JSON de metadatos asociado."""
    safe_filename = os.path.basename(filename)
    # Se sanea antes de basename: "Reunión 6/oct" pasa a "Reunión 6-oct" en vez de quedarse en "oct"
    clean_target_name = os.path.basename(_sanitize_filename(request.new_name.strip()))
    if not clean_target_name:
        raise HTTPException(status_code=400, detail="El nuevo nombre no puede estar vacío.")

    recordings_dir = _get_recordings_dir()
    old_audio_path = os.path.join(recordings_dir, safe_filename)
    old_json_path = _get_json_path(old_audio_path)
    
    if not os.path.exists(old_audio_path):
        raise HTTPException(status_code=404, detail="Grabación no encontrada.")
        
    ext = os.path.splitext(safe_filename)[1].lower()
    
    new_filename_audio = clean_target_name
    if not new_filename_audio.lower().endswith(ext):
        new_filename_audio += ext
        
    new_audio_path = os.path.join(recordings_dir, new_filename_audio)
    new_json_path = _get_json_path(new_audio_path)
    
    if os.path.exists(new_audio_path):
        raise HTTPException(status_code=400, detail="Ya existe un archivo con ese nombre.")
        
    try:
        os.rename(old_audio_path, new_audio_path)
        
        if os.path.exists(old_json_path):
            os.rename(old_json_path, new_json_path)
            # Solo cambian filename y audio_path; el resto de claves (bookmarks, speaker_map, created...) se conserva
            repo.update_audio_path(new_json_path, new_audio_path)
                
        return {"status": "renamed", "new_filename": new_filename_audio, "new_path": new_audio_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{filename}/rename-speaker")
def rename_speaker(
    filename: str,
    request: RenameSpeakerRequest,
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """Renombra un hablante en todos los segmentos y metadatos de una grabación."""
    safe_filename = os.path.basename(filename)
    recordings_dir = _get_recordings_dir()
    audio_path = os.path.join(recordings_dir, safe_filename)
    json_path = _get_json_path(audio_path)

    if not os.path.exists(json_path) and not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Grabación o metadatos no encontrados.")

    old_speaker = request.old_speaker.strip()
    new_speaker = request.new_speaker.strip()

    if not old_speaker or not new_speaker:
        raise HTTPException(status_code=400, detail="Los nombres de hablante no pueden estar vacíos.")

    target_path = json_path if os.path.exists(json_path) else audio_path
    updated_meta = repo.rename_speaker(target_path, old_speaker, new_speaker)
    if not updated_meta:
        raise HTTPException(status_code=500, detail="Error al actualizar metadatos del hablante.")

    try:
        from services.session_manager import session_manager
        current_audio = session_manager.get_audio_path()
        if current_audio and os.path.basename(current_audio) == safe_filename:
            session_manager.set_transcript(updated_meta.get("transcript"))
            if updated_meta.get("analysis"):
                session_manager.set_analysis(updated_meta.get("analysis"))
    except Exception as e:
        print(f"[HistoryRouter] Advertencia sincronizando session_manager: {e}")

    return {
        "status": "updated",
        "filename": safe_filename,
        "old_speaker": old_speaker,
        "new_speaker": new_speaker,
        "metadata": updated_meta
    }

@router.post("/{filename}/bookmarks")
def add_recording_bookmark(
    filename: str,
    request: BookmarkRequest,
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """Agrega un marcador a los metadatos de una reunión existente."""
    safe_filename = os.path.basename(filename)
    recordings_dir = _get_recordings_dir()
    audio_path = os.path.join(recordings_dir, safe_filename)
    json_path = _get_json_path(audio_path)
    target_path = json_path if os.path.exists(json_path) else audio_path

    if not os.path.exists(json_path) and not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Grabación o metadatos no encontrados.")

    updated_meta = repo.add_bookmark(target_path, request.time, request.note or "")
    if not updated_meta:
        raise HTTPException(status_code=500, detail="Error al agregar marcador a la grabación.")
    return {"status": "ok", "metadata": updated_meta, "bookmarks": updated_meta.get("bookmarks", [])}

@router.delete("/{filename}/bookmarks/{bookmark_id}")
def delete_recording_bookmark(
    filename: str,
    bookmark_id: str,
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """Elimina un marcador de los metadatos de una reunión existente."""
    safe_filename = os.path.basename(filename)
    recordings_dir = _get_recordings_dir()
    audio_path = os.path.join(recordings_dir, safe_filename)
    json_path = _get_json_path(audio_path)
    target_path = json_path if os.path.exists(json_path) else audio_path

    if not os.path.exists(json_path) and not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Grabación o metadatos no encontrados.")

    updated_meta = repo.delete_bookmark(target_path, bookmark_id)
    if not updated_meta:
        raise HTTPException(status_code=500, detail="Error al eliminar marcador de la grabación.")
    return {"status": "ok", "metadata": updated_meta, "bookmarks": updated_meta.get("bookmarks", [])}

@router.patch("/{filename}/tasks/{task_index}")
def update_meeting_task(
    filename: str,
    task_index: int,
    request: TaskStatusRequest,
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """Actualiza el estado de completado (completed: True/False) de una tarea específica de la reunión."""
    safe_filename = os.path.basename(filename)
    recordings_dir = _get_recordings_dir()
    audio_path = os.path.join(recordings_dir, safe_filename)
    json_path = _get_json_path(audio_path)
    target_path = json_path if os.path.exists(json_path) else audio_path

    if not os.path.exists(json_path) and not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Grabación o metadatos no encontrados.")

    updated_meta = repo.update_action_item_status(target_path, task_index, request.completed)
    if not updated_meta:
        raise HTTPException(
            status_code=400, 
            detail=f"No se pudo actualizar la tarea en el índice {task_index}. Verifique que el análisis y la tarea existan."
        )

    action_items = updated_meta.get("analysis", {}).get("action_items", [])
    return {
        "status": "ok",
        "metadata": updated_meta,
        "action_items": action_items
    }

@router.get("/{filename}/tasks/export")
def export_meeting_tasks(
    filename: str,
    format: str = Query("csv", pattern="^(csv|ics)$"),
    status: str = Query("all", pattern="^(all|pending|completed)$"),
    title: Optional[str] = Query(None),
    repo: IMetadataRepository = Depends(get_metadata_repo)
):
    """
    Descarga los compromisos de una reunión individual en formato .csv o .ics (iCalendar).
    """
    safe_filename = os.path.basename(filename)
    recordings_dir = _get_recordings_dir()
    audio_path = os.path.join(recordings_dir, safe_filename)
    json_path = _get_json_path(audio_path)
    target_path = json_path if os.path.exists(json_path) else audio_path

    if not os.path.exists(json_path) and not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Grabación o metadatos no encontrados.")

    meta = repo.get_metadata(target_path)
    if not meta or not isinstance(meta, dict):
        raise HTTPException(status_code=404, detail="Metadatos no encontrados para la reunión.")

    base_name = os.path.splitext(safe_filename)[0]
    display_title = title.strip() if title and title.strip() else base_name
    tasks = TaskExportService.get_meeting_tasks_for_export(
        metadata=meta,
        meeting_title=display_title,
        status_filter=status
    )

    clean_slug = re.sub(r'[^a-zA-Z0-9_\-]', '_', base_name).strip('_') or "reunion"
    fmt = format.lower()
    if fmt == "csv":
        content = TaskExportService.export_to_csv(tasks, meeting_title=display_title, is_consolidated=False)
        media_type = "text/csv; charset=utf-8"
        download_name = f"compromisos_{clean_slug}.csv"
    else:
        content = TaskExportService.export_to_ics(tasks, meeting_title=display_title, is_consolidated=False)
        media_type = "text/calendar; charset=utf-8"
        download_name = f"compromisos_{clean_slug}.ics"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'}
    )

@router.get("/audio")
def get_audio_file(
    path: str,
    download: bool = False,
    filename: Optional[str] = None
):
    """
    Sirve el archivo de audio local para reproducción (inline) o descarga (attachment).
    Acepta tanto ruta absoluta dentro de grabaciones como solo el nombre de archivo.
    """
    resolved_path = path
    if not os.path.dirname(path):
        resolved_path = os.path.join(_get_recordings_dir(), path)

    if not _is_safe_recording_path(resolved_path):
        raise HTTPException(status_code=403, detail="Acceso denegado al archivo fuera del directorio de grabaciones.")

    if not os.path.isfile(resolved_path):
        raise HTTPException(status_code=404, detail="Archivo de audio no encontrado.")
    
    ext = os.path.splitext(resolved_path)[1].lower()
    if ext not in SUPPORTED_AUDIO_EXTS:
        raise HTTPException(status_code=400, detail="Formato de archivo no permitido.")
        
    import mimetypes
    mime_type, _ = mimetypes.guess_type(resolved_path)
    if not mime_type:
        mime_type = "audio/mpeg" if ext == ".mp3" else "audio/wav"

    if download:
        download_name = filename or os.path.basename(resolved_path)
        return FileResponse(resolved_path, media_type=mime_type, filename=download_name)
    return FileResponse(resolved_path, media_type=mime_type)

@router.post("/upload")
def upload_audio_file(file: UploadFile = File(...)):
    """Permite al usuario subir su propio archivo de audio para análisis."""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".wav", ".mp3", ".m4a", ".mp4", ".ogg", ".aac", ".flac"]:
        raise HTTPException(
            status_code=400,
            detail="Formato de audio no soportado. Formatos válidos: WAV, MP3, M4A, MP4, OGG, AAC, FLAC."
        )

    recordings_dir = _get_recordings_dir()
    os.makedirs(recordings_dir, exist_ok=True)

    filename = os.path.basename(file.filename)
    dest_path = os.path.join(recordings_dir, filename)

    base, extension = os.path.splitext(filename)
    counter = 1
    while os.path.exists(dest_path):
        filename = f"{base}_{counter}{extension}"
        dest_path = os.path.join(recordings_dir, filename)
        counter += 1

    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return {
            "status": "uploaded",
            "filename": filename,
            "path": dest_path
        }
    except Exception as e:
        if os.path.exists(dest_path):
            try:
                os.remove(dest_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Error al guardar el archivo: {str(e)}")

