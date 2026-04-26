import Link from "next/link";
import { cookies } from "next/headers";
import { removeFavoriteAction, removeMockFavoriteAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { LANGUAGE_COOKIE_KEY, parseAppLanguage } from "@/lib/i18n";
import { fetchMockHotels } from "@/lib/mock-hotels-api";
import {
  MOCK_FAVORITES_COOKIE_KEY,
  parseMockFavoriteHotelIds,
} from "@/lib/mock-favorites";
import type { MockHotel } from "@/lib/mock-hotels";

function parseImages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export default async function FavoritesPage() {
  const cookieStore = await cookies();
  const language = parseAppLanguage(cookieStore.get(LANGUAGE_COOKIE_KEY)?.value);
  const isHebrew = language === "he";
  const user = await requireUser();

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    include: {
      hotel: {
        include: { roomTypes: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const mockFavoriteHotelIds = parseMockFavoriteHotelIds(
    cookieStore.get(MOCK_FAVORITES_COOKIE_KEY)?.value,
  );
  const mockHotelsSource = mockFavoriteHotelIds.length ? await fetchMockHotels({ limit: 50 }) : [];
  const mockHotelsById = new Map(mockHotelsSource.map((hotel) => [hotel.id, hotel]));
  const mockFavoriteHotels: MockHotel[] = mockFavoriteHotelIds
    .map((hotelId) => mockHotelsById.get(hotelId))
    .filter((hotel): hotel is MockHotel => Boolean(hotel));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{isHebrew ? "המועדפים שלי" : "My favorites"}</h1>

      {favorites.length === 0 && mockFavoriteHotels.length === 0 && (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-600 shadow-sm">
          {isHebrew
            ? "עדיין לא שמרת מלונות למועדפים."
            : "You haven’t saved any hotels to favorites yet."}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {favorites.map((favorite) => {
          const imageUrl = parseImages(favorite.hotel.images)[0] ?? "";
          const minPrice = favorite.hotel.roomTypes.length
            ? Math.min(...favorite.hotel.roomTypes.map((room) => Number(room.pricePerNight) || 0))
            : 0;

          return (
            <article key={favorite.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="h-44 w-full bg-slate-200">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={favorite.hotel.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    {isHebrew ? "אין תמונה זמינה" : "No image available"}
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{favorite.hotel.name}</h2>
                  <p className="text-sm text-slate-500">{favorite.hotel.location}</p>
                </div>

                <p className="text-sm text-slate-600 line-clamp-2">{favorite.hotel.description}</p>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--color-primary-light)]">
                    {minPrice > 0
                      ? `${isHebrew ? "החל מ־" : "From "} ${formatCurrency(minPrice)} ${
                          isHebrew ? "ללילה" : "per night"
                        }`
                      : isHebrew
                        ? "מחיר יפורסם בקרוב"
                        : "Price coming soon"}
                  </p>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/hotels/${favorite.hotel.id}`}
                      className="rounded-lg bg-[var(--color-primary-light)] px-3 py-2 text-xs font-semibold text-white"
                    >
                      {isHebrew ? "צפייה במלון" : "View hotel"}
                    </Link>
                    <form action={removeFavoriteAction}>
                      <input type="hidden" name="hotelId" value={favorite.hotel.id} />
                      <button
                        type="submit"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-red-500 transition hover:bg-red-50"
                        aria-label={isHebrew ? "הסרה מהמועדפים" : "Remove from favorites"}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
                          <path
                            d="M12.001 20.727 4.93 13.656a4.5 4.5 0 1 1 6.364-6.364l.707.707.707-.707a4.5 4.5 0 1 1 6.364 6.364z"
                            fill="currentColor"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {mockFavoriteHotels.map((mockFavorite) => {
          const imageUrl = mockFavorite.images[0] ?? "";
          const minPrice = mockFavorite.rooms.length
            ? Math.min(...mockFavorite.rooms.map((room) => Number(room.pricePerNight) || 0))
            : 0;

          return (
            <article
              key={`mock-favorite-${mockFavorite.id}`}
              className="overflow-hidden rounded-2xl bg-white shadow-sm"
            >
              <div className="h-44 w-full bg-slate-200">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={mockFavorite.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    {isHebrew ? "אין תמונה זמינה" : "No image available"}
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{mockFavorite.name}</h2>
                  <p className="text-sm text-slate-500">{mockFavorite.location}</p>
                </div>

                <p className="text-sm text-slate-600 line-clamp-2">{mockFavorite.description}</p>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--color-primary-light)]">
                    {minPrice > 0
                      ? `${isHebrew ? "החל מ־" : "From "} ${formatCurrency(minPrice)} ${
                          isHebrew ? "ללילה" : "per night"
                        }`
                      : isHebrew
                        ? "מחיר יפורסם בקרוב"
                        : "Price coming soon"}
                  </p>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/hotels/${mockFavorite.id}`}
                      className="rounded-lg bg-[var(--color-primary-light)] px-3 py-2 text-xs font-semibold text-white"
                    >
                      {isHebrew ? "צפייה במלון" : "View hotel"}
                    </Link>
                    <form action={removeMockFavoriteAction}>
                      <input type="hidden" name="hotelId" value={mockFavorite.id} />
                      <button
                        type="submit"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-red-500 transition hover:bg-red-50"
                        aria-label={isHebrew ? "הסרה מהמועדפים" : "Remove from favorites"}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
                          <path
                            d="M12.001 20.727 4.93 13.656a4.5 4.5 0 1 1 6.364-6.364l.707.707.707-.707a4.5 4.5 0 1 1 6.364 6.364z"
                            fill="currentColor"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
