import os
import json
import shutil
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from domain.interfaces import IMetadataRepository
from services.metadata_repository import MetadataRepository


router = APIRouter()

class RenameRequest(BaseModel):
    new_name: str

def get_metadata_repo() -> IMetadataRepository:
    return MetadataRepository()

def _get_json_path(audio_path: str) -> str:
    if audio_path.endswith(".wav"):
        return audio_path.replace(".wav", ".json")
    elif audio_path.endswith(".mp3"):
        return audio_path.replace(".mp3", ".json")
    return audio_path + ".json"

def _get_recordings_dir() -> str:
    return os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "recordings")

@router.get("/")
def list_recordings(repo: IMetadataRepository = Depends(get_metadata_repo)):
    """Lista todos los archivos de grabación guardados y sus metadatos si existen."""
    recordings_dir = _get_recordings_dir()
    if not os.path.exists(recordings_dir):
        return {"recordings": []}

    files = []
    for f in sorted(os.listdir(recordings_dir), reverse=True):
        if f.endswith(".wav") or f.endswith(".mp3"):
            path = os.path.join(recordings_dir, f)
            json_path = _get_json_path(path)
            
            meta = repo.get_metadata(json_path)
            has_metadata = meta is not None
            
            category = None
            tone = None
            if meta:
                analysis = meta.get("analysis", {})
                category = analysis.get("category")
                tone = analysis.get("tone")
            
            files.append({
                "filename": f,
                "path": path,
                "size_mb": round(os.path.getsize(path) / 1024 / 1024, 2),
                "created": os.path.getctime(path),
                "has_metadata": has_metadata,
                "category": category,
                "tone": tone
            })

    return {"recordings": files}

@router.get("/metadata")
def get_recording_metadata(path: str, repo: IMetadataRepository = Depends(get_metadata_repo)):
    """Obtiene los metadatos guardados (transcripción, análisis, etc.) para una grabación."""
    json_path = _get_json_path(path)
    meta = repo.get_metadata(json_path)
    if meta is None:
        return {"exists": False}
    return meta

@router.delete("/{filename}")
def delete_recording(filename: str):
    """Elimina físicamente una grabación y sus metadatos asociados."""
    recordings_dir = _get_recordings_dir()
    audio_path = os.path.join(recordings_dir, filename)
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
    recordings_dir = _get_recordings_dir()
    old_audio_path = os.path.join(recordings_dir, filename)
    old_json_path = _get_json_path(old_audio_path)
    
    if not os.path.exists(old_audio_path):
        raise HTTPException(status_code=404, detail="Grabación no encontrada.")
        
    ext = ".mp3" if filename.endswith(".mp3") else ".wav"
    
    new_filename_audio = request.new_name.strip()
    if not new_filename_audio.endswith(ext):
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

@router.get("/audio")
def get_audio_file(path: str):
    """Sirve el archivo de audio local para ser reproducido en el frontend."""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Archivo de audio no encontrado.")
    
    mime_type = "audio/mpeg" if path.endswith(".mp3") else "audio/wav"
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

