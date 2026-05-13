import type { CurrencyCode } from "@prisma/client";
import { IsraelGatewayAdapter } from "@/lib/payments/adapters/israel-gateway-adapter";
import { StripeGatewayAdapter } from "@/lib/payments/adapters/stripe-gateway-adapter";
import type { PaymentGatewayAdapter } from "@/lib/payments/types";

const israelGatewayAdapter = new IsraelGatewayAdapter();
const stripeGatewayAdapter = new StripeGatewayAdapter();

export function resolveGatewayByCurrency(currencyCode: CurrencyCode): PaymentGatewayAdapter {
  return currencyCode === "ILS" ? israelGatewayAdapter : stripeGatewayAdapter;
}

export function normalizeCurrencyCode(value: string | null | undefined): CurrencyCode {
  const normalized = String(value ?? "ILS").trim().toUpperCase();
  if (normalized === "USD" || normalized === "EUR" || normalized === "GBP" || normalized === "ILS") {
    return normalized;
  }
  return "ILS";
}
