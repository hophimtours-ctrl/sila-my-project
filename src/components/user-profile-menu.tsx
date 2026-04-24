"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { logoutAction } from "@/app/actions";

type UserRole = "GUEST" | "OWNER" | "ADMIN";

type UserProfileMenuProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
  avatarUrl: string;
  profileSuffix: string;
  userProfileMenuLabel: string;
  roleLabel: string;
  dashboardText: string;
  profileDashboardHref: string;
  profileDashboardLabel: string;
  hotelsAndRoomsManagementText: string;
  hostingManagementText: string;
  logoutText: string;
};

export function UserProfileMenu({
  user,
  avatarUrl,
  profileSuffix,
  userProfileMenuLabel,
  roleLabel,
  dashboardText,
  profileDashboardHref,
  profileDashboardLabel,
  hotelsAndRoomsManagementText,
  hostingManagementText,
  logoutText,
}: UserProfileMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  const closeMenu = () => {
    detailsRef.current?.removeAttribute("open");
  };

  useEffect(() => {
    closeMenu();
  }, [pathname]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (!details) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !details.contains(target)) {
        closeMenu();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <details ref={detailsRef} className="relative">
      <summary
        aria-label={userProfileMenuLabel}
        className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
      >
        <img
          src={avatarUrl}
          alt={`${user.name} ${profileSuffix}`}
          className="h-8 w-8 rounded-full object-cover"
          loading="lazy"
        />
        <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4 text-slate-500">
          <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      </summary>

      <div className="absolute left-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl md:left-auto md:right-0">
        <div className="border-b border-slate-100 pb-3">
          <p className="text-sm font-semibold text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">{user.email}</p>
          <p className="mt-1 text-xs text-slate-500">{roleLabel}</p>
        </div>

        <div className="mt-3 space-y-1">
          <Link
            href={profileDashboardHref}
            onClick={closeMenu}
            className="block rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            {dashboardText} · {profileDashboardLabel}
          </Link>
          {user.role === "ADMIN" && (
            <>
              <Link
                href="/admin/hotels"
                onClick={closeMenu}
                className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                {hotelsAndRoomsManagementText}
              </Link>
              <Link
                href="/admin/properties"
                onClick={closeMenu}
                className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                {hostingManagementText}
              </Link>
            </>
          )}
          {user.role === "OWNER" && (
            <Link
              href="/owner/register-property"
              onClick={closeMenu}
              className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              {hostingManagementText}
            </Link>
          )}
        </div>

        <form action={logoutAction} className="mt-3 border-t border-slate-100 pt-3">
          <button
            onClick={closeMenu}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {logoutText}
          </button>
        </form>
      </div>
    </details>
  );
}
