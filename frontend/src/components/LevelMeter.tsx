import { useEffect, useRef } from "react";

/**
 * Live microphone level, drawn straight to a canvas (no React state per frame).
 * Feedback that the mic is actually hearing the cook.
 */
export default function LevelMeter({ stream }: { stream: MediaStream | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!stream || !canvas.current) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audio = new Ctx();
    const source = audio.createMediaStreamSource(stream);
    const analyser = audio.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const c = canvas.current;
    const g = c.getContext("2d")!;
    const color = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#2e6b4c";
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#f5b83d";
    const bars = 32;
    const history: number[] = Array(bars).fill(0);
    let raf = 0;
    let frame = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      if (frame++ % 3 === 0) { history.shift(); history.push(Math.min(1, peak / 64)); }
      const { width, height } = c;
      g.clearRect(0, 0, width, height);
      const w = width / bars;
      history.forEach((lvl, i) => {
        const h = Math.max(4, lvl * height);
        g.fillStyle = i === bars - 1 ? accent : color;
        g.globalAlpha = 0.35 + 0.65 * (i / bars);
        g.beginPath();
        g.roundRect(i * w + w * 0.2, (height - h) / 2, w * 0.6, h, w * 0.3);
        g.fill();
      });
    };
    draw();
    return () => { cancelAnimationFrame(raf); source.disconnect(); audio.close(); };
  }, [stream]);

  return <canvas ref={canvas} width={320} height={64} className="h-16 w-full max-w-xs" aria-hidden="true" />;
}
