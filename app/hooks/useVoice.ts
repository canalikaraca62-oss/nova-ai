"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;

  onstart: (() => void) | null;
  onend: (() => void) | null;

  onresult: (
    event: SpeechRecognitionEvent
  ) => void;

  onerror: (
    event: SpeechRecognitionErrorEvent
  ) => void;

  start: () => void;
  stop: () => void;
  abort: () => void;
}

export interface UseVoiceOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  voice?: SpeechSynthesisVoice | null;
}

export interface UseVoiceReturn {
  transcript: string;

  interimTranscript: string;

  isListening: boolean;

  isSpeaking: boolean;

  isPaused: boolean;

  isSupported: boolean;

  error: string | null;

  startListening: () => void;

  stopListening: () => void;

  abortListening: () => void;

  clearTranscript: () => void;

  speak: (
    text: string,
    options?: SpeakOptions
  ) => void;

  stopSpeaking: () => void;

  pauseSpeaking: () => void;

  resumeSpeaking: () => void;

  clearError: () => void;
}

function getSpeechRecognitionConstructor():
  | SpeechRecognitionConstructor
  | null {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  const browserWindow =
    window as Window &
      typeof globalThis & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };

  return (
    browserWindow.SpeechRecognition ??
    browserWindow.webkitSpeechRecognition ??
    null
  );
}

function getSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !==
      "undefined"
  );
}

export function useVoice(
  options: UseVoiceOptions = {}
): UseVoiceReturn {
  const {
    language = "en-US",
    continuous = true,
    interimResults = true,
    maxAlternatives = 1,
  } = options;

  const [transcript, setTranscript] =
    useState("");

  const [
    interimTranscript,
    setInterimTranscript,
  ] = useState("");

  const [isListening, setIsListening] =
    useState(false);

  const [isSpeaking, setIsSpeaking] =
    useState(false);

  const [isPaused, setIsPaused] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const recognitionRef =
    useRef<SpeechRecognition | null>(
      null
    );

  const utteranceRef =
    useRef<SpeechSynthesisUtterance | null>(
      null
    );

  const isSupported =
    typeof window !== "undefined" &&
    getSpeechRecognitionConstructor() !==
      null;

  const clearError =
    useCallback(() => {
      setError(null);
    }, []);

  const clearTranscript =
    useCallback(() => {
      setTranscript("");
      setInterimTranscript("");
    }, []);

  const initializeRecognition =
    useCallback(() => {
      if (
        recognitionRef.current
      ) {
        return recognitionRef.current;
      }

      const RecognitionConstructor =
        getSpeechRecognitionConstructor();

      if (!RecognitionConstructor) {
        setError(
          "Speech recognition is not supported in this browser."
        );

        return null;
      }

      const recognition =
        new RecognitionConstructor();

      recognition.lang = language;

      recognition.continuous =
        continuous;

      recognition.interimResults =
        interimResults;

      recognition.maxAlternatives =
        maxAlternatives;

      recognition.onstart = () => {
        setError(null);
        setIsListening(true);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
      };

      recognition.onresult = (
        event: SpeechRecognitionEvent
      ) => {
        let finalTranscript = "";
        let currentInterimTranscript =
          "";

        for (
          let index = 0;
          index < event.results.length;
          index += 1
        ) {
          const result =
            event.results[index];

          const alternative =
            result[0];

          if (!alternative) {
            continue;
          }

          if (result.isFinal) {
            finalTranscript +=
              alternative.transcript;
          } else {
            currentInterimTranscript +=
              alternative.transcript;
          }
        }

        if (finalTranscript) {
          setTranscript(
            (currentTranscript) =>
              currentTranscript +
              finalTranscript
          );
        }

        setInterimTranscript(
          currentInterimTranscript
        );
      };

      recognition.onerror = (
        event: SpeechRecognitionErrorEvent
      ) => {
        if (
          event.error === "aborted"
        ) {
          return;
        }

        setError(
          event.message ||
            event.error ||
            "Voice recognition failed."
        );

        setIsListening(false);
      };

      recognitionRef.current =
        recognition;

      return recognition;
    }, [
      continuous,
      interimResults,
      language,
      maxAlternatives,
    ]);

  const startListening =
    useCallback(() => {
      setError(null);

      const recognition =
        initializeRecognition();

      if (!recognition) {
        return;
      }

      try {
        recognition.start();
      } catch (voiceError) {
        const message =
          voiceError instanceof Error
            ? voiceError.message
            : "Could not start voice recognition.";

        setError(message);
      }
    }, [initializeRecognition]);

  const stopListening =
    useCallback(() => {
      recognitionRef.current?.stop();
    }, []);

  const abortListening =
    useCallback(() => {
      recognitionRef.current?.abort();

      setIsListening(false);

      setInterimTranscript("");
    }, []);

  const speak = useCallback(
    (
      text: string,
      speakOptions: SpeakOptions = {}
    ) => {
      if (!text.trim()) {
        return;
      }

      if (
        !getSpeechSynthesisSupported()
      ) {
        setError(
          "Speech synthesis is not supported in this browser."
        );

        return;
      }

      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(
          text
        );

      utterance.rate =
        speakOptions.rate ?? 1;

      utterance.pitch =
        speakOptions.pitch ?? 1;

      utterance.volume =
        speakOptions.volume ?? 1;

      utterance.lang =
        speakOptions.lang ?? language;

      if (speakOptions.voice) {
        utterance.voice =
          speakOptions.voice;
      }

      utterance.onstart = () => {
        setError(null);
        setIsPaused(false);
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsPaused(false);
        setIsSpeaking(false);
        utteranceRef.current = null;
      };

      utterance.onerror = (
        speechError
      ) => {
        if (
          speechError.error !==
          "canceled"
        ) {
          setError(
            speechError.error ||
              "Speech synthesis failed."
          );
        }

        setIsPaused(false);
        setIsSpeaking(false);
        utteranceRef.current = null;
      };

      utteranceRef.current =
        utterance;

      window.speechSynthesis.speak(
        utterance
      );
    },
    [language]
  );

  const stopSpeaking =
    useCallback(() => {
      if (
        !getSpeechSynthesisSupported()
      ) {
        return;
      }

      window.speechSynthesis.cancel();

      utteranceRef.current = null;

      setIsSpeaking(false);

      setIsPaused(false);
    }, []);

  const pauseSpeaking =
    useCallback(() => {
      if (
        !getSpeechSynthesisSupported()
      ) {
        return;
      }

      if (
        window.speechSynthesis.speaking
      ) {
        window.speechSynthesis.pause();

        setIsPaused(true);
      }
    }, []);

  const resumeSpeaking =
    useCallback(() => {
      if (
        !getSpeechSynthesisSupported()
      ) {
        return;
      }

      if (
        window.speechSynthesis.paused
      ) {
        window.speechSynthesis.resume();

        setIsPaused(false);

        setIsSpeaking(true);
      }
    }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();

      recognitionRef.current = null;

      if (
        getSpeechSynthesisSupported()
      ) {
        window.speechSynthesis.cancel();
      }

      utteranceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!recognitionRef.current) {
      return;
    }

    recognitionRef.current.lang =
      language;

    recognitionRef.current.continuous =
      continuous;

    recognitionRef.current.interimResults =
      interimResults;

    recognitionRef.current.maxAlternatives =
      maxAlternatives;
  }, [
    continuous,
    interimResults,
    language,
    maxAlternatives,
  ]);

  return {
    transcript,

    interimTranscript,

    isListening,

    isSpeaking,

    isPaused,

    isSupported,

    error,

    startListening,

    stopListening,

    abortListening,

    clearTranscript,

    speak,

    stopSpeaking,

    pauseSpeaking,

    resumeSpeaking,

    clearError,
  };
}

export default useVoice;