import { Role } from "@prisma/client";
import { adminCreateRoomAction, adminDeleteRoomAction, adminUpdateRoomAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminManagementShell } from "@/components/admin-management-shell";
import { redirect } from "next/navigation";
import { ROOM_TYPE_OPTIONS } from "@/lib/room-type-options";
const ownerAdminNavigationItems = [
  { href: "/admin/hotels", label: "ניהול מלונות" },
  { href: "/admin/rooms", label: "ניהול חדרים" },
];

export default async function AdminRoomsPage({
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
  const roomScopeFilter = isAdmin ? {} : { hotel: { ownerId: user.id } };

  const [hotels, rooms] = await Promise.all([
    prisma.hotel.findMany({
      where: hotelScopeFilter,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.roomType.findMany({
      where: roomScopeFilter,
      include: { hotel: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <AdminManagementShell
      activePath="/admin/rooms"
      title="ניהול חדרים"
      description="יצירה, עריכה ומחיקה של חדרים כולל קיבולת, מחיר וזמינות."
      error={query.error}
      success={query.success}
      navigationItems={isAdmin ? undefined : ownerAdminNavigationItems}
    >
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">הוספת חדר</h2>
        <form action={adminCreateRoomAction} className="mt-3 grid gap-2 md:grid-cols-2">
          <input type="hidden" name="redirectTo" value="/admin/rooms" />
          <select name="hotelId" required className="rounded-lg border p-2">
            <option value="">בחירת מלון</option>
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
          <select name="name" required className="rounded-lg border p-2">
            <option value="">בחירת סוג חדר</option>
            {ROOM_TYPE_OPTIONS.map((roomTypeOption) => (
              <option key={roomTypeOption} value={roomTypeOption}>
                {roomTypeOption}
              </option>
            ))}
          </select>
          <input
            name="pricePerNight"
            type="number"
            min={1}
            required
            placeholder="מחיר בסיס"
            className="rounded-lg border p-2"
          />
          <input
            name="maxGuests"
            type="number"
            min={1}
            required
            placeholder="קיבולת"
            className="rounded-lg border p-2"
          />
          <input
            name="inventory"
            type="number"
            min={0}
            required
            defaultValue={1}
            placeholder="סה״כ חדרים"
            className="rounded-lg border p-2"
          />
          <input
            name="availableInventory"
            type="number"
            min={0}
            required
            defaultValue={1}
            placeholder="חדרים זמינים"
            className="rounded-lg border p-2"
          />
          <input
            name="cancellationPolicy"
            required
            placeholder="מדיניות ביטול"
            className="rounded-lg border p-2 md:col-span-2"
          />
          <textarea name="photos" placeholder="תמונות (URL)" className="rounded-lg border p-2 md:col-span-2" />
          <button className="rounded-lg bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-white md:col-span-2">
            יצירת חדר
          </button>
        </form>
      </article>

      <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">רשימת חדרים</h2>
        {rooms.map((room) => (
          <div key={room.id} className="rounded-xl border border-slate-100 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-700">{room.hotel.name}</p>
            <form action={adminUpdateRoomAction} className="grid gap-2 md:grid-cols-3">
              <input type="hidden" name="roomId" value={room.id} />
              <input type="hidden" name="hotelId" value={room.hotelId} />
              <input type="hidden" name="redirectTo" value="/admin/rooms" />
              <select name="name" defaultValue={room.name} required className="rounded-lg border p-2">
                {buildRoomTypeOptions(room.name).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                name="pricePerNight"
                defaultValue={room.pricePerNight}
                type="number"
                min={1}
                required
                className="rounded-lg border p-2"
              />
              <input
                name="maxGuests"
                defaultValue={room.maxGuests}
                type="number"
                min={1}
                required
                className="rounded-lg border p-2"
              />
              <input
                name="inventory"
                defaultValue={room.inventory}
                type="number"
                min={0}
                required
                className="rounded-lg border p-2"
              />
              <input
                name="availableInventory"
                defaultValue={room.availableInventory}
                type="number"
                min={0}
                required
                className="rounded-lg border p-2"
              />
              <input
                name="cancellationPolicy"
                defaultValue={room.cancellationPolicy}
                required
                className="rounded-lg border p-2"
              />
              <textarea
                name="photos"
                defaultValue={Array.isArray(room.photos) ? room.photos.join(", ") : ""}
                className="rounded-lg border p-2 md:col-span-3"
              />
              <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                עדכון חדר
              </button>
            </form>
            <form action={adminDeleteRoomAction} className="mt-2">
              <input type="hidden" name="roomId" value={room.id} />
              <input type="hidden" name="redirectTo" value="/admin/rooms" />
              <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">
                מחיקת חדר
              </button>
            </form>
          </div>
        ))}
      </article>
    </AdminManagementShell>
  );
}

function buildRoomTypeOptions(currentValue?: string) {
  if (!currentValue || ROOM_TYPE_OPTIONS.includes(currentValue as (typeof ROOM_TYPE_OPTIONS)[number])) {
    return ROOM_TYPE_OPTIONS;
  }

  return [currentValue, ...ROOM_TYPE_OPTIONS];
}
