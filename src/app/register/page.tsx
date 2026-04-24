import Link from "next/link";
import { cookies } from "next/headers";
import { facebookSignInAction, googleSignInAction, registerAction, xSignInAction } from "@/app/actions";
import { LANGUAGE_COOKIE_KEY, parseAppLanguage } from "@/lib/i18n";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  const language = parseAppLanguage(cookieStore.get(LANGUAGE_COOKIE_KEY)?.value);
  const isHebrew = language === "he";
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-md card space-y-4 p-6">
      <h1 className="text-2xl font-bold">{isHebrew ? "הרשמה" : "Register"}</h1>
      {params.error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{params.error}</p>
      )}
      <div className="space-y-2">
        <form action={googleSignInAction}>
          <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
            <svg viewBox="0 0 48 48" aria-hidden className="h-4 w-4">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.655 32.657 29.239 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.84 1.154 7.959 3.041l5.657-5.657C34.046 6.053 29.28 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 19.003 12 24 12c3.059 0 5.84 1.154 7.959 3.041l5.657-5.657C34.046 6.053 29.28 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 44c5.178 0 9.86-1.977 13.409-5.192l-6.191-5.238C29.13 35.091 26.715 36 24 36c-5.219 0-9.622-3.316-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.045 12.045 0 0 1-4.085 5.571h.003l6.191 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            <span>{isHebrew ? "הרשמה עם Google" : "Sign up with Google"}</span>
          </button>
        </form>
        <form action={facebookSignInAction}>
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1877F2] p-3 text-sm font-semibold text-white transition hover:brightness-95">
            <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-white">
              <path d="M22 12.06C22 6.503 17.523 2 12 2S2 6.503 2 12.06c0 5.023 3.656 9.187 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.52 1.493-3.913 3.777-3.913 1.095 0 2.24.196 2.24.196v2.476h-1.262c-1.243 0-1.631.773-1.631 1.565v1.89h2.773l-.443 2.91h-2.33V22C18.344 21.247 22 17.083 22 12.06z" />
            </svg>
            <span>{isHebrew ? "הרשמה עם Facebook" : "Sign up with Facebook"}</span>
          </button>
        </form>
        <form action={xSignInAction}>
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-black p-3 text-sm font-semibold text-white transition hover:bg-neutral-800">
            <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-white">
              <path d="M18.901 2H22l-6.767 7.74L23.191 22h-6.227l-4.878-6.392L6.43 22H3.33l7.237-8.274L.809 2h6.385l4.409 5.822L18.901 2zm-1.088 18.06h1.719L6.231 3.84H4.387L17.813 20.06z" />
            </svg>
            <span>{isHebrew ? "הרשמה עם X (Twitter)" : "Sign up with X (Twitter)"}</span>
          </button>
        </form>
      </div>
      <form action={registerAction} className="space-y-3">
        <input
          name="name"
          required
          placeholder={isHebrew ? "שם מלא" : "Full name"}
          className="w-full rounded-lg border p-3"
        />
        <input
          name="email"
          type="email"
          required
          placeholder={isHebrew ? "אימייל" : "Email"}
          className="w-full rounded-lg border p-3"
        />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder={isHebrew ? "סיסמה" : "Password"}
          className="w-full rounded-lg border p-3"
        />
        <button className="w-full rounded-lg bg-[var(--color-cta)] p-3 font-bold">
          {isHebrew ? "יצירת חשבון" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        {isHebrew ? "כבר רשום? " : "Already have an account? "}
        <Link className="text-[var(--color-primary)]" href="/login">
          {isHebrew ? "להתחברות" : "Login"}
        </Link>
      </p>
    </div>
  );
}
