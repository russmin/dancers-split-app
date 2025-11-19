import React from "react";
import { Button } from "@/components/ui/button";

interface RestTimerProps {
  seconds?: number;
  startSignal?: number;
  onDone?: () => void;
}

export default function RestTimer({
  seconds = 90,
  startSignal = 0,
  onDone,
}: RestTimerProps) {
  const [remaining, setRemaining] = React.useState<number>(seconds);
  const [running, setRunning] = React.useState<boolean>(false);

  React.useEffect(() => {
    setRemaining(seconds);
    setRunning(true);
  }, [startSignal, seconds]);

  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setRunning(false);

          // --- HAPTIC (mobile-safe no-op on desktop)
          try {
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              // light buzz
              (navigator as any).vibrate?.(150);
            }
          } catch {}

          // --- BEEP (very short)
          try {
            const AudioCtx =
              (window as any).AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 880;   // A5-ish
              gain.gain.value = 0.04;      // quiet
              osc.start();
              setTimeout(() => {
                osc.stop();
                ctx.close?.();
              }, 180);
            }
          } catch {}

          onDone?.();          // advance your flow
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, onDone]);

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="font-mono">{fmt(remaining)}</div>
      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setRunning((r) => !r)}>
        {running ? "Pause" : "Start"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl"
        onClick={() => {
          setRunning(false);
          setRemaining(seconds);
        }}
      >
        Reset
      </Button>
    </div>
  );
}

