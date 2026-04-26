import Link from "next/link";
import { cookies } from "next/headers";
import { oauthSignInAction, registerAction } from "@/app/actions";
import { OAuthSigninButtons } from "@/components/oauth-signin-buttons";
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
      <OAuthSigninButtons
        isHebrew={isHebrew}
        mode="register"
        returnTo="/register"
        oauthSignInAction={oauthSignInAction}
      />
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
