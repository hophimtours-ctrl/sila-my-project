import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { addFavoriteAction, createBookingAction, removeFavoriteAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { fetchMockHotelById } from "@/lib/mock-hotels-api";
import type { MockHotel } from "@/lib/mock-hotels";
import {
  getInventoryDisplayLabel,
  getInventoryDisplayState,
  getRemainingInventory,
  isLowInventory,
  isRoomBookable,
} from "@/lib/inventory-availability";

function parseDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
function parseImages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
function getFacilityIcon(facility: string) {
  const normalized = facility.trim().toLowerCase();
  const iconClassName = "h-3.5 w-3.5";

  if (normalized.includes("wifi") || normalized.includes("wi-fi") || normalized.includes("אינטרנט")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path
          d="M5 9.5a11 11 0 0 1 14 0M8 13a6.5 6.5 0 0 1 8 0M11 16.5a2.2 2.2 0 0 1 2 0M12 20h.01"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (normalized.includes("park") || normalized.includes("חניה")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path
          d="M8 18V6h4.5a3 3 0 0 1 0 6H8m0 6h8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (normalized.includes("pool") || normalized.includes("בריכ")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path
          d="M3 15c1.1 1 2.2 1.5 3.4 1.5S8.8 16 10 15c1.1 1 2.2 1.5 3.4 1.5S15.8 16 17 15c1.1 1 2.2 1.5 3.4 1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (normalized.includes("spa") || normalized.includes("ספא")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path
          d="M12 19c2.8 0 5-2.2 5-5 0-3.8-5-7-5-9 0 2-5 5.2-5 9 0 2.8 2.2 5 5 5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (normalized.includes("gym") || normalized.includes("כושר")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path
          d="M3 10h3v4H3m15-4h3v4h-3M9 9v6m6-6v6M6 12h12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (normalized.includes("breakfast") || normalized.includes("ארוחת")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path
          d="M5 14h14M7 14V9m10 5V9M6 18h12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (normalized.includes("restaurant") || normalized.includes("מסעד")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path
          d="M7 4v7m0 0a2.5 2.5 0 0 0 2.5-2.5V4M7 11a2.5 2.5 0 0 1-2.5-2.5V4M13 4h2v7m0 9V4m4 16V9a3 3 0 0 0-3-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (normalized.includes("bar") || normalized.includes("בר ")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path
          d="M4 6h16l-6.5 7v5l-3 1v-6z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (normalized.includes("tv") || normalized.includes("television") || normalized.includes("טלויז") || normalized.includes("טלוויז")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <rect x="4" y="6" width="16" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 20h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (normalized.includes("air") || normalized.includes("ac") || normalized.includes("מיזוג")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path
          d="M5 8h14M8 12h8M9 16h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (normalized.includes("safe") || normalized.includes("כספת")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (normalized.includes("balcony") || normalized.includes("מרפס")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path
          d="M4 10h16M6 10V6h12v4M6 10v8m4-8v8m4-8v8m4-8v8M4 18h16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (normalized.includes("elevator") || normalized.includes("מעלית")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <rect x="6" y="4" width="12" height="16" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8V16M10 10l2-2 2 2M10 14l2 2 2-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (normalized.includes("accessible") || normalized.includes("נגיש")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <circle cx="12" cy="6" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8v4h3m-3 0-2.5 4m2.5-4 3 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (normalized.includes("beach") || normalized.includes("חוף")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path d="M6 10h9l-2 2m2-2 2 2M3 18c1 .9 2 1.4 3.2 1.4S8.4 18.9 9.6 18c1 .9 2 1.4 3.2 1.4S15 18.9 16.2 18c1 .9 2 1.4 3.2 1.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (normalized.includes("room service") || normalized.includes("שירות חדרים")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path d="M4 14h16M6 14a6 6 0 0 1 12 0M3 17h18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (normalized.includes("pet") || normalized.includes("חיות")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path d="M12 18c2.5 0 4.5-1.5 4.5-3.5S14.5 11 12 11s-4.5 1.5-4.5 3.5S9.5 18 12 18Zm-4-8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (normalized.includes("smoking") || normalized.includes("עישון")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <path d="M4 15h12M4 18h12m3-3v3M18 10c1 0 2 .8 2 1.8V13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (normalized.includes("24") || normalized.includes("קבלה")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8v4l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (normalized.includes("shuttle") || normalized.includes("שאטל")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
        <rect x="4" y="7" width="16" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="8" cy="17.5" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16" cy="17.5" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden className={iconClassName}>
      <path
        d="m5 12 4.2 4.2L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function renderMockHotelPage(hotel: MockHotel, query: { checkIn?: string; checkOut?: string; guests?: string }) {
  const hotelImages = hotel.images;
  const imagePreview = hotelImages.slice(0, 5);
  const imageMain = imagePreview[0] ?? "";
  const imageSecondary = imagePreview.slice(1);
  const facilities = hotel.facilities;
  const stars = hotel.stars;
  const mapQuery = encodeURIComponent(`${hotel.name} ${hotel.location}`);
  const hotelMapHref = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  const hotelMapEmbedSrc = `https://www.google.com/maps?q=${mapQuery}&output=embed`;
  const hotelQuery = new URLSearchParams();
  if (query.checkIn) {
    hotelQuery.set("checkIn", query.checkIn);
  }
  if (query.checkOut) {
    hotelQuery.set("checkOut", query.checkOut);
  }
  if (query.guests) {
    hotelQuery.set("guests", query.guests);
  }
  const buildGalleryLink = (imageIndex: number) => {
    const galleryQuery = new URLSearchParams(hotelQuery);
    galleryQuery.set("image", String(imageIndex));
    return `/hotels/${hotel.id}/gallery?${galleryQuery.toString()}`;
  };

  return (
    <div className="space-y-5">
      <section className="card p-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold">{hotel.name}</h1>
          <span
            aria-label="מועדפים זמינים לאחר חיבור לנתונים אמיתיים"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-400"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6">
              <path
                d="M12.001 20.727 4.93 13.656a4.5 4.5 0 1 1 6.364-6.364l.707.707.707-.707a4.5 4.5 0 1 1 6.364 6.364z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
        <p className="text-slate-600">{hotel.location}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-amber-500">
            {Array.from({ length: stars }).map((_, index) => (
              <svg key={`hotel-star-${index}`} viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
                <path d="m12 3 2.6 5.3 5.9.8-4.3 4.2 1 5.9L12 16.8 6.8 19.2l1-5.9L3.5 9.1l5.9-.8z" />
              </svg>
            ))}
          </div>
          <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
            {hotel.rating.toFixed(1)}
          </span>
          <a
            href={hotelMapHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5">
              <path
                d="M12 21s7-5.9 7-11a7 7 0 1 0-14 0c0 5.1 7 11 7 11Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <span>הצג במפה</span>
          </a>
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">תמונות המלון</h2>
          {hotelImages.length > 0 && (
            <Link
              href={buildGalleryLink(0)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              לכל הגלריה
            </Link>
          )}
        </div>

        {hotelImages.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">טרם נוספו תמונות למלון זה.</p>
        ) : (
          <div className="grid gap-2 lg:grid-cols-[2fr_1fr]">
            <Link href={buildGalleryLink(0)} className="block overflow-hidden rounded-2xl">
              <img src={imageMain} alt={`${hotel.name} - תמונה ראשית`} className="h-72 w-full object-cover" />
            </Link>
            <div className="grid grid-cols-2 gap-2">
              {imageSecondary.map((imageUrl, index) => (
                <Link
                  key={`${imageUrl}-${index}`}
                  href={buildGalleryLink(index + 1)}
                  className="block overflow-hidden rounded-2xl"
                >
                  <img
                    src={imageUrl}
                    alt={`${hotel.name} - תמונה ${index + 2}`}
                    className="h-36 w-full object-cover"
                  />
                </Link>
              ))}
              {hotelImages.length > imagePreview.length && (
                <Link
                  href={buildGalleryLink(imagePreview.length)}
                  className="flex h-36 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  +{hotelImages.length - imagePreview.length} תמונות נוספות
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-bold">מיקום המלון</h2>
        <p className="text-sm text-slate-600">{hotel.location}</p>
        <iframe
          title={`מיקום ${hotel.name}`}
          src={hotelMapEmbedSrc}
          className="h-64 w-full rounded-xl border border-slate-200"
          loading="lazy"
        />
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-xl font-bold">פרטי המקום</h2>
        <p className="leading-7 text-slate-700">{hotel.description}</p>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold text-slate-900">המתקנים הפופולריים ביותר</h3>
          <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {facilities.map((facility) => (
              <div key={facility} className="flex items-center gap-2 text-[13px] font-medium text-slate-700">
                <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  {getFacilityIcon(facility)}
                </span>
                <span className="truncate">{facility}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">סוגי חדרים</h2>
        {hotel.rooms.map((room) => (
          <article key={room.id} className="card p-4">
            {room.photos[0] && (
              <img
                src={room.photos[0]}
                alt={`${room.name} - תמונת חדר`}
                className="mb-3 h-44 w-full rounded-xl object-cover"
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{room.name}</h3>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {getInventoryDisplayLabel({
                  state: isLowInventory(room.availableRooms) ? "lowStock" : "available",
                  remainingInventory: room.availableRooms,
                  locale: "he",
                })}
              </span>
            </div>
            <p className="text-sm">עד {room.maxGuests} אורחים</p>
            <p className="my-2 font-bold text-[var(--color-primary)]">
              {formatCurrency(room.pricePerNight)} ללילה
            </p>
            <p className="text-sm text-slate-600">הזמנות פעילות רק לאחר חיבור לנתוני מלונות אמיתיים.</p>
          </article>
        ))}
      </section>
    </div>
  );
}

export default async function HotelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (id.startsWith("mock-hotel-")) {
    const mockHotel = await fetchMockHotelById(id);
    if (!mockHotel) {
      return notFound();
    }
    return renderMockHotelPage(mockHotel, query);
  }
  const requestedCheckInDate = parseDate(query.checkIn);
  const requestedCheckOutDate = parseDate(query.checkOut);
  const hasRequestedDateRange = Boolean(
    requestedCheckInDate &&
      requestedCheckOutDate &&
      requestedCheckOutDate.getTime() > requestedCheckInDate.getTime(),
  );
  const user = await getCurrentUser();
  const isFavorite = user
    ? Boolean(
        await prisma.favorite.findUnique({
          where: {
            userId_hotelId: {
              userId: user.id,
              hotelId: id,
            },
          },
          select: { id: true },
        }),
      )
    : false;

  const hotel = await prisma.hotel.findUnique({
    where: { id },
    include: {
      roomTypes: true,
      reviews: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!hotel || hotel.status !== "APPROVED") {
    return notFound();
  }
  const hotelImages = parseImages(hotel.images);
  const imagePreview = hotelImages.slice(0, 5);
  const imageMain = imagePreview[0] ?? "";
  const imageSecondary = imagePreview.slice(1);
  const facilities = Array.isArray(hotel.facilities)
    ? hotel.facilities.filter((facility): facility is string => typeof facility === "string")
    : [];
  const averageRating =
    hotel.reviews.length > 0
      ? hotel.reviews.reduce((sum, review) => sum + review.rating, 0) / hotel.reviews.length
      : 0;
  const stars = averageRating >= 4.7 ? 5 : averageRating >= 4.1 ? 4 : averageRating >= 3.2 ? 3 : 2;
  const mapQuery = encodeURIComponent(`${hotel.name} ${hotel.location}`);
  const hotelMapHref = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  const hotelMapEmbedSrc = `https://www.google.com/maps?q=${mapQuery}&output=embed`;
  const hotelQuery = new URLSearchParams();
  if (query.checkIn) {
    hotelQuery.set("checkIn", query.checkIn);
  }
  if (query.checkOut) {
    hotelQuery.set("checkOut", query.checkOut);
  }
  if (query.guests) {
    hotelQuery.set("guests", query.guests);
  }
  const buildGalleryLink = (imageIndex: number) => {
    const galleryQuery = new URLSearchParams(hotelQuery);
    galleryQuery.set("image", String(imageIndex));
    return `/hotels/${hotel.id}/gallery?${galleryQuery.toString()}`;
  };
  const roomTypeIds = hotel.roomTypes.map((roomType) => roomType.id);
  const [overlappingBookings, blockedDateInRequestedRange] =
    hasRequestedDateRange && requestedCheckInDate && requestedCheckOutDate && roomTypeIds.length > 0
      ? await Promise.all([
          prisma.booking.groupBy({
            by: ["roomTypeId"],
            where: {
              roomTypeId: { in: roomTypeIds },
              status: BookingStatus.CONFIRMED,
              checkIn: { lt: requestedCheckOutDate },
              checkOut: { gt: requestedCheckInDate },
            },
            _count: { _all: true },
          }),
          prisma.blockedDate.findFirst({
            where: {
              hotelId: hotel.id,
              date: { gte: requestedCheckInDate, lt: requestedCheckOutDate },
            },
            select: { id: true },
          }),
        ])
      : [[], null];
  const overlappingByRoomType = new Map(
    overlappingBookings.map((item) => [item.roomTypeId, item._count._all]),
  );
  const isHotelBlockedForRequestedDates = Boolean(blockedDateInRequestedRange);
  const roomStates = hotel.roomTypes.map((room) => {
    const overlappingCount = hasRequestedDateRange
      ? Number(overlappingByRoomType.get(room.id) ?? 0)
      : 0;
    const remainingRooms = getRemainingInventory({
      inventory: room.inventory,
      availableInventory: room.availableInventory,
      overlappingBookings: overlappingCount,
    });
    const isBookable = isRoomBookable({
      roomIsAvailable: room.isAvailable,
      remainingInventory: remainingRooms,
      hotelBlockedByDates: isHotelBlockedForRequestedDates,
    });
    const displayState = getInventoryDisplayState({
      isBookable,
      remainingInventory: remainingRooms,
      hotelBlockedByDates: isHotelBlockedForRequestedDates,
    });
    const displayLabel = getInventoryDisplayLabel({
      state: displayState,
      remainingInventory: remainingRooms,
      locale: "he",
    });

    return {
      room,
      roomPhotos: parseImages(room.photos),
      remainingRooms,
      isBookable,
      displayState,
      displayLabel,
    };
  });

  return (
    <div className="space-y-5">
      <section className="card p-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold">{hotel.name}</h1>
          {user ? (
            <form action={isFavorite ? removeFavoriteAction : addFavoriteAction}>
              <input type="hidden" name="hotelId" value={hotel.id} />
              <button
                type="submit"
                aria-label={isFavorite ? "הסרה מהמועדפים" : "שמירה למועדפים"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100"
              >
                <svg viewBox="0 0 24 24" aria-hidden className={`h-6 w-6 ${isFavorite ? "text-red-500" : ""}`}>
                  <path
                    d="M12.001 20.727 4.93 13.656a4.5 4.5 0 1 1 6.364-6.364l.707.707.707-.707a4.5 4.5 0 1 1 6.364 6.364z"
                    fill={isFavorite ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              aria-label="התחברות לשמירה למועדפים"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6">
                <path
                  d="M12.001 20.727 4.93 13.656a4.5 4.5 0 1 1 6.364-6.364l.707.707.707-.707a4.5 4.5 0 1 1 6.364 6.364z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          )}
        </div>
        <p className="text-slate-600">{hotel.location}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-amber-500">
            {Array.from({ length: stars }).map((_, index) => (
              <svg key={`hotel-star-${index}`} viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
                <path d="m12 3 2.6 5.3 5.9.8-4.3 4.2 1 5.9L12 16.8 6.8 19.2l1-5.9L3.5 9.1l5.9-.8z" />
              </svg>
            ))}
          </div>
          <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
            {averageRating > 0 ? averageRating.toFixed(1) : "חדש"}
          </span>
          <a
            href={hotelMapHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5">
              <path
                d="M12 21s7-5.9 7-11a7 7 0 1 0-14 0c0 5.1 7 11 7 11Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <span>הצג במפה</span>
          </a>
        </div>
      </section>
      <section className="card space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">תמונות המלון</h2>
          {hotelImages.length > 0 && (
            <Link
              href={buildGalleryLink(0)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              לכל הגלריה
            </Link>
          )}
        </div>

        {hotelImages.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">טרם נוספו תמונות למלון זה.</p>
        ) : (
          <div className="grid gap-2 lg:grid-cols-[2fr_1fr]">
            <Link href={buildGalleryLink(0)} className="block overflow-hidden rounded-2xl">
              <img src={imageMain} alt={`${hotel.name} - תמונה ראשית`} className="h-72 w-full object-cover" />
            </Link>
            <div className="grid grid-cols-2 gap-2">
              {imageSecondary.map((imageUrl, index) => (
                <Link
                  key={`${imageUrl}-${index}`}
                  href={buildGalleryLink(index + 1)}
                  className="block overflow-hidden rounded-2xl"
                >
                  <img
                    src={imageUrl}
                    alt={`${hotel.name} - תמונה ${index + 2}`}
                    className="h-36 w-full object-cover"
                  />
                </Link>
              ))}
              {hotelImages.length > imagePreview.length && (
                <Link
                  href={buildGalleryLink(imagePreview.length)}
                  className="flex h-36 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  +{hotelImages.length - imagePreview.length} תמונות נוספות
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-bold">מיקום המלון</h2>
        <p className="text-sm text-slate-600">{hotel.location}</p>
        <iframe
          title={`מיקום ${hotel.name}`}
          src={hotelMapEmbedSrc}
          className="h-64 w-full rounded-xl border border-slate-200"
          loading="lazy"
        />
      </section>
      <section className="card space-y-4 p-5">
        <h2 className="text-xl font-bold">פרטי המקום</h2>
        <p className="leading-7 text-slate-700">{hotel.description}</p>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold text-slate-900">המתקנים הפופולריים ביותר</h3>
          <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {facilities.map((facility) => (
              <div key={facility} className="flex items-center gap-2 text-[13px] font-medium text-slate-700">
                <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  {getFacilityIcon(facility)}
                </span>
                <span className="truncate">{facility}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {query.error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{query.error}</p>}
      {hasRequestedDateRange && isHotelBlockedForRequestedDates && (
        <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
          המלון אינו זמין בתאריכים שנבחרו.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">סוגי חדרים</h2>
        {roomStates.map(({ room, roomPhotos, remainingRooms, isBookable, displayState, displayLabel }) => (
          <article key={room.id} className="card p-4">
            {roomPhotos[0] && (
              <img
                src={roomPhotos[0]}
                alt={`${room.name} - תמונת חדר`}
                className="mb-3 h-44 w-full rounded-xl object-cover"
              />
            )}
            {roomPhotos.length > 1 && (
              <div className="mb-3 grid grid-cols-4 gap-2">
                {roomPhotos.slice(1, 5).map((photo, index) => (
                  <img
                    key={`${room.id}-thumb-${index}`}
                    src={photo}
                    alt={`${room.name} - תמונה ${index + 2}`}
                    className="h-16 w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{room.name}</h3>
              {displayState === "available" ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {displayLabel}
                </span>
              ) : displayState === "lowStock" ? (
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                  {displayLabel}
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {displayLabel}
                </span>
              )}
            </div>
            <p className="text-sm">עד {room.maxGuests} אורחים</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5">
                  <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="16" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M4 18a4 4 0 0 1 8 0m4 0a4 4 0 0 1 4-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <span>{`תפוסה מקסימלית: ${room.maxGuests}`}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5">
                  <path
                    d="M4 7h16M4 12h16M4 17h10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <span>{room.cancellationPolicy}</span>
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {facilities.slice(0, 5).map((facility) => (
                <span
                  key={`${room.id}-${facility}`}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                >
                  {getFacilityIcon(facility)}
                  <span>{facility}</span>
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500">חדרים זמינים כרגע: {remainingRooms}</p>
            <p className="my-2 font-bold text-[var(--color-primary)]">
              {formatCurrency(room.pricePerNight)} ללילה
            </p>
            {user?.role === "GUEST" && isBookable ? (
              <form action={createBookingAction} className="grid gap-2 md:grid-cols-4">
                <input type="hidden" name="roomTypeId" value={room.id} />
                <input
                  name="checkIn"
                  type="date"
                  required
                  defaultValue={query.checkIn}
                  className="rounded-lg border p-2"
                />
                <input
                  name="checkOut"
                  type="date"
                  required
                  defaultValue={query.checkOut}
                  className="rounded-lg border p-2"
                />
                <input
                  name="guests"
                  type="number"
                  min={1}
                  max={room.maxGuests}
                  defaultValue={query.guests ? Number(query.guests) : 1}
                  className="rounded-lg border p-2"
                />
                <button className="rounded-lg bg-[var(--color-cta)] p-2 font-bold">בחר חדר</button>
              </form>
            ) : user?.role === "GUEST" ? (
              <p className="text-sm font-medium text-red-600">אין זמינות לחדר זה בתאריכים שנבחרו.</p>
            ) : (
              <p className="text-sm text-slate-600">להזמנה יש להתחבר כאורח.</p>
            )}
          </article>
        ))}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-xl font-bold">ביקורות אחרונות</h2>
        {hotel.reviews.length === 0 && <p className="text-sm text-slate-600">אין עדיין ביקורות.</p>}
        <div className="space-y-3">
          {hotel.reviews.map((review) => (
            <div key={review.id} className="rounded-lg border p-3">
              <p className="font-semibold">
                {review.user.name} · {review.rating}/5
              </p>
              <p className="text-sm">{review.comment}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
