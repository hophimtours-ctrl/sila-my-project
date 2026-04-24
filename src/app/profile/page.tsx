import Link from "next/link";
import { BookingStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function ProfilePage() {
  const user = await requireUser();
  const today = new Date();

  const [upcomingTrips, pastTrips, favoriteCount] = await Promise.all([
    prisma.booking.count({
      where: {
        userId: user.id,
        status: BookingStatus.CONFIRMED,
        checkIn: { gte: today },
      },
    }),
    prisma.booking.count({
      where: {
        userId: user.id,
        OR: [{ status: BookingStatus.CANCELED }, { checkOut: { lt: today } }],
      },
    }),
    prisma.favorite.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="space-y-5">
      <section className="card space-y-2 p-5">
        <h1 className="text-2xl font-bold">הפרופיל שלי</h1>
        <p className="text-sm text-slate-600">{user.name}</p>
        <p className="text-sm text-slate-500">{user.email}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="card p-4">
          <p className="text-xs font-semibold text-slate-500">נסיעות עתידיות</p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-primary-light)]">{upcomingTrips}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs font-semibold text-slate-500">נסיעות קודמות</p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-primary-light)]">{pastTrips}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs font-semibold text-slate-500">מלונות שמורים</p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-primary-light)]">{favoriteCount}</p>
        </article>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-semibold">פעולות מהירות</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/bookings"
            className="rounded-xl bg-[var(--color-primary-light)] px-3 py-2 text-sm font-semibold text-white"
          >
            לצפייה בנסיעות
          </Link>
          <Link
            href="/favorites"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            למועדפים
          </Link>
        </div>
      </section>
    </div>
  );
}
