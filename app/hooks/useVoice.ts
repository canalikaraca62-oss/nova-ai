"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ==================================================
   WEB SPEECH API TYPES
================================================== */

interface VoiceRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface VoiceRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: VoiceRecognitionAlternative;
}

interface VoiceRecognitionResultList {
  length: number;
  [index: number]: VoiceRecognitionResult;
}

interface VoiceRecognitionEvent extends Event {
  resultIndex: number;
  results: VoiceRecognitionResultList;
}

interface VoiceRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface VoiceRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;

  onstart: (() => void) | null;

  onend: (() => void) | null;

  onresult:
    | ((
        event: VoiceRecognitionEvent
      ) => void)
    | null;

  onerror:
    | ((
        event: VoiceRecognitionErrorEvent
      ) => void)
    | null;

  start: () => void;

  stop: () => void;

  abort: () => void;
}

type SpeechRecognitionConstructor =
  new () => VoiceRecognitionInstance;

/* ==================================================
   OPTIONS
================================================== */

export interface UseVoiceOptions {
  language?: string;

  continuous?: boolean;

  interimResults?: boolean;

  maxAlternatives?: number;

  /**
   * Recognition beklenmedik şekilde kapanırsa
   * continuous modda otomatik tekrar başlatır.
   */
  autoRestart?: boolean;
}

export interface SpeakOptions {
  rate?: number;

  pitch?: number;

  volume?: number;

  lang?: string;

  voice?: SpeechSynthesisVoice | null;
}

/* ==================================================
   RETURN TYPE
================================================== */

export interface UseVoiceReturn {
  transcript: string;

  interimTranscript: string;

  isListening: boolean;

  isSpeaking: boolean;

  isPaused: boolean;

  isSupported: boolean;

  isSpeechRecognitionSupported: boolean;

  isSpeechSynthesisSupported: boolean;

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

/* ==================================================
   CONSTANTS
================================================== */

const RESTART_DELAY = 250;

/* ==================================================
   ENVIRONMENT HELPERS
================================================== */

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getSpeechRecognitionConstructor():
  | SpeechRecognitionConstructor
  | null {
  if (!isBrowser()) {
    return null;
  }

  const browserWindow =
    window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

  return (
    browserWindow.SpeechRecognition ??
    browserWindow.webkitSpeechRecognition ??
    null
  );
}

function isSpeechRecognitionSupported(): boolean {
  return (
    isBrowser() &&
    getSpeechRecognitionConstructor() !== null
  );
}

function isSpeechSynthesisSupported(): boolean {
  return (
    isBrowser() &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !==
      "undefined"
  );
}

/* ==================================================
   ERROR HELPERS
================================================== */

function getRecognitionErrorMessage(
  event: VoiceRecognitionErrorEvent
): string {
  if (event.message?.trim()) {
    return event.message;
  }

  switch (event.error) {
    case "no-speech":
      return "No speech was detected.";

    case "audio-capture":
      return "No microphone was found or microphone access failed.";

    case "not-allowed":
      return "Microphone permission was denied.";

    case "service-not-allowed":
      return "Speech recognition service is not allowed.";

    case "network":
      return "A network error occurred during speech recognition.";

    case "language-not-supported":
      return "The selected speech recognition language is not supported.";

    case "bad-grammar":
      return "Speech recognition grammar is invalid.";

    default:
      return (
        event.error ||
        "Speech recognition failed."
      );
  }
}

function getSpeechErrorMessage(
  error: string
): string {
  switch (error) {
    case "audio-busy":
      return "Audio output is currently busy.";

    case "audio-hardware":
      return "Audio hardware is unavailable.";

    case "network":
      return "A network error occurred during speech synthesis.";

    case "not-allowed":
      return "Speech synthesis is not allowed.";

    case "synthesis-failed":
      return "Speech synthesis failed.";

    case "language-unavailable":
      return "The selected language is unavailable.";

    case "voice-unavailable":
      return "The selected voice is unavailable.";

    case "text-too-long":
      return "The text is too long to synthesize.";

    default:
      return error || "Speech synthesis failed.";
  }
}

/* ==================================================
   HOOK
================================================== */

export function useVoice(
  options: UseVoiceOptions = {}
): UseVoiceReturn {
  const {
    language = "en-US",
    continuous = true,
    interimResults = true,
    maxAlternatives = 1,
    autoRestart = true,
  } = options;

  /* ==================================================
     STATE
  ================================================== */

  const [transcript, setTranscript] =
    useState<string>("");

  const [
    interimTranscript,
    setInterimTranscript,
  ] = useState<string>("");

  const [isListening, setIsListening] =
    useState<boolean>(false);

  const [isSpeaking, setIsSpeaking] =
    useState<boolean>(false);

  const [isPaused, setIsPaused] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string | null>(null);

  /* ==================================================
     REFS
  ================================================== */

  const recognitionRef =
    useRef<VoiceRecognitionInstance | null>(
      null
    );

  const utteranceRef =
    useRef<SpeechSynthesisUtterance | null>(
      null
    );

  const mountedRef =
    useRef<boolean>(false);

  const shouldListenRef =
    useRef<boolean>(false);

  const isStartingRef =
    useRef<boolean>(false);

  const isStoppingRef =
    useRef<boolean>(false);

  const restartTimeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const optionsRef =
    useRef<UseVoiceOptions>({
      language,
      continuous,
      interimResults,
      maxAlternatives,
      autoRestart,
    });

  /* ==================================================
     SUPPORT
  ================================================== */

  const speechRecognitionSupported =
    useMemo(
      () => isSpeechRecognitionSupported(),
      []
    );

  const speechSynthesisSupported =
    useMemo(
      () => isSpeechSynthesisSupported(),
      []
    );

  const isSupported =
    speechRecognitionSupported ||
    speechSynthesisSupported;

  /* ==================================================
     SAFE STATE HELPERS
  ================================================== */

  const safeSetError =
    useCallback(
      (
        value: string | null
      ): void => {
        if (!mountedRef.current) {
          return;
        }

        setError(value);
      },
      []
    );

  const safeSetIsListening =
    useCallback(
      (
        value: boolean
      ): void => {
        if (!mountedRef.current) {
          return;
        }

        setIsListening(value);
      },
      []
    );

  const safeSetIsSpeaking =
    useCallback(
      (
        value: boolean
      ): void => {
        if (!mountedRef.current) {
          return;
        }

        setIsSpeaking(value);
      },
      []
    );

  const safeSetIsPaused =
    useCallback(
      (
        value: boolean
      ): void => {
        if (!mountedRef.current) {
          return;
        }

        setIsPaused(value);
      },
      []
    );

  /* ==================================================
     OPTIONS REF SYNC
  ================================================== */

  useEffect(() => {
    optionsRef.current = {
      language,
      continuous,
      interimResults,
      maxAlternatives,
      autoRestart,
    };
  }, [
    language,
    continuous,
    interimResults,
    maxAlternatives,
    autoRestart,
  ]);

  /* ==================================================
     CLEAR ERROR
  ================================================== */

  const clearError =
    useCallback((): void => {
      safeSetError(null);
    }, [safeSetError]);

  /* ==================================================
     CLEAR TRANSCRIPT
  ================================================== */

  const clearTranscript =
    useCallback((): void => {
      if (!mountedRef.current) {
        return;
      }

      setTranscript("");
      setInterimTranscript("");
    }, []);

  /* ==================================================
     CLEAR RESTART TIMER
  ================================================== */

  const clearRestartTimer =
    useCallback((): void => {
      if (
        restartTimeoutRef.current !== null
      ) {
        clearTimeout(
          restartTimeoutRef.current
        );

        restartTimeoutRef.current =
          null;
      }
    }, []);

  /* ==================================================
     START RECOGNITION SAFELY
  ================================================== */

  const startRecognitionInstance =
    useCallback(
      (
        recognition: VoiceRecognitionInstance
      ): void => {
        if (!mountedRef.current) {
          return;
        }

        if (!shouldListenRef.current) {
          return;
        }

        if (isStartingRef.current) {
          return;
        }

        isStartingRef.current = true;
        isStoppingRef.current = false;

        try {
          recognition.start();
        } catch (caughtError) {
          const errorObject =
            caughtError as Error & {
              name?: string;
            };

          /*
           * Recognition zaten çalışıyorsa
           * tekrar hata verme.
           */
          if (
            errorObject?.name ===
            "InvalidStateError"
          ) {
            return;
          }

          shouldListenRef.current = false;

          safeSetIsListening(false);

          safeSetError(
            caughtError instanceof Error
              ? caughtError.message
              : "Could not start speech recognition."
          );
        } finally {
          isStartingRef.current = false;
        }
      },
      [
        safeSetError,
        safeSetIsListening,
      ]
    );

  /* ==================================================
     INITIALIZE RECOGNITION
  ================================================== */

  const initializeRecognition =
    useCallback(():
      | VoiceRecognitionInstance
      | null => {
      if (recognitionRef.current) {
        return recognitionRef.current;
      }

      const RecognitionConstructor =
        getSpeechRecognitionConstructor();

      if (!RecognitionConstructor) {
        safeSetError(
          "Speech recognition is not supported in this browser."
        );

        return null;
      }

      const recognition =
        new RecognitionConstructor();

      const currentOptions =
        optionsRef.current;

      recognition.lang =
        currentOptions.language ??
        "en-US";

      recognition.continuous =
        currentOptions.continuous ?? true;

      recognition.interimResults =
        currentOptions.interimResults ??
        true;

      recognition.maxAlternatives =
        currentOptions.maxAlternatives ?? 1;

      /* ==============================================
         ON START
      ============================================== */

      recognition.onstart = () => {
        if (!mountedRef.current) {
          return;
        }

        clearRestartTimer();

        safeSetError(null);

        safeSetIsListening(true);
      };

      /* ==============================================
         ON END
      ============================================== */

      recognition.onend = () => {
        if (!mountedRef.current) {
          return;
        }

        safeSetIsListening(false);

        setInterimTranscript("");

        const currentOptions =
          optionsRef.current;

        const shouldRestart =
          shouldListenRef.current &&
          !isStoppingRef.current &&
          currentOptions.continuous === true &&
          currentOptions.autoRestart !== false;

        if (!shouldRestart) {
          return;
        }

        clearRestartTimer();

        restartTimeoutRef.current =
          setTimeout(() => {
            restartTimeoutRef.current =
              null;

            if (
              !mountedRef.current ||
              !shouldListenRef.current
            ) {
              return;
            }

            startRecognitionInstance(
              recognition
            );
          }, RESTART_DELAY);
      };

      /* ==============================================
         ON RESULT
      ============================================== */

      recognition.onresult = (
        event: VoiceRecognitionEvent
      ) => {
        if (!mountedRef.current) {
          return;
        }

        let finalText = "";

        let interimText = "";

        /*
         * Çok önemli:
         * resultIndex'ten başlamak aynı sonuçların
         * tekrar tekrar transcript'e eklenmesini engeller.
         */
        const startIndex =
          typeof event.resultIndex === "number"
            ? event.resultIndex
            : 0;

        for (
          let index = startIndex;
          index < event.results.length;
          index += 1
        ) {
          const result =
            event.results[index];

          if (!result) {
            continue;
          }

          const alternative =
            result[0];

          if (!alternative?.transcript) {
            continue;
          }

          const text =
            alternative.transcript;

          if (result.isFinal) {
            finalText += text;
          } else {
            interimText += text;
          }
        }

        if (finalText.length > 0) {
          setTranscript(
            (currentTranscript) =>
              currentTranscript +
              finalText
          );
        }

        setInterimTranscript(
          interimText
        );
      };

      /* ==============================================
         ON ERROR
      ============================================== */

      recognition.onerror = (
        event: VoiceRecognitionErrorEvent
      ) => {
        if (!mountedRef.current) {
          return;
        }

        /*
         * abort manuel işlemse hata gösterme.
         */
        if (
          event.error === "aborted" &&
          isStoppingRef.current
        ) {
          return;
        }

        /*
         * no-speech çoğu browser'da normal
         * continuous kullanımında oluşabilir.
         */
        if (
          event.error === "no-speech" &&
          shouldListenRef.current &&
          optionsRef.current.continuous
        ) {
          return;
        }

        safeSetError(
          getRecognitionErrorMessage(
            event
          )
        );

        /*
         * Kritik izin/hardware hatalarında
         * tekrar başlatma yapma.
         */
        const fatalErrors = new Set([
          "not-allowed",
          "service-not-allowed",
          "audio-capture",
          "language-not-supported",
        ]);

        if (
          fatalErrors.has(event.error)
        ) {
          shouldListenRef.current = false;

          clearRestartTimer();

          safeSetIsListening(false);
        }
      };

      recognitionRef.current =
        recognition;

      return recognition;
    }, [
      clearRestartTimer,
      safeSetError,
      safeSetIsListening,
      startRecognitionInstance,
    ]);

  /* ==================================================
     START LISTENING
  ================================================== */

  const startListening =
    useCallback((): void => {
      if (!mountedRef.current) {
        return;
      }

      if (!speechRecognitionSupported) {
        safeSetError(
          "Speech recognition is not supported in this browser."
        );

        return;
      }

      clearRestartTimer();

      shouldListenRef.current = true;

      isStoppingRef.current = false;

      safeSetError(null);

      const recognition =
        initializeRecognition();

      if (!recognition) {
        shouldListenRef.current = false;
        return;
      }

      const currentOptions =
        optionsRef.current;

      recognition.lang =
        currentOptions.language ??
        "en-US";

      recognition.continuous =
        currentOptions.continuous ?? true;

      recognition.interimResults =
        currentOptions.interimResults ??
        true;

      recognition.maxAlternatives =
        currentOptions.maxAlternatives ?? 1;

      startRecognitionInstance(
        recognition
      );
    }, [
      clearRestartTimer,
      initializeRecognition,
      safeSetError,
      speechRecognitionSupported,
      startRecognitionInstance,
    ]);

  /* ==================================================
     STOP LISTENING
  ================================================== */

  const stopListening =
    useCallback((): void => {
      clearRestartTimer();

      shouldListenRef.current = false;

      isStoppingRef.current = true;

      const recognition =
        recognitionRef.current;

      if (!recognition) {
        safeSetIsListening(false);
        setInterimTranscript("");
        return;
      }

      try {
        recognition.stop();
      } catch {
        /*
         * Browser state hataları burada
         * uygulamayı bozmamalı.
         */
      }

      safeSetIsListening(false);

      setInterimTranscript("");
    }, [
      clearRestartTimer,
      safeSetIsListening,
    ]);

  /* ==================================================
     ABORT LISTENING
  ================================================== */

  const abortListening =
    useCallback((): void => {
      clearRestartTimer();

      shouldListenRef.current = false;

      isStoppingRef.current = true;

      const recognition =
        recognitionRef.current;

      if (recognition) {
        try {
          recognition.abort();
        } catch {
          // Ignore browser state errors.
        }
      }

      safeSetIsListening(false);

      setInterimTranscript("");
    }, [
      clearRestartTimer,
      safeSetIsListening,
    ]);

  /* ==================================================
     SPEAK
  ================================================== */

  const speak = useCallback(
    (
      text: string,
      speakOptions: SpeakOptions = {}
    ): void => {
      const normalizedText =
        text.trim();

      if (!normalizedText) {
        return;
      }

      if (!speechSynthesisSupported) {
        safeSetError(
          "Speech synthesis is not supported in this browser."
        );

        return;
      }

      try {
        /*
         * Önce çalışan konuşmayı durdur.
         */
        window.speechSynthesis.cancel();

        utteranceRef.current = null;

        const utterance =
          new SpeechSynthesisUtterance(
            normalizedText
          );

        utterance.rate =
          Math.min(
            10,
            Math.max(
              0.1,
              speakOptions.rate ?? 1
            )
          );

        utterance.pitch =
          Math.min(
            2,
            Math.max(
              0,
              speakOptions.pitch ?? 1
            )
          );

        utterance.volume =
          Math.min(
            1,
            Math.max(
              0,
              speakOptions.volume ?? 1
            )
          );

        utterance.lang =
          speakOptions.lang ??
          optionsRef.current.language ??
          "en-US";

        if (speakOptions.voice) {
          utterance.voice =
            speakOptions.voice;
        }

        utterance.onstart = () => {
          if (!mountedRef.current) {
            return;
          }

          safeSetError(null);

          safeSetIsPaused(false);

          safeSetIsSpeaking(true);
        };

        utterance.onpause = () => {
          if (!mountedRef.current) {
            return;
          }

          safeSetIsPaused(true);
        };

        utterance.onresume = () => {
          if (!mountedRef.current) {
            return;
          }

          safeSetIsPaused(false);

          safeSetIsSpeaking(true);
        };

        utterance.onend = () => {
          if (!mountedRef.current) {
            return;
          }

          if (
            utteranceRef.current ===
            utterance
          ) {
            utteranceRef.current = null;
          }

          safeSetIsPaused(false);

          safeSetIsSpeaking(false);
        };

        utterance.onerror = (
          event
        ) => {
          if (!mountedRef.current) {
            return;
          }

          if (
            utteranceRef.current ===
            utterance
          ) {
            utteranceRef.current = null;
          }

          /*
           * cancel manuel stop sırasında
           * normal davranıştır.
           */
          if (
            event.error !== "canceled" &&
            event.error !== "interrupted"
          ) {
            safeSetError(
              getSpeechErrorMessage(
                event.error
              )
            );
          }

          safeSetIsPaused(false);

          safeSetIsSpeaking(false);
        };

        utteranceRef.current =
          utterance;

        safeSetError(null);

        safeSetIsPaused(false);

        safeSetIsSpeaking(true);

        window.speechSynthesis.speak(
          utterance
        );
      } catch (caughtError) {
        utteranceRef.current = null;

        safeSetIsPaused(false);

        safeSetIsSpeaking(false);

        safeSetError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not start speech synthesis."
        );
      }
    },
    [
      safeSetError,
      safeSetIsPaused,
      safeSetIsSpeaking,
      speechSynthesisSupported,
    ]
  );

  /* ==================================================
     STOP SPEAKING
  ================================================== */

  const stopSpeaking =
    useCallback((): void => {
      if (
        !speechSynthesisSupported
      ) {
        return;
      }

      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser errors.
      }

      utteranceRef.current = null;

      safeSetIsPaused(false);

      safeSetIsSpeaking(false);
    }, [
      safeSetIsPaused,
      safeSetIsSpeaking,
      speechSynthesisSupported,
    ]);

  /* ==================================================
     PAUSE SPEAKING
  ================================================== */

  const pauseSpeaking =
    useCallback((): void => {
      if (
        !speechSynthesisSupported
      ) {
        return;
      }

      if (
        window.speechSynthesis.speaking &&
        !window.speechSynthesis.paused
      ) {
        try {
          window.speechSynthesis.pause();

          safeSetIsPaused(true);
        } catch (caughtError) {
          safeSetError(
            caughtError instanceof Error
              ? caughtError.message
              : "Could not pause speech synthesis."
          );
        }
      }
    }, [
      safeSetError,
      safeSetIsPaused,
      speechSynthesisSupported,
    ]);

  /* ==================================================
     RESUME SPEAKING
  ================================================== */

  const resumeSpeaking =
    useCallback((): void => {
      if (
        !speechSynthesisSupported
      ) {
        return;
      }

      if (
        window.speechSynthesis.paused
      ) {
        try {
          window.speechSynthesis.resume();

          safeSetIsPaused(false);

          safeSetIsSpeaking(true);
        } catch (caughtError) {
          safeSetError(
            caughtError instanceof Error
              ? caughtError.message
              : "Could not resume speech synthesis."
          );
        }
      }
    }, [
      safeSetError,
      safeSetIsPaused,
      safeSetIsSpeaking,
      speechSynthesisSupported,
    ]);

  /* ==================================================
     UPDATE EXISTING RECOGNITION SETTINGS
  ================================================== */

  useEffect(() => {
    const recognition =
      recognitionRef.current;

    if (!recognition) {
      return;
    }

    recognition.lang = language;

    recognition.continuous =
      continuous;

    recognition.interimResults =
      interimResults;

    recognition.maxAlternatives =
      maxAlternatives;
  }, [
    language,
    continuous,
    interimResults,
    maxAlternatives,
  ]);

  /* ==================================================
     MOUNT / UNMOUNT
  ================================================== */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      shouldListenRef.current = false;

      isStoppingRef.current = true;

      if (
        restartTimeoutRef.current !==
        null
      ) {
        clearTimeout(
          restartTimeoutRef.current
        );

        restartTimeoutRef.current =
          null;
      }

      const recognition =
        recognitionRef.current;

      if (recognition) {
        recognition.onstart = null;
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;

        try {
          recognition.abort();
        } catch {
          // Ignore cleanup errors.
        }
      }

      recognitionRef.current = null;

      if (
        isSpeechSynthesisSupported()
      ) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore cleanup errors.
        }
      }

      utteranceRef.current = null;
    };
  }, []);

  /* ==================================================
     RETURN
  ================================================== */

  return {
    transcript,

    interimTranscript,

    isListening,

    isSpeaking,

    isPaused,

    isSupported,

    isSpeechRecognitionSupported:
      speechRecognitionSupported,

    isSpeechSynthesisSupported:
      speechSynthesisSupported,

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