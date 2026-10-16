"use client";

import { uploadPresigned } from "@vercel/blob/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { APP_NAME, INSTRUCTOR_NAME, STUDENT_NAME } from "@/lib/branding";
import { readApiError } from "@/lib/read-api-error";
import { openFrontCameraStream, PracticeRecorder } from "@/lib/recorder";

type Phase = "requesting" | "ready" | "countdown" | "recording" | "uploading" | "done" | "error";

const PIANO_ID = "piano";
const PIANO_TITLE = "Piano practice";

export function PianoRecorder() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<PracticeRecorder | null>(null);
  const cancelRequested = useRef(false);

  const [phase, setPhase] = useState<Phase>("requesting");
  const [countdown, setCountdown] = useState(3);
  const [message, setMessage] = useState("");

  const attachPreview = useCallback((stream: MediaStream | null) => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => {});
  }, []);

  const stopPreview = useCallback(() => {
    previewRef.current?.getTracks().forEach((track) => track.stop());
    previewRef.current = null;
    attachPreview(null);
  }, [attachPreview]);

  const openCamera = useCallback(async () => {
    setMessage("");
    setPhase("requesting");
    const stream = await openFrontCameraStream();
    previewRef.current?.getTracks().forEach((track) => track.stop());
    previewRef.current = stream;
    attachPreview(stream);
    setPhase("ready");
  }, [attachPreview]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stream = await openFrontCameraStream();
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        previewRef.current = stream;
        attachPreview(stream);
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setMessage(
          `Allow ${APP_NAME} to use the camera and microphone so ${STUDENT_NAME} can record piano.`,
        );
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      previewRef.current?.getTracks().forEach((track) => track.stop());
      previewRef.current = null;
      recorderRef.current?.cancel();
    };
  }, [attachPreview]);

  const startRecording = async () => {
    setMessage("");
    cancelRequested.current = false;
    try {
      if (!previewRef.current) await openCamera();
      if (cancelRequested.current) return;

      setPhase("countdown");
      setCountdown(3);
      for (let i = 3; i >= 1; i--) {
        if (cancelRequested.current) return;
        setCountdown(i);
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      if (cancelRequested.current) return;

      const recorder = new PracticeRecorder();
      recorderRef.current = recorder;
      stopPreview();
      await recorder.start();
      attachPreview(recorder.previewStream);
      setPhase("recording");
    } catch (err) {
      console.error(err);
      stopPreview();
      recorderRef.current?.cancel();
      recorderRef.current = null;
      setMessage(
        `Camera or mic blocked. Allow ${APP_NAME} to use the camera and microphone in Settings.`,
      );
      setPhase("error");
    }
  };

  const stopAndUpload = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    setPhase("uploading");
    attachPreview(null);

    try {
      const { blob, mimeType } = await recorder.stop();
      recorderRef.current = null;

      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const id = crypto.randomUUID();
      const file = new File([blob], `eva-piano.${ext}`, { type: mimeType });

      const uploaded = await uploadPresigned(`videos/${id}.${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/videos/upload",
        clientPayload: JSON.stringify({
          songId: PIANO_ID,
          songTitle: PIANO_TITLE,
          studentName: STUDENT_NAME,
        }),
        multipart: file.size > 4 * 1024 * 1024,
        contentType: mimeType,
      });

      const res = await fetch("/api/videos/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          songId: PIANO_ID,
          songTitle: PIANO_TITLE,
          studentName: STUDENT_NAME,
          url: uploaded.url,
        }),
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, "Upload failed"));
      }
      setPhase("done");
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  };

  const cancel = () => {
    cancelRequested.current = true;
    recorderRef.current?.cancel();
    recorderRef.current = null;
    stopPreview();
    void openCamera().catch(() => {
      setMessage(
        `Allow ${APP_NAME} to use the camera and microphone so ${STUDENT_NAME} can record piano.`,
      );
      setPhase("error");
    });
  };

  const recordAgain = () => {
    setMessage("");
    void openCamera().catch(() => {
      setMessage(
        `Allow ${APP_NAME} to use the camera and microphone so ${STUDENT_NAME} can record piano.`,
      );
      setPhase("error");
    });
  };

  return (
    <div className="flex flex-col">
      <div className="relative mb-4 h-[min(46dvh,380px)] overflow-hidden rounded-3xl border-4 border-[var(--walter-coral)] bg-black shadow-lg">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        {phase === "requesting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 px-6 text-center text-lg font-bold text-white">
            Allow camera & microphone
          </div>
        )}
        {phase === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-8xl font-bold text-[var(--walter-sun)]">{countdown}</span>
          </div>
        )}
        {phase === "recording" && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-[var(--walter-coral)] px-3 py-1 text-sm font-bold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            REC
          </div>
        )}
      </div>

      <p className="mb-4 text-center text-sm leading-snug opacity-90">
        Record {STUDENT_NAME} playing piano. No backing track — just the camera and mic.
      </p>

      {message && (
        <p className="mb-4 rounded-2xl bg-white px-4 py-3 text-center text-sm text-[var(--walter-coral)]">
          {message}
        </p>
      )}

      <div className="sticky bottom-[4.75rem] z-40 flex flex-col gap-3">
        {phase === "ready" && (
          <button
            type="button"
            onClick={() => void startRecording()}
            className="rounded-2xl bg-[var(--walter-sky)] px-6 py-5 text-xl font-bold text-white shadow-md active:scale-[0.98]"
          >
            Record piano 🎹
          </button>
        )}

        {phase === "requesting" && (
          <p className="py-4 text-center text-lg font-semibold">Opening camera…</p>
        )}

        {phase === "recording" && (
          <button
            type="button"
            onClick={() => void stopAndUpload()}
            className="rounded-2xl bg-[var(--walter-coral)] px-6 py-5 text-xl font-bold text-white shadow-md active:scale-[0.98]"
          >
            Done! Send to {INSTRUCTOR_NAME} ✨
          </button>
        )}

        {(phase === "countdown" || phase === "recording") && (
          <button
            type="button"
            onClick={cancel}
            className="rounded-2xl bg-white px-6 py-3 text-base font-semibold shadow-sm"
          >
            Cancel
          </button>
        )}

        {phase === "uploading" && (
          <p className="py-4 text-center text-lg font-semibold">Uploading…</p>
        )}

        {phase === "done" && (
          <div className="flex flex-col gap-3">
            <p className="text-center text-xl font-bold text-[var(--walter-grape)]">
              Nice! {INSTRUCTOR_NAME} can watch it now. 🌟
            </p>
            <button
              type="button"
              onClick={recordAgain}
              className="rounded-2xl bg-[var(--walter-sun)] px-6 py-4 text-lg font-bold shadow-md"
            >
              Record another
            </button>
          </div>
        )}

        {phase === "error" && (
          <button
            type="button"
            onClick={() => void openCamera().catch(() => setPhase("error"))}
            className="rounded-2xl bg-[var(--walter-sun)] px-6 py-4 text-lg font-bold"
          >
            Allow camera
          </button>
        )}
      </div>
    </div>
  );
}
