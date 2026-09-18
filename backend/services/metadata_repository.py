import os
import json
from typing import Optional, Dict, Any, List
from domain.interfaces import IMetadataRepository

class MetadataRepository(IMetadataRepository):
    def save_meeting_metadata(self, audio_path: str, transcript: str, analysis: Dict[str, Any], language: Optional[str] = None, segments: Optional[List] = None):
        if not audio_path:
            return
        base_path, _ = os.path.splitext(audio_path)
        json_path = base_path + ".json"
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

    def rename_speaker(self, audio_path: str, old_speaker: str, new_speaker: str) -> Optional[Dict[str, Any]]:
        if not audio_path:
            return None

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
