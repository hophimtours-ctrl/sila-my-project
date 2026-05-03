"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { he } from "date-fns/locale";

export type DateRangeValue = {
  startDate: Date | null;
  endDate: Date | null;
};

type DateRangeCalendarPopupProps = {
  value: DateRangeValue;
  onConfirm: (value: { startDate: Date; endDate: Date }) => void;
  onClose: () => void;
};

const WEEK_DAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export function DateRangeCalendarPopup({
  value,
  onConfirm,
  onClose,
}: DateRangeCalendarPopupProps) {
  const [localValue, setLocalValue] = useState<DateRangeValue>(value);

  const months = useMemo(() => {
    const firstMonth = startOfMonth(new Date());
    return Array.from({ length: 2 }, (_, index) => addMonths(firstMonth, index));
  }, []);

  const onDateClick = (clickedDate: Date) => {
    if (!localValue.startDate || localValue.endDate) {
      setLocalValue({ startDate: clickedDate, endDate: null });
      return;
    }

    if (isBefore(clickedDate, localValue.startDate) || isSameDay(clickedDate, localValue.startDate)) {
      setLocalValue({ startDate: clickedDate, endDate: null });
      return;
    }

    setLocalValue({ startDate: localValue.startDate, endDate: clickedDate });
  };

  const hasFullRange = Boolean(localValue.startDate && localValue.endDate);

  return (
    <div className="search-overlay fixed inset-0 z-50 bg-slate-900/35 sm:p-6" onClick={onClose}>
      <div
        className={clsx(
          "search-popup search-popup-mobile flex h-full w-full flex-col bg-white p-4 sm:mx-auto sm:h-auto sm:max-h-[88vh] sm:max-w-[760px] sm:rounded-3xl sm:p-6",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <button
            type="button"
            aria-label="סגירה"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
          <div className="text-right">
            <h3 className="text-lg font-semibold text-slate-900">בחרו טווח תאריכים</h3>
            <p className="text-sm text-slate-500">לוח שנה אחיד לבחירה מהירה</p>
          </div>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          <div className="space-y-8">
            {months.map((monthStart) => {
              const days = eachDayOfInterval({
                start: startOfWeek(startOfMonth(monthStart), { weekStartsOn: 0 }),
                end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 }),
              });

              return (
                <section
                  key={monthStart.toISOString()}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm"
                >
                  <h4 className="mb-4 border-b border-slate-200 pb-3 text-right text-base font-semibold text-slate-900">
                    {format(monthStart, "LLLL yyyy", { locale: he })}
                  </h4>
                  <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
                    {WEEK_DAYS.map((day) => (
                      <span key={day} className="py-1">
                        {day}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {days.map((day) => {
                      const isOutsideMonth = !isSameMonth(day, monthStart);
                      const isStart = Boolean(localValue.startDate && isSameDay(day, localValue.startDate));
                      const isEnd = Boolean(localValue.endDate && isSameDay(day, localValue.endDate));
                      const isInRange =
                        Boolean(localValue.startDate && localValue.endDate) &&
                        isWithinInterval(day, {
                          start: localValue.startDate!,
                          end: localValue.endDate!,
                        });

                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          onClick={() => onDateClick(day)}
                          className={clsx(
                            "h-10 rounded-lg text-sm transition",
                            isOutsideMonth ? "text-slate-300" : "text-slate-700 hover:bg-slate-100",
                            isInRange && !isStart && !isEnd && "bg-blue-50 text-[var(--color-primary-light)]",
                            (isStart || isEnd) && "bg-[var(--color-primary-light)] font-semibold text-white",
                          )}
                        >
                          {format(day, "d")}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-3 text-right text-sm text-slate-600">
            {hasFullRange
              ? `${format(localValue.startDate!, "dd/MM/yyyy")} - ${format(
                  localValue.endDate!,
                  "dd/MM/yyyy",
                )}`
              : "בחרו תאריך התחלה ותאריך סיום"}
          </p>
          <button
            type="button"
            disabled={!hasFullRange}
            onClick={() => {
              if (localValue.startDate && localValue.endDate) {
                onConfirm({ startDate: localValue.startDate, endDate: localValue.endDate });
              }
            }}
            className={clsx(
              "w-full rounded-xl px-4 py-3 font-semibold text-white transition",
              hasFullRange
                ? "bg-[var(--color-primary-light)] hover:brightness-105"
                : "cursor-not-allowed bg-slate-300",
            )}
          >
            אישור
          </button>
        </div>
      </div>
    </div>
  );
}
