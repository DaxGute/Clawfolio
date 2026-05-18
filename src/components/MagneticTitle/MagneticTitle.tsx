import { useEffect, useRef, useState } from "react";
import styles from "./MagneticTitle.module.css";

const MAGNET_RADIUS = 110;
const MAX_PULL = 22;
const PULL_FACTOR = 0.42;
const LERP = 0.14;
const MAX_ROTATE = 14;

type LetterNode = {
  el: HTMLSpanElement;
  x: number;
  y: number;
  rot: number;
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

type MagneticTitleProps = {
  text: string;
  className?: string;
};

export function MagneticTitle({ text, className }: MagneticTitleProps) {
  const lettersRef = useRef<LetterNode[]>([]);
  const mouse = useRef({ x: -9999, y: -9999 });
  const active = useRef(false);
  const raf = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    lettersRef.current = [];
  }, [text]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      active.current = true;
    };

    const onLeave = () => {
      active.current = false;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    const tick = () => {
      const letters = lettersRef.current;
      const { x: mx, y: my } = mouse.current;

      for (let i = 0; i < letters.length; i++) {
        const letter = letters[i];
        const { el } = letter;

        let targetX = 0;
        let targetY = 0;
        let targetRot = 0;

        if (active.current) {
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = mx - cx;
          const dy = my - cy;
          const dist = Math.hypot(dx, dy);

          if (dist < MAGNET_RADIUS && dist > 0.5) {
            const pull = ((MAGNET_RADIUS - dist) / MAGNET_RADIUS) * PULL_FACTOR;
            targetX = dx * pull;
            targetY = dy * pull;
            targetX = Math.max(-MAX_PULL, Math.min(MAX_PULL, targetX));
            targetY = Math.max(-MAX_PULL, Math.min(MAX_PULL, targetY));
            targetRot = (targetX / MAX_PULL) * MAX_ROTATE;
          }
        }

        letter.x = lerp(letter.x, targetX, LERP);
        letter.y = lerp(letter.y, targetY, LERP);
        letter.rot = lerp(letter.rot, targetRot, LERP);

        el.style.transform = `translate3d(${letter.x}px, ${letter.y}px, 0) rotate(${letter.rot}deg)`;
      }

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf.current);
    };
  }, [reducedMotion]);

  const rootClass = className ?? "";

  if (reducedMotion) {
    return <h1 className={rootClass}>{text}</h1>;
  }

  return (
    <h1 className={rootClass}>
      {text.split("").map((char, index) => (
        <span
          key={`${index}-${char}`}
          ref={(el) => {
            if (!el) return;
            const letters = lettersRef.current;
            if (!letters[index]) {
              letters[index] = { el, x: 0, y: 0, rot: 0 };
            } else {
              letters[index].el = el;
            }
          }}
          className={styles.char}
          aria-hidden={char === " " ? true : undefined}
        >
          {char === " " ? "\u00a0" : char}
        </span>
      ))}
    </h1>
  );
}
