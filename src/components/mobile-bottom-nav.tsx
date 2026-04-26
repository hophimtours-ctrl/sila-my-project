"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MobileBottomNavProps = {
  language: "he" | "en";
  isAuthenticated: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (pathname: string) => boolean;
};

export function MobileBottomNav({ language, isAuthenticated }: MobileBottomNavProps) {
  const pathname = usePathname();
  const isHebrew = language === "he";

  const navItems: NavItem[] = [
    {
      href: "/",
      label: isHebrew ? "בית" : "Home",
      match: (value) => value === "/",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
          <path
            d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      href: "/search/results?category=accommodations",
      label: isHebrew ? "חיפוש" : "Search",
      match: (value) => value.startsWith("/search"),
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="m16 16 4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      href: "/bookings",
      label: isHebrew ? "נסיעות" : "Trips",
      match: (value) => value.startsWith("/bookings") || value.startsWith("/trips"),
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
          <path
            d="M3 17h18M5 17V8.5A1.5 1.5 0 0 1 6.5 7h11A1.5 1.5 0 0 1 19 8.5V17M8 11h8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      href: isAuthenticated ? "/profile" : "/login",
      label: isHebrew ? "פרופיל" : "Profile",
      match: (value) => value.startsWith("/profile") || value.startsWith("/login"),
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
          <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M5 20a7 7 0 0 1 14 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2">
        {navItems.map((item) => {
          const isActive = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`inline-flex min-w-[68px] flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                  isActive
                    ? "text-[var(--color-primary-light)]"
                    : "text-slate-500 hover:text-[var(--color-primary-light)]"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
