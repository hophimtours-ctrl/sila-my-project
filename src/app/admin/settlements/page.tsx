import { Role } from "@prisma/client";
import { adminUpdateSettlementPaymentAction } from "@/app/actions";
import { AdminManagementShell } from "@/components/admin-management-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function AdminSettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireUser(Role.ADMIN);
  const query = await searchParams;
  const bookings = await prisma.booking.findMany({
    include: {
      user: {
        select: { name: true, email: true },
      },
      hotel: {
        select: { name: true },
      },
      settlement: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const settlementRows = bookings.map((booking) => {
    const amountToPaySupplier =
      booking.settlement?.amountToPaySupplier ?? booking.amountToPaySupplier ?? booking.netRate ?? 0;
    const amountPaid = booking.settlement?.amountPaid ?? 0;
    const remaining = Math.max(0, amountToPaySupplier - amountPaid);
    const netRate = booking.netRate || amountToPaySupplier;
    const sellRate = booking.sellRate || booking.totalPrice;
    const profitAmount = booking.profitAmount || Math.max(0, sellRate - netRate);

    return {
      booking,
      settlement: booking.settlement,
      amountToPaySupplier,
      amountPaid,
      remaining,
      netRate,
      sellRate,
      profitAmount,
    };
  });

  const summary = settlementRows.reduce(
    (accumulator, row) => {
      accumulator.netRate += row.netRate;
      accumulator.sellRate += row.sellRate;
      accumulator.profitAmount += row.profitAmount;
      accumulator.amountToPaySupplier += row.amountToPaySupplier;
      accumulator.amountPaid += row.amountPaid;
      accumulator.remaining += row.remaining;
      return accumulator;
    },
    {
      netRate: 0,
      sellRate: 0,
      profitAmount: 0,
      amountToPaySupplier: 0,
      amountPaid: 0,
      remaining: 0,
    },
  );

  return (
    <AdminManagementShell
      activePath="/admin/settlements"
      title="ניהול התחשבנות"
      description="מעקב נטו/מכירה/רווח, תשלומים לספקים ויתרות פתוחות לכל הזמנה."
      error={query.error}
      success={query.success}
    >
      <article className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">סכום לתשלום לספקים</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(summary.amountToPaySupplier)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">שולם לספקים</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">{formatCurrency(summary.amountPaid)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">יתרה לתשלום</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">{formatCurrency(summary.remaining)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">נטו מצטבר</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(summary.netRate)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">מכירה מצטברת</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(summary.sellRate)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">רווח מצטבר</p>
          <p className="mt-1 text-lg font-semibold text-indigo-700">{formatCurrency(summary.profitAmount)}</p>
        </div>
      </article>

      <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">רשימת הזמנות והתחשבנות</h2>
        {settlementRows.length === 0 ? (
          <p className="text-sm text-slate-500">עדיין אין הזמנות להצגה.</p>
        ) : (
          settlementRows.map((row) => (
            <div key={row.booking.id} className="rounded-xl border border-slate-100 p-3">
              <div className="grid gap-1 text-xs text-slate-700 md:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-900">הזמנה:</span> {row.booking.id}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">מלון:</span> {row.booking.hotel.name}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">לקוח:</span> {row.booking.user.name} ({row.booking.user.email})
                </p>
                <p>
                  <span className="font-semibold text-slate-900">תאריכים:</span> {formatDate(row.booking.checkIn)} -{" "}
                  {formatDate(row.booking.checkOut)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">ספק:</span> {row.booking.supplierType}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">סטטוס תשלום ספק:</span>{" "}
                  {row.settlement?.paymentStatus ?? row.booking.supplierPaymentStatus}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">נטו:</span> {formatCurrency(row.netRate)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">מכירה:</span> {formatCurrency(row.sellRate)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">רווח:</span> {formatCurrency(row.profitAmount)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">לתשלום לספק:</span>{" "}
                  {formatCurrency(row.amountToPaySupplier)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">שולם:</span> {formatCurrency(row.amountPaid)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">יתרה:</span> {formatCurrency(row.remaining)}
                </p>
              </div>

              {row.settlement ? (
                <form action={adminUpdateSettlementPaymentAction} className="mt-3 grid gap-2 md:grid-cols-4">
                  <input type="hidden" name="settlementId" value={row.settlement.id} />
                  <input
                    name="amountPaid"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={row.settlement.amountPaid}
                    className="rounded-lg border p-2 text-sm"
                  />
                  <select
                    name="supplierPaymentStatus"
                    defaultValue={row.settlement.paymentStatus}
                    className="rounded-lg border p-2 text-sm"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="PAID">PAID</option>
                  </select>
                  <input
                    name="paymentDate"
                    type="date"
                    defaultValue={row.settlement.paymentDate ? row.settlement.paymentDate.toISOString().slice(0, 10) : ""}
                    className="rounded-lg border p-2 text-sm"
                  />
                  <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                    עדכון תשלום לספק
                  </button>
                </form>
              ) : (
                <p className="mt-2 text-xs text-amber-700">לא קיימת רשומת התחשבנות להזמנה זו.</p>
              )}
            </div>
          ))
        )}
      </article>
    </AdminManagementShell>
  );
}
