"""Whisper transcription service for audio-to-text conversion."""

from __future__ import annotations

import io
import structlog
from faster_whisper import WhisperModel
from typing import Optional

logger = structlog.get_logger(__name__)


class WhisperTranscriptionService:
    """Service for transcribing audio using Whisper."""

    def __init__(self, model_size: str = "base", device: str = "cpu", compute_type: str = "int8"):
        """
        Initialize Whisper transcription service.

        Args:
            model_size: Whisper model size (tiny, base, small, medium, large-v2, large-v3)
            device: Device to run on (cpu, cuda)
            compute_type: Compute type (int8, int8_float16, float16, float32)
        """
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self._model: Optional[WhisperModel] = None

    @property
    def model(self) -> WhisperModel:
        """Lazy load the Whisper model."""
        if self._model is None:
            logger.info("loading.whisper.model", model_size=self.model_size, device=self.device)
            self._model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type
            )
            logger.info("whisper.model.loaded")
        return self._model

    def transcribe(
        self,
        audio_data: bytes,
        language: Optional[str] = None,
        task: str = "transcribe"
    ) -> tuple[str, Optional[str], Optional[float]]:
        """
        Transcribe audio data to text.

        Args:
            audio_data: Raw audio bytes (WAV, MP3, etc.)
            language: Language code (e.g., 'en', 'de'). If None, auto-detect.
            task: Task type ('transcribe' or 'translate')

        Returns:
            Transcribed text
        """
        try:
            logger.info("transcribing.audio", language=language, task=task)
            
            # Convert bytes to file-like object
            audio_file = io.BytesIO(audio_data)
            
            # Transcribe using Whisper
            segments, info = self.model.transcribe(
                audio_file,
                language=language,
                task=task,
                beam_size=5,
                vad_filter=True,  # Voice Activity Detection
                vad_parameters=dict(min_silence_duration_ms=500)
            )
            
            # Combine all segments into a single text
            text_parts = []
            for segment in segments:
                text_parts.append(segment.text.strip())
            
            transcript = " ".join(text_parts).strip()
            
            logger.info(
                "transcription.complete",
                detected_language=info.language,
                language_probability=info.language_probability,
                text_length=len(transcript)
            )
            
            return transcript, info.language, info.language_probability
            
        except Exception as e:
            logger.error("transcription.failed", error=str(e), exc_info=True)
            raise

