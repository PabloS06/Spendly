"use client";

import { useEffect, useState, type InputHTMLAttributes } from "react";
import { useData } from "@/lib/data";
import { centsToInput, decimalSeparator, formatMoney, parseTyped } from "@/lib/money";
import { cx } from "./ui";

export function useMoney() {
  const { fmt } = useData();
  return (cents: number, decimals = true) => formatMoney(cents, fmt, { decimals });
}

export function Money({ cents, decimals = true, className }: { cents: number; decimals?: boolean; className?: string }) {
  const money = useMoney();
  return <span className={cx("num", className)}>{money(cents, decimals)}</span>;
}

type AmountInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  cents: number;
  onCents: (cents: number) => void;
  locale: string;
  max?: number;
};

/** Text field for money: numeric keypad, accepts either decimal separator, reports cents. */
export function AmountInput({ cents, onCents, locale, max, className, ...props }: AmountInputProps) {
  const [text, setText] = useState(() => centsToInput(cents, locale));

  // Follow outside changes (e.g. a slider) without fighting the user's typing.
  useEffect(() => {
    if (parseTyped(text) !== cents) setText(centsToInput(cents, locale));
  }, [cents, locale]);

  return (
    <input
      inputMode="decimal"
      autoComplete="off"
      placeholder={`0${decimalSeparator(locale)}00`}
      {...props}
      value={text}
      onChange={(e) => {
        let next = e.target.value.replace(/[^\d.,]/g, "");
        let value = parseTyped(next);
        if (max !== undefined && value > max) {
          value = max;
          next = centsToInput(max, locale);
        }
        setText(next);
        onCents(value);
      }}
      className={cx("num bg-transparent outline-none placeholder:text-faint", className)}
    />
  );
}
