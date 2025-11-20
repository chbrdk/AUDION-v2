"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

const getRecognitionConstructor = (): RecognitionConstructor | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const globalWindow = window as typeof window & {
    webkitSpeechRecognition?: RecognitionConstructor;
    SpeechRecognition?: RecognitionConstructor;
  };

  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition ?? null;
};

export const useSpeechToText = () => {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ensureRecognition = useCallback(() => {
    if (recognitionRef.current) {
      return recognitionRef.current;
    }

    const RecognitionCtor = getRecognitionConstructor();
    if (!RecognitionCtor) {
      return null;
    }

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = typeof navigator !== "undefined" ? navigator.language ?? "en-US" : "en-US";
    recognition.onresult = (event) => {
      let latestTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        latestTranscript += result[0]?.transcript ?? "";
      }
      setTranscript(latestTranscript.trim());
    };
    recognition.onerror = (event) => {
      const errorCode = event.error ?? "";
      let userMessage = "Speech recognition error";
      
      if (errorCode === "not-allowed" || errorCode === "no-speech") {
        userMessage = "Microphone permission denied. Please allow microphone access in your browser settings.";
      } else if (errorCode === "aborted") {
        // Don't show error for aborted - it's usually intentional
        setListening(false);
        return;
      } else if (errorCode === "network") {
        userMessage = "Cannot connect to speech recognition service. Please check your internet connection. The Web Speech API requires an active internet connection to Google's speech recognition service.";
      } else if (errorCode === "audio-capture") {
        userMessage = "No microphone found. Please connect a microphone.";
      } else if (errorCode === "service-not-allowed") {
        userMessage = "Speech recognition service is not available. Please check your browser settings or try again later.";
      } else if (errorCode === "bad-grammar") {
        userMessage = "Speech recognition grammar error.";
      } else if (errorCode === "language-not-supported") {
        userMessage = "The selected language is not supported for speech recognition.";
      } else if (errorCode) {
        userMessage = `Speech recognition error: ${errorCode}`;
      }
      
      setError(userMessage);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setSupported(true);
    return recognition;
  }, []);

  useEffect(() => {
    ensureRecognition();
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, [ensureRecognition]);

  const startListening = useCallback(async (): Promise<boolean> => {
    setError(null);
    const recognition = ensureRecognition();
    if (!recognition) {
      setSupported(false);
      setError("Speech recognition is not supported in this browser.");
      return false;
    }
    
    // Check if mediaDevices API is available
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // If not available, try to start recognition directly (some browsers handle permissions differently)
      try {
        recognition.start();
        setListening(true);
        setTranscript("");
        return true;
      } catch (err) {
        const error = err as Error;
        if (error.message.includes("not-allowed") || error.message.includes("permission")) {
          setError("Microphone permission denied. Please allow microphone access in your browser settings. Note: HTTPS is required for microphone access.");
        } else {
          setError(`Failed to start speech recognition: ${error.message}`);
        }
        setListening(false);
        return false;
      }
    }
    
    // Request microphone permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      const error = err as Error;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setError("Microphone permission denied. Please allow microphone access in your browser settings.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setError("No microphone found. Please connect a microphone.");
      } else if (error.name === "NotSupportedError" || error.name === "NotReadableError") {
        setError("Microphone access is not available. Please ensure you're using HTTPS or localhost.");
      } else {
        setError(`Failed to access microphone: ${error.message || "Unknown error"}`);
      }
      setListening(false);
      return false;
    }
    
    try {
      recognition.start();
      setListening(true);
      setTranscript("");
      return true;
    } catch (err) {
      const error = err as Error;
      if (error.message.includes("already started") || error.message.includes("started")) {
        // Recognition is already running, try to stop and restart
        try {
          recognition.stop();
          await new Promise((resolve) => setTimeout(resolve, 100));
          recognition.start();
          setListening(true);
          setTranscript("");
          return true;
        } catch (retryErr) {
          setError((retryErr as Error).message);
          setListening(false);
          return false;
        }
      }
      setError(error.message || "Failed to start speech recognition.");
      setListening(false);
      return false;
    }
  }, [ensureRecognition]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  return {
    supported,
    listening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript
  };
};


