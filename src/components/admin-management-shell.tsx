import Link from "next/link";

type AdminManagementShellProps = {
  title: string;
  description: string;
  activePath: string;
  error?: string;
  success?: string;
  navigationItems?: Array<{ href: string; label: string }>;
  children: React.ReactNode;
};

const adminNavigationItems = [
  { href: "/admin/super", label: "סופר-אדמין" },
  { href: "/admin/roles", label: "הרשאות ותפקידים" },
  { href: "/admin/settings", label: "הגדרות מערכת" },
  { href: "/admin/users", label: "ניהול משתמשים" },
  { href: "/admin/hotels", label: "ניהול מלונות" },
  { href: "/admin/properties", label: "ניהול בתי אירוח" },
  { href: "/admin/rooms", label: "ניהול חדרים" },
  { href: "/admin/availability", label: "ניהול זמינות" },
  { href: "/admin/deals", label: "ניהול דילים" },
  { href: "/admin/reviews", label: "ניהול ביקורות" },
  { href: "/admin/providers", label: "ניהול ספקי API" },
  { href: "/admin/logs", label: "לוגים מערכתיים" },
];

export function AdminManagementShell({
  title,
  description,
  activePath,
  error,
  success,
  navigationItems,
  children,
}: AdminManagementShellProps) {
  const visibleNavigationItems = navigationItems ?? adminNavigationItems;
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
        <h2 className="px-2 pb-2 text-sm font-semibold text-slate-500">תפריט ניהול</h2>
        <nav className="space-y-1">
          {visibleNavigationItems.map((item) => {
            const isActive = item.href === activePath;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-xl px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-[var(--color-primary-light)]/10 font-semibold text-[var(--color-primary-light)]"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-600">{description}</p>
        </header>

        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
        {success && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {success}
          </p>
        )}

        {children}
      </section>
    </div>
  );
}
