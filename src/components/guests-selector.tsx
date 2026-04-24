"use client";

import { useEffect, useRef, useState } from "react";
import { type AppLanguage } from "@/lib/i18n";

type GuestsSelectorProps = {
  guests?: string;
  language: AppLanguage;
};

function parseInitialAdults(guests?: string) {
  const parsed = Number(guests);
  if (!Number.isFinite(parsed)) {
    return 2;
  }
  return Math.max(1, Math.floor(parsed));
}

export function GuestsSelector({ guests, language }: GuestsSelectorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [adults, setAdults] = useState(() => parseInitialAdults(guests));
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const totalGuests = adults + children;
  const isHebrew = language === "he";
  const label = isHebrew
    ? `${adults} מבוגרים · ${children} ילדים · ${rooms} חדרים`
    : `${adults} adults · ${children} children · ${rooms} rooms`;

  return (
    <div ref={containerRef} className="relative rounded-xl border border-slate-200 px-3 py-2">
      <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">
        {isHebrew ? "אורחים" : "Guests"}
      </span>
      <input type="hidden" name="guests" value={String(totalGuests)} />
      <input type="hidden" name="adults" value={String(adults)} />
      <input type="hidden" name="children" value={String(children)} />
      <input type="hidden" name="rooms" value={String(rooms)} />

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="mt-1 flex w-full items-center justify-between gap-2 text-start text-sm text-slate-900 outline-none"
      >
        <span className="truncate">{label}</span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          <path
            d="M5.5 7.5 10 12l4.5-4.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[320px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
          <CounterRow
            label={isHebrew ? "מבוגרים" : "Adults"}
            description={isHebrew ? "גיל 18+" : "Ages 18+"}
            value={adults}
            onDecrease={() => setAdults((value) => Math.max(1, value - 1))}
            onIncrease={() => setAdults((value) => value + 1)}
            canDecrease={adults > 1}
          />
          <CounterRow
            label={isHebrew ? "ילדים" : "Children"}
            description={isHebrew ? "גיל 0-17" : "Ages 0-17"}
            value={children}
            onDecrease={() => setChildren((value) => Math.max(0, value - 1))}
            onIncrease={() => setChildren((value) => value + 1)}
            canDecrease={children > 0}
          />
          <CounterRow
            label={isHebrew ? "חדרים" : "Rooms"}
            description={isHebrew ? "מספר חדרים" : "Number of rooms"}
            value={rooms}
            onDecrease={() => setRooms((value) => Math.max(1, value - 1))}
            onIncrease={() => setRooms((value) => value + 1)}
            canDecrease={rooms > 1}
          />

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg bg-[var(--color-primary-light)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-105"
            >
              {isHebrew ? "אישור" : "Apply"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CounterRow({
  label,
  description,
  value,
  onDecrease,
  onIncrease,
  canDecrease,
}: {
  label: string;
  description: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  canDecrease: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDecrease}
          disabled={!canDecrease}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-semibold text-slate-900">{value}</span>
        <button
          type="button"
          onClick={onIncrease}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-100"
        >
          +
        </button>
      </div>
    </div>
  );
}
