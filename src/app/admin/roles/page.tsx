import { Role } from "@prisma/client";
import {
  adminAssignUserRoleDefinitionAction,
  adminCreateRoleDefinitionAction,
  adminDeleteRoleDefinitionAction,
  adminUpdateRoleDefinitionAction,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminManagementShell } from "@/components/admin-management-shell";

export default async function AdminRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireUser(Role.ADMIN);
  const query = await searchParams;

  const [roles, users] = await Promise.all([
    prisma.roleDefinition.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      include: { customRole: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <AdminManagementShell
      activePath="/admin/roles"
      title="ניהול הרשאות ותפקידים"
      description="יצירה, עריכה ושיוך תפקידים והרשאות לפי מודולים."
      error={query.error}
      success={query.success}
    >
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">יצירת תפקיד חדש</h2>
        <form action={adminCreateRoleDefinitionAction} className="mt-3 grid gap-2 md:grid-cols-3">
          <input name="name" required placeholder="שם תפקיד" className="rounded-lg border p-2" />
          <input name="description" placeholder="תיאור תפקיד" className="rounded-lg border p-2" />
          <input
            name="permissions"
            placeholder="הרשאות (Users:CRUD, Hotels:READ...)"
            className="rounded-lg border p-2"
          />
          <button className="rounded-lg bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-white md:col-span-3">
            יצירת תפקיד
          </button>
        </form>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">רשימת תפקידים</h2>
        <div className="mt-3 space-y-3">
          {roles.map((roleDefinition) => (
            <div key={roleDefinition.id} className="rounded-xl border border-slate-100 p-3">
              <form action={adminUpdateRoleDefinitionAction} className="grid gap-2 md:grid-cols-3">
                <input type="hidden" name="roleId" value={roleDefinition.id} />
                <input
                  name="name"
                  defaultValue={roleDefinition.name}
                  required
                  className="rounded-lg border p-2"
                />
                <input
                  name="description"
                  defaultValue={roleDefinition.description ?? ""}
                  placeholder="תיאור"
                  className="rounded-lg border p-2"
                />
                <input
                  name="permissions"
                  defaultValue={Array.isArray(roleDefinition.permissions) ? roleDefinition.permissions.join(", ") : ""}
                  placeholder="הרשאות"
                  className="rounded-lg border p-2"
                />
                <div className="flex items-center gap-2 md:col-span-3">
                  <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                    שמירת תפקיד
                  </button>
                </div>
              </form>
              <form action={adminDeleteRoleDefinitionAction} className="mt-2">
                <input type="hidden" name="roleId" value={roleDefinition.id} />
                <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">
                  מחיקת תפקיד
                </button>
              </form>
            </div>
          ))}
          {roles.length === 0 && <p className="text-sm text-slate-500">אין תפקידים מותאמים עדיין.</p>}
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">שיוך משתמשים לתפקידים</h2>
        <div className="mt-3 space-y-2">
          {users.map((user) => (
            <form key={user.id} action={adminAssignUserRoleDefinitionAction} className="grid gap-2 rounded-xl border border-slate-100 p-3 md:grid-cols-4">
              <input type="hidden" name="userId" value={user.id} />
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <select
                name="roleId"
                defaultValue={user.customRoleId ?? ""}
                className="rounded-lg border p-2 text-sm"
              >
                <option value="">ללא תפקיד מותאם</option>
                {roles.map((roleDefinition) => (
                  <option key={roleDefinition.id} value={roleDefinition.id}>
                    {roleDefinition.name}
                  </option>
                ))}
              </select>
              <button className="rounded-lg bg-[var(--color-primary-light)] px-3 py-2 text-xs font-semibold text-white">
                עדכון שיוך
              </button>
            </form>
          ))}
        </div>
      </article>
    </AdminManagementShell>
  );
}
