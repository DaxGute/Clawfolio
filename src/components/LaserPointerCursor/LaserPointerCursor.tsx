import { useEffect, useRef } from "react";
import styles from "./LaserPointerCursor.module.css";

const TRAIL_LEN = 7;
const LERP_HEAD = 0.55;
const LERP_TRAIL = 0.38;

const trailSizesPx = [9, 7.5, 6.5, 5.5, 4.5, 3.8, 3];
const trailOpacity = [0.92, 0.72, 0.55, 0.4, 0.28, 0.18, 0.1];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function LaserPointerCursor() {
  const headRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<(HTMLDivElement | null)[]>([]);
  const target = useRef({ x: 0, y: 0 });
  const head = useRef({ x: 0, y: 0 });
  const trail = useRef(
    Array.from({ length: TRAIL_LEN }, () => ({ x: 0, y: 0 })),
  );
  const ready = useRef(false);
  const raf = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!ready.current) {
        ready.current = true;
        head.current = { x: e.clientX, y: e.clientY };
        for (let i = 0; i < TRAIL_LEN; i++) {
          trail.current[i] = { x: e.clientX, y: e.clientY };
        }
      }
      target.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener("mousemove", onMove, { passive: true });

    const tick = () => {
      if (ready.current) {
        head.current.x = lerp(
          head.current.x,
          target.current.x,
          LERP_HEAD,
        );
        head.current.y = lerp(
          head.current.y,
          target.current.y,
          LERP_HEAD,
        );

        let prev = head.current;
        for (let i = 0; i < TRAIL_LEN; i++) {
          trail.current[i].x = lerp(
            trail.current[i].x,
            prev.x,
            LERP_TRAIL,
          );
          trail.current[i].y = lerp(
            trail.current[i].y,
            prev.y,
            LERP_TRAIL,
          );
          prev = trail.current[i];
        }

        const hr = headRef.current;
        if (hr) {
          hr.style.transform = `translate(${head.current.x}px, ${head.current.y}px) translate(-50%, -50%)`;
        }
        for (let i = 0; i < TRAIL_LEN; i++) {
          const el = trailRefs.current[i];
          if (el) {
            const p = trail.current[i];
            el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
          }
        }
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div className={styles.root} aria-hidden>
      {trailSizesPx.map((size, i) => (
        <div
          key={i}
          ref={(el) => {
            trailRefs.current[i] = el;
          }}
          className={`${styles.dot} ${styles["dot--trail"]}`}
          style={{
            width: size,
            height: size,
            opacity: trailOpacity[i],
          }}
        />
      ))}
      <div ref={headRef} className={`${styles.dot} ${styles["dot--head"]}`} />
    </div>
  );
}
