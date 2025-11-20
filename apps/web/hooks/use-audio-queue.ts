"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const createObjectUrlFromBase64 = (audioBase64: string, mimeType: string) => {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
};

export const useAudioQueue = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const cleanupUrl = useCallback((url?: string) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const playNext = useCallback(() => {
    if (!audioRef.current) {
      return;
    }

    const nextUrl = queueRef.current.shift();
    if (!nextUrl) {
      playingRef.current = false;
      setIsPlaying(false);
      audioRef.current.removeAttribute("src");
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      return;
    }

    playingRef.current = true;
    setIsPlaying(true);
    audioRef.current.src = nextUrl;
    audioRef.current.onended = () => {
      cleanupUrl(nextUrl);
      playNext();
    };
    audioRef.current.onerror = () => {
      cleanupUrl(nextUrl);
      playNext();
    };
    void audioRef.current.play().catch(() => {
      cleanupUrl(nextUrl);
      playNext();
    });
  }, [cleanupUrl]);

  const enqueue = useCallback(
    (audioBase64: string, mimeType = "audio/mpeg") => {
      if (typeof window === "undefined") {
        return;
      }
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      const url = createObjectUrlFromBase64(audioBase64, mimeType);
      queueRef.current.push(url);
      if (!playingRef.current) {
        playNext();
      }
    },
    [playNext]
  );

  const stop = useCallback(() => {
    queueRef.current.forEach((url) => cleanupUrl(url));
    queueRef.current = [];
    if (audioRef.current) {
      cleanupUrl(audioRef.current.src);
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }
    playingRef.current = false;
    setIsPlaying(false);
  }, [cleanupUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return () => {
      stop();
      audioRef.current = null;
    };
  }, [stop]);

  return {
    enqueue,
    stop,
    isPlaying
  };
};


