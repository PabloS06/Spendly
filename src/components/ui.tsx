"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import type { BudgetStatus } from "@/lib/budget";

export const ICON = { size: 20, strokeWidth: 1.5 } as const;

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" };

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        "press inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium disabled:pointer-events-none disabled:opacity-40",
        variant === "primary" && "bg-accent text-accent-fg",
        variant === "secondary" && "border hairline text-fg hover:bg-track/60",
        variant === "ghost" && "text-muted hover:text-fg",
        variant === "danger" && "border border-danger/40 text-danger",
        className,
      )}
    />
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-11 w-full border-b hairline bg-transparent text-[15px] outline-none transition-colors duration-150 placeholder:text-faint focus:border-fg",
        className,
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{children}</span>;
}

const statusColor: Record<BudgetStatus, string> = { ok: "bg-accent", warn: "bg-warn", over: "bg-danger" };

/** Thin progress line; `value` is 0..1 (clamped). */
export function Progress({ value, status = "ok", className }: { value: number; status?: BudgetStatus; className?: string }) {
  return (
    <div className={cx("h-[2px] w-full overflow-hidden rounded-full bg-track", className)}>
      <div
        className={cx("h-full rounded-full transition-[width] duration-200 ease-out", statusColor[status])}
        style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} />;
}

/** Animates a number from its previous value to the new one. */
export function useCountUp(target: number, duration = 500): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const initial = from.current;
    if (initial === target) return;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(initial + (target - initial) * eased);
      setValue(v);
      from.current = v;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

/** Bottom sheet on mobile, centered panel on desktop. */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={label}>
      <div className="fade-in absolute inset-0 bg-black/30 dark:bg-black/60" onClick={onClose} />
      <div className="sheet-up relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 md:rounded-[28px] md:pb-6">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-track md:hidden" />
        {children}
      </div>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx("h-px w-full bg-line", className)} />;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      {body && <p className="max-w-xs text-sm text-muted">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
