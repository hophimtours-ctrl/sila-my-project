"use client";

import { useMemo, useState } from "react";
import { BED_TYPE_OPTIONS, ROOM_CURRENCY_OPTIONS, ROOM_PAYMENT_POLICY_OPTIONS } from "@/lib/booking-options";

type OwnerRegisterPropertyFormProps = {
  error?: string;
  action: (formData: FormData) => void | Promise<void>;
};
const HOTEL_MARKUP_MODES = ["PERCENTAGE", "AMOUNT", "MAX"] as const;
const SUPPLIER_TYPES = ["HOTELBEDS", "MANUAL", "DIRECT"] as const;

export function OwnerRegisterPropertyForm({ error, action }: OwnerRegisterPropertyFormProps) {
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  const mapQuery = useMemo(
    () => [address.trim(), city.trim(), country.trim()].filter(Boolean).join(", "),
    [address, city, country],
  );
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery || "Tel Aviv, Israel")}&output=embed`;

  return (
    <form action={action} className="card grid gap-4 p-5 md:grid-cols-2">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{error}</p>}

      <input
        name="name"
        required
        placeholder="שם מקום האירוח"
        className="rounded-lg border p-3 md:col-span-2"
      />
      <input
        name="address"
        required
        placeholder="כתובת (רחוב ומספר)"
        className="rounded-lg border p-3 md:col-span-2"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
      />
      <input
        name="city"
        required
        placeholder="עיר"
        className="rounded-lg border p-3"
        value={city}
        onChange={(event) => setCity(event.target.value)}
      />
      <input
        name="country"
        required
        placeholder="מדינה"
        className="rounded-lg border p-3"
        value={country}
        onChange={(event) => setCountry(event.target.value)}
      />
      <input
        name="location"
        placeholder="מיקום להצגה (אופציונלי, אם שונה מהכתובת)"
        className="rounded-lg border p-3 md:col-span-2"
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 md:col-span-2">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          תצוגת מפה לפי הכתובת שנבחרה
        </div>
        <iframe
          title="מפת מיקום הנכס"
          src={mapSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-64 w-full border-0"
        />
      </div>

      <input name="contactEmail" type="email" required placeholder="אימייל ליצירת קשר" className="rounded-lg border p-3" />
      <input
        name="pricePerNight"
        type="number"
        min={1}
        required
        placeholder="מחיר נטו ללילה (ללא מרקאפ)"
        className="rounded-lg border p-3"
      />
      <select name="supplierType" defaultValue="MANUAL" className="rounded-lg border p-3">
        {SUPPLIER_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <select name="markupMode" defaultValue="PERCENTAGE" className="rounded-lg border p-3">
        {HOTEL_MARKUP_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {mode}
          </option>
        ))}
      </select>
      <input
        name="markupPercentage"
        type="number"
        min={0}
        step="0.01"
        defaultValue={0}
        placeholder="אחוז מרקאפ"
        className="rounded-lg border p-3"
      />
      <input
        name="markupAmount"
        type="number"
        min={0}
        step="0.01"
        defaultValue={0}
        placeholder="מרקאפ קבוע"
        className="rounded-lg border p-3"
      />
      <input
        name="maxGuests"
        type="number"
        min={1}
        defaultValue={2}
        required
        placeholder="מקסימום אורחים"
        className="rounded-lg border p-3"
      />
      <input
        name="inventory"
        type="number"
        min={1}
        defaultValue={1}
        required
        placeholder="כמות חדרים זמינה"
        className="rounded-lg border p-3"
      />
      <input
        name="roomName"
        defaultValue="חדר סטנדרט"
        placeholder="שם החדר הראשי"
        className="rounded-lg border p-3"
      />
      <select name="bedType" defaultValue={BED_TYPE_OPTIONS[0]?.value} className="rounded-lg border p-3">
        {BED_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select name="paymentPolicy" defaultValue={ROOM_PAYMENT_POLICY_OPTIONS[0]?.value} className="rounded-lg border p-3">
        {ROOM_PAYMENT_POLICY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select name="currencyCode" defaultValue={ROOM_CURRENCY_OPTIONS[0]?.value} className="rounded-lg border p-3">
        {ROOM_CURRENCY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <textarea
        name="description"
        required
        placeholder="תיאור מקום האירוח"
        className="min-h-28 rounded-lg border p-3 md:col-span-2"
      />
      <input
        name="facilities"
        placeholder="מתקנים (מופרדים בפסיקים)"
        className="rounded-lg border p-3 md:col-span-2"
      />

      <div className="rounded-lg border border-slate-200 p-3 md:col-span-2">
        <p className="text-sm font-semibold text-slate-800">תמונות</p>
        <p className="mt-1 text-xs text-slate-500">
          אפשר להוסיף קישורים, להעלות מהמחשב, או לצלם ישירות מהטלפון.
        </p>
        <textarea
          name="images"
          placeholder="קישורי תמונות (שורה חדשה או פסיק בין כל קישור)"
          className="mt-3 min-h-24 w-full rounded-lg border p-3"
        />
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
            העלאה מהמחשב
            <input name="imageFiles" type="file" accept="image/*" multiple className="mt-2 block w-full text-xs" />
          </label>
          <label className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
            צילום תמונה (טלפון)
            <input
              name="imageFiles"
              type="file"
              accept="image/*"
              capture="environment"
              className="mt-2 block w-full text-xs"
            />
          </label>
        </div>
      </div>

      <input
        name="cancellationPolicy"
        defaultValue="ביטול חינם עד 48 שעות לפני ההגעה"
        placeholder="מדיניות ביטול"
        className="rounded-lg border p-3 md:col-span-2"
      />

      <button
        type="submit"
        className="rounded-lg bg-[var(--color-primary-light)] px-4 py-3 text-sm font-semibold text-white md:col-span-2"
      >
        שליחת טופס רישום מקום האירוח
      </button>
    </form>
  );
}
