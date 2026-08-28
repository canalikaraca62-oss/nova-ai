"use client";

import {
  Mic,
  Pause,
  Play,
  RotateCcw,
  Send,
  Square,
  Volume2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type VoiceChatProps = {
  onTranscript?: (transcript: string) => void;
  onSend?: (transcript: string) => void | Promise<void>;
  onClose?: () => void;
  className?: string;
  disabled?: boolean;
  autoTranscribe?: boolean;
};

type RecordingStatus =
  | "idle"
  | "recording"
  | "processing"
  | "ready"
  | "error";

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const mimeTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return (
    mimeTypes.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType)
    ) ?? ""
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");

  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Microphone permission was denied.";
    }

    if (error.name === "NotFoundError") {
      return "No microphone was found.";
    }

    if (error.name === "NotReadableError") {
      return "Your microphone is currently unavailable.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while using voice chat.";
}

export default function VoiceChat({
  onTranscript,
  onSend,
  onClose,
  className = "",
  disabled = false,
  autoTranscribe = true,
}: VoiceChatProps) {
  const recorderRef =
    useRef<MediaRecorder | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const chunksRef =
    useRef<Blob[]>([]);

  const timerRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const [status, setStatus] =
    useState<RecordingStatus>("idle");

  const [duration, setDuration] =
    useState(0);

  const [audioUrl, setAudioUrl] =
    useState<string | null>(null);

  const [audioBlob, setAudioBlob] =
    useState<Blob | null>(null);

  const [transcript, setTranscript] =
    useState("");

  const [error, setError] =
    useState<string | null>(null);

  const [isPlaying, setIsPlaying] =
    useState(false);

  const audioRef =
    useRef<HTMLAudioElement | null>(null);

  const stopMediaStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetRecording = useCallback(() => {
    clearTimer();

    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      recorderRef.current.stop();
    }

    stopMediaStream();

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    recorderRef.current = null;
    chunksRef.current = [];

    setDuration(0);
    setAudioUrl(null);
    setAudioBlob(null);
    setTranscript("");
    setError(null);
    setIsPlaying(false);
    setStatus("idle");
  }, [
    audioUrl,
    clearTimer,
    stopMediaStream,
  ]);

  useEffect(() => {
    return () => {
      clearTimer();

      if (
        recorderRef.current &&
        recorderRef.current.state !== "inactive"
      ) {
        recorderRef.current.stop();
      }

      stopMediaStream();

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [
    audioUrl,
    clearTimer,
    stopMediaStream,
  ]);

  const transcribeAudio = useCallback(
    async (blob: Blob) => {
      setStatus("processing");
      setError(null);

      try {
        const formData = new FormData();

        const extension =
          blob.type.includes("mp4")
            ? "m4a"
            : blob.type.includes("ogg")
              ? "ogg"
              : "webm";

        formData.append(
          "file",
          blob,
          `voice-recording.${extension}`
        );

        const response = await fetch(
          "/api/voice/transcribe",
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            typeof data?.error === "string"
              ? data.error
              : "Voice transcription failed."
          );
        }

        const nextTranscript =
          typeof data?.transcript === "string"
            ? data.transcript
            : typeof data?.text === "string"
              ? data.text
              : typeof data?.message === "string"
                ? data.message
                : "";

        if (!nextTranscript.trim()) {
          throw new Error(
            "No speech could be detected."
          );
        }

        setTranscript(nextTranscript);
        setStatus("ready");

        onTranscript?.(nextTranscript);
      } catch (transcriptionError) {
        console.error(
          "VOICE TRANSCRIPTION ERROR:",
          transcriptionError
        );

        setError(
          getErrorMessage(transcriptionError)
        );

        setStatus("error");
      }
    },
    [onTranscript]
  );

  const startRecording = useCallback(
    async () => {
      if (disabled || status === "processing") {
        return;
      }

      try {
        setError(null);

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error(
            "Voice recording is not supported in this browser."
          );
        }

        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });

        streamRef.current = stream;
        chunksRef.current = [];

        const mimeType =
          getSupportedMimeType();

        const recorder = mimeType
          ? new MediaRecorder(stream, {
              mimeType,
            })
          : new MediaRecorder(stream);

        recorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          clearTimer();
          stopMediaStream();

          const recordedMimeType =
            recorder.mimeType ||
            mimeType ||
            "audio/webm";

          const blob = new Blob(
            chunksRef.current,
            {
              type: recordedMimeType,
            }
          );

          if (blob.size === 0) {
            setError(
              "No audio was recorded. Please try again."
            );

            setStatus("error");
            return;
          }

          const nextAudioUrl =
            URL.createObjectURL(blob);

          setAudioBlob(blob);
          setAudioUrl(nextAudioUrl);

          if (autoTranscribe) {
            await transcribeAudio(blob);
          } else {
            setStatus("ready");
          }
        };

        recorder.onerror = () => {
          clearTimer();
          stopMediaStream();

          setError(
            "The voice recording failed."
          );

          setStatus("error");
        };

        setDuration(0);
        setAudioBlob(null);
        setTranscript("");
        setAudioUrl(null);
        setStatus("recording");

        recorder.start(250);

        timerRef.current = setInterval(() => {
          setDuration((current) => current + 1);
        }, 1000);
      } catch (recordingError) {
        console.error(
          "VOICE RECORDING ERROR:",
          recordingError
        );

        clearTimer();
        stopMediaStream();

        setError(
          getErrorMessage(recordingError)
        );

        setStatus("error");
      }
    },
    [
      autoTranscribe,
      clearTimer,
      disabled,
      status,
      stopMediaStream,
      transcribeAudio,
    ]
  );

  const stopRecording = useCallback(() => {
    const recorder =
      recorderRef.current;

    if (!recorder) {
      return;
    }

    if (recorder.state !== "inactive") {
      recorder.stop();
    }

    clearTimer();
    setStatus("processing");
  }, [clearTimer]);

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    try {
      if (audio.paused) {
        await audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    } catch (playbackError) {
      console.error(
        "VOICE PLAYBACK ERROR:",
        playbackError
      );

      setError(
        "Audio playback could not be started."
      );
    }
  }, []);

  const sendTranscript = useCallback(async () => {
    const message = transcript.trim();

    if (!message || disabled) {
      return;
    }

    try {
      await onSend?.(message);
    } catch (sendError) {
      console.error(
        "VOICE MESSAGE SEND ERROR:",
        sendError
      );

      setError(
        getErrorMessage(sendError)
      );
    }
  }, [
    disabled,
    onSend,
    transcript,
  ]);

  const processExistingAudio =
    useCallback(async () => {
      if (!audioBlob) {
        return;
      }

      await transcribeAudio(audioBlob);
    }, [
      audioBlob,
      transcribeAudio,
    ]);

  const isRecording =
    status === "recording";

  const isProcessing =
    status === "processing";

  const canSend =
    status === "ready" &&
    transcript.trim().length > 0 &&
    !disabled;

  return (
    <div
      className={[
        "w-full rounded-2xl border",
        "border-white/10 bg-background/95",
        "p-3 shadow-2xl backdrop-blur-xl",
        className,
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={
            isRecording
              ? stopRecording
              : startRecording
          }
          disabled={
            disabled ||
            isProcessing
          }
          className={[
            "flex h-12 w-12 shrink-0 items-center",
            "justify-center rounded-full border",
            "transition-all duration-200",
            "disabled:cursor-not-allowed",
            "disabled:opacity-50",
            isRecording
              ? [
                  "border-red-500/40",
                  "bg-red-500/15",
                  "text-red-400",
                  "animate-pulse",
                ].join(" ")
              : [
                  "border-primary/30",
                  "bg-primary/10",
                  "text-primary",
                  "hover:scale-105",
                  "hover:bg-primary/20",
                ].join(" "),
          ].join(" ")}
          aria-label={
            isRecording
              ? "Stop recording"
              : "Start voice recording"
          }
        >
          {isRecording ? (
            <Square className="h-4 w-4 fill-current" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          {isRecording ? (
            <>
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />

                <span className="text-sm font-medium">
                  Recording
                </span>

                <span className="ml-auto font-mono text-sm text-muted-foreground">
                  {formatDuration(duration)}
                </span>
              </div>

              <div className="flex h-6 items-center gap-1 overflow-hidden">
                {Array.from(
                  { length: 28 },
                  (_, index) => (
                    <span
                      key={index}
                      className="w-1 flex-1 rounded-full bg-primary/70 animate-pulse"
                      style={{
                        height: `${
                          25 +
                          ((index * 17 +
                            duration * 11) %
                            70)
                        }%`,
                        animationDelay: `${
                          index * 35
                        }ms`,
                      }}
                    />
                  )
                )}
              </div>
            </>
          ) : isProcessing ? (
            <div>
              <p className="text-sm font-medium">
                Processing voice...
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Your audio is being prepared and transcribed.
              </p>
            </div>
          ) : transcript ? (
            <div>
              <p className="truncate text-sm font-medium">
                Voice message ready
              </p>

              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {transcript}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium">
                Voice conversation
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Tap the microphone and start speaking.
              </p>
            </div>
          )}
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close voice chat"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {audioUrl ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-muted/30 p-2">
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => {
              setIsPlaying(false);
            }}
            onPause={() => {
              setIsPlaying(false);
            }}
            onPlay={() => {
              setIsPlaying(true);
            }}
          />

          <button
            type="button"
            onClick={togglePlayback}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background transition-transform hover:scale-105"
            aria-label={
              isPlaying
                ? "Pause recording"
                : "Play recording"
            }
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">
              Voice recording
            </p>

            <p className="text-xs text-muted-foreground">
              {formatDuration(duration)}
            </p>
          </div>

          <Volume2 className="h-4 w-4 text-muted-foreground" />

          <button
            type="button"
            onClick={resetRecording}
            disabled={isProcessing}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
            aria-label="Discard recording"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
          <p className="text-xs text-red-400">
            {error}
          </p>

          {audioBlob ? (
            <button
              type="button"
              onClick={processExistingAudio}
              className="text-xs font-medium text-red-300 hover:text-red-200"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {transcript ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-muted/20 p-3">
          <textarea
            value={transcript}
            onChange={(event) => {
              setTranscript(
                event.target.value
              );
            }}
            rows={3}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Your transcription will appear here..."
          />

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
            <span className="text-xs text-muted-foreground">
              Edit before sending if needed.
            </span>

            <button
              type="button"
              onClick={sendTranscript}
              disabled={!canSend}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type {
  VoiceChatProps,
  RecordingStatus,
};