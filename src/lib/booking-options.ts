import type { BedType, TripPurpose } from "@prisma/client";

export const BED_TYPE_OPTIONS: Array<{ value: BedType; label: string }> = [
  { value: "DOUBLE", label: "מיטה זוגית" },
  { value: "TWIN", label: "2 מיטות נפרדות" },
];

export const TRIP_PURPOSE_OPTIONS: Array<{ value: TripPurpose; label: string }> = [
  { value: "BUSINESS", label: "עסקים" },
  { value: "WORK", label: "עבודה" },
];

export function getBedTypeLabel(bedType: BedType | string | null | undefined) {
  return BED_TYPE_OPTIONS.find((option) => option.value === bedType)?.label ?? "מיטה זוגית";
}

export function getTripPurposeLabel(tripPurpose: TripPurpose | string | null | undefined) {
  return TRIP_PURPOSE_OPTIONS.find((option) => option.value === tripPurpose)?.label ?? "עסקים";
}
