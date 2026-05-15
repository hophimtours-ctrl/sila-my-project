import { format } from "date-fns";
import type { CurrencyCode } from "@prisma/client";

export function formatDate(value: Date) {
  return format(value, "dd/MM/yyyy");
}

export function formatCurrency(value: number, currency: CurrencyCode | string = "ILS") {
  const normalizedCurrency = String(currency || "ILS").toUpperCase();
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
  }).format(value);
}
