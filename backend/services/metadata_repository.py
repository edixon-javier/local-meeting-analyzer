import os
import json
from typing import Optional, Dict, Any, List
from domain.interfaces import IMetadataRepository

class MetadataRepository(IMetadataRepository):
    def save_meeting_metadata(self, audio_path: str, transcript: str, analysis: Dict[str, Any], language: Optional[str] = None, segments: Optional[List] = None):
        if not audio_path:
            return
        json_path = audio_path.replace(".wav", ".json").replace(".mp3", ".json")
        metadata = {
            "filename": os.path.basename(audio_path),
            "audio_path": audio_path,
            "transcript": transcript,
            "analysis": analysis,
            "language": language,
            "segments": segments,
            "created": os.path.getctime(audio_path) if os.path.exists(audio_path) else None
        }
        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            print(f"[MetadataRepo] Metadatos guardados en {json_path}")
        except Exception as e:
            print(f"[MetadataRepo] Error al guardar metadatos: {e}")

    def get_metadata(self, json_path: str) -> Optional[Dict[str, Any]]:
        if not os.path.exists(json_path):
            return None
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[MetadataRepo] Error al cargar metadatos: {e}")
            return None
