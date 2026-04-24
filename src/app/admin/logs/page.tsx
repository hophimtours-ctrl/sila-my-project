import { IntegrationLogLevel, Prisma, Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminManagementShell } from "@/components/admin-management-shell";

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ providerId?: string; level?: string }>;
}) {
  await requireUser(Role.ADMIN);
  const query = await searchParams;
  const levelFilter =
    query.level && Object.values(IntegrationLogLevel).includes(query.level as IntegrationLogLevel)
      ? (query.level as IntegrationLogLevel)
      : undefined;

  const where: Prisma.HotelApiSyncLogWhereInput = {
    ...(query.providerId ? { providerId: query.providerId } : {}),
    ...(levelFilter ? { level: levelFilter } : {}),
  };

  const [providers, logs, total, failed, successful] = await Promise.all([
    prisma.hotelApiProvider.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.hotelApiSyncLog.findMany({
      where,
      include: {
        provider: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.hotelApiSyncLog.count(),
    prisma.hotelApiSyncLog.count({ where: { level: "ERROR" } }),
    prisma.hotelApiSyncLog.count({ where: { level: "INFO" } }),
  ]);

  return (
    <AdminManagementShell
      activePath="/admin/logs"
      title="לוגים ומעקב"
      description="מעקב אחר בדיקות, סנכרונים ושגיאות ספקים."
    >
      <article className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">סה״כ אירועים</p>
          <p className="text-xl font-semibold">{total}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-xs text-emerald-700">הצלחות</p>
          <p className="text-xl font-semibold text-emerald-800">{successful}</p>
        </div>
        <div className="rounded-xl bg-rose-50 p-3">
          <p className="text-xs text-rose-700">כשלים</p>
          <p className="text-xl font-semibold text-rose-800">{failed}</p>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">סינון לוגים</h2>
        <form className="mt-3 grid gap-2 md:grid-cols-3" method="get">
          <select name="providerId" defaultValue={query.providerId ?? ""} className="rounded-lg border p-2">
            <option value="">כל הספקים</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <select name="level" defaultValue={levelFilter ?? "ALL"} className="rounded-lg border p-2">
            <option value="ALL">כל הרמות</option>
            <option value="INFO">INFO</option>
            <option value="ERROR">ERROR</option>
          </select>
          <button className="rounded-lg bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-white">
            החל סינון
          </button>
        </form>
      </article>

      <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">100 לוגים אחרונים</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">אין לוגים להצגה.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="rounded-xl border border-slate-100 p-3">
              <p className="text-sm font-semibold text-slate-800">
                {log.provider.name} · {log.level} · {log.action}
              </p>
              <p className="text-xs text-slate-500">{log.createdAt.toLocaleString()}</p>
              <p className="text-sm text-slate-700">{log.message}</p>
            </div>
          ))
        )}
      </article>
    </AdminManagementShell>
  );
}
