import Link from "next/link";
import { HotelDataSourceMode, Role } from "@prisma/client";
import {
  adminCreateHotelAction,
  adminCreateRoomAction,
  adminDeleteHotelAction,
  adminDeleteRoomAction,
  adminSetHotelSourceModeAction,
  adminSyncHotelFromProviderAction,
  adminUpdateRoomAction,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminManagementShell } from "@/components/admin-management-shell";
import { AdminHotelCreateForm } from "@/components/admin-hotel-create-form";
import { redirect } from "next/navigation";
import { ROOM_TYPE_OPTIONS } from "@/lib/room-type-options";
const ownerAdminNavigationItems = [
  { href: "/admin/hotels", label: "ניהול מלונות" },
  { href: "/admin/rooms", label: "ניהול חדרים" },
];

export default async function AdminHotelsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== Role.ADMIN && user.role !== Role.OWNER) {
    redirect("/");
  }
  const query = await searchParams;
  const isAdmin = user.role === Role.ADMIN;
  const hotelScopeFilter = isAdmin ? {} : { ownerId: user.id };

  const [hotels, owners, providers] = await Promise.all([
    prisma.hotel.findMany({
      where: hotelScopeFilter,
      include: { owner: true, provider: true, roomTypes: true },
      orderBy: { createdAt: "desc" },
    }),
    isAdmin
      ? prisma.user.findMany({
          where: { role: { in: [Role.OWNER, Role.ADMIN] } },
          orderBy: { name: "asc" },
        })
      : prisma.user.findMany({
          where: { id: user.id },
          orderBy: { name: "asc" },
        }),
    isAdmin
      ? prisma.hotelApiProvider.findMany({
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const hotelNameSuggestions = Array.from(new Set(hotels.map((hotel) => hotel.name))).sort((a, b) =>
    a.localeCompare(b, "he"),
  );

  return (
    <AdminManagementShell
      activePath="/admin/hotels"
      title="ניהול מלונות"
      description="רשימת מלונות, הוספה, מחיקה, צפייה וניהול מקור נתונים."
      error={query.error}
      success={query.success}
      navigationItems={isAdmin ? undefined : ownerAdminNavigationItems}
    >
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">הוספת מלון</h2>
        <AdminHotelCreateForm
          action={adminCreateHotelAction}
          owners={owners}
          providers={providers}
          hotelNameSuggestions={hotelNameSuggestions}
          isAdmin={isAdmin}
          ownerId={isAdmin ? undefined : user.id}
        />
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">רשימת מלונות</h2>
        <div className="mt-3 space-y-2">
          {hotels.map((hotel) => (
            <div key={hotel.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{hotel.name}</p>
                  <p className="text-sm text-slate-600">{hotel.location}</p>
                  <p className="text-sm text-amber-600">
                    {renderHotelRatingStars(hotel.rating)}
                  </p>
                  <p className="text-xs text-slate-500">
                    סטטוס: {hotel.status} · מקור: {hotel.dataSourceMode} · סוגי חדרים: {hotel.roomTypes.length}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/hotels/${hotel.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs">
                    צפייה
                  </Link>
                  {isAdmin && (
                    <form action={adminSyncHotelFromProviderAction}>
                      <input type="hidden" name="hotelId" value={hotel.id} />
                      <button className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs text-indigo-700">
                        סנכרון
                      </button>
                    </form>
                  )}
                  <form action={adminDeleteHotelAction}>
                    <input type="hidden" name="hotelId" value={hotel.id} />
                    <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700">
                      מחיקה
                    </button>
                  </form>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <h3 className="text-sm font-semibold text-slate-900">ניהול חדרים במלון</h3>
                <p className="mt-1 text-xs text-slate-500">
                  בחרו סוג חדר מרשימה והגדירו כמה חדרים יש וכמה מהם זמינים להזמנה.
                </p>
                <form action={adminCreateRoomAction} className="mt-3 grid gap-2 md:grid-cols-3">
                  <input type="hidden" name="hotelId" value={hotel.id} />
                  <input type="hidden" name="redirectTo" value="/admin/hotels" />
                  <select name="name" required className="rounded-lg border p-2 text-sm">
                    <option value="">בחירת סוג חדר</option>
                    {ROOM_TYPE_OPTIONS.map((roomTypeOption) => (
                      <option key={roomTypeOption} value={roomTypeOption}>
                        {roomTypeOption}
                      </option>
                    ))}
                  </select>
                  <input
                    name="inventory"
                    type="number"
                    min={0}
                    required
                    defaultValue={1}
                    placeholder="סה״כ חדרים"
                    className="rounded-lg border p-2 text-sm"
                  />
                  <input
                    name="availableInventory"
                    type="number"
                    min={0}
                    required
                    defaultValue={1}
                    placeholder="חדרים זמינים"
                    className="rounded-lg border p-2 text-sm"
                  />
                  <input
                    name="pricePerNight"
                    type="number"
                    min={1}
                    required
                    defaultValue={450}
                    placeholder="מחיר ללילה"
                    className="rounded-lg border p-2 text-sm"
                  />
                  <input
                    name="maxGuests"
                    type="number"
                    min={1}
                    required
                    defaultValue={2}
                    placeholder="מקסימום אורחים"
                    className="rounded-lg border p-2 text-sm"
                  />
                  <input
                    name="cancellationPolicy"
                    required
                    defaultValue="ביטול חינם עד 48 שעות לפני ההגעה"
                    placeholder="מדיניות ביטול"
                    className="rounded-lg border p-2 text-sm"
                  />
                  <button className="rounded-lg bg-[var(--color-primary-light)] px-3 py-2 text-xs font-semibold text-white md:col-span-3">
                    הוספת סוג חדר למלון
                  </button>
                </form>

                {hotel.roomTypes.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">עדיין לא הוגדרו סוגי חדרים למלון זה.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {hotel.roomTypes.map((roomType) => (
                      <div key={roomType.id} className="rounded-lg border border-slate-100 p-2">
                        <p className="mb-2 text-xs text-slate-500">
                          סה״כ: {roomType.inventory} · זמינים: {roomType.availableInventory}
                        </p>
                        <form action={adminUpdateRoomAction} className="grid gap-2 md:grid-cols-3">
                          <input type="hidden" name="roomId" value={roomType.id} />
                          <input type="hidden" name="hotelId" value={hotel.id} />
                          <input type="hidden" name="redirectTo" value="/admin/hotels" />
                          <select
                            name="name"
                            required
                            defaultValue={roomType.name}
                            className="rounded-lg border p-2 text-sm"
                          >
                            {buildRoomTypeOptions(roomType.name).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <input
                            name="inventory"
                            type="number"
                            min={0}
                            required
                            defaultValue={roomType.inventory}
                            className="rounded-lg border p-2 text-sm"
                          />
                          <input
                            name="availableInventory"
                            type="number"
                            min={0}
                            required
                            defaultValue={roomType.availableInventory}
                            className="rounded-lg border p-2 text-sm"
                          />
                          <input
                            name="pricePerNight"
                            type="number"
                            min={1}
                            required
                            defaultValue={roomType.pricePerNight}
                            className="rounded-lg border p-2 text-sm"
                          />
                          <input
                            name="maxGuests"
                            type="number"
                            min={1}
                            required
                            defaultValue={roomType.maxGuests}
                            className="rounded-lg border p-2 text-sm"
                          />
                          <input
                            name="cancellationPolicy"
                            required
                            defaultValue={roomType.cancellationPolicy}
                            className="rounded-lg border p-2 text-sm"
                          />
                          <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white md:col-span-2">
                            שמירת סוג חדר
                          </button>
                        </form>
                        <form action={adminDeleteRoomAction} className="mt-2">
                          <input type="hidden" name="roomId" value={roomType.id} />
                          <input type="hidden" name="redirectTo" value="/admin/hotels" />
                          <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">
                            מחיקת סוג חדר
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {isAdmin && (
                <form action={adminSetHotelSourceModeAction} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="hotelId" value={hotel.id} />
                  <select name="dataSourceMode" defaultValue={hotel.dataSourceMode} className="rounded-lg border p-2 text-xs">
                    {Object.values(HotelDataSourceMode).map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                    עדכון מקור נתונים
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </article>
    </AdminManagementShell>
  );
}

function renderHotelRatingStars(rating: number | null) {
  if (!rating || rating <= 0) {
    return "ללא דירוג";
  }

  const roundedStars = Math.max(1, Math.min(5, Math.round(rating)));
  return `${"★".repeat(roundedStars)}${"☆".repeat(5 - roundedStars)} (${roundedStars}/5)`;
}

function buildRoomTypeOptions(currentValue?: string) {
  if (!currentValue || ROOM_TYPE_OPTIONS.includes(currentValue as (typeof ROOM_TYPE_OPTIONS)[number])) {
    return ROOM_TYPE_OPTIONS;
  }

  return [currentValue, ...ROOM_TYPE_OPTIONS];
}
