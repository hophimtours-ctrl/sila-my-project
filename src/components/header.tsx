import Link from "next/link";
import { cookies } from "next/headers";
import { BookingStatus, HotelStatus, Role } from "@prisma/client";
import { getCurrentUser, PROFILE_IMAGE_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LANGUAGE_COOKIE_KEY, parseAppLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { UserProfileMenu } from "@/components/user-profile-menu";

async function getUnreadAlertsCount(userId: string, role: Role) {
  if (role === Role.GUEST) {
    return prisma.booking.count({
      where: {
        userId,
        status: BookingStatus.CONFIRMED,
        checkIn: { gte: new Date() },
      },
    });
  }

  if (role === Role.OWNER) {
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    return prisma.booking.count({
      where: {
        status: BookingStatus.CONFIRMED,
        createdAt: { gte: since },
        hotel: { ownerId: userId },
      },
    });
  }

  return prisma.hotel.count({
    where: {
      status: HotelStatus.PENDING,
    },
  });
}

export async function Header() {
  const cookieStore = await cookies();
  const sessionProfileImageCookie = cookieStore.get(PROFILE_IMAGE_COOKIE_NAME)?.value?.trim();
  const sessionProfileImageUrl =
    sessionProfileImageCookie && /^https?:\/\//i.test(sessionProfileImageCookie)
      ? sessionProfileImageCookie
      : null;
  const language = parseAppLanguage(cookieStore.get(LANGUAGE_COOKIE_KEY)?.value);
  const t =
    language === "he"
      ? {
          alerts: "התראות",
          logout: "התנתקות",
          accommodations: "מקומות אירוח",
          flights: "טיסות",
          myFavorites: "המועדפים שלי",
          myBookings: "ההזמנות שלי",
          ownerDashboard: "לוח בעלים",
          registerAccommodation: "רישום מקום האירוח שלכם",
          adminDashboard: "ניהול מערכת",
          dashboard: "דשבורד",
          hotelsAndRoomsManagement: "ניהול מלונות וחדרים",
          hostingManagement: "ניהול מקומות אירוח",
          userProfileMenu: "תפריט פרופיל",
          guestUser: "אורח",
          ownerUser: "בעל נכס",
          adminUser: "אדמין",
          login: "התחברות",
          register: "הרשמה",
          goHome: "מעבר לדף הבית",
          profileSuffix: "פרופיל",
        }
      : {
          alerts: "Alerts",
          logout: "Logout",
          accommodations: "Accommodations",
          flights: "Flights",
          myFavorites: "My favorites",
          myBookings: "My bookings",
          ownerDashboard: "Owner dashboard",
          registerAccommodation: "Register your accommodation",
          adminDashboard: "Admin dashboard",
          dashboard: "Dashboard",
          hotelsAndRoomsManagement: "Hotels & rooms management",
          hostingManagement: "Hosting management",
          userProfileMenu: "Profile menu",
          guestUser: "Guest",
          ownerUser: "Owner",
          adminUser: "Administrator",
          login: "Login",
          register: "Register",
          goHome: "Go to homepage",
          profileSuffix: "profile",
        };
  const user = await getCurrentUser();
  const unreadAlerts = user ? await getUnreadAlertsCount(user.id, user.role) : 0;
  const roleLabel = user
    ? user.role === "ADMIN"
      ? t.adminUser
      : user.role === "OWNER"
        ? t.ownerUser
        : t.guestUser
    : "";
  const profileDashboardHref = user
    ? user.role === "ADMIN"
      ? "/admin/super"
      : user.role === "OWNER"
        ? "/owner"
        : "/bookings"
    : "/";
  const profileDashboardLabel = user
    ? user.role === "ADMIN"
      ? t.adminDashboard
      : user.role === "OWNER"
        ? t.ownerDashboard
        : t.myBookings
    : t.dashboard;
  const avatarUrl = user
    ? sessionProfileImageUrl ??
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1a73e8&color=ffffff&bold=true&size=64`
    : "";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2">

          {user && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t.alerts}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-current">
                  <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z" />
                </svg>
                {unreadAlerts > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadAlerts > 9 ? "9+" : unreadAlerts}
                  </span>
                )}
              </button>

              <UserProfileMenu
                user={{
                  name: user.name,
                  email: user.email,
                  role: user.role,
                }}
                avatarUrl={avatarUrl}
                profileSuffix={t.profileSuffix}
                userProfileMenuLabel={t.userProfileMenu}
                roleLabel={roleLabel}
                dashboardText={t.dashboard}
                profileDashboardHref={profileDashboardHref}
                profileDashboardLabel={profileDashboardLabel}
                hotelsAndRoomsManagementText={t.hotelsAndRoomsManagement}
                hostingManagementText={t.hostingManagement}
                logoutText={t.logout}
              />
            </div>
          )}
        </div>

        <nav className="hidden items-center gap-5 text-sm font-medium text-slate-700 md:flex">
          <Link
            className="inline-flex items-center gap-1 transition hover:text-[var(--color-primary-light)]"
            href="/search/results?category=accommodations"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
              <path
                d="M4 12V7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 15h18M5 15v3m14-3v3M8.5 10h2m3 0h2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{t.accommodations}</span>
          </Link>
          <Link
            className="inline-flex items-center gap-1 transition hover:text-[var(--color-primary-light)]"
            href="/search/results?category=flights"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
              <path
                d="m3 11 7.5 1.2L21 8.5l-1 2.3-6.7 2.5L18 16l-1.8.8-5.9-2.3L6.5 16l-.8-1.6 3.2-1.9L3 11Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{t.flights}</span>
          </Link>
          {user && (
            <Link
              className="inline-flex items-center gap-1 transition hover:text-[var(--color-primary-light)]"
              href="/favorites"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
                <path
                  d="M12.001 20.727 4.93 13.656a4.5 4.5 0 1 1 6.364-6.364l.707.707.707-.707a4.5 4.5 0 1 1 6.364 6.364z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{t.myFavorites}</span>
            </Link>
          )}
          {user?.role === "GUEST" && (
            <Link className="transition hover:text-[var(--color-primary-light)]" href="/bookings">
              {t.myBookings}
            </Link>
          )}
          {user?.role === "OWNER" && (
            <Link className="transition hover:text-[var(--color-primary-light)]" href="/owner">
              {t.ownerDashboard}
            </Link>
          )}
          {user?.role === "OWNER" && (
            <Link className="transition hover:text-[var(--color-primary-light)]" href="/owner/register-property">
              {t.registerAccommodation}
            </Link>
          )}
          {user?.role === "ADMIN" && (
            <Link className="transition hover:text-[var(--color-primary-light)]" href="/admin">
              {t.adminDashboard}
            </Link>
          )}
          {!user && (
            <>
              <Link className="transition hover:text-[var(--color-primary-light)]" href="/login">
                {t.login}
              </Link>
              <Link
                className="rounded-full border border-slate-300 px-3 py-2 transition hover:border-slate-400"
                href="/register"
              >
                {t.register}
              </Link>
            </>
          )}
        </nav>
        <LanguageSwitcher initialLanguage={language} />
        <Link
          href="/"
          aria-label={t.goHome}
          className="text-xl font-bold tracking-tight text-[var(--color-primary)] transition hover:opacity-90"
        >
          BookMeNow
        </Link>
      </div>
    </header>
  );
}
