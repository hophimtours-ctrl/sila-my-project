import Link from "next/link";
import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/format";

export type SearchResultsCardHotel = {
  id: string;
  name: string;
  location: string;
  description: string;
  imageUrl: string;
  minPrice: number;
  stars: number;
  userScore: string;
  guestRatingText: string;
  reviewsCount: number;
  distanceFromCenterKm: number;
  distanceToBeachKm: number;
  distanceToNightlifeKm: number;
  isPopularChoice: boolean;
  hasFreeCancellation: boolean;
  hasLowAvailability: boolean;
};

type HotelResultCardProps = {
  hotel: SearchResultsCardHotel;
  hotelDetailsHref: string;
  showOnMapHref: string;
  isHebrew: boolean;
  requestedNightsLabel: string | null;
  lowInventoryLabel: string | null;
  favoriteControl: ReactNode;
};

export function HotelResultCard({
  hotel,
  hotelDetailsHref,
  showOnMapHref,
  isHebrew,
  requestedNightsLabel,
  lowInventoryLabel,
  favoriteControl,
}: HotelResultCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-52 w-full bg-slate-200">
        {hotel.imageUrl ? (
          <img
            src={hotel.imageUrl}
            alt={hotel.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">
            {isHebrew ? "תמונה תתווסף בקרוב" : "Image coming soon"}
          </div>
        )}
        <div className="absolute right-3 top-3">{favoriteControl}</div>
      </div>

      <div className="flex h-full flex-col space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div>
            <h3 className="inline-flex items-center gap-2 text-lg font-semibold">
              <Link
                href={hotelDetailsHref}
                className="text-[var(--color-primary-light)] transition hover:text-blue-400 hover:underline"
              >
                {hotel.name}
              </Link>
              <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-bold text-blue-600">
                <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
                  <path
                    d="M12 2 14.9 8.1 22 9.2l-5.2 5.1 1.2 7L12 18l-6 3.3 1.2-7L2 9.2l7.1-1.1z"
                    fill="currentColor"
                  />
                </svg>
                <span>{hotel.userScore}</span>
              </span>
              <span className="text-xs font-medium text-slate-500">
                {isHebrew
                  ? `${hotel.guestRatingText} · ${hotel.reviewsCount} חוות דעת`
                  : `${hotel.guestRatingText} · ${hotel.reviewsCount} reviews`}
              </span>
            </h3>
            <div className="mt-1 flex items-center gap-1 text-amber-500">
              {Array.from({ length: hotel.stars }).map((_, index) => (
                <svg
                  key={`star-${hotel.id}-${index}`}
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="h-4 w-4 fill-current"
                >
                  <path d="m12 3 2.6 5.3 5.9.8-4.3 4.2 1 5.9L12 16.8 6.8 19.2l1-5.9L3.5 9.1l5.9-.8z" />
                </svg>
              ))}
            </div>
            <p className="text-sm text-slate-500">{hotel.location}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5">
                  <path
                    d="M12 21s7-5.9 7-11a7 7 0 1 0-14 0c0 5.1 7 11 7 11Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="10"
                    r="2.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
                <span>
                  {isHebrew
                    ? `${hotel.distanceFromCenterKm} ק״מ מהמרכז`
                    : `${hotel.distanceFromCenterKm} km from center`}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5">
                  <path
                    d="M3 16c1.1 1 2.2 1.5 3.5 1.5S9 17 10.3 16c1.1 1 2.2 1.5 3.5 1.5s2.5-.5 3.7-1.5c1.1 1 2.2 1.5 3.5 1.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  {isHebrew
                    ? `${hotel.distanceToBeachKm} ק״מ מהים`
                    : `${hotel.distanceToBeachKm} km from the beach`}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5">
                  <path
                    d="M6 4v8m0 0a3 3 0 0 0 3-3V4M6 12a3 3 0 0 1-3-3V4M13 4h2v8m0 8V4m4 16V10a3 3 0 0 0-3-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  {isHebrew
                    ? `${hotel.distanceToNightlifeKm} ק״מ מאזורי בילוי`
                    : `${hotel.distanceToNightlifeKm} km from nightlife`}
                </span>
              </span>
            </div>
            {hotel.isPopularChoice && (
              <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                {isHebrew ? "בחירה פופולרית" : "Popular choice"}
              </span>
            )}
            {hotel.hasFreeCancellation && (
              <span className="mt-1 ms-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                {isHebrew ? "ביטול חינם" : "Free cancellation"}
              </span>
            )}
            {requestedNightsLabel && (
              <p className="mt-1 text-xs font-medium text-[var(--color-primary-light)]">
                {isHebrew ? `מבוקש: ${requestedNightsLabel}` : `Requested: ${requestedNightsLabel}`}
              </p>
            )}
            {hotel.hasLowAvailability && lowInventoryLabel && (
              <p className="mt-1 text-xs font-semibold text-rose-600">{lowInventoryLabel}</p>
            )}
          </div>
        </div>

        <p className="text-sm leading-6 text-slate-600">{hotel.description}</p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div>
            <p className="text-xs text-slate-500">{isHebrew ? "החל מ־" : "From"}</p>
            <p className="text-xl font-bold text-[var(--color-primary-light)]">
              {formatCurrency(hotel.minPrice)}
            </p>
            <p className="text-xs text-slate-500">{isHebrew ? "ללילה" : "per night"}</p>
          </div>

          <Link
            href={hotelDetailsHref}
            className="rounded-xl bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
          >
            {isHebrew ? "צפייה במלון" : "View hotel"}
          </Link>
        </div>

        <a
          href={showOnMapHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-[var(--color-primary-light)]"
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
          <span>{isHebrew ? "הצג במפה" : "Show on map"}</span>
        </a>
      </div>
    </article>
  );
}
