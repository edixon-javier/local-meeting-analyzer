import os
import json
import time as time_module
import uuid
from typing import Optional, Dict, Any, List
from domain.interfaces import IMetadataRepository
from core.paths import get_recordings_dir


def _resolve_path(path: str) -> str:
    """Un nombre de archivo sin carpeta se interpreta relativo a la carpeta de grabaciones (no al CWD)."""
    if path and not os.path.dirname(path):
        return os.path.join(get_recordings_dir(), path)
    return path


class MetadataRepository(IMetadataRepository):
    def save_meeting_metadata(
        self, 
        audio_path: str, 
        transcript: str, 
        analysis: Dict[str, Any], 
        language: Optional[str] = None, 
        segments: Optional[List] = None,
        bookmarks: Optional[List] = None
    ):
        if not audio_path:
            return
        audio_path = _resolve_path(audio_path)
        base_path, _ = os.path.splitext(audio_path)
        json_path = base_path + ".json"
        
        # Cargar metadatos previos si existen para preservar bookmarks o speaker_map
        existing_meta = self.get_metadata(json_path) or {}
        
        final_bookmarks = bookmarks
        if final_bookmarks is None:
            final_bookmarks = existing_meta.get("bookmarks", [])
        else:
            final_bookmarks = sorted(list(final_bookmarks), key=lambda b: b.get("time", 0.0))

        metadata = {
            "filename": os.path.basename(audio_path),
            "audio_path": audio_path,
            "transcript": transcript,
            "analysis": analysis,
            "language": language or existing_meta.get("language"),
            "segments": segments if segments is not None else existing_meta.get("segments"),
            "bookmarks": final_bookmarks,
            "speaker_map": existing_meta.get("speaker_map"),
            "created": os.path.getctime(audio_path) if os.path.exists(audio_path) else existing_meta.get("created")
        }
        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            print(f"[MetadataRepo] Metadatos guardados en {json_path}")
        except Exception as e:
            print(f"[MetadataRepo] Error al guardar metadatos: {e}")

    def get_metadata(self, json_path: str) -> Optional[Dict[str, Any]]:
        json_path = _resolve_path(json_path)
        if not os.path.exists(json_path):
            return None
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[MetadataRepo] Error al cargar metadatos: {e}")
            return None

    def update_audio_path(self, json_path: str, audio_path: str) -> Optional[Dict[str, Any]]:
        """Actualiza solo `filename` y `audio_path` de un JSON existente, conservando el resto de claves."""
        json_path = _resolve_path(json_path)
        metadata = self.get_metadata(json_path)
        if not isinstance(metadata, dict):
            return None
        metadata["filename"] = os.path.basename(audio_path)
        metadata["audio_path"] = audio_path
        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            return metadata
        except Exception as e:
            print(f"[MetadataRepo] Error al actualizar ruta de audio en {json_path}: {e}")
            return None

    def rename_speaker(self, audio_path: str, old_speaker: str, new_speaker: str) -> Optional[Dict[str, Any]]:
        if not audio_path:
            return None

        audio_path = _resolve_path(audio_path)
        if audio_path.lower().endswith(".json"):
            json_path = audio_path
        else:
            base_path, _ = os.path.splitext(audio_path)
            json_path = base_path + ".json"

        if not os.path.exists(json_path):
            return None

        metadata = self.get_metadata(json_path)
        if not metadata:
            return None

        clean_old = old_speaker.strip()
        clean_new = new_speaker.strip()
        if not clean_old or not clean_new:
            return metadata

        # 1. Actualizar segmentos
        segments = metadata.get("segments") or []
        for seg in segments:
            if isinstance(seg, dict) and seg.get("speaker") == clean_old:
                seg["speaker"] = clean_new

        # 2. Actualizar transcript
        if segments and any(seg.get("speaker") for seg in segments):
            rebuilt_lines = []
            for seg in segments:
                spk = seg.get("speaker", "Hablante")
                txt = seg.get("text", "").strip()
                rebuilt_lines.append(f"{spk}: {txt}")
            metadata["transcript"] = "\n\n".join(rebuilt_lines)
        else:
            current_transcript = metadata.get("transcript", "")
            if current_transcript:
                import re
                pattern = re.compile(rf"(^|\n){re.escape(clean_old)}:", re.MULTILINE)
                metadata["transcript"] = pattern.sub(rf"\1{clean_new}:", current_transcript)

        # 3. Actualizar tareas pendientes (action_items)
        analysis = metadata.get("analysis")
        if isinstance(analysis, dict):
            action_items = analysis.get("action_items") or []
            for item in action_items:
                if isinstance(item, dict) and item.get("assignee") == clean_old:
                    item["assignee"] = clean_new

        # 4. Mantener registro speaker_map
        speaker_map = metadata.get("speaker_map") or {}
        speaker_map[clean_old] = clean_new
        metadata["speaker_map"] = speaker_map

        # 5. Persistir en archivo JSON
        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            print(f"[MetadataRepo] Hablante '{clean_old}' renombrado a '{clean_new}' en {json_path}")
            return metadata
        except Exception as e:
            print(f"[MetadataRepo] Error al actualizar hablante en {json_path}: {e}")
            return None

    def add_bookmark(self, audio_path: str, time: float, note: str = "") -> Optional[Dict[str, Any]]:
        if not audio_path:
            return None
        audio_path = _resolve_path(audio_path)
        if audio_path.lower().endswith(".json"):
            json_path = audio_path
        else:
            base_path, _ = os.path.splitext(audio_path)
            json_path = base_path + ".json"

        if not os.path.exists(json_path):
            return None

        metadata = self.get_metadata(json_path)
        if not metadata:
            return None

        bookmarks = metadata.get("bookmarks")
        if bookmarks is None or not isinstance(bookmarks, list):
            bookmarks = []

        new_bm = {
            "id": str(uuid.uuid4()),
            "time": round(float(time), 2),
            "note": str(note).strip() if note else "",
            "created_at": time_module.time()
        }
        bookmarks.append(new_bm)
        bookmarks.sort(key=lambda b: b.get("time", 0.0))
        metadata["bookmarks"] = bookmarks

        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            print(f"[MetadataRepo] Bookmark agregado a {json_path}: {new_bm['time']}s")
            return metadata
        except Exception as e:
            print(f"[MetadataRepo] Error al agregar bookmark en {json_path}: {e}")
            return None

    def delete_bookmark(self, audio_path: str, bookmark_id: str) -> Optional[Dict[str, Any]]:
        if not audio_path or not bookmark_id:
            return None
        audio_path = _resolve_path(audio_path)
        if audio_path.lower().endswith(".json"):
            json_path = audio_path
        else:
            base_path, _ = os.path.splitext(audio_path)
            json_path = base_path + ".json"

        if not os.path.exists(json_path):
            return None

        metadata = self.get_metadata(json_path)
        if not metadata:
            return None

        bookmarks = metadata.get("bookmarks", [])
        if not isinstance(bookmarks, list):
            return metadata

        initial_len = len(bookmarks)
        bookmarks = [b for b in bookmarks if str(b.get("id")) != str(bookmark_id)]
        if len(bookmarks) == initial_len:
            return metadata

        metadata["bookmarks"] = bookmarks
        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            print(f"[MetadataRepo] Bookmark {bookmark_id} eliminado de {json_path}")
            return metadata
        except Exception as e:
            print(f"[MetadataRepo] Error al eliminar bookmark en {json_path}: {e}")
            return None

    def update_action_item_status(self, audio_path: str, task_index: int, completed: bool) -> Optional[Dict[str, Any]]:
        if not audio_path or task_index < 0:
            return None
        audio_path = _resolve_path(audio_path)
        if audio_path.lower().endswith(".json"):
            json_path = audio_path
        else:
            base_path, _ = os.path.splitext(audio_path)
            json_path = base_path + ".json"

        if not os.path.exists(json_path):
            return None

        metadata = self.get_metadata(json_path)
        if not metadata:
            return None

        analysis = metadata.get("analysis")
        if not isinstance(analysis, dict):
            return None

        action_items = analysis.get("action_items")
        if not isinstance(action_items, list) or task_index >= len(action_items):
            return None

        task_item = action_items[task_index]
        if not isinstance(task_item, dict):
            return None

        task_item["completed"] = bool(completed)
        task_item["updated_at"] = time_module.time()

        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            print(f"[MetadataRepo] Tarea #{task_index} actualizada (completed={completed}) en {json_path}")
            return metadata
        except Exception as e:
            print(f"[MetadataRepo] Error al actualizar estado de tarea en {json_path}: {e}")
            return None
