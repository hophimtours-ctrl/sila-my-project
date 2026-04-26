import { BookingStatus, DashboardRole, Role } from "@prisma/client";
import {
  adminDeleteUserAction,
  adminResetPasswordAction,
  adminToggleUserBlockAction,
  adminUpdateUserAction,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
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
      bookings: {
        include: {
          hotel: {
            select: {
              name: true,
              location: true,
            },
          },
          roomType: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminManagementShell
      activePath="/admin/users"
      title="ניהול לקוחות ומשתמשים"
      description="פרטי לקוח מלאים, מה הוזמן, סטטוס הזמנות, יצירת קשר וניהול חשבונות."
      error={query.error}
      success={query.success}
    >
      <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        {users.map((user) => {
          const totalBookings = user.bookings.length;
          const confirmedBookings = user.bookings.filter(
            (booking) => booking.status === BookingStatus.CONFIRMED,
          );
          const canceledBookings = user.bookings.filter(
            (booking) => booking.status === BookingStatus.CANCELED,
          );
          const totalSpent = confirmedBookings.reduce((sum, booking) => sum + booking.totalPrice, 0);
          const latestBooking = user.bookings[0];

          return (
          <div key={user.id} className="space-y-3 rounded-xl border border-slate-100 p-3">
            <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 md:grid-cols-4">
              <p>
                <span className="font-semibold text-slate-900">לקוח:</span> {user.name}
              </p>
              <p>
                <span className="font-semibold text-slate-900">מייל:</span> {user.email}
              </p>
              <p>
                <span className="font-semibold text-slate-900">טלפון:</span>{" "}
                <span className="text-amber-700">לא קיים במערכת</span>
              </p>
              <p>
                <span className="font-semibold text-slate-900">תאריך הרשמה:</span>{" "}
                {user.createdAt.toLocaleDateString("he-IL")}
              </p>
              <p>
                <span className="font-semibold text-slate-900">כניסה אחרונה:</span>{" "}
                {user.lastLoginAt ? user.lastLoginAt.toLocaleString("he-IL") : "אין נתון"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">סה״כ הזמנות:</span> {totalBookings}
              </p>
              <p>
                <span className="font-semibold text-slate-900">הזמנות מאושרות:</span>{" "}
                {confirmedBookings.length}
              </p>
              <p>
                <span className="font-semibold text-slate-900">סה״כ הוצאות:</span>{" "}
                {formatCurrency(totalSpent)}
              </p>
              <p>
                <span className="font-semibold text-slate-900">בוטלו:</span>{" "}
                {canceledBookings.length}
              </p>
              <p className="md:col-span-3">
                <span className="font-semibold text-slate-900">הזמנה אחרונה:</span>{" "}
                {latestBooking
                  ? `${latestBooking.hotel.name} · ${formatDate(latestBooking.checkIn)} - ${formatDate(latestBooking.checkOut)}`
                  : "עדיין אין הזמנות"}
              </p>
            </div>
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

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">פרטי ההזמנות של הלקוח</p>
              {user.bookings.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">אין עדיין הזמנות ללקוח זה.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {user.bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="grid gap-1 rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs text-slate-700 md:grid-cols-2"
                    >
                      <p>
                        <span className="font-semibold text-slate-900">קוד הזמנה:</span> {booking.id}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">סטטוס:</span>{" "}
                        <span
                          className={
                            booking.status === BookingStatus.CONFIRMED
                              ? "font-semibold text-emerald-700"
                              : "font-semibold text-rose-700"
                          }
                        >
                          {booking.status === BookingStatus.CONFIRMED ? "מאושר" : "בוטל"}
                        </span>
                      </p>
                      <p className="md:col-span-2">
                        <span className="font-semibold text-slate-900">מה הוזמן:</span>{" "}
                        {booking.hotel.name} · {booking.roomType.name}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">מלון:</span> {booking.hotel.location}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">תאריכים:</span>{" "}
                        {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">אורחים:</span> {booking.guests}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">מחיר כולל:</span>{" "}
                        {formatCurrency(booking.totalPrice)}
                      </p>
                      <p className="md:col-span-2">
                        <span className="font-semibold text-slate-900">נוצר בתאריך:</span>{" "}
                        {booking.createdAt.toLocaleString("he-IL")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          );
        })}
      </article>
    </AdminManagementShell>
  );
}
