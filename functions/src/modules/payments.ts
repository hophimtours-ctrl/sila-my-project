import Stripe from "stripe";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { db } from "../lib/firebase.js";
import { requireAuth } from "../lib/rbac.js";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const createPaymentIntent = onCall(async (request) => {
  const uid = requireAuth(request);
  const input = z
    .object({
      bookingId: z.string().min(1),
      provider: z.enum(["stripe", "paypal"]).default("stripe"),
    })
    .parse(request.data);

  const bookingRef = db.collection("bookings").doc(input.bookingId);
  const bookingSnapshot = await bookingRef.get();
  if (!bookingSnapshot.exists) {
    throw new Error("Booking not found");
  }

  const booking = bookingSnapshot.data() ?? {};
  if (booking.userId !== uid) {
    throw new Error("Booking does not belong to current user");
  }

  const amount = Number(booking.totalPrice ?? 0);
  const currency = String(booking.currency ?? "usd").toLowerCase();
  let clientSecret: string | null = null;
  let providerIntentId = `mock_${Date.now()}`;

  if (input.provider === "stripe" && stripe) {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.max(1, Math.round(amount * 100)),
      currency,
      metadata: {
        bookingId: input.bookingId,
        userId: uid,
      },
    });

    clientSecret = paymentIntent.client_secret;
    providerIntentId = paymentIntent.id;
  }

  const paymentRef = await db.collection("payments").add({
    bookingId: input.bookingId,
    userId: uid,
    provider: input.provider,
    providerIntentId,
    status: "pending",
    amount,
    currency: currency.toUpperCase(),
    transactionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await bookingRef.set(
    {
      paymentId: paymentRef.id,
      paymentStatus: "pending",
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return {
    paymentId: paymentRef.id,
    status: "pending",
    clientSecret,
    checkoutUrl: null,
  };
});

export const stripeWebhook = onRequest(async (request, response) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    response.status(200).send("Stripe webhook not configured");
    return;
  }

  const signature = request.headers["stripe-signature"];
  if (typeof signature !== "string") {
    response.status(400).send("Missing stripe-signature header");
    return;
  }

  try {
    const event = stripe.webhooks.constructEvent(
      request.rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const paymentsSnapshot = await db
        .collection("payments")
        .where("providerIntentId", "==", paymentIntent.id)
        .limit(1)
        .get();

      if (!paymentsSnapshot.empty) {
        const paymentDoc = paymentsSnapshot.docs[0];
        const paymentData = paymentDoc.data();

        await paymentDoc.ref.set(
          {
            status: "paid",
            transactionId: paymentIntent.id,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );

        await db
          .collection("bookings")
          .doc(String(paymentData.bookingId))
          .set(
            {
              status: "confirmed",
              paymentStatus: "paid",
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
      }
    }

    response.status(200).json({ received: true });
  } catch (error) {
    response.status(400).send(error instanceof Error ? error.message : "Webhook error");
  }
});
