"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { APP_NAME, INSTRUCTOR_NAME, STUDENT_NAME } from "@/lib/branding";

type Video = {
  id: string;
  songTitle: string;
  studentName: string;
  url: string;
  uploadedAt: string;
};

type Props = { initialKey?: string };

export function TeacherDashboard({ initialKey = "" }: Props) {
  const [key, setKey] = useState(initialKey);
  const [storedKey, setStoredKey] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [status, setStatus] = useState("");

  const authHeaders = useCallback((): HeadersInit => {
    return storedKey ? { "x-teacher-password": storedKey } : {};
  }, [storedKey]);

  const load = useCallback(async () => {
    const videosRes = await fetch("/api/videos", { headers: authHeaders() });
    if (videosRes.ok) {
      const videosData = (await videosRes.json()) as { videos: Video[] };
      setVideos(videosData.videos);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("stomple-teacher-key");
      if (saved) setStoredKey(saved);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, storedKey]);

  const unlock = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("");
    try {
      const res = await fetch("/api/teacher/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: key }),
      });
      if (res.status === 401) {
        setStatus("Wrong password — try again.");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus(data.error || "Could not sign in. Refresh and try again.");
        return;
      }
      sessionStorage.setItem("stomple-teacher-key", key);
      setStoredKey(key);
    } catch {
      setStatus("Could not check password. Try again.");
    }
  };

  const signOut = () => {
    sessionStorage.removeItem("stomple-teacher-key");
    setStoredKey("");
    setVideos([]);
    setKey("");
  };

  const teacherUnlocked = Boolean(storedKey);

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 text-center">
        <p className="text-3xl font-bold text-[var(--walter-grape)]">{INSTRUCTOR_NAME}</p>
        <p className="mt-1 text-sm opacity-80">
          Watch {STUDENT_NAME}&apos;s piano videos.
        </p>
      </div>

      {!teacherUnlocked ? (
        <form
          onSubmit={(e) => void unlock(e)}
          className="mb-8 rounded-2xl bg-white p-5 shadow-sm"
        >
          <label className="mb-2 block text-sm font-semibold">{INSTRUCTOR_NAME} password</label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="mb-3 w-full rounded-xl border-2 border-[var(--walter-sun)] px-3 py-2"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="rounded-xl bg-[var(--walter-grape)] px-4 py-2 font-semibold text-white"
          >
            Unlock
          </button>
        </form>
      ) : (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={signOut}
            className="text-sm font-semibold text-[var(--walter-coral)]"
          >
            Lock {INSTRUCTOR_NAME} tab
          </button>
        </div>
      )}

      {status && (
        <p className="mb-4 rounded-xl bg-[var(--walter-sun)]/40 px-4 py-2 text-sm">{status}</p>
      )}

      {teacherUnlocked && (
        <section>
          <h2 className="mb-2 font-bold">Practice videos ({videos.length})</h2>
          {videos.length === 0 ? (
            <p className="text-sm opacity-70">
              No videos yet — tell {STUDENT_NAME} to hit {APP_NAME}!
            </p>
          ) : (
            <ul className="flex flex-col gap-6">
              {videos.map((v) => (
                <li key={v.id} className="rounded-2xl bg-white p-3 shadow-sm">
                  <p className="mb-2 text-sm font-semibold">
                    {v.songTitle} · {new Date(v.uploadedAt).toLocaleString()}
                  </p>
                  <video
                    src={v.url}
                    controls
                    playsInline
                    className="w-full rounded-xl bg-black"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
