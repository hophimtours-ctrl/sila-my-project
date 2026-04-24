import { Role, ReviewStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminManagementShell } from "@/components/admin-management-shell";

export default async function SuperAdminPage() {
  await requireUser(Role.ADMIN);

  const [
    hotelsCount,
    propertiesCount,
    roomsCount,
    usersCount,
    bookingsCount,
    recentActivityLogs,
    recentProviderLogs,
    pendingHotels,
    providerErrors,
    pendingReviews,
  ] = await Promise.all([
    prisma.hotel.count(),
    prisma.hostingProperty.count(),
    prisma.roomType.count(),
    prisma.user.count(),
    prisma.booking.count(),
    prisma.userActivityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.hotelApiSyncLog.findMany({
      include: { provider: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.hotel.count({ where: { status: "PENDING" } }),
    prisma.hotelApiProvider.count({ where: { status: "ERROR" } }),
    prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
  ]);

  return (
    <AdminManagementShell
      activePath="/admin/super"
      title="מסך ראשי לסופר-אדמין"
      description="סטטיסטיקות מערכת, לוגים אחרונים והתראות תפעוליות."
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="מלונות" value={hotelsCount} />
        <MetricCard label="בתי אירוח" value={propertiesCount} />
        <MetricCard label="חדרים" value={roomsCount} />
        <MetricCard label="משתמשים" value={usersCount} />
        <MetricCard label="הזמנות" value={bookingsCount} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">התראות מערכת</h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            <li>מלונות בהמתנה לאישור: {pendingHotels}</li>
            <li>ספקי API בסטטוס שגיאה: {providerErrors}</li>
            <li>ביקורות בהמתנה למודרציה: {pendingReviews}</li>
          </ul>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold">לוגים אחרונים (מערכת)</h2>
          <div className="mt-3 space-y-2">
            {recentActivityLogs.map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-800">{log.action}</p>
                <p className="text-slate-600">{log.details}</p>
                <p className="mt-1 text-xs text-slate-400">{log.createdAt.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold">לוגים אחרונים (ספקי API)</h2>
          <div className="mt-3 space-y-2">
            {recentProviderLogs.map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <p className="font-medium text-slate-800">
                  {log.provider.name} · {log.level}
                </p>
                <p className="text-slate-600">{log.message}</p>
                <p className="mt-1 text-xs text-slate-400">{log.createdAt.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AdminManagementShell>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
    </article>
  );
}
