import Link from "next/link";
import { cookies } from "next/headers";
import { loginAction, oauthSignInAction } from "@/app/actions";
import { OAuthSigninButtons } from "@/components/oauth-signin-buttons";
import { LANGUAGE_COOKIE_KEY, parseAppLanguage } from "@/lib/i18n";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  const language = parseAppLanguage(cookieStore.get(LANGUAGE_COOKIE_KEY)?.value);
  const isHebrew = language === "he";
  const params = await searchParams;

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">{isHebrew ? "התחברות" : "Login"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isHebrew
              ? "ברוכים הבאים חזרה. בחרו שיטת התחברות כדי להמשיך."
              : "Welcome back. Choose a sign-in method to continue."}
          </p>
        </div>

        {params.error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {params.error}
          </p>
        )}

        <OAuthSigninButtons
          isHebrew={isHebrew}
          mode="login"
          returnTo="/login"
          oauthSignInAction={oauthSignInAction}
        />

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs uppercase tracking-wide text-slate-400">{isHebrew ? "או" : "OR"}</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form action={loginAction} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              {isHebrew ? "אימייל" : "Email"}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="name@example.com"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                {isHebrew ? "סיסמה" : "Password"}
              </label>
              <Link href="/forgot-password" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                {isHebrew ? "שכחת סיסמה?" : "Forgot password?"}
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder={isHebrew ? "הכניסו סיסמה" : "Enter your password"}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button className="w-full rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-light)]">
            {isHebrew ? "התחברות" : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          {isHebrew ? "עדיין אין לך חשבון? " : "Don’t have an account yet? "}
          <Link className="font-medium text-blue-600 hover:text-blue-700" href="/register">
            {isHebrew ? "יצירת חשבון" : "Create account"}
          </Link>
        </p>
      </div>
    </div>
  );
}
