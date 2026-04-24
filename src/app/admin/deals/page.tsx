import { Role } from "@prisma/client";
import { adminCreateDealAction, adminDeleteDealAction, adminUpdateDealAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { AdminManagementShell } from "@/components/admin-management-shell";

export default async function AdminDealsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireUser(Role.ADMIN);
  const query = await searchParams;

  const [hotels, deals] = await Promise.all([
    prisma.hotel.findMany({
      where: { status: "APPROVED" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.deal.findMany({
      include: { hotel: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <AdminManagementShell
      activePath="/admin/deals"
      title="ניהול דילים"
      description="רשימת דילים, יצירה, עריכה ומחיקה."
      error={query.error}
      success={query.success}
    >
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">הוספת דיל</h2>
        <form action={adminCreateDealAction} className="mt-3 grid gap-2 md:grid-cols-2">
          <select name="hotelId" required className="rounded-lg border p-2">
            <option value="">בחירת מלון</option>
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
          <input name="title" required placeholder="כותרת דיל" className="rounded-lg border p-2" />
          <textarea
            name="description"
            required
            placeholder="תיאור דיל"
            className="rounded-lg border p-2 md:col-span-2"
          />
          <input name="dealPrice" type="number" min={1} required placeholder="מחיר מבצע" className="rounded-lg border p-2" />
          <select name="isActive" defaultValue="true" className="rounded-lg border p-2">
            <option value="true">פעיל</option>
            <option value="false">לא פעיל</option>
          </select>
          <input name="validFrom" type="date" required className="rounded-lg border p-2" />
          <input name="validTo" type="date" required className="rounded-lg border p-2" />
          <button className="rounded-lg bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-white md:col-span-2">
            יצירת דיל
          </button>
        </form>
      </article>

      <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">רשימת דילים</h2>
        {deals.map((deal) => (
          <div key={deal.id} className="rounded-xl border border-slate-100 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-700">
              {deal.hotel.name} · {formatCurrency(deal.dealPrice)}
            </p>
            <form action={adminUpdateDealAction} className="grid gap-2 md:grid-cols-3">
              <input type="hidden" name="dealId" value={deal.id} />
              <input name="title" defaultValue={deal.title} required className="rounded-lg border p-2" />
              <input
                name="dealPrice"
                defaultValue={deal.dealPrice}
                type="number"
                min={1}
                required
                className="rounded-lg border p-2"
              />
              <select name="isActive" defaultValue={String(deal.isActive)} className="rounded-lg border p-2">
                <option value="true">פעיל</option>
                <option value="false">לא פעיל</option>
              </select>
              <input name="validFrom" type="date" defaultValue={deal.validFrom.toISOString().slice(0, 10)} required className="rounded-lg border p-2" />
              <input name="validTo" type="date" defaultValue={deal.validTo.toISOString().slice(0, 10)} required className="rounded-lg border p-2" />
              <textarea
                name="description"
                defaultValue={deal.description}
                required
                className="rounded-lg border p-2 md:col-span-3"
              />
              <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                עדכון דיל
              </button>
            </form>
            <form action={adminDeleteDealAction} className="mt-2">
              <input type="hidden" name="dealId" value={deal.id} />
              <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">
                מחיקת דיל
              </button>
            </form>
          </div>
        ))}
      </article>
    </AdminManagementShell>
  );
}
