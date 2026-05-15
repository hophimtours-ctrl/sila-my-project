"use client";

import { useMemo, useState } from "react";
import { GuestsPopup, type GuestsValue } from "@/components/search/guests-popup";
import { CalendarOutlineIcon, GuestsOutlineIcon } from "@/components/search/search-icons";

type RoomBookingFormProps = {
  roomTypeId: string;
  maxGuests: number;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultGuests?: string;
  defaultAdults?: string;
  defaultChildren?: string;
  defaultRooms?: string;
};

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parseNonNegativeInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function normalizeGuestsValue(value: GuestsValue, maxGuests: number): GuestsValue {
  const normalizedMaxGuests = Math.max(1, maxGuests);
  let adults = Math.max(1, value.adults);
  let children = Math.max(0, value.children);
  const rooms = Math.max(1, value.rooms);

  if (adults > normalizedMaxGuests) {
    adults = normalizedMaxGuests;
    children = 0;
  } else if (adults + children > normalizedMaxGuests) {
    children = Math.max(0, normalizedMaxGuests - adults);
  }

  return { adults, children, rooms };
}

export function RoomBookingForm({
  roomTypeId,
  maxGuests,
  defaultCheckIn,
  defaultCheckOut,
  defaultGuests,
  defaultAdults,
  defaultChildren,
  defaultRooms,
}: RoomBookingFormProps) {
  const initialGuests = useMemo(() => {
    const adults = parsePositiveInteger(defaultAdults, parsePositiveInteger(defaultGuests, 1));
    const children = parseNonNegativeInteger(defaultChildren, 0);
    const rooms = parsePositiveInteger(defaultRooms, 1);
    return normalizeGuestsValue({ adults, children, rooms }, maxGuests);
  }, [defaultAdults, defaultChildren, defaultGuests, defaultRooms, maxGuests]);
  const [guestSelection, setGuestSelection] = useState<GuestsValue>(initialGuests);
  const [isGuestsOpen, setIsGuestsOpen] = useState(false);
  const totalGuests = guestSelection.adults + guestSelection.children;
  const guestsLabel = `${guestSelection.adults} מבוגרים, ${guestSelection.children} ילדים, ${guestSelection.rooms} חדרים`;

  return (
    <form
      action="/bookings/payment"
      method="get"
      className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto] md:items-stretch"
    >
      <input type="hidden" name="roomTypeId" value={roomTypeId} />
      <input type="hidden" name="guests" value={String(totalGuests)} />
      <input type="hidden" name="adults" value={String(guestSelection.adults)} />
      <input type="hidden" name="children" value={String(guestSelection.children)} />
      <input type="hidden" name="rooms" value={String(guestSelection.rooms)} />

      <div className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
        <CalendarOutlineIcon className="h-4 w-4 shrink-0 text-slate-500" />
        <div className="flex-1 text-right">
          <p className="text-[11px] text-slate-500">צ׳ק-אין</p>
          <input
            name="checkIn"
            type="date"
            required
            defaultValue={defaultCheckIn}
            className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none"
          />
        </div>
      </div>
      <div className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
        <CalendarOutlineIcon className="h-4 w-4 shrink-0 text-slate-500" />
        <div className="flex-1 text-right">
          <p className="text-[11px] text-slate-500">צ׳ק-אאוט</p>
          <input
            name="checkOut"
            type="date"
            required
            defaultValue={defaultCheckOut}
            className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none"
          />
        </div>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsGuestsOpen((prev) => !prev)}
          className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-right transition hover:border-[var(--color-primary-light)]"
        >
          <GuestsOutlineIcon className="h-4 w-4 shrink-0 text-slate-500" />
          <div className="flex-1 text-right">
            <p className="text-[11px] text-slate-500">אורחים</p>
            <p className="truncate text-sm text-slate-900">{guestsLabel}</p>
          </div>
        </button>
        {isGuestsOpen && (
          <GuestsPopup
            value={guestSelection}
            onClose={() => setIsGuestsOpen(false)}
            onConfirm={(nextValue) => setGuestSelection(normalizeGuestsValue(nextValue, maxGuests))}
          />
        )}
      </div>
      <button className="min-h-12 rounded-xl bg-[var(--color-primary-light)] px-5 text-sm font-semibold text-white transition hover:brightness-110">
        הזמן עכשיו
      </button>
      <p className="text-[11px] text-slate-500 md:col-span-4">עד {maxGuests} אורחים בחדר (כולל ילדים)</p>
    </form>
  );
}
