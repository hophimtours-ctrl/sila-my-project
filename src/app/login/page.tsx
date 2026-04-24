import Link from "next/link";
import { cookies } from "next/headers";
import { facebookSignInAction, googleSignInAction, loginAction, xSignInAction } from "@/app/actions";
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

        <div className="space-y-3">
          <form action={googleSignInAction}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
            >
              <svg viewBox="0 0 48 48" aria-hidden className="h-5 w-5">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.655 32.657 29.239 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.84 1.154 7.959 3.041l5.657-5.657C34.046 6.053 29.28 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 19.003 12 24 12c3.059 0 5.84 1.154 7.959 3.041l5.657-5.657C34.046 6.053 29.28 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.178 0 9.86-1.977 13.409-5.192l-6.191-5.238C29.13 35.091 26.715 36 24 36c-5.219 0-9.622-3.316-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.045 12.045 0 0 1-4.085 5.571h.003l6.191 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              <span>{isHebrew ? "התחברות עם Google" : "Continue with Google"}</span>
            </button>
          </form>

          <form action={facebookSignInAction}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] px-4 py-3 text-sm font-medium text-white transition hover:brightness-95"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-white">
                <path d="M22 12.06C22 6.503 17.523 2 12 2S2 6.503 2 12.06c0 5.023 3.656 9.187 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.52 1.493-3.913 3.777-3.913 1.095 0 2.24.196 2.24.196v2.476h-1.262c-1.243 0-1.631.773-1.631 1.565v1.89h2.773l-.443 2.91h-2.33V22C18.344 21.247 22 17.083 22 12.06z" />
              </svg>
              <span>{isHebrew ? "התחברות עם Facebook" : "Continue with Facebook"}</span>
            </button>
          </form>

          <form action={xSignInAction}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-white">
                <path d="M18.901 2H22l-6.767 7.74L23.191 22h-6.227l-4.878-6.392L6.43 22H3.33l7.237-8.274L.809 2h6.385l4.409 5.822L18.901 2zm-1.088 18.06h1.719L6.231 3.84H4.387L17.813 20.06z" />
              </svg>
              <span>{isHebrew ? "התחברות עם X (Twitter)" : "Continue with X (Twitter)"}</span>
            </button>
          </form>
        </div>

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
