export type InventoryDisplayState = "available" | "lowStock" | "soldOut" | "blockedByDates";

type InventoryLabelLocale = "he" | "en";

function normalizeInventoryCount(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function getActiveInventory(inventory: number, availableInventory: number) {
  const normalizedInventory = normalizeInventoryCount(inventory);
  const normalizedAvailableInventory = normalizeInventoryCount(availableInventory);
  return Math.min(normalizedInventory, normalizedAvailableInventory);
}

export function getRemainingInventory(params: {
  inventory: number;
  availableInventory: number;
  overlappingBookings: number;
}) {
  const activeInventory = getActiveInventory(params.inventory, params.availableInventory);
  const overlappingBookings = normalizeInventoryCount(params.overlappingBookings);
  return Math.max(0, activeInventory - overlappingBookings);
}

export function isRoomBookable(params: {
  roomIsAvailable: boolean;
  remainingInventory: number;
  hotelBlockedByDates: boolean;
}) {
  return !params.hotelBlockedByDates && params.roomIsAvailable && params.remainingInventory > 0;
}

export function isLowInventory(remainingInventory: number, threshold = 5) {
  return remainingInventory > 0 && remainingInventory <= Math.max(1, Math.floor(threshold));
}

export function getInventoryDisplayState(params: {
  isBookable: boolean;
  remainingInventory: number;
  hotelBlockedByDates: boolean;
  lowStockThreshold?: number;
}): InventoryDisplayState {
  if (params.hotelBlockedByDates) {
    return "blockedByDates";
  }

  if (!params.isBookable || params.remainingInventory <= 0) {
    return "soldOut";
  }

  if (isLowInventory(params.remainingInventory, params.lowStockThreshold)) {
    return "lowStock";
  }

  return "available";
}

export function getInventoryDisplayLabel(params: {
  state: InventoryDisplayState;
  remainingInventory: number;
  locale: InventoryLabelLocale;
}) {
  const isHebrew = params.locale === "he";

  if (params.state === "lowStock") {
    return isHebrew
      ? `נותרו ${params.remainingInventory} חדרים אחרונים`
      : `Only ${params.remainingInventory} rooms left`;
  }

  if (params.state === "blockedByDates") {
    return isHebrew ? "לא זמין בתאריכים אלה" : "Not available for these dates";
  }

  if (params.state === "soldOut") {
    return isHebrew ? "אזל" : "Sold out";
  }

  return isHebrew ? "זמין להזמנה" : "Available";
}
