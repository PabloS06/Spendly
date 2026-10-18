"use client";

import { useRef, useState, type ReactNode } from "react";

const REVEAL = 88;

/** Row that slides left to reveal a delete action; a long swipe deletes straight away. */
export function SwipeRow({ children, onDelete, onTap }: { children: ReactNode; onDelete: () => void; onTap: () => void }) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; axis: "x" | "y" | null } | null>(null);
  const moved = useRef(false);
  const row = useRef<HTMLDivElement>(null);

  return (
    <div className="relative overflow-hidden">
      <button
        aria-label="Delete"
        onClick={onDelete}
        tabIndex={x < 0 ? 0 : -1}
        className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger pr-5 text-sm font-medium text-white"
        style={{ width: Math.max(REVEAL, -x) }}
      >
        Delete
      </button>
      <div
        ref={row}
        role="button"
        tabIndex={0}
        className="relative bg-bg"
        style={{ transform: `translateX(${x}px)`, transition: dragging ? "none" : "transform 180ms cubic-bezier(0.16,1,0.3,1)", touchAction: "pan-y" }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY, base: x, axis: null };
          moved.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (!s.axis && Math.hypot(dx, dy) > 6) s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          if (s.axis !== "x") return;
          moved.current = true;
          setDragging(true);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setX(Math.min(0, s.base + dx));
        }}
        onPointerUp={() => {
          const s = start.current;
          start.current = null;
          setDragging(false);
          if (!s || s.axis !== "x") return;
          const width = row.current?.offsetWidth ?? 360;
          if (-x > Math.max(200, width * 0.6)) {
            setX(0);
            onDelete();
          } else setX(-x > REVEAL / 2 ? -REVEAL : 0);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setX(0);
        }}
        onClick={() => {
          if (moved.current) return;
          if (x !== 0) setX(0);
          else onTap();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") onTap();
          if (e.key === "Delete" || e.key === "Backspace") onDelete();
        }}
      >
        {children}
      </div>
    </div>
  );
}
