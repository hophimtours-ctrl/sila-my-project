import { Role } from "@prisma/client";
import {
  adminCreateHostingPropertyAction,
  adminDeleteHostingPropertyAction,
  adminUpdateHostingPropertyAction,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminManagementShell } from "@/components/admin-management-shell";

export default async function AdminPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireUser(Role.ADMIN);
  const query = await searchParams;

  const [properties, owners] = await Promise.all([
    prisma.hostingProperty.findMany({
      include: { owner: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: { in: [Role.OWNER, Role.ADMIN] } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AdminManagementShell
      activePath="/admin/properties"
      title="ניהול בתי אירוח"
      description="הוספה, עדכון, מחיקה וצפייה ברשימת בתי האירוח."
      error={query.error}
      success={query.success}
    >
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">הוספת בית אירוח</h2>
        <form action={adminCreateHostingPropertyAction} className="mt-3 grid gap-2 md:grid-cols-2">
          <select name="ownerId" className="rounded-lg border p-2">
            <option value="">ללא בעלים</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
          <input name="name" required placeholder="שם בית אירוח" className="rounded-lg border p-2" />
          <input name="city" required placeholder="עיר" className="rounded-lg border p-2" />
          <input name="country" required placeholder="ארץ" className="rounded-lg border p-2" />
          <input name="location" required placeholder="מיקום" className="rounded-lg border p-2 md:col-span-2" />
          <input
            name="contactEmail"
            type="email"
            required
            placeholder="אימייל קשר"
            className="rounded-lg border p-2 md:col-span-2"
          />
          <textarea name="description" required placeholder="תיאור" className="rounded-lg border p-2 md:col-span-2" />
          <input name="facilities" placeholder="מתקנים (פסיקים)" className="rounded-lg border p-2 md:col-span-2" />
          <textarea name="images" placeholder="תמונות (URL)" className="rounded-lg border p-2 md:col-span-2" />
          <button className="rounded-lg bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-white md:col-span-2">
            יצירת בית אירוח
          </button>
        </form>
      </article>

      <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">רשימת בתי אירוח</h2>
        {properties.map((property) => (
          <div key={property.id} className="rounded-xl border border-slate-100 p-3">
            <form action={adminUpdateHostingPropertyAction} className="grid gap-2 md:grid-cols-3">
              <input type="hidden" name="propertyId" value={property.id} />
              <select
                name="ownerId"
                defaultValue={property.ownerId ?? ""}
                className="rounded-lg border p-2"
              >
                <option value="">ללא בעלים</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
              <input name="name" defaultValue={property.name} required className="rounded-lg border p-2" />
              <input name="location" defaultValue={property.location} required className="rounded-lg border p-2" />
              <input name="city" defaultValue={property.city} required className="rounded-lg border p-2" />
              <input name="country" defaultValue={property.country} required className="rounded-lg border p-2" />
              <input
                name="contactEmail"
                defaultValue={property.contactEmail}
                type="email"
                required
                className="rounded-lg border p-2"
              />
              <textarea
                name="description"
                defaultValue={property.description}
                required
                className="rounded-lg border p-2 md:col-span-3"
              />
              <input
                name="facilities"
                defaultValue={Array.isArray(property.facilities) ? property.facilities.join(", ") : ""}
                className="rounded-lg border p-2 md:col-span-3"
              />
              <textarea
                name="images"
                defaultValue={Array.isArray(property.images) ? property.images.join(", ") : ""}
                className="rounded-lg border p-2 md:col-span-3"
              />
              <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                עדכון
              </button>
            </form>
            <form action={adminDeleteHostingPropertyAction} className="mt-2">
              <input type="hidden" name="propertyId" value={property.id} />
              <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">
                מחיקה
              </button>
            </form>
          </div>
        ))}
      </article>
    </AdminManagementShell>
  );
}
