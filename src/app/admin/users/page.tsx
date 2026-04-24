import { DashboardRole, Role } from "@prisma/client";
import {
  adminDeleteUserAction,
  adminResetPasswordAction,
  adminToggleUserBlockAction,
  adminUpdateUserAction,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminManagementShell } from "@/components/admin-management-shell";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireUser(Role.ADMIN);
  const query = await searchParams;

  const users = await prisma.user.findMany({
    include: {
      activityLogsAsTarget: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminManagementShell
      activePath="/admin/users"
      title="ניהול משתמשים"
      description="רשימה מלאה, עריכה, מחיקה, השבתה ואיפוס סיסמה."
      error={query.error}
      success={query.success}
    >
      <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        {users.map((user) => (
          <div key={user.id} className="rounded-xl border border-slate-100 p-3">
            <form action={adminUpdateUserAction} className="grid gap-2 md:grid-cols-5">
              <input type="hidden" name="userId" value={user.id} />
              <input name="name" defaultValue={user.name} required className="rounded-lg border p-2" />
              <input name="email" defaultValue={user.email} type="email" required className="rounded-lg border p-2" />
              <select
                name="dashboardRole"
                defaultValue={user.dashboardRole}
                className="rounded-lg border p-2"
              >
                {Object.values(DashboardRole).map((dashboardRole) => (
                  <option key={dashboardRole} value={dashboardRole}>
                    {dashboardRole}
                  </option>
                ))}
              </select>
              <select name="blocked" defaultValue={String(user.blocked)} className="rounded-lg border p-2">
                <option value="false">פעיל</option>
                <option value="true">חסום</option>
              </select>
              <input
                name="permissions"
                defaultValue={
                  Array.isArray(user.featurePermissions) ? user.featurePermissions.join(", ") : ""
                }
                placeholder="הרשאות מותאמות"
                className="rounded-lg border p-2 md:col-span-4"
              />
              <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                שמירת משתמש
              </button>
            </form>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <form action={adminToggleUserBlockAction}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="blocked" value={user.blocked ? "false" : "true"} />
                <button className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  {user.blocked ? "הפעלה מחדש" : "השבתת חשבון"}
                </button>
              </form>

              <form action={adminResetPasswordAction}>
                <input type="hidden" name="userId" value={user.id} />
                <button className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  איפוס סיסמה
                </button>
              </form>

              <form action={adminDeleteUserAction}>
                <input type="hidden" name="userId" value={user.id} />
                <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">
                  מחיקה
                </button>
              </form>
            </div>

            <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
              <p className="font-semibold">היסטוריית פעולות אחרונה:</p>
              {user.activityLogsAsTarget.length === 0 && <p>ללא פעולות.</p>}
              {user.activityLogsAsTarget.map((activityLog) => (
                <p key={activityLog.id}>
                  {activityLog.action} · {activityLog.createdAt.toLocaleString()}
                </p>
              ))}
            </div>
          </div>
        ))}
      </article>
    </AdminManagementShell>
  );
}
