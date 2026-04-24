"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDateRange = normalizeDateRange;
exports.calculateNights = calculateNights;
function normalizeDateRange(checkIn, checkOut) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        throw new Error("Invalid date range");
    }
    return { start, end };
}
function calculateNights(checkIn, checkOut) {
    return Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
}
