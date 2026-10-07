from typing import Optional, Dict, Any, List
from abc import ABC, abstractmethod

class IAudioCapture(ABC):
    @property
    @abstractmethod
    def is_recording(self) -> bool:
        pass

    @property
    @abstractmethod
    def is_paused(self) -> bool:
        pass

    @property
    @abstractmethod
    def output_path(self) -> str:
        pass

    @abstractmethod
    def start(self, output_dir: str, mode: str, mic_device_id: str) -> str:
        pass

    @abstractmethod
    def pause(self):
        pass

    @abstractmethod
    def resume(self):
        pass

    @abstractmethod
    def stop(self) -> str:
        pass

    @abstractmethod
    def cancel(self):
        pass

    @property
    @abstractmethod
    def is_testing(self) -> bool:
        pass

    @abstractmethod
    def start_test(self, output_dir: str, mode: str, mic_device_id: str) -> str:
        pass

    @abstractmethod
    def stop_test(self) -> str:
        pass

    @abstractmethod
    def get_levels(self) -> dict:
        pass

class ITranscriber(ABC):
    @property
    @abstractmethod
    def model_name(self) -> str:
        pass

    @abstractmethod
    def set_config(self, config: 'Config'):
        pass

    @abstractmethod
    def set_model(self, model_name: str):
        pass

    @abstractmethod
    def get_progress(self) -> float:
        pass

    @abstractmethod
    def transcribe(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        pass

class IAnalyzer(ABC):
    @property
    @abstractmethod
    def model(self) -> str:
        pass

    @property
    @abstractmethod
    def ai_provider(self) -> str:
        pass

    @abstractmethod
    def set_config(self, config: 'Config'):
        pass

    @abstractmethod
    def is_running(self) -> bool:
        """Verifica si el proveedor (ej. Ollama local) está disponible"""
        pass

    @abstractmethod
    def diarize_transcript(self, segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def analyze(self, transcript: str, bookmarks: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        pass

    @abstractmethod
    def chat_with_transcript(self, transcript: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        pass

    @abstractmethod
    def chat_with_history(self, context: str, messages: List[Dict[str, Any]], new_question: str) -> str:
        pass

class IMetadataRepository(ABC):
    @abstractmethod
    def save_meeting_metadata(
        self, 
        audio_path: str, 
        transcript: str, 
        analysis: Dict[str, Any], 
        language: Optional[str] = None, 
        segments: Optional[List] = None,
        bookmarks: Optional[List] = None
    ):
        pass

    @abstractmethod
    def get_metadata(self, json_path: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def update_audio_path(self, json_path: str, audio_path: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def rename_speaker(self, audio_path: str, old_speaker: str, new_speaker: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def add_bookmark(self, audio_path: str, time: float, note: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def delete_bookmark(self, audio_path: str, bookmark_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def update_action_item_status(self, audio_path: str, task_index: int, completed: bool) -> Optional[Dict[str, Any]]:
        pass
