import { ReviewStatus, Role } from "@prisma/client";
import { adminDeleteReviewAction, adminModerateReviewAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminManagementShell } from "@/components/admin-management-shell";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireUser(Role.ADMIN);
  const query = await searchParams;

  const reviews = await prisma.review.findMany({
    include: {
      hotel: true,
      user: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminManagementShell
      activePath="/admin/reviews"
      title="ניהול ביקורות"
      description="אישור/דחייה/מחיקה, צפייה בתוכן ובסימון ביקור מאומת."
      error={query.error}
      success={query.success}
    >
      <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        {reviews.map((review) => (
          <div key={review.id} className="rounded-xl border border-slate-100 p-3">
            <div className="mb-2">
              <p className="font-semibold text-slate-900">
                {review.hotel.name} · {review.user.name} · {review.rating}/5
              </p>
              <p className="text-sm text-slate-600">{review.comment}</p>
              <p className="mt-1 text-xs text-slate-500">
                סטטוס: {review.status} · ביקור מאומת: {review.verifiedStay ? "כן" : "לא"}
              </p>
            </div>

            <form action={adminModerateReviewAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="reviewId" value={review.id} />
              <select name="status" defaultValue={review.status} className="rounded-lg border p-2 text-xs">
                {Object.values(ReviewStatus).map((reviewStatus) => (
                  <option key={reviewStatus} value={reviewStatus}>
                    {reviewStatus}
                  </option>
                ))}
              </select>
              <select name="verifiedStay" defaultValue={review.verifiedStay ? "true" : "false"} className="rounded-lg border p-2 text-xs">
                <option value="false">לא מאומת</option>
                <option value="true">מאומת</option>
              </select>
              <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                שמירת מודרציה
              </button>
            </form>

            <form action={adminDeleteReviewAction} className="mt-2">
              <input type="hidden" name="reviewId" value={review.id} />
              <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">
                מחיקת ביקורת
              </button>
            </form>
          </div>
        ))}
      </article>
    </AdminManagementShell>
  );
}
