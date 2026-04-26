"use client";

import { useEffect, useRef, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  TwitterAuthProvider,
  getRedirectResult,
  getAuth,
  signInWithRedirect,
  signInWithPopup,
  signOut,
} from "firebase/auth";

type ProviderKey = "google" | "facebook" | "x";

type OAuthSigninButtonsProps = {
  isHebrew: boolean;
  mode: "login" | "register";
  returnTo: "/login" | "/register";
  oauthSignInAction: (formData: FormData) => Promise<void>;
};

const oauthFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const FIREBASE_PROVIDER_ID_TO_KEY: Record<string, ProviderKey> = {
  "google.com": "google",
  "facebook.com": "facebook",
  "twitter.com": "x",
};

function getProviderErrorMessage(isHebrew: boolean) {
  return isHebrew
    ? "ההתחברות דרך הספק נכשלה. נסו שוב בעוד רגע."
    : "OAuth sign-in failed. Please try again.";
}

function getProviderButtonLabel(isHebrew: boolean, mode: "login" | "register", provider: ProviderKey) {
  if (provider === "google") {
    return isHebrew
      ? mode === "register"
        ? "הרשמה עם Google"
        : "התחברות עם Google"
      : mode === "register"
        ? "Sign up with Google"
        : "Continue with Google";
  }
  if (provider === "facebook") {
    return isHebrew
      ? mode === "register"
        ? "הרשמה עם Facebook"
        : "התחברות עם Facebook"
      : mode === "register"
        ? "Sign up with Facebook"
        : "Continue with Facebook";
  }
  return isHebrew
    ? mode === "register"
      ? "הרשמה עם X (Twitter)"
      : "התחברות עם X (Twitter)"
    : mode === "register"
      ? "Sign up with X (Twitter)"
      : "Continue with X (Twitter)";
}

function shouldFallbackToRedirect(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  const errorCode = String(error.code);
  return (
    errorCode === "auth/popup-blocked" ||
    errorCode === "auth/operation-not-supported-in-this-environment" ||
    errorCode === "auth/web-storage-unsupported"
  );
}

function getFirebaseProvider(provider: ProviderKey) {
  if (provider === "google") {
    const googleProvider = new GoogleAuthProvider();
    googleProvider.addScope("email");
    googleProvider.addScope("profile");
    return googleProvider;
  }
  if (provider === "facebook") {
    const facebookProvider = new FacebookAuthProvider();
    facebookProvider.addScope("email");
    return facebookProvider;
  }
  return new TwitterAuthProvider();
}

function getOAuthFirebaseAuth() {
  if (
    !oauthFirebaseConfig.apiKey ||
    !oauthFirebaseConfig.authDomain ||
    !oauthFirebaseConfig.projectId ||
    !oauthFirebaseConfig.appId
  ) {
    return null;
  }

  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          apiKey: oauthFirebaseConfig.apiKey,
          authDomain: oauthFirebaseConfig.authDomain,
          projectId: oauthFirebaseConfig.projectId,
          appId: oauthFirebaseConfig.appId,
        });

  return getAuth(app);
}

export function OAuthSigninButtons({
  isHebrew,
  mode,
  returnTo,
  oauthSignInAction,
}: OAuthSigninButtonsProps) {
  const submitFormRef = useRef<HTMLFormElement | null>(null);
  const idTokenInputRef = useRef<HTMLInputElement | null>(null);
  const providerInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingProvider, setPendingProvider] = useState<ProviderKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPending = pendingProvider !== null;
  function submitOAuthToken(idToken: string, provider: ProviderKey) {
    if (!submitFormRef.current || !idTokenInputRef.current || !providerInputRef.current) {
      throw new Error("Missing OAuth submit form");
    }

    idTokenInputRef.current.value = idToken;
    providerInputRef.current.value = provider;
    submitFormRef.current.requestSubmit();
  }

  useEffect(() => {
    let cancelled = false;
    const auth = getOAuthFirebaseAuth();
    if (!auth) {
      return;
    }

    async function handleRedirectCompletion() {
      try {
        const redirectResult = await getRedirectResult(auth);
        if (!redirectResult?.user || !redirectResult.providerId || cancelled) {
          return;
        }

        const provider = FIREBASE_PROVIDER_ID_TO_KEY[redirectResult.providerId];
        if (!provider) {
          return;
        }

        setPendingProvider(provider);
        const idToken = await redirectResult.user.getIdToken(true);
        if (!idToken || cancelled) {
          throw new Error("Missing OAuth token");
        }

        submitOAuthToken(idToken, provider);
      } catch {
        if (!cancelled) {
          setPendingProvider(null);
          setErrorMessage(getProviderErrorMessage(isHebrew));
        }
      } finally {
        await signOut(auth).catch(() => undefined);
      }
    }

    void handleRedirectCompletion();

    return () => {
      cancelled = true;
    };
  }, [isHebrew]);

  async function handleProviderSignin(provider: ProviderKey) {
    setErrorMessage(null);
    setPendingProvider(provider);
    let shouldSignOutAfterAttempt = true;

    try {
      const auth = getOAuthFirebaseAuth();
      if (!auth) {
        throw new Error("Missing Firebase config");
      }
      const authProvider = getFirebaseProvider(provider);
      try {
        const credential = await signInWithPopup(auth, authProvider);
        const idToken = await credential.user.getIdToken(true);
        if (!idToken) {
          throw new Error("Missing OAuth token");
        }
        submitOAuthToken(idToken, provider);
      } catch (error) {
        if (shouldFallbackToRedirect(error)) {
          shouldSignOutAfterAttempt = false;
          await signInWithRedirect(auth, authProvider);
          return;
        }
        throw error;
      }
    } catch {
      setPendingProvider(null);
      setErrorMessage(getProviderErrorMessage(isHebrew));
    } finally {
      if (shouldSignOutAfterAttempt) {
        const auth = getOAuthFirebaseAuth();
        if (auth) {
          await signOut(auth).catch(() => undefined);
        }
      }
    }
  }

  return (
    <div className="space-y-2">
      <form ref={submitFormRef} action={oauthSignInAction}>
        <input ref={idTokenInputRef} type="hidden" name="idToken" />
        <input ref={providerInputRef} type="hidden" name="provider" />
        <input type="hidden" name="returnTo" value={returnTo} />
      </form>

      {errorMessage && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={() => handleProviderSignin("google")}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg viewBox="0 0 48 48" aria-hidden className="h-5 w-5">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.655 32.657 29.239 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.84 1.154 7.959 3.041l5.657-5.657C34.046 6.053 29.28 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 19.003 12 24 12c3.059 0 5.84 1.154 7.959 3.041l5.657-5.657C34.046 6.053 29.28 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
          <path fill="#4CAF50" d="M24 44c5.178 0 9.86-1.977 13.409-5.192l-6.191-5.238C29.13 35.091 26.715 36 24 36c-5.219 0-9.622-3.316-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.045 12.045 0 0 1-4.085 5.571h.003l6.191 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
        </svg>
        <span>{getProviderButtonLabel(isHebrew, mode, "google")}</span>
      </button>

      <button
        type="button"
        disabled={isPending}
        onClick={() => handleProviderSignin("facebook")}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] px-4 py-3 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-white">
          <path d="M22 12.06C22 6.503 17.523 2 12 2S2 6.503 2 12.06c0 5.023 3.656 9.187 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.52 1.493-3.913 3.777-3.913 1.095 0 2.24.196 2.24.196v2.476h-1.262c-1.243 0-1.631.773-1.631 1.565v1.89h2.773l-.443 2.91h-2.33V22C18.344 21.247 22 17.083 22 12.06z" />
        </svg>
        <span>{getProviderButtonLabel(isHebrew, mode, "facebook")}</span>
      </button>

      <button
        type="button"
        disabled={isPending}
        onClick={() => handleProviderSignin("x")}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-white">
          <path d="M18.901 2H22l-6.767 7.74L23.191 22h-6.227l-4.878-6.392L6.43 22H3.33l7.237-8.274L.809 2h6.385l4.409 5.822L18.901 2zm-1.088 18.06h1.719L6.231 3.84H4.387L17.813 20.06z" />
        </svg>
        <span>{getProviderButtonLabel(isHebrew, mode, "x")}</span>
      </button>
    </div>
  );
}
