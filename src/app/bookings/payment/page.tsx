import Link from "next/link";
import { BookingStatus, HotelStatus, Role } from "@prisma/client";
import { differenceInCalendarDays, format } from "date-fns";
import { redirect } from "next/navigation";
import { createBookingAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";

type PaymentPageSearchParams = {
  roomTypeId?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  error?: string;
};

function parseDateInput(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parsePositiveInteger(value?: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }
  return parsed;
}

function appendErrorQuery(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}error=${encodeURIComponent(message)}`;
}

export default async function BookingPaymentPage({
  searchParams,
}: {
  searchParams: Promise<PaymentPageSearchParams>;
}) {
  const user = await requireUser(Role.GUEST);
  const params = await searchParams;
  const roomTypeId = params.roomTypeId?.trim() ?? "";

  if (!roomTypeId) {
    redirect("/search/results?category=accommodations&error=לא נבחר חדר להזמנה");
  }

  const room = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    include: { hotel: true },
  });

  if (!room || room.hotel.status !== HotelStatus.APPROVED) {
    redirect("/search/results?category=accommodations&error=החדר אינו זמין");
  }

  const checkInDate = parseDateInput(params.checkIn);
  const checkOutDate = parseDateInput(params.checkOut);
  const guests = parsePositiveInteger(params.guests);

  const hotelQuery = new URLSearchParams();
  if (params.checkIn) {
    hotelQuery.set("checkIn", params.checkIn);
  }
  if (params.checkOut) {
    hotelQuery.set("checkOut", params.checkOut);
  }
  if (params.guests) {
    hotelQuery.set("guests", params.guests);
  }
  const hotelDetailsHref =
    hotelQuery.size > 0 ? `/hotels/${room.hotelId}?${hotelQuery.toString()}` : `/hotels/${room.hotelId}`;
  const redirectToHotelWithError = (message: string): never =>
    redirect(appendErrorQuery(hotelDetailsHref, message));

  if (!checkInDate || !checkOutDate || guests === undefined) {
    redirectToHotelWithError("יש למלא תאריכים ומספר אורחים תקין");
  }
  const selectedCheckInDate = checkInDate!;
  const selectedCheckOutDate = checkOutDate!;
  const selectedGuests = guests!;

  if (selectedCheckOutDate <= selectedCheckInDate) {
    redirectToHotelWithError("טווח תאריכים לא תקין");
  }
  if (selectedGuests > room.maxGuests) {
    redirectToHotelWithError("מספר אורחים גבוה מהמותר לחדר");
  }

  const activeInventory = Math.max(0, Math.min(room.inventory, room.availableInventory));
  if (!room.isAvailable || activeInventory < 1) {
    redirectToHotelWithError("החדר אינו זמין כרגע להזמנה");
  }

  const overlapping = await prisma.booking.count({
    where: {
      roomTypeId: room.id,
      status: BookingStatus.CONFIRMED,
      checkIn: { lt: selectedCheckOutDate },
      checkOut: { gt: selectedCheckInDate },
    },
  });

  if (overlapping >= activeInventory) {
    redirectToHotelWithError("החדר תפוס בתאריכים שבחרת");
  }

  const blocked = await prisma.blockedDate.findFirst({
    where: {
      hotelId: room.hotelId,
      date: { gte: selectedCheckInDate, lt: selectedCheckOutDate },
    },
    select: { id: true },
  });

  if (blocked) {
    redirectToHotelWithError("המלון חסום באחד התאריכים");
  }

  const nights = differenceInCalendarDays(selectedCheckOutDate, selectedCheckInDate);
  if (nights <= 0) {
    redirectToHotelWithError("טווח תאריכים לא תקין");
  }

  const totalPrice = nights * room.pricePerNight;
  const checkInValue = format(selectedCheckInDate, "yyyy-MM-dd");
  const checkOutValue = format(selectedCheckOutDate, "yyyy-MM-dd");
  const bookingReturnPath = `/bookings/payment?${new URLSearchParams({
    roomTypeId: room.id,
    checkIn: checkInValue,
    checkOut: checkOutValue,
    guests: String(selectedGuests),
  }).toString()}`;

  return (
    <div className="space-y-4">
      <section className="card space-y-2 p-4">
        <h1 className="text-2xl font-bold">תשלום ואישור הזמנה</h1>
        <p className="text-sm text-slate-600">בדוק את פרטי החדר והשלם תשלום כדי לסיים את ההזמנה.</p>
      </section>

      {params.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-bold">סיכום הזמנה</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">מלון</dt>
            <dd className="font-semibold">{room.hotel.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">סוג חדר</dt>
            <dd className="font-semibold">{room.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">צ׳ק-אין</dt>
            <dd className="font-semibold">{formatDate(selectedCheckInDate)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">צ׳ק-אאוט</dt>
            <dd className="font-semibold">{formatDate(selectedCheckOutDate)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">אורחים</dt>
            <dd className="font-semibold">{selectedGuests}</dd>
          </div>
          <div>
            <dt className="text-slate-500">לילות</dt>
            <dd className="font-semibold">{nights}</dd>
          </div>
          <div>
            <dt className="text-slate-500">מחיר ללילה</dt>
            <dd className="font-semibold">{formatCurrency(room.pricePerNight)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">סה״כ לתשלום</dt>
            <dd className="font-semibold text-[var(--color-primary)]">{formatCurrency(totalPrice)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">מדיניות ביטול</dt>
            <dd className="font-semibold">{room.cancellationPolicy}</dd>
          </div>
          <div>
            <dt className="text-slate-500">מזמין</dt>
            <dd className="font-semibold">{user.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">אימייל</dt>
            <dd className="font-semibold">{user.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">חדרים זמינים כרגע</dt>
            <dd className="font-semibold">{Math.max(0, activeInventory - overlapping)}</dd>
          </div>
        </dl>

        {(room.hotel.providerId || room.hotel.externalHotelId || room.externalRoomId) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold">פרטי ספק הזמנה</p>
            <p>Provider ID: {room.hotel.providerId ?? "-"}</p>
            <p>External Hotel ID: {room.hotel.externalHotelId ?? "-"}</p>
            <p>External Room ID: {room.externalRoomId ?? "-"}</p>
          </div>
        )}
      </section>

      <section className="card p-4">
        <form action={createBookingAction} className="space-y-4">
          <input type="hidden" name="roomTypeId" value={room.id} />
          <input type="hidden" name="checkIn" value={checkInValue} />
          <input type="hidden" name="checkOut" value={checkOutValue} />
          <input type="hidden" name="guests" value={String(selectedGuests)} />
          <input type="hidden" name="bookingReturnPath" value={bookingReturnPath} />

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">שם בעל הכרטיס</span>
              <input
                name="cardHolder"
                required
                className="w-full rounded-lg border border-slate-300 p-2"
                placeholder="ישראל ישראלי"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">מספר כרטיס</span>
              <input
                name="cardNumber"
                required
                inputMode="numeric"
                pattern="[0-9]{12,19}"
                maxLength={19}
                className="w-full rounded-lg border border-slate-300 p-2"
                placeholder="4580123412341234"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">תוקף (MM/YY)</span>
              <input
                name="cardExpiry"
                required
                pattern="(0[1-9]|1[0-2])/[0-9]{2}"
                className="w-full rounded-lg border border-slate-300 p-2"
                placeholder="08/28"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">CVV</span>
              <input
                name="cardCvv"
                required
                inputMode="numeric"
                pattern="[0-9]{3,4}"
                maxLength={4}
                className="w-full rounded-lg border border-slate-300 p-2"
                placeholder="123"
              />
            </label>
          </div>

          <p className="text-xs text-slate-500">פרטי התשלום משמשים לאישור ההזמנה בלבד.</p>

          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg bg-[var(--color-cta)] px-4 py-2 font-bold text-slate-900">
              שלם ואשר הזמנה
            </button>
            <Link href={hotelDetailsHref} className="rounded-lg border px-4 py-2 text-sm">
              חזרה לבחירת חדר
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
