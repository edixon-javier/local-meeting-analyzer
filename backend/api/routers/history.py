import os
import json
import shutil
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from domain.interfaces import IMetadataRepository
from services.metadata_repository import MetadataRepository


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
    return os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "recordings")

def _is_safe_recording_path(path: str) -> bool:
    try:
        real_path = os.path.realpath(path)
        real_recordings = os.path.realpath(_get_recordings_dir())
        return real_path == real_recordings or real_path.startswith(real_recordings + os.sep)
    except Exception:
        return False

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
            if meta:
                analysis = meta.get("analysis") or {}
                category = analysis.get("category")
                tone = analysis.get("tone")
            
            files.append({
                "filename": f,
                "path": path,
                "size_mb": round(os.path.getsize(path) / 1024 / 1024, 2),
                "created": os.path.getctime(path),
                "has_metadata": has_metadata,
                "category": category,
                "tone": tone,
                "bookmarks_count": len(meta.get("bookmarks", [])) if (meta and isinstance(meta.get("bookmarks"), list)) else 0
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
    clean_target_name = os.path.basename(request.new_name.strip())
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
            meta = repo.get_metadata(new_json_path)
            if meta:
                meta["audio_path"] = new_audio_path
                meta["filename"] = new_filename_audio
                repo.save_meeting_metadata(
                    audio_path=new_audio_path,
                    transcript=meta.get("transcript", ""),
                    analysis=meta.get("analysis", {}),
                    language=meta.get("language"),
                    segments=meta.get("segments")
                )
                
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

@router.get("/audio")
def get_audio_file(path: str):
    """Sirve el archivo de audio local para ser reproducido en el frontend."""
    if not _is_safe_recording_path(path):
        raise HTTPException(status_code=403, detail="Acceso denegado al archivo fuera del directorio de grabaciones.")

    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Archivo de audio no encontrado.")
    
    ext = os.path.splitext(path)[1].lower()
    if ext not in SUPPORTED_AUDIO_EXTS:
        raise HTTPException(status_code=400, detail="Formato de archivo no permitido.")
        
    import mimetypes
    mime_type, _ = mimetypes.guess_type(path)
    if not mime_type:
        mime_type = "audio/mpeg" if ext == ".mp3" else "audio/wav"
    return FileResponse(path, media_type=mime_type)

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

