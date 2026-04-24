"use client";

import { useMemo, useState } from "react";

type OwnerOption = {
  id: string;
  name: string;
  email: string;
};

type ProviderOption = {
  id: string;
  name: string;
};

type AdminHotelCreateFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  owners: OwnerOption[];
  providers: ProviderOption[];
  hotelNameSuggestions: string[];
  isAdmin: boolean;
  ownerId?: string;
};

const FACILITY_OPTIONS = [
  { value: "wifi", label: "Wi-Fi חינם" },
  { value: "parking", label: "חניה" },
  { value: "pool", label: "בריכה" },
  { value: "spa", label: "ספא" },
  { value: "gym", label: "חדר כושר" },
  { value: "breakfast", label: "ארוחת בוקר" },
  { value: "restaurant", label: "מסעדה" },
  { value: "bar", label: "בר/לאונג׳" },
  { value: "room-service", label: "שירות חדרים" },
  { value: "air-conditioning", label: "מיזוג אוויר" },
  { value: "family-rooms", label: "חדרי משפחה" },
  { value: "accessible", label: "נגישות" },
  { value: "airport-shuttle", label: "הסעה לשדה תעופה" },
  { value: "pets-allowed", label: "כניסה עם חיות מחמד" },
  { value: "beach-access", label: "גישה לחוף" },
  { value: "business-center", label: "מרכז עסקים" },
  { value: "meeting-rooms", label: "חדרי ישיבות" },
  { value: "laundry", label: "שירותי כביסה" },
  { value: "kitchen", label: "מטבחון" },
  { value: "free-cancellation", label: "ביטול חינם" },
];
const DATA_SOURCE_MODES = ["MANUAL", "API", "HYBRID"] as const;
const HOTEL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export function AdminHotelCreateForm({
  action,
  owners,
  providers,
  hotelNameSuggestions,
  isAdmin,
  ownerId,
}: AdminHotelCreateFormProps) {
  const [hotelName, setHotelName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationText, setLocationText] = useState("");
  const [rating, setRating] = useState(4);

  const mapQuery = useMemo(() => {
    if (latitude.trim() && longitude.trim()) {
      return `${latitude.trim()}, ${longitude.trim()}`;
    }
    const hotelByCityCountry = [hotelName.trim(), city.trim(), country.trim()]
      .filter(Boolean)
      .join(", ");
    if (hotelByCityCountry) {
      return hotelByCityCountry;
    }

    const addressQuery = [address.trim(), city.trim(), country.trim()].filter(Boolean).join(", ");
    if (addressQuery) {
      return addressQuery;
    }

    if (locationText.trim()) {
      return locationText.trim();
    }

    return "Tel Aviv, Israel";
  }, [address, city, country, hotelName, latitude, longitude, locationText]);
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;

  return (
    <form action={action} className="mt-3 grid gap-3 md:grid-cols-2" encType="multipart/form-data">
      {isAdmin ? (
        <select name="ownerId" required className="rounded-lg border p-2">
          <option value="">בחירת בעלים</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name} ({owner.email})
            </option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="ownerId" value={ownerId} />
      )}

      <div className="space-y-1">
        <input
          name="name"
          required
          list="admin-hotel-name-options"
          placeholder="שם מלון (בחירה או כתיבה חופשית)"
          className="w-full rounded-lg border p-2"
          value={hotelName}
          onChange={(event) => setHotelName(event.target.value)}
        />
        <datalist id="admin-hotel-name-options">
          {hotelNameSuggestions.map((nameOption) => (
            <option key={nameOption} value={nameOption} />
          ))}
        </datalist>
      </div>

      <textarea
        name="description"
        required
        placeholder="תיאור המלון"
        className="rounded-lg border p-2 md:col-span-2"
      />

      <div className="rounded-lg border border-slate-200 p-3 md:col-span-2">
        <p className="text-sm font-semibold text-slate-900">מיקום וכתובת</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input
            name="address"
            placeholder="כתובת מלאה"
            className="rounded-lg border p-2 md:col-span-2"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          <input
            name="city"
            placeholder="עיר"
            className="rounded-lg border p-2"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
          <input
            name="country"
            placeholder="מדינה"
            className="rounded-lg border p-2"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          />
          <input
            name="latitude"
            placeholder="קו רוחב (Latitude)"
            className="rounded-lg border p-2"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
          />
          <input
            name="longitude"
            placeholder="קו אורך (Longitude)"
            className="rounded-lg border p-2"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
          />
          <input
            name="location"
            placeholder="שם מיקום להצגה (אופציונלי)"
            className="rounded-lg border p-2 md:col-span-2"
            value={locationText}
            onChange={(event) => setLocationText(event.target.value)}
          />
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            תצוגת מפה (מתעדכן לפי כתובת/נ״צ)
          </div>
          <iframe
            title="תצוגת מיקום המלון"
            src={mapSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-64 w-full border-0"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3 md:col-span-2">
        <p className="text-sm font-semibold text-slate-900">דירוג כוכבים</p>
        <p className="mt-1 text-xs text-slate-500">בחר דירוג בין כוכב אחד לחמישה כוכבים.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((starValue) => {
            const selected = rating === starValue;
            return (
              <label
                key={starValue}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition ${
                  selected ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="rating"
                  value={starValue}
                  checked={selected}
                  onChange={() => setRating(starValue)}
                  className="sr-only"
                />
                {"★".repeat(starValue)}
                {"☆".repeat(5 - starValue)}
              </label>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3 md:col-span-2">
        <p className="text-sm font-semibold text-slate-900">מתקנים במלון</p>
        <p className="mt-1 text-xs text-slate-500">סמנו אם המתקן קיים במלון.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FACILITY_OPTIONS.map((facility) => (
            <label key={facility.value} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" name="facilityOptions" value={facility.value} className="h-4 w-4" />
              <span>{facility.label}</span>
            </label>
          ))}
        </div>
        <textarea
          name="facilities"
          placeholder="מתקנים נוספים בכתיבה חופשית (פסיקים/שורות)"
          className="mt-3 min-h-20 w-full rounded-lg border p-2"
        />
      </div>

      <div className="rounded-lg border border-slate-200 p-3 md:col-span-2">
        <p className="text-sm font-semibold text-slate-900">תמונות המלון</p>
        <p className="mt-1 text-xs text-slate-500">
          אפשר להדביק קישורים, לגרור תמונות מהמחשב או לבחור קבצים מהמחשב.
        </p>
        <textarea name="images" placeholder="קישורי תמונות (שורה חדשה או פסיק)" className="mt-3 min-h-20 w-full rounded-lg border p-2" />
        <label className="mt-3 block rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600">
          גרירה/הוספה מהמחשב
          <input name="imageFiles" type="file" accept="image/*" multiple className="mt-2 block w-full text-xs" />
        </label>
      </div>

      {isAdmin ? (
        <>
          <select name="dataSourceMode" className="rounded-lg border p-2">
            {DATA_SOURCE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>

          <select name="providerId" className="rounded-lg border p-2">
            <option value="">ללא ספק</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>

          <select name="status" defaultValue="APPROVED" className="rounded-lg border p-2">
            {HOTEL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select name="manualOverride" defaultValue="false" className="rounded-lg border p-2">
            <option value="false">Manual Override: Off</option>
            <option value="true">Manual Override: On</option>
          </select>
        </>
      ) : (
        <>
          <input type="hidden" name="dataSourceMode" value="MANUAL" />
          <input type="hidden" name="providerId" value="" />
          <input type="hidden" name="status" value="PENDING" />
          <input type="hidden" name="manualOverride" value="false" />
        </>
      )}

      <button className="rounded-lg bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-white md:col-span-2">
        יצירת מלון
      </button>
    </form>
  );
}
