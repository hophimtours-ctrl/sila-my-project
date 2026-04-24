import { format } from "date-fns";

export function formatDate(value: Date) {
  return format(value, "dd/MM/yyyy");
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value);
}
