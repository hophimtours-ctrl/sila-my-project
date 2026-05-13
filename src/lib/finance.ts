import type { HotelMarkupMode, SupplierPaymentStatus } from "@prisma/client";

type FinanceMarkupInput = {
  netRate: number;
  markupMode: HotelMarkupMode;
  markupPercentage: number;
  markupAmount: number;
};

const EPSILON = 0.01;

function toNonNegativeNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

export function normalizeMoney(value: number) {
  return Math.round(toNonNegativeNumber(value) * 100) / 100;
}

export function calculateSellFromNetRate(input: FinanceMarkupInput) {
  const netRate = normalizeMoney(input.netRate);
  const markupPercentage = toNonNegativeNumber(input.markupPercentage);
  const markupAmount = normalizeMoney(input.markupAmount);
  const percentageProfit = normalizeMoney((netRate * markupPercentage) / 100);
  let profitAmount = percentageProfit;

  if (input.markupMode === "AMOUNT") {
    profitAmount = markupAmount;
  } else if (input.markupMode === "MAX") {
    profitAmount = Math.max(percentageProfit, markupAmount);
  }

  const sellRate = normalizeMoney(netRate + profitAmount);
  const profitPercent = netRate > 0 ? normalizeMoney((profitAmount / netRate) * 100) : 0;

  return {
    netRate,
    sellRate,
    profitAmount: normalizeMoney(profitAmount),
    profitPercent,
  };
}

export function calculateNetFromSellRate(params: {
  sellRate: number;
  markupMode: HotelMarkupMode;
  markupPercentage: number;
  markupAmount: number;
}) {
  const sellRate = normalizeMoney(params.sellRate);
  const markupPercentage = toNonNegativeNumber(params.markupPercentage);
  const markupAmount = normalizeMoney(params.markupAmount);

  if (sellRate <= 0) {
    return calculateSellFromNetRate({
      netRate: 0,
      markupMode: params.markupMode,
      markupPercentage,
      markupAmount,
    });
  }

  if (params.markupMode === "PERCENTAGE") {
    const denominator = 1 + markupPercentage / 100;
    const netRate = denominator > 0 ? normalizeMoney(sellRate / denominator) : sellRate;
    return calculateSellFromNetRate({
      netRate,
      markupMode: params.markupMode,
      markupPercentage,
      markupAmount,
    });
  }

  if (params.markupMode === "AMOUNT") {
    const netRate = normalizeMoney(Math.max(0, sellRate - markupAmount));
    return calculateSellFromNetRate({
      netRate,
      markupMode: params.markupMode,
      markupPercentage,
      markupAmount,
    });
  }

  const denominator = 1 + markupPercentage / 100;
  const percentageCaseNet = denominator > 0 ? normalizeMoney(sellRate / denominator) : sellRate;
  const amountCaseNet = normalizeMoney(Math.max(0, sellRate - markupAmount));
  const percentageCaseValid =
    normalizeMoney((percentageCaseNet * markupPercentage) / 100) + EPSILON >= markupAmount;
  const amountCaseValid =
    normalizeMoney((amountCaseNet * markupPercentage) / 100) <= markupAmount + EPSILON;
  const resolvedNet = percentageCaseValid
    ? percentageCaseNet
    : amountCaseValid
      ? amountCaseNet
      : Math.min(percentageCaseNet, amountCaseNet);

  return calculateSellFromNetRate({
    netRate: resolvedNet,
    markupMode: params.markupMode,
    markupPercentage,
    markupAmount,
  });
}

export function resolveSupplierPaymentStatus(params: {
  amountToPaySupplier: number;
  amountPaid: number;
}): SupplierPaymentStatus {
  const amountToPaySupplier = normalizeMoney(params.amountToPaySupplier);
  const amountPaid = normalizeMoney(params.amountPaid);

  if (amountToPaySupplier <= EPSILON) {
    return "PAID";
  }
  if (amountPaid <= EPSILON) {
    return "PENDING";
  }
  if (amountPaid + EPSILON >= amountToPaySupplier) {
    return "PAID";
  }
  return "PARTIAL";
}
