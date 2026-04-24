import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { db } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/rbac.js";

export const createReview = onCall(async (request) => {
  const uid = requireAuth(request);
  const input = z
    .object({
      hotelId: z.string().min(1),
      bookingId: z.string().min(1),
      rating: z.number().min(1).max(5),
      text: z.string().min(2),
      images: z.array(z.string()).default([]),
    })
    .parse(request.data);

  const reviewDoc = await db.collection("reviews").add({
    ...input,
    userId: uid,
    verified: true,
    status: "pending",
    createdAt: new Date().toISOString(),
    moderatedBy: null,
    moderatedAt: null,
  });

  return { reviewId: reviewDoc.id };
});

export const moderateReview = onCall(async (request) => {
  const adminUid = requireAuth(request);
  requireRole(request, ["admin", "editor"]);

  const input = z
    .object({
      reviewId: z.string().min(1),
      status: z.enum(["approved", "rejected"]),
    })
    .parse(request.data);

  await db.collection("reviews").doc(input.reviewId).set(
    {
      status: input.status,
      moderatedBy: adminUid,
      moderatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return { success: true };
});
