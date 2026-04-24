import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveInventory,
  getInventoryDisplayLabel,
  getInventoryDisplayState,
  getRemainingInventory,
  isLowInventory,
  isRoomBookable,
} from "@/lib/inventory-availability";

test("getActiveInventory uses the lower of total and available inventory", () => {
  assert.equal(getActiveInventory(10, 6), 6);
  assert.equal(getActiveInventory(4, 9), 4);
});

test("getRemainingInventory subtracts overlapping bookings and never goes below zero", () => {
  assert.equal(
    getRemainingInventory({
      inventory: 10,
      availableInventory: 7,
      overlappingBookings: 3,
    }),
    4,
  );

  assert.equal(
    getRemainingInventory({
      inventory: 2,
      availableInventory: 1,
      overlappingBookings: 5,
    }),
    0,
  );
});

test("isRoomBookable enforces room flag, remaining inventory, and blocked dates", () => {
  assert.equal(
    isRoomBookable({
      roomIsAvailable: true,
      remainingInventory: 2,
      hotelBlockedByDates: false,
    }),
    true,
  );

  assert.equal(
    isRoomBookable({
      roomIsAvailable: false,
      remainingInventory: 2,
      hotelBlockedByDates: false,
    }),
    false,
  );

  assert.equal(
    isRoomBookable({
      roomIsAvailable: true,
      remainingInventory: 0,
      hotelBlockedByDates: false,
    }),
    false,
  );

  assert.equal(
    isRoomBookable({
      roomIsAvailable: true,
      remainingInventory: 3,
      hotelBlockedByDates: true,
    }),
    false,
  );
});

test("getInventoryDisplayState returns low stock only when bookable and under threshold", () => {
  assert.equal(
    getInventoryDisplayState({
      isBookable: true,
      remainingInventory: 4,
      hotelBlockedByDates: false,
    }),
    "lowStock",
  );

  assert.equal(
    getInventoryDisplayState({
      isBookable: true,
      remainingInventory: 9,
      hotelBlockedByDates: false,
    }),
    "available",
  );

  assert.equal(
    getInventoryDisplayState({
      isBookable: false,
      remainingInventory: 4,
      hotelBlockedByDates: false,
    }),
    "soldOut",
  );

  assert.equal(
    getInventoryDisplayState({
      isBookable: false,
      remainingInventory: 4,
      hotelBlockedByDates: true,
    }),
    "blockedByDates",
  );
});

test("getInventoryDisplayLabel returns localized low-stock and sold-out labels", () => {
  assert.equal(
    getInventoryDisplayLabel({
      state: "lowStock",
      remainingInventory: 5,
      locale: "he",
    }),
    "נותרו 5 חדרים אחרונים",
  );

  assert.equal(
    getInventoryDisplayLabel({
      state: "lowStock",
      remainingInventory: 3,
      locale: "en",
    }),
    "Only 3 rooms left",
  );

  assert.equal(
    getInventoryDisplayLabel({
      state: "soldOut",
      remainingInventory: 0,
      locale: "he",
    }),
    "אזל",
  );
});

test("isLowInventory flags values between 1 and threshold inclusive", () => {
  assert.equal(isLowInventory(5), true);
  assert.equal(isLowInventory(1), true);
  assert.equal(isLowInventory(0), false);
  assert.equal(isLowInventory(6), false);
});
