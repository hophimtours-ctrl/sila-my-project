import { Role } from "@prisma/client";
import { adminUpsertRoomAvailabilityRangeAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminManagementShell } from "@/components/admin-management-shell";

export default async function AdminAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; roomTypeId?: string }>;
}) {
  await requireUser(Role.ADMIN);
  const query = await searchParams;
  const selectedRoomTypeId = query.roomTypeId ?? "";

  const [rooms, availabilityOverrides] = await Promise.all([
    prisma.roomType.findMany({
      include: { hotel: true },
      orderBy: [{ hotel: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.roomAvailabilityOverride.findMany({
      where: selectedRoomTypeId ? { roomTypeId: selectedRoomTypeId } : undefined,
      include: { roomType: { include: { hotel: true } } },
      orderBy: { date: "desc" },
      take: 120,
    }),
  ]);

  return (
    <AdminManagementShell
      activePath="/admin/availability"
      title="ניהול זמינות"
      description="לוח ניהול זמינות ותמחור לפי תאריך לטווחי זמן."
      error={query.error}
      success={query.success}
    >
      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">עדכון זמינות לטווח תאריכים</h2>
        <form action={adminUpsertRoomAvailabilityRangeAction} className="mt-3 grid gap-2 md:grid-cols-3">
          <select
            name="roomTypeId"
            defaultValue={selectedRoomTypeId}
            required
            className="rounded-lg border p-2 md:col-span-3"
          >
            <option value="">בחירת חדר</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.hotel.name} · {room.name}
              </option>
            ))}
          </select>
          <input name="from" type="date" required className="rounded-lg border p-2" />
          <input name="to" type="date" required className="rounded-lg border p-2" />
          <select name="isAvailable" defaultValue="true" className="rounded-lg border p-2">
            <option value="true">פנוי</option>
            <option value="false">לא פנוי</option>
          </select>
          <input
            name="priceOverride"
            type="number"
            min={0}
            step="0.01"
            placeholder="מחיר לתאריך (אופציונלי)"
            className="rounded-lg border p-2 md:col-span-3"
          />
          <button className="rounded-lg bg-[var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-white md:col-span-3">
            עדכון טווח תאריכים
          </button>
        </form>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">רשומות זמינות אחרונות</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-right text-slate-500">
              <tr>
                <th className="px-2 py-2">מלון / חדר</th>
                <th className="px-2 py-2">תאריך</th>
                <th className="px-2 py-2">סטטוס</th>
                <th className="px-2 py-2">מחיר יומי</th>
              </tr>
            </thead>
            <tbody>
              {availabilityOverrides.map((override) => (
                <tr key={override.id} className="border-t border-slate-100">
                  <td className="px-2 py-2">
                    {override.roomType.hotel.name} · {override.roomType.name}
                  </td>
                  <td className="px-2 py-2">{override.date.toLocaleDateString()}</td>
                  <td className="px-2 py-2">{override.isAvailable ? "פנוי" : "לא פנוי"}</td>
                  <td className="px-2 py-2">{override.priceOverride ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </AdminManagementShell>
  );
}
