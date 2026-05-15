import nodemailer from "nodemailer";
import { formatCurrency, formatDate } from "@/lib/format";

export type BookingConfirmationEmailPayload = {
  recipientEmail: string;
  guestName: string;
  bookingId: string;
  bookingCreatedAt: Date;
  bookingStatus: "CONFIRMED" | "CANCELED";
  hotelName: string;
  hotelAddress: string;
  hotelCity: string | null;
  hotelCountry: string | null;
  hotelContactEmail: string | null;
  roomName: string;
  cancellationPolicy: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  nights: number;
  totalPrice: number;
  rapidBookingReference?: string | null;
};

type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  from: string | null;
};

function getMailConfig(): MailConfig {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure =
    process.env.SMTP_SECURE?.trim().toLowerCase() === "true" || Number(process.env.SMTP_PORT) === 465;
  const user = process.env.SMTP_USER?.trim() || null;
  const pass = process.env.SMTP_PASS?.trim() || null;
  const from = process.env.BOOKING_CONFIRMATION_FROM?.trim() || user;

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    user,
    pass,
    from,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildHotelAddress(payload: BookingConfirmationEmailPayload) {
  const parts = [payload.hotelAddress, payload.hotelCity, payload.hotelCountry]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.join(", ");
}

function buildEmailSubject(payload: BookingConfirmationEmailPayload) {
  return `אישור הזמנה ${payload.bookingId} - ${payload.hotelName}`;
}

function buildEmailText(payload: BookingConfirmationEmailPayload) {
  const hotelAddress = buildHotelAddress(payload);
  const lines = [
    `שלום ${payload.guestName},`,
    "",
    "ההזמנה שלך נקלטה בהצלחה.",
    `מספר הזמנה: ${payload.bookingId}`,
    `סטטוס: ${payload.bookingStatus === "CONFIRMED" ? "מאושרת" : "בוטלה"}`,
    `תאריך יצירת הזמנה: ${formatDate(payload.bookingCreatedAt)}`,
    "",
    `מלון: ${payload.hotelName}`,
    `כתובת: ${hotelAddress || "-"}`,
    `אימייל מלון: ${payload.hotelContactEmail || "-"}`,
    "",
    `סוג חדר: ${payload.roomName}`,
    `צ'ק-אין: ${formatDate(payload.checkIn)}`,
    `צ'ק-אאוט: ${formatDate(payload.checkOut)}`,
    `מספר לילות: ${payload.nights}`,
    `מספר אורחים: ${payload.guests}`,
    "",
    `מחיר כולל: ${formatCurrency(payload.totalPrice)}`,
    `תנאי ביטול: ${payload.cancellationPolicy}`,
    "",
    payload.rapidBookingReference
      ? `מספר אסמכתא ספק (Rapid): ${payload.rapidBookingReference}`
      : null,
    "",
    "תודה שבחרת BookMeNow.",
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

function buildEmailHtml(payload: BookingConfirmationEmailPayload) {
  const hotelAddress = buildHotelAddress(payload);
  const rapidReferenceRow = payload.rapidBookingReference
    ? `<tr><td style="padding:8px 0;color:#475569;">אסמכתא ספק</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(payload.rapidBookingReference)}</td></tr>`
    : "";

  return `
  <div style="font-family:Arial,sans-serif;direction:rtl;text-align:right;color:#0f172a;max-width:680px;margin:0 auto;padding:20px;">
    <h2 style="margin:0 0 12px;color:#0f172a;">אישור הזמנה</h2>
    <p style="margin:0 0 20px;">שלום ${escapeHtml(payload.guestName)}, ההזמנה שלך נקלטה בהצלחה.</p>

    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px;padding:14px;">
      <tbody>
        <tr><td style="padding:8px 0;color:#475569;">מספר הזמנה</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(payload.bookingId)}</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">סטטוס</td><td style="padding:8px 0;font-weight:600;">${payload.bookingStatus === "CONFIRMED" ? "מאושרת" : "בוטלה"}</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">תאריך יצירת הזמנה</td><td style="padding:8px 0;font-weight:600;">${formatDate(payload.bookingCreatedAt)}</td></tr>
        ${rapidReferenceRow}
      </tbody>
    </table>

    <h3 style="margin:24px 0 10px;">פרטי המלון</h3>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>
        <tr><td style="padding:8px 0;color:#475569;">שם מלון</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(payload.hotelName)}</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">כתובת</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(hotelAddress || "-")}</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">אימייל מלון</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(payload.hotelContactEmail || "-")}</td></tr>
      </tbody>
    </table>

    <h3 style="margin:24px 0 10px;">פרטי השהייה</h3>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>
        <tr><td style="padding:8px 0;color:#475569;">סוג חדר</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(payload.roomName)}</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">צ'ק-אין</td><td style="padding:8px 0;font-weight:600;">${formatDate(payload.checkIn)}</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">צ'ק-אאוט</td><td style="padding:8px 0;font-weight:600;">${formatDate(payload.checkOut)}</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">מספר לילות</td><td style="padding:8px 0;font-weight:600;">${payload.nights}</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">אורחים</td><td style="padding:8px 0;font-weight:600;">${payload.guests}</td></tr>
        <tr><td style="padding:8px 0;color:#475569;">מחיר כולל</td><td style="padding:8px 0;font-weight:600;">${formatCurrency(payload.totalPrice)}</td></tr>
      </tbody>
    </table>

    <h3 style="margin:24px 0 10px;">תנאי ביטול</h3>
    <p style="margin:0;padding:12px;background:#fff7ed;border-radius:8px;border:1px solid #fdba74;">${escapeHtml(payload.cancellationPolicy)}</p>

    <p style="margin:24px 0 0;color:#475569;">תודה שבחרת BookMeNow.</p>
  </div>
  `.trim();
}

export async function sendBookingConfirmationEmail(payload: BookingConfirmationEmailPayload) {
  const config = getMailConfig();
  if (!config.host || !config.from) {
    console.warn(
      "[booking-confirmation-email] Skipping email send because SMTP_HOST or BOOKING_CONFIRMATION_FROM/SMTP_USER is missing.",
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
  });

  await transporter.sendMail({
    from: config.from,
    to: payload.recipientEmail,
    subject: buildEmailSubject(payload),
    text: buildEmailText(payload),
    html: buildEmailHtml(payload),
  });
}
