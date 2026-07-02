from typing import Dict, Any, Optional

class SessionManager:
    """Maneja el estado de la sesión activa en memoria de forma encapsulada."""
    
    def __init__(self):
        self._state: Dict[str, Any] = {
            "recording": False,
            "paused": False,
            "audio_path": None,
            "transcript": None,
            "analysis": None,
            "processing": False
        }

    def get_state(self) -> Dict[str, Any]:
        return self._state.copy()

    def set_recording(self, status: bool):
        self._state["recording"] = status

    def set_paused(self, status: bool):
        self._state["paused"] = status

    def set_audio_path(self, path: Optional[str]):
        self._state["audio_path"] = path

    def set_transcript(self, transcript: Optional[str]):
        self._state["transcript"] = transcript

    def set_analysis(self, analysis: Optional[Dict[str, Any]]):
        self._state["analysis"] = analysis

    def set_processing(self, status: bool):
        self._state["processing"] = status

    def get_audio_path(self) -> Optional[str]:
        return self._state.get("audio_path")

    def is_processing(self) -> bool:
        return self._state.get("processing", False)

    def get_transcript(self) -> Optional[str]:
        return self._state.get("transcript")

    def reset_for_new_recording(self):
        self._state["transcript"] = None
        self._state["analysis"] = None

# Single instance for the application lifecycle
session_manager = SessionManager()
