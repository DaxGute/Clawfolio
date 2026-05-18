import { useEffect, useRef } from "react";
import styles from "./LiquidSwirlBackground.module.css";

type Blob = {
  hue: number;
  sat: number;
  light: number;
  alpha: number;
  radius: number;
  orbitX: number;
  orbitY: number;
  speed: number;
  phase: number;
  drift: number;
};

type BlobState = {
  x: number;
  y: number;
  r: number;
  hue: number;
};

const BLOBS: Blob[] = [
  { hue: 258, sat: 88, light: 60, alpha: 0.78, radius: 0.5, orbitX: 0.4, orbitY: 0.34, speed: 0.24, phase: 0, drift: 0.12 },
  { hue: 198, sat: 86, light: 58, alpha: 0.72, radius: 0.46, orbitX: 0.36, orbitY: 0.38, speed: 0.28, phase: 1.2, drift: 0.13 },
  { hue: 288, sat: 84, light: 62, alpha: 0.7, radius: 0.44, orbitX: 0.34, orbitY: 0.32, speed: 0.22, phase: 2.5, drift: 0.11 },
  { hue: 36, sat: 82, light: 60, alpha: 0.68, radius: 0.42, orbitX: 0.32, orbitY: 0.36, speed: 0.3, phase: 0.7, drift: 0.14 },
  { hue: 322, sat: 86, light: 58, alpha: 0.7, radius: 0.48, orbitX: 0.38, orbitY: 0.3, speed: 0.26, phase: 3.4, drift: 0.12 },
];

const RENDER_SCALE = 0.28;
const MAX_RENDER_W = 880;
const MAX_RENDER_H = 560;
const TIME_SCALE = 0.38;
const SMOOTH_RATE = 2.4;
const PAINT_FPS = 30;
const PAINT_INTERVAL = 1 / PAINT_FPS;

/** px/s for ~2×; tuned so even gentle movement is felt */
const REF_MOUSE_VELOCITY = 160;
const MIN_SPEED_MULT = 1;
const MAX_SPEED_MULT = 10;
const MOUSE_VELOCITY_SMOOTH = 16;
const MOUSE_VELOCITY_DECAY = 3.5;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function targetForBlob(blob: Blob, t: number) {
  const swirl =
    Math.sin(t * blob.speed + blob.phase) *
    Math.cos(t * blob.speed * 0.72 + blob.phase * 1.2);
  const x =
    0.5 +
    Math.sin(t * blob.speed * 0.88 + blob.phase) * blob.orbitX +
    Math.cos(t * blob.speed * 0.58 + blob.phase * 0.7) * blob.drift;
  const y =
    0.5 +
    Math.cos(t * blob.speed * 0.82 + blob.phase * 1.05) * blob.orbitY +
    Math.sin(t * blob.speed * 0.5 + blob.phase * 1.3) * blob.drift;
  const r = blob.radius * (1 + swirl * 0.08);
  const hue = blob.hue + Math.sin(t * 0.35 + blob.phase) * 12;
  return { x, y, r, hue };
}

function expSmooth(current: number, target: number, dt: number, rate: number) {
  return current + (target - current) * (1 - Math.exp(-dt * rate));
}

function speedMultFromVelocity(velocityPxPerSec: number) {
  const t = velocityPxPerSec / REF_MOUSE_VELOCITY;
  const mult = MIN_SPEED_MULT + t * 1.4 + t * t * 3.2;
  return Math.min(MAX_SPEED_MULT, Math.max(MIN_SPEED_MULT, mult));
}

export function LiquidSwirlBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useRef(prefersReducedMotion());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let time = 0;
    let lastFrame = 0;
    let paintAccum = 0;
    let width = 0;
    let height = 0;
    let displayW = 0;
    let displayH = 0;
    let running = true;
    let resizeRaf = 0;

    let mouseVel = 0;
    let mouseVelTarget = 0;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let lastMouseMoveAt = 0;
    let hasMouseSample = false;

    const states: BlobState[] = BLOBS.map((b) => ({
      x: 0.5,
      y: 0.5,
      r: b.radius,
      hue: b.hue,
    }));

    const resize = () => {
      displayW = Math.max(1, window.innerWidth);
      displayH = Math.max(1, window.innerHeight);
      width = Math.min(MAX_RENDER_W, Math.max(1, Math.floor(displayW * RENDER_SCALE)));
      height = Math.min(MAX_RENDER_H, Math.max(1, Math.floor(displayH * RENDER_SCALE)));
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";
    };

    const scheduleResize = () => {
      window.cancelAnimationFrame(resizeRaf);
      resizeRaf = window.requestAnimationFrame(resize);
    };

    const paint = () => {
      ctx.fillStyle = "#dde2f0";
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "lighter";
      const base = Math.min(width, height);

      for (let i = 0; i < BLOBS.length; i++) {
        const blob = BLOBS[i];
        const s = states[i];
        const cx = s.x * width;
        const cy = s.y * height;
        const r = base * s.r;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `hsla(${s.hue | 0},${blob.sat}%,${blob.light}%,${blob.alpha})`);
        grad.addColorStop(
          0.45,
          `hsla(${(s.hue + 22) | 0},${blob.sat}%,${blob.light + 6}%,${blob.alpha * 0.5})`,
        );
        grad.addColorStop(1, "hsla(0,0%,100%,0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
    };

    const syncTargets = (dt: number, speedMult: number) => {
      const motionRate = SMOOTH_RATE * (0.7 + speedMult * 0.55);
      for (let i = 0; i < BLOBS.length; i++) {
        const target = targetForBlob(BLOBS[i], time);
        const s = states[i];
        s.x = expSmooth(s.x, target.x, dt, motionRate);
        s.y = expSmooth(s.y, target.y, dt, motionRate);
        s.r = expSmooth(s.r, target.r, dt, motionRate);
        s.hue = expSmooth(s.hue, target.hue, dt, motionRate);
      }
    };

    const updateMouseVelocity = (dt: number, now: number) => {
      const idleSec = (now - lastMouseMoveAt) / 1000;
      if (idleSec > 0.14) mouseVelTarget = 0;

      const rate =
        mouseVelTarget > mouseVel ? MOUSE_VELOCITY_SMOOTH : MOUSE_VELOCITY_DECAY;
      mouseVel = expSmooth(mouseVel, mouseVelTarget, dt, rate);
    };

    const onMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      if (hasMouseSample && lastMouseMoveAt > 0) {
        const dt = (now - lastMouseMoveAt) / 1000;
        if (dt > 0 && dt < 0.15) {
          const dist = Math.hypot(e.clientX - lastMouseX, e.clientY - lastMouseY);
          mouseVelTarget = dist / dt;
        }
      }
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      lastMouseMoveAt = now;
      hasMouseSample = true;
    };

    const onMouseLeave = () => {
      mouseVelTarget = 0;
    };

    const tick = (now: number) => {
      if (!running) return;

      if (!lastFrame) lastFrame = now;
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;

      updateMouseVelocity(dt, now);
      const speedMult = speedMultFromVelocity(mouseVel);
      time += dt * TIME_SCALE * speedMult;
      syncTargets(dt, speedMult);

      const paintInterval = PAINT_INTERVAL / Math.min(2.2, Math.sqrt(speedMult));
      paintAccum += dt;
      if (paintAccum >= paintInterval) {
        paintAccum %= paintInterval;
        paint();
      }

      raf = window.requestAnimationFrame(tick);
    };

    resize();

    if (reducedMotion.current) {
      time = 1.5;
      for (let i = 0; i < BLOBS.length; i++) {
        Object.assign(states[i], targetForBlob(BLOBS[i], time));
      }
      paint();
    } else {
      raf = window.requestAnimationFrame(tick);
    }

    window.addEventListener("resize", scheduleResize, { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onMouseLeave);

    const onVisibility = () => {
      if (reducedMotion.current) return;
      if (document.hidden) {
        running = false;
        window.cancelAnimationFrame(raf);
        lastFrame = 0;
        paintAccum = 0;
      } else {
        running = true;
        raf = window.requestAnimationFrame(tick);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("mousemove", onMouseMove);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className={styles.host} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
