import { Role } from "@prisma/client";
import { adminDeleteSystemSettingAction, adminUpsertSystemSettingAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminManagementShell } from "@/components/admin-management-shell";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireUser(Role.ADMIN);
  const query = await searchParams;

  const settings = await prisma.systemSetting.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });

  return (
    <AdminManagementShell
      activePath="/admin/settings"
      title="הגדרות מערכת"
      description="הגדרות כלליות, תשלומים, API ואבטחה."
      error={query.error}
      success={query.success}
    >
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">הוספה / עדכון הגדרה</h2>
        <form action={adminUpsertSystemSettingAction} className="mt-3 grid gap-2 md:grid-cols-2">
          <input name="key" required placeholder="Key (למשל payment.currency)" className="rounded-lg border p-2" />
          <select name="category" className="rounded-lg border p-2">
            <option value="general">General</option>
            <option value="payments">Payments</option>
            <option value="api">API</option>
            <option value="security">Security</option>
          </select>
          <input name="value" required placeholder="Value" className="rounded-lg border p-2 md:col-span-2" />
          <input name="description" placeholder="Description" className="rounded-lg border p-2 md:col-span-2" />
          <button className="rounded-lg bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-white md:col-span-2">
            שמירת הגדרה
          </button>
        </form>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">רשימת הגדרות</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-right text-slate-500">
              <tr>
                <th className="px-2 py-2">קטגוריה</th>
                <th className="px-2 py-2">מפתח</th>
                <th className="px-2 py-2">ערך</th>
                <th className="px-2 py-2">תיאור</th>
                <th className="px-2 py-2">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <tr key={setting.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{setting.category}</td>
                  <td className="px-2 py-2 font-mono text-xs">{setting.key}</td>
                  <td className="px-2 py-2">{setting.value}</td>
                  <td className="px-2 py-2">{setting.description ?? "-"}</td>
                  <td className="px-2 py-2">
                    <form action={adminDeleteSystemSettingAction}>
                      <input type="hidden" name="settingId" value={setting.id} />
                      <button className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700">
                        מחיקה
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </AdminManagementShell>
  );
}
