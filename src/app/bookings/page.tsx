import { BookingStatus, Role } from "@prisma/client";
import { cancelBookingAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; warning?: string }>;
}) {
  const user = await requireUser(Role.GUEST);
  const params = await searchParams;

  const bookings = await prisma.booking.findMany({
    where: { userId: user.id },
    include: { hotel: true, roomType: true },
    orderBy: { createdAt: "desc" },
  });
  const today = new Date();
  const upcomingBookings = bookings.filter(
    (booking) => booking.status === BookingStatus.CONFIRMED && booking.checkIn >= today,
  );
  const pastBookings = bookings.filter(
    (booking) => booking.status === BookingStatus.CANCELED || booking.checkOut < today,
  );
  const renderBookingCard = (booking: (typeof bookings)[number]) => (
    <article key={booking.id} className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{booking.hotel.name}</h2>
          <p className="text-sm">{booking.roomType.name}</p>
          <p className="text-sm">
            {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
          </p>
          <p className="text-sm font-semibold text-[var(--color-primary)]">
            {formatCurrency(booking.totalPrice)}
          </p>
        </div>
        <div>
          <span
            className={`rounded-full px-3 py-1 text-sm ${
              booking.status === BookingStatus.CONFIRMED
                ? "bg-green-100 text-green-800"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {booking.status === BookingStatus.CONFIRMED ? "מאושר" : "בוטל"}
          </span>
          {booking.status === BookingStatus.CONFIRMED && (
            <form action={cancelBookingAction} className="mt-2">
              <input type="hidden" name="bookingId" value={booking.id} />
              <button className="rounded-lg border px-3 py-2 text-sm">ביטול הזמנה</button>
            </form>
          )}
        </div>
      </div>
    </article>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ההזמנות שלי</h1>
      {params.success && <p className="rounded-lg bg-green-50 p-3 text-green-700">{params.success}</p>}
      {params.warning && <p className="rounded-lg bg-amber-50 p-3 text-amber-800">{params.warning}</p>}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">נסיעות עתידיות</h2>
        {upcomingBookings.length === 0 ? (
          <p className="rounded-lg bg-white p-3 text-sm text-slate-600">אין כרגע הזמנות עתידיות.</p>
        ) : (
          upcomingBookings.map((booking) => renderBookingCard(booking))
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">נסיעות קודמות</h2>
        {pastBookings.length === 0 ? (
          <p className="rounded-lg bg-white p-3 text-sm text-slate-600">עדיין אין הזמנות קודמות.</p>
        ) : (
          pastBookings.map((booking) => renderBookingCard(booking))
        )}
      </section>
    </div>
  );
}
