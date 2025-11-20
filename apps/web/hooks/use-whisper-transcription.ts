"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface TranscriptionResult {
  text: string;
  language?: string;
  language_probability?: number;
}

interface UseWhisperTranscriptionOptions {
  onTranscriptionComplete?: (text: string) => void;
}

export const useWhisperTranscription = (options?: UseWhisperTranscriptionOptions) => {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const onTranscriptionCompleteRef = useRef(options?.onTranscriptionComplete);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const maxRecordingTimeRef = useRef<number | null>(null);
  
  // Update callback ref when options change
  useEffect(() => {
    onTranscriptionCompleteRef.current = options?.onTranscriptionComplete;
  }, [options?.onTranscriptionComplete]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      setTranscript("");

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create AudioContext for VAD
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") 
          ? "audio/webm" 
          : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/wav"
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      silenceStartRef.current = null;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Clean up VAD
        if (vadIntervalRef.current) {
          clearInterval(vadIntervalRef.current);
          vadIntervalRef.current = null;
        }
        if (maxRecordingTimeRef.current) {
          clearTimeout(maxRecordingTimeRef.current);
          maxRecordingTimeRef.current = null;
        }
        if (audioContextRef.current) {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }
        analyserRef.current = null;

        // Stop all tracks
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        // Transcribe audio
        if (audioChunksRef.current.length > 0) {
          await transcribeAudio();
        }
      };

      // Start VAD monitoring
      const startVAD = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const SILENCE_THRESHOLD = 20; // Adjust based on testing (0-255)
        const SILENCE_DURATION = 2000; // 2 seconds of silence before stopping
        const MAX_RECORDING_TIME = 30000; // 30 seconds max

        // Set max recording time
        maxRecordingTimeRef.current = window.setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
            setRecording(false);
          }
        }, MAX_RECORDING_TIME);

        // Monitor audio levels
        vadIntervalRef.current = window.setInterval(() => {
          if (!analyserRef.current || !mediaRecorderRef.current) {
            return;
          }
          
          analyser.getByteFrequencyData(dataArray);
          
          // Calculate average volume
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          
          if (average > SILENCE_THRESHOLD) {
            // Voice detected, reset silence timer
            silenceStartRef.current = null;
          } else {
            // Silence detected
            const now = Date.now();
            if (silenceStartRef.current === null) {
              silenceStartRef.current = now;
            } else if (now - silenceStartRef.current >= SILENCE_DURATION) {
              // Silence for long enough, stop recording
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
                setRecording(false);
              }
            }
          }
        }, 100); // Check every 100ms
      };

      mediaRecorder.start();
      setRecording(true);
      
      // Start VAD after a short delay to avoid false positives
      setTimeout(startVAD, 500);
      
      return true;
    } catch (err) {
      const error = err as Error;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setError("Microphone permission denied. Please allow microphone access in your browser settings.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setError("No microphone found. Please connect a microphone.");
      } else {
        setError(`Failed to start recording: ${error.message}`);
      }
      setRecording(false);
      return false;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      // Clean up VAD
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
      }
      if (maxRecordingTimeRef.current) {
        clearTimeout(maxRecordingTimeRef.current);
        maxRecordingTimeRef.current = null;
      }
      
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, []);

  const transcribeAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      setError("No audio recorded");
      return;
    }

    try {
      setTranscribing(true);
      setError(null);

      // Combine audio chunks into a single blob
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || "audio/webm"
      });

      // Create FormData
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      // Get API base URL - use relative path for nginx routing
      // nginx routes /api/voice to chat-api service
      const apiUrl = "/api/voice/transcribe";

      // Send to server
      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Transcription failed: ${errorText}`);
      }

      const result: TranscriptionResult = await response.json();
      const transcribedText = result.text || "";
      setTranscript(transcribedText);
      
      // Call callback if provided
      if (onTranscriptionCompleteRef.current && transcribedText.trim()) {
        onTranscriptionCompleteRef.current(transcribedText);
      }
    } catch (err) {
      const error = err as Error;
      setError(`Transcription failed: ${error.message}`);
      setTranscript("");
    } finally {
      setTranscribing(false);
      audioChunksRef.current = [];
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  return {
    recording,
    transcribing,
    transcript,
    error,
    startRecording,
    stopRecording,
    resetTranscript,
  };
};

