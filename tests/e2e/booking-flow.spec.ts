import { expect, test } from "playwright/test";

function formatDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

test("guest can complete booking flow from search to payment confirmation", async ({ page }) => {
  test.setTimeout(180_000);
  const requestedBaseUrl = process.env.E2E_BASE_URL ?? "https://bookmenow-7f4f2.web.app";
  const email = process.env.E2E_LOGIN_EMAIL ?? "guest@bookmenow.co.il";
  const password = process.env.E2E_LOGIN_PASSWORD ?? "Pass1234!";
  const checkInDate = new Date();
  checkInDate.setDate(checkInDate.getDate() + 14);
  const checkOutDate = new Date();
  checkOutDate.setDate(checkOutDate.getDate() + 16);
  const checkIn = formatDateParam(checkInDate);
  const checkOut = formatDateParam(checkOutDate);

  await page.goto(`${requestedBaseUrl}/login`, { waitUntil: "domcontentloaded" });
  const appBaseUrl = new URL(page.url()).origin;
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  const loginForm = page.locator('form:has(input[name="email"]):has(input[name="password"])').first();
  await loginForm.getByRole("button").last().click();
  await page.waitForTimeout(2500);
  await page.goto(`${appBaseUrl}/bookings`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/bookings(\?|$)/, { timeout: 45_000 });
  await expect(page).toHaveURL(/\/bookings(\?|$)/);
  await page.goto(`${appBaseUrl}/search/results?category=accommodations`, {
    waitUntil: "domcontentloaded",
  });

  const hotelHref = await page.locator('a[href^="/hotels/"]').evaluateAll((links) => {
    const hrefs = links
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("/hotels/"));
    return hrefs.find((href) => !href.includes("mock-hotel-")) ?? null;
  });
  if (!hotelHref) {
    const mockHotelLinkCount = await page.locator('a[href*="/hotels/mock-hotel-"]').count();
    throw new Error(
      `No real hotel links found in search results; mock hotel links detected: ${mockHotelLinkCount}`,
    );
  }
  await page.goto(`${appBaseUrl}${hotelHref!}`, { waitUntil: "domcontentloaded" });

  const bookingForm = page.locator('form[action="/bookings/payment"]').first();
  await expect(bookingForm).toBeVisible({ timeout: 45_000 });
  await bookingForm.locator('input[name="checkIn"]').fill(checkIn);
  await bookingForm.locator('input[name="checkOut"]').fill(checkOut);
  await bookingForm.locator('input[name="guests"]').fill("2");
  await bookingForm.getByRole("button", { name: /Book now|הזמן עכשיו/ }).click();

  await page.waitForURL(/\/bookings\/payment(\?|$)/, { timeout: 45_000 });
  await expect(page).toHaveURL(/\/bookings\/payment(\?|$)/);
  await page.fill('input[name="cardHolder"]', "Oz E2E Guest");
  await page.fill('input[name="cardNumber"]', "4580123412341234");
  await page.fill('input[name="cardExpiry"]', "08/30");
  await page.fill('input[name="cardCvv"]', "123");
  await page.getByRole("button", { name: /שלם ואשר הזמנה|Pay and confirm booking/ }).click();

  await page.waitForURL(/\/bookings(\?|$)/, { timeout: 45_000 });
  await expect(page).toHaveURL(/\/bookings(\?|$)/);
  await expect(page.getByRole("heading", { name: /ההזמנות שלי|My bookings/i })).toBeVisible();
});
