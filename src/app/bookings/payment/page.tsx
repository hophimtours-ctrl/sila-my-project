import Link from "next/link";
import { BookingStatus, HotelStatus, Role } from "@prisma/client";
import { differenceInCalendarDays, format } from "date-fns";
import { redirect } from "next/navigation";
import { createBookingAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getBedTypeLabel, getRoomPaymentPolicyLabel, TRIP_PURPOSE_OPTIONS } from "@/lib/booking-options";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";

type PaymentPageSearchParams = {
  roomTypeId?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  adults?: string;
  children?: string;
  rooms?: string;
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
function parseNonNegativeInteger(value?: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
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
  const adults = parsePositiveInteger(params.adults);
  const children = parseNonNegativeInteger(params.children);
  const rooms = parsePositiveInteger(params.rooms);
  const hasGuestBreakdown = adults !== undefined || children !== undefined;
  const selectedAdults = adults ?? guests ?? 1;
  const selectedChildren = children ?? 0;
  const selectedRooms = rooms ?? 1;
  const derivedGuests = selectedAdults + selectedChildren;
  const selectedGuests = hasGuestBreakdown ? derivedGuests : (guests ?? derivedGuests);

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
  if (params.adults) {
    hotelQuery.set("adults", params.adults);
  }
  if (params.children) {
    hotelQuery.set("children", params.children);
  }
  if (params.rooms) {
    hotelQuery.set("rooms", params.rooms);
  }
  const hotelDetailsHref =
    hotelQuery.size > 0 ? `/hotels/${room.hotelId}?${hotelQuery.toString()}` : `/hotels/${room.hotelId}`;
  const redirectToHotelWithError = (message: string): never =>
    redirect(appendErrorQuery(hotelDetailsHref, message));

  if (!checkInDate || !checkOutDate || selectedGuests < 1) {
    redirectToHotelWithError("יש למלא תאריכים ומספר אורחים תקין");
  }
  const selectedCheckInDate = checkInDate!;
  const selectedCheckOutDate = checkOutDate!;

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
    adults: String(selectedAdults),
    children: String(selectedChildren),
    rooms: String(selectedRooms),
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
            <dt className="text-slate-500">סוג מיטה</dt>
            <dd className="font-semibold">{getBedTypeLabel(room.bedType)}</dd>
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
            <dt className="text-slate-500">מבוגרים</dt>
            <dd className="font-semibold">{selectedAdults}</dd>
          </div>
          <div>
            <dt className="text-slate-500">ילדים</dt>
            <dd className="font-semibold">{selectedChildren}</dd>
          </div>
          <div>
            <dt className="text-slate-500">חדרים</dt>
            <dd className="font-semibold">{selectedRooms}</dd>
          </div>
          <div>
            <dt className="text-slate-500">לילות</dt>
            <dd className="font-semibold">{nights}</dd>
          </div>
          <div>
            <dt className="text-slate-500">מחיר ללילה</dt>
            <dd className="font-semibold">{formatCurrency(room.pricePerNight, room.currencyCode)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">סה״כ לתשלום</dt>
            <dd className="font-semibold text-[var(--color-primary)]">{formatCurrency(totalPrice, room.currencyCode)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">מטבע</dt>
            <dd className="font-semibold">{room.currencyCode}</dd>
          </div>
          <div>
            <dt className="text-slate-500">אופן סליקה</dt>
            <dd className="font-semibold">{getRoomPaymentPolicyLabel(room.paymentPolicy)}</dd>
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
          <input type="hidden" name="adults" value={String(selectedAdults)} />
          <input type="hidden" name="children" value={String(selectedChildren)} />
          <input type="hidden" name="rooms" value={String(selectedRooms)} />
          <input type="hidden" name="bookingReturnPath" value={bookingReturnPath} />

          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <h3 className="text-sm font-semibold text-slate-900">פרטי השהייה</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: selectedGuests }, (_, index) => (
                <label key={`guest-name-${index}`} className="space-y-1 text-sm">
                  <span className="font-medium">שם אורח {index + 1}</span>
                  <input
                    name="guestNames"
                    required={index === 0}
                    className="w-full rounded-lg border border-slate-300 p-2"
                    placeholder={index === 0 ? user.name : `אורח ${index + 1}`}
                    defaultValue={index === 0 ? user.name : ""}
                  />
                </label>
              ))}
              <label className="space-y-1 text-sm">
                <span className="font-medium">מטרת הנסיעה</span>
                <select name="tripPurpose" defaultValue={TRIP_PURPOSE_OPTIONS[0]?.value} className="w-full rounded-lg border border-slate-300 p-2">
                  {TRIP_PURPOSE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="font-medium">בקשות מיוחדות</span>
                <textarea
                  name="specialRequests"
                  className="min-h-24 w-full rounded-lg border border-slate-300 p-2"
                  placeholder="לדוגמה: קומה גבוהה, מיטת תינוק, הגעה מאוחרת"
                />
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <h3 className="text-sm font-semibold text-slate-900">אישור תשלום מאובטח (Tokenized)</h3>
            <p className="text-xs text-slate-600">
              אין להזין פרטי כרטיס גולמיים. יש להזין רק מזהה טוקן/סשן שמתקבל מטופס התשלום המאובטח של הסולק.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Payment Token</span>
                <input
                  name="paymentToken"
                  required
                  className="w-full rounded-lg border border-slate-300 p-2"
                  placeholder="tok_xxx / pm_xxx / token_xxx"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Payment Session ID (אופציונלי)</span>
                <input
                  name="paymentSessionId"
                  className="w-full rounded-lg border border-slate-300 p-2"
                  placeholder="sess_xxx / checkout_xxx"
                />
              </label>
            </div>
          </div>

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
