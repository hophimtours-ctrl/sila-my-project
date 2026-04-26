"use client";

import { useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { DateRangeCalendarPopup, type DateRangeValue } from "@/components/search/date-range-calendar-popup";
import { GuestsPopup, type GuestsValue } from "@/components/search/guests-popup";
import {
  CalendarOutlineIcon,
  GuestsOutlineIcon,
  LocationPinIcon,
} from "@/components/search/search-icons";

type HebrewSearchBarProps = {
  initialCity?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialAdults?: string;
  initialChildren?: string;
  initialRooms?: string;
};

function parseDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function parseCounter(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function HebrewSearchBar({
  initialCity,
  initialCheckIn,
  initialCheckOut,
  initialAdults,
  initialChildren,
  initialRooms,
}: HebrewSearchBarProps) {
  const [city, setCity] = useState(initialCity ?? "");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isGuestsOpen, setIsGuestsOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    startDate: parseDate(initialCheckIn),
    endDate: parseDate(initialCheckOut),
  });
  const [guests, setGuests] = useState<GuestsValue>({
    adults: Math.max(1, parseCounter(initialAdults, 2)),
    children: Math.max(0, parseCounter(initialChildren, 0)),
    rooms: Math.max(1, parseCounter(initialRooms, 1)),
  });

  const dateLabel = useMemo(() => {
    if (dateRange.startDate && dateRange.endDate) {
      return `${format(dateRange.startDate, "dd/MM/yyyy")} - ${format(
        dateRange.endDate,
        "dd/MM/yyyy",
      )}`;
    }

    return "בחרו תאריכים";
  }, [dateRange.endDate, dateRange.startDate]);

  const guestsLabel = `${guests.adults} מבוגרים, ${guests.children} ילדים, ${guests.rooms} חדרים`;

  return (
    <section className="card border-4 border-[var(--color-cta)] p-3 shadow-2xl">
      <form
        action="/search/results"
        className="grid gap-2 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-stretch"
      >
        <div className="flex min-h-14 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
          <LocationPinIcon className="h-5 w-5 shrink-0 text-slate-500" />
          <div className="flex-1 text-right">
            <p className="text-xs text-slate-500">יעד</p>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              name="city"
              placeholder="אילת, ישראל"
              className="w-full border-none p-0 text-right text-base text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCalendarOpen(true);
            setIsGuestsOpen(false);
          }}
          className="flex min-h-14 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-right transition hover:border-[var(--color-primary-light)]"
        >
          <CalendarOutlineIcon className="h-5 w-5 shrink-0 text-slate-500" />
          <div className="flex-1 text-right">
            <p className="text-xs text-slate-500">תאריכים</p>
            <p className="text-base text-slate-900">{dateLabel}</p>
          </div>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsGuestsOpen((prev) => !prev);
              setIsCalendarOpen(false);
            }}
            className="flex min-h-14 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-right transition hover:border-[var(--color-primary-light)]"
          >
            <GuestsOutlineIcon className="h-5 w-5 shrink-0 text-slate-500" />
            <div className="flex-1 text-right">
              <p className="text-xs text-slate-500">אורחים</p>
              <p className="truncate text-base text-slate-900">{guestsLabel}</p>
            </div>
          </button>
          {isGuestsOpen && (
            <GuestsPopup
              value={guests}
              onClose={() => setIsGuestsOpen(false)}
              onConfirm={(nextValue) => setGuests(nextValue)}
            />
          )}
        </div>

        <button
          type="submit"
          className="min-h-14 rounded-xl bg-[var(--color-primary-light)] px-8 text-lg font-semibold text-white transition hover:brightness-110"
        >
          חיפוש
        </button>

        <input
          type="hidden"
          name="checkIn"
          value={dateRange.startDate ? format(dateRange.startDate, "yyyy-MM-dd") : ""}
        />
        <input
          type="hidden"
          name="checkOut"
          value={dateRange.endDate ? format(dateRange.endDate, "yyyy-MM-dd") : ""}
        />
        <input type="hidden" name="adults" value={String(guests.adults)} />
        <input type="hidden" name="children" value={String(guests.children)} />
        <input type="hidden" name="rooms" value={String(guests.rooms)} />
      </form>

      {isCalendarOpen && (
        <DateRangeCalendarPopup
          value={dateRange}
          onClose={() => setIsCalendarOpen(false)}
          onConfirm={({ startDate, endDate }) => {
            setDateRange({ startDate, endDate });
            setIsCalendarOpen(false);
          }}
        />
      )}
    </section>
  );
}
