"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export type GuestsValue = {
  adults: number;
  children: number;
  rooms: number;
};

type GuestsPopupProps = {
  value: GuestsValue;
  onConfirm: (value: GuestsValue) => void;
  onClose: () => void;
};

type CounterKey = keyof GuestsValue;

const COUNTERS: Array<{ key: CounterKey; label: string; min: number; helper: string }> = [
  { key: "adults", label: "מבוגרים", min: 1, helper: "גיל 18 ומעלה" },
  { key: "children", label: "ילדים", min: 0, helper: "גיל 0–17" },
  { key: "rooms", label: "חדרים", min: 1, helper: "מספר חדרים נדרש" },
];

export function GuestsPopup({ value, onConfirm, onClose }: GuestsPopupProps) {
  const [localValue, setLocalValue] = useState<GuestsValue>(value);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [onClose]);

  const updateCounter = (key: CounterKey, direction: "inc" | "dec") => {
    setLocalValue((prev) => {
      const config = COUNTERS.find((counter) => counter.key === key)!;
      const next =
        direction === "inc" ? prev[key] + 1 : Math.max(config.min, prev[key] - 1);
      return { ...prev, [key]: next };
    });
  };

  return (
    <div
      ref={panelRef}
      className={clsx(
        "search-popup absolute right-0 top-[calc(100%+10px)] z-50 w-full min-w-[280px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl",
        "sm:w-[320px]",
      )}
    >
      <div className="space-y-4">
        {COUNTERS.map((counter) => (
          <div key={counter.key} className="flex items-center justify-between gap-3">
            <div className="text-right">
              <p className="font-semibold text-slate-900">{counter.label}</p>
              <p className="text-xs text-slate-500">{counter.helper}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateCounter(counter.key, "dec")}
                disabled={localValue[counter.key] <= counter.min}
                className="h-8 w-8 rounded-full border border-slate-300 text-lg leading-none text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                -
              </button>
              <span className="min-w-6 text-center font-semibold text-slate-900">
                {localValue[counter.key]}
              </span>
              <button
                type="button"
                onClick={() => updateCounter(counter.key, "inc")}
                className="h-8 w-8 rounded-full border border-slate-300 text-lg leading-none text-slate-700 transition hover:bg-slate-50"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          onConfirm(localValue);
          onClose();
        }}
        className="mt-5 w-full rounded-xl bg-[var(--color-primary-light)] px-4 py-2.5 font-semibold text-white transition hover:brightness-105"
      >
        אישור
      </button>
    </div>
  );
}
