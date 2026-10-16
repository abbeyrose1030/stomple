import { APP_NAME, STUDENT_NAME } from "@/lib/branding";
import { PianoRecorder } from "@/components/PianoRecorder";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 py-8">
      <div className="mb-8 text-center">
        <p className="walter-bounce text-5xl font-bold tracking-tight text-[var(--walter-coral)]">
          {APP_NAME}
        </p>
        <p className="mt-2 text-lg font-medium">
          Hey {STUDENT_NAME}! 👋 Ready to practice?
        </p>
      </div>

      <PianoRecorder />

      <p className="mt-10 text-center text-xs opacity-50">
        Add {APP_NAME} to your Home Screen from Safari&apos;s Share menu.
      </p>
    </main>
  );
}
