import { Role } from "@prisma/client";
import {
  adminCreateProviderAction,
  adminDeleteProviderAction,
  adminSyncProviderAction,
  adminTestProviderConnectionAction,
  adminToggleProviderAction,
  adminUpdateProviderAction,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminManagementShell } from "@/components/admin-management-shell";

export default async function AdminProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireUser(Role.ADMIN);
  const query = await searchParams;

  const providers = await prisma.hotelApiProvider.findMany({
    include: {
      logs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AdminManagementShell
      activePath="/admin/providers"
      title="ניהול ספקי API"
      description="יצירה, בדיקה, סנכרון ועדכון ספקים."
      error={query.error}
      success={query.success}
    >
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">הוספת ספק API</h2>
        <form action={adminCreateProviderAction} className="mt-3 grid gap-2 md:grid-cols-2">
          <input name="name" required placeholder="שם ספק" className="rounded-lg border p-2" />
          <input name="endpoint" required placeholder="Endpoint" className="rounded-lg border p-2" />
          <input name="hotelsPath" defaultValue="/hotels" placeholder="Hotels Path" className="rounded-lg border p-2" />
          <input name="apiKey" required placeholder="API Key" className="rounded-lg border p-2" />
          <select name="enabled" defaultValue="true" className="rounded-lg border p-2">
            <option value="true">פעיל</option>
            <option value="false">לא פעיל</option>
          </select>
          <select name="autoRefreshEnabled" defaultValue="false" className="rounded-lg border p-2">
            <option value="false">Auto Refresh Off</option>
            <option value="true">Auto Refresh On</option>
          </select>
          <input
            name="refreshIntervalMinutes"
            type="number"
            min={1}
            defaultValue={60}
            className="rounded-lg border p-2 md:col-span-2"
          />
          <button className="rounded-lg bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-white md:col-span-2">
            יצירת ספק
          </button>
        </form>
      </article>

      <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">רשימת ספקים</h2>
        {providers.map((provider) => (
          <div key={provider.id} className="rounded-xl border border-slate-100 p-3">
            <p className="text-sm font-semibold text-slate-800">
              {provider.name} · {provider.status} · {provider.enabled ? "Enabled" : "Disabled"}
            </p>
            <p className="text-xs text-slate-500">סנכרון אחרון: {provider.lastRefreshedAt?.toLocaleString() ?? "-"}</p>
            <p className="mb-2 text-xs text-slate-500">לוג אחרון: {provider.logs[0]?.message ?? "-"}</p>

            <form action={adminUpdateProviderAction} className="grid gap-2 md:grid-cols-3">
              <input type="hidden" name="providerId" value={provider.id} />
              <input name="name" defaultValue={provider.name} required className="rounded-lg border p-2" />
              <input name="endpoint" defaultValue={provider.endpoint} required className="rounded-lg border p-2" />
              <input name="hotelsPath" defaultValue={provider.hotelsPath} className="rounded-lg border p-2" />
              <input name="apiKey" placeholder="השאר ריק כדי לא לעדכן מפתח" className="rounded-lg border p-2 md:col-span-3" />
              <select name="enabled" defaultValue={String(provider.enabled)} className="rounded-lg border p-2">
                <option value="true">פעיל</option>
                <option value="false">לא פעיל</option>
              </select>
              <select
                name="autoRefreshEnabled"
                defaultValue={String(provider.autoRefreshEnabled)}
                className="rounded-lg border p-2"
              >
                <option value="true">Auto Refresh On</option>
                <option value="false">Auto Refresh Off</option>
              </select>
              <input
                name="refreshIntervalMinutes"
                type="number"
                min={1}
                defaultValue={provider.refreshIntervalMinutes}
                className="rounded-lg border p-2"
              />
              <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white md:col-span-3">
                עדכון ספק
              </button>
            </form>

            <div className="mt-2 flex flex-wrap gap-2">
              <form action={adminTestProviderConnectionAction}>
                <input type="hidden" name="providerId" value={provider.id} />
                <button className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs text-indigo-700">
                  בדיקה
                </button>
              </form>
              <form action={adminSyncProviderAction}>
                <input type="hidden" name="providerId" value={provider.id} />
                <button className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs text-emerald-700">
                  סנכרון
                </button>
              </form>
              <form action={adminToggleProviderAction}>
                <input type="hidden" name="providerId" value={provider.id} />
                <input type="hidden" name="enabled" value={provider.enabled ? "false" : "true"} />
                <button className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700">
                  {provider.enabled ? "השבתה" : "הפעלה"}
                </button>
              </form>
              <form action={adminDeleteProviderAction}>
                <input type="hidden" name="providerId" value={provider.id} />
                <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700">
                  מחיקה
                </button>
              </form>
            </div>
          </div>
        ))}
      </article>
    </AdminManagementShell>
  );
}
