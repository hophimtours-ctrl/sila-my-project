import type { BedType, CurrencyCode, RoomPaymentPolicy, TripPurpose } from "@prisma/client";

export const BED_TYPE_OPTIONS: Array<{ value: BedType; label: string }> = [
  { value: "DOUBLE", label: "מיטה זוגית" },
  { value: "TWIN", label: "2 מיטות נפרדות" },
];

export const TRIP_PURPOSE_OPTIONS: Array<{ value: TripPurpose; label: string }> = [
  { value: "BUSINESS", label: "עסקים" },
  { value: "WORK", label: "עבודה" },
];

export const ROOM_PAYMENT_POLICY_OPTIONS: Array<{ value: RoomPaymentPolicy; label: string }> = [
  { value: "CHARGE", label: "חיוב מלא מיידי" },
  { value: "PREAUTH", label: "הבטחת הזמנה (Pre-Auth)" },
];

export const ROOM_CURRENCY_OPTIONS: Array<{ value: CurrencyCode; label: string }> = [
  { value: "ILS", label: "₪ ILS" },
  { value: "USD", label: "$ USD" },
  { value: "EUR", label: "€ EUR" },
  { value: "GBP", label: "£ GBP" },
];

export function getBedTypeLabel(bedType: BedType | string | null | undefined) {
  return BED_TYPE_OPTIONS.find((option) => option.value === bedType)?.label ?? "מיטה זוגית";
}

export function getTripPurposeLabel(tripPurpose: TripPurpose | string | null | undefined) {
  return TRIP_PURPOSE_OPTIONS.find((option) => option.value === tripPurpose)?.label ?? "עסקים";
}

export function getRoomPaymentPolicyLabel(paymentPolicy: RoomPaymentPolicy | string | null | undefined) {
  return (
    ROOM_PAYMENT_POLICY_OPTIONS.find((option) => option.value === paymentPolicy)?.label ??
    ROOM_PAYMENT_POLICY_OPTIONS[0].label
  );
}
