import { Role } from "@prisma/client";
import { ownerBlockDateAction, ownerCreateHotelAction, ownerCreateRoomAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";

export default async function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireUser(Role.OWNER);
  const query = await searchParams;

  const hotels = await prisma.hotel.findMany({
    where: { ownerId: user.id },
    include: {
      roomTypes: true,
      bookings: true,
      blockedDates: { orderBy: { date: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">דשבורד בעל מלון</h1>
      {query.error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{query.error}</p>}
      {query.success && <p className="rounded-lg bg-emerald-50 p-3 text-emerald-700">{query.success}</p>}

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="card p-4">
          <h2 className="mb-2 font-semibold">הוספת מלון</h2>
          <form action={ownerCreateHotelAction} className="space-y-2">
            <input name="name" required placeholder="שם המלון" className="w-full rounded-lg border p-2" />
            <input name="location" required placeholder="מיקום" className="w-full rounded-lg border p-2" />
            <textarea
              name="description"
              required
              placeholder="תיאור"
              className="w-full rounded-lg border p-2"
            />
            <input
              name="facilities"
              placeholder="מתקנים (מופרדים בפסיק)"
              className="w-full rounded-lg border p-2"
            />
            <button className="w-full rounded-lg bg-[var(--color-primary-light)] p-2 text-white">
              יצירת מלון
            </button>
          </form>
        </article>

        <article className="card p-4">
          <h2 className="mb-2 font-semibold">הוספת חדר</h2>
          <form action={ownerCreateRoomAction} className="space-y-2">
            <select name="hotelId" required className="w-full rounded-lg border p-2">
              <option value="">בחירת מלון</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
            <input name="name" required placeholder="שם החדר" className="w-full rounded-lg border p-2" />
            <input
              name="pricePerNight"
              type="number"
              min={1}
              required
              placeholder="מחיר ללילה"
              className="w-full rounded-lg border p-2"
            />
            <input
              name="maxGuests"
              type="number"
              min={1}
              required
              placeholder="מקסימום אורחים"
              className="w-full rounded-lg border p-2"
            />
            <input
              name="cancellationPolicy"
              required
              placeholder="מדיניות ביטול"
              className="w-full rounded-lg border p-2"
            />
            <button className="w-full rounded-lg bg-[var(--color-primary-light)] p-2 text-white">
              הוספת חדר
            </button>
          </form>
        </article>

        <article className="card p-4">
          <h2 className="mb-2 font-semibold">חסימת תאריכים</h2>
          <form action={ownerBlockDateAction} className="space-y-2">
            <select name="hotelId" required className="w-full rounded-lg border p-2">
              <option value="">בחירת מלון</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
            <input name="from" type="date" required className="w-full rounded-lg border p-2" />
            <input name="to" type="date" required className="w-full rounded-lg border p-2" />
            <button className="w-full rounded-lg bg-[var(--color-primary-light)] p-2 text-white">
              חסימה
            </button>
          </form>
        </article>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">המלונות שלי</h2>
        {hotels.map((hotel) => (
          <article key={hotel.id} className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{hotel.name}</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{hotel.status}</span>
            </div>
            <p className="text-sm text-slate-600">{hotel.location}</p>
            <p className="mb-3 text-sm">{hotel.description}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <h4 className="font-medium">חדרים</h4>
                {hotel.roomTypes.map((room) => (
                  <p key={room.id} className="text-sm">
                    {room.name} · {formatCurrency(room.pricePerNight)}
                  </p>
                ))}
              </div>
              <div>
                <h4 className="font-medium">הזמנות</h4>
                <p className="text-sm">סה״כ הזמנות: {hotel.bookings.length}</p>
                <p className="text-sm">ימים חסומים: {hotel.blockedDates.length}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
