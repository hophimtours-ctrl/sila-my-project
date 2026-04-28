"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { enUS, he } from "date-fns/locale";
import { DayPicker, type DateRange } from "react-day-picker";
import { type AppLanguage, getLanguageDirection } from "@/lib/i18n";

type DateRangePickerProps = {
  checkIn?: string;
  checkOut?: string;
  language: AppLanguage;
};

function parseDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function DateRangePicker({ checkIn, checkOut, language }: DateRangePickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isWideCalendar, setIsWideCalendar] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = parseDate(checkIn);
    const to = parseDate(checkOut);
    if (!from && !to) {
      return undefined;
    }
    return { from, to };
  });
  const hasCompleteRange = Boolean(range?.from && range?.to);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    function updateCalendarMode() {
      setIsWideCalendar(window.innerWidth >= 1024);
    }

    updateCalendarMode();
    window.addEventListener("resize", updateCalendarMode);
    return () => window.removeEventListener("resize", updateCalendarMode);
  }, []);

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
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const isHebrew = language === "he";
  const locale = isHebrew ? he : enUS;
  const direction = getLanguageDirection(language);
  const isMobileCalendar = !isWideCalendar;
  const visibleMonths = isWideCalendar ? 3 : 1;
  const checkInValue = range?.from ? format(range.from, "yyyy-MM-dd") : "";
  const checkOutValue = range?.to ? format(range.to, "yyyy-MM-dd") : "";

  const displayValue =
    range?.from && range?.to
      ? `${format(range.from, "dd/MM/yyyy")} - ${format(range.to, "dd/MM/yyyy")}`
      : isHebrew
        ? "בחירת צ'ק-אין וצ'ק-אאוט"
        : "Select check-in and check-out";

  return (
    <div ref={containerRef} className="relative rounded-xl border border-slate-200 px-3 py-2">
      <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">
        {isHebrew ? "תאריכים" : "Dates"}
      </span>
      <input type="hidden" name="checkIn" value={checkInValue} />
      <input type="hidden" name="checkOut" value={checkOutValue} />

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="mt-1 flex w-full items-center justify-between gap-2 text-start text-sm text-slate-900 outline-none"
      >
        <span className="truncate">{displayValue}</span>
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
        <>
          <button
            type="button"
            aria-label={isHebrew ? "סגירת תאריכון" : "Close date picker"}
            onClick={() => setIsOpen(false)}
            className={`fixed inset-0 z-40 ${isMobileCalendar ? "bg-black/20 backdrop-blur-[1px]" : "bg-black/30"}`}
          />
          <div
            className={`fixed z-50 border border-slate-200 bg-white shadow-2xl ${
              isMobileCalendar
                ? "inset-x-2 bottom-2 max-h-[78dvh] rounded-2xl p-4 pb-5"
                : "left-1/2 top-1/2 w-[min(94vw,1120px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5"
            }`}
          >
            {isMobileCalendar && (
              <div className="mb-3 flex justify-center">
                <span className="h-1.5 w-14 rounded-full bg-slate-300" />
              </div>
            )}
            <DayPicker
              mode="range"
              min={1}
              locale={locale}
              dir={direction}
              selected={range}
              disabled={{ before: today }}
              numberOfMonths={visibleMonths}
              defaultMonth={new Date()}
              pagedNavigation
              animate
              onSelect={(nextRange) => {
                setRange(nextRange);
              }}
              showOutsideDays
              className={isMobileCalendar ? "max-h-[52dvh] overflow-y-auto pr-1" : undefined}
              classNames={{
                months: isMobileCalendar
                  ? "flex flex-col gap-4"
                  : "flex snap-x snap-mandatory flex-nowrap gap-4 overflow-x-auto pb-2",
                month: isMobileCalendar
                  ? "space-y-3 rounded-xl border border-slate-100 bg-white p-2"
                  : "min-w-[280px] snap-start space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm",
                caption: "relative flex items-center justify-center pb-2",
                caption_label: "text-sm font-semibold text-slate-900",
                nav: "absolute inset-x-0 top-0 flex items-center justify-between",
                button_previous:
                  "h-8 w-8 rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900",
                button_next:
                  "h-8 w-8 rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900",
                month_grid: "w-full border-collapse",
                weekdays: "mb-1 flex",
                weekday: "w-10 text-center text-xs font-medium text-slate-400",
                week: "mt-1 flex w-full",
                day: "h-10 w-10 p-0 text-sm",
                day_button:
                  "h-10 w-10 rounded-lg text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-slate-50",
                selected: "bg-[var(--color-primary-light)] text-white hover:bg-[var(--color-primary-light)]",
                range_start:
                  "bg-[var(--color-primary-light)] text-white rounded-l-lg rounded-r-none hover:bg-[var(--color-primary-light)]",
                range_end:
                  "bg-[var(--color-primary-light)] text-white rounded-r-lg rounded-l-none hover:bg-[var(--color-primary-light)]",
                range_middle: "bg-blue-50 text-slate-900 rounded-none hover:bg-blue-50",
                today: "font-semibold text-[var(--color-primary)]",
                outside: "text-slate-300",
                disabled: "text-slate-300",
              }}
            />

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRange(undefined)}
                className="text-xs font-medium text-slate-500 transition hover:text-slate-700"
              >
                {isHebrew ? "ניקוי" : "Clear"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!hasCompleteRange) {
                    return;
                  }
                  setIsOpen(false);
                  const parentForm = containerRef.current?.closest("form");
                  parentForm?.requestSubmit();
                }}
                disabled={!hasCompleteRange}
                className="rounded-lg bg-[var(--color-primary-light)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isHebrew ? "חיפוש" : "Search"}
              </button>
            </div>
            {!hasCompleteRange && (
              <p className="mt-2 text-xs text-slate-500">
                {isHebrew
                  ? "התאריכון ייסגר בלחיצה מחוץ אליו."
                  : "Click anywhere outside to close the calendar."}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
