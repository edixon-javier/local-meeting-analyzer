import threading
import time as time_module
import uuid
from typing import Dict, Any, Optional, List

class SessionManager:
    """Maneja el estado de la sesión activa en memoria de forma encapsulada y segura para concurrencia."""
    
    def __init__(self):
        self._lock = threading.Lock()
        self._state: Dict[str, Any] = {
            "session_id": None,
            "recording": False,
            "paused": False,
            "audio_path": None,
            "transcript": None,
            "live_transcript": None,
            "analysis": None,
            "processing": False,
            "bookmarks": []
        }

    def get_state(self) -> Dict[str, Any]:
        with self._lock:
            state_copy = self._state.copy()
            state_copy["bookmarks"] = list(self._state.get("bookmarks", []))
            return state_copy

    def set_recording(self, status: bool):
        with self._lock:
            self._state["recording"] = status

    def set_paused(self, status: bool):
        with self._lock:
            self._state["paused"] = status

    def set_audio_path(self, path: Optional[str]):
        with self._lock:
            self._state["audio_path"] = path

    def set_transcript(self, transcript: Optional[str]):
        with self._lock:
            self._state["transcript"] = transcript

    def set_analysis(self, analysis: Optional[Dict[str, Any]]):
        with self._lock:
            self._state["analysis"] = analysis

    def set_processing(self, status: bool):
        with self._lock:
            self._state["processing"] = status

    def get_audio_path(self) -> Optional[str]:
        with self._lock:
            return self._state.get("audio_path")

    def is_processing(self) -> bool:
        with self._lock:
            return bool(self._state.get("processing", False))

    def get_transcript(self) -> Optional[str]:
        with self._lock:
            return self._state.get("transcript")

    def set_session_id(self, session_id: Optional[str]):
        with self._lock:
            self._state["session_id"] = session_id

    def get_session_id(self) -> Optional[str]:
        with self._lock:
            return self._state.get("session_id")

    def set_live_transcript(self, transcript: Optional[str]):
        with self._lock:
            self._state["live_transcript"] = transcript

    def get_live_transcript(self) -> Optional[str]:
        with self._lock:
            return self._state.get("live_transcript")

    def add_bookmark(self, seconds: float, note: str = "") -> Dict[str, Any]:
        with self._lock:
            if "bookmarks" not in self._state:
                self._state["bookmarks"] = []
            
            clean_time = max(0.0, round(float(seconds), 1))
            clean_note = (note or "").strip() or "Momento clave"
            bm = {
                "id": f"bm_{int(time_module.time())}_{uuid.uuid4().hex[:6]}",
                "time": clean_time,
                "note": clean_note,
                "created_at": time_module.time()
            }
            self._state["bookmarks"].append(bm)
            self._state["bookmarks"].sort(key=lambda b: b["time"])
            return bm

    def get_bookmarks(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._state.get("bookmarks", []))

    def set_bookmarks(self, bookmarks: List[Dict[str, Any]]):
        with self._lock:
            self._state["bookmarks"] = sorted(list(bookmarks or []), key=lambda b: b.get("time", 0.0))

    def delete_bookmark(self, bookmark_id: str) -> bool:
        with self._lock:
            curr = self._state.get("bookmarks", [])
            new_list = [b for b in curr if b.get("id") != bookmark_id]
            found = len(new_list) < len(curr)
            self._state["bookmarks"] = new_list
            return found

    def reset_for_new_recording(self):
        with self._lock:
            self._state["session_id"] = None
            self._state["transcript"] = None
            self._state["live_transcript"] = None
            self._state["analysis"] = None
            self._state["processing"] = False
            self._state["bookmarks"] = []

# Single instance for the application lifecycle
session_manager = SessionManager()
