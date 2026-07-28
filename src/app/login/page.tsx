"use client";
import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { post } from "@/lib/http";
import { cn } from "@/lib/cn";

type Tab = "login" | "signup";

interface FormState {
  name: string;
  email: string;
  password: string;
}

const EMPTY_FORM: FormState = { name: "", email: "", password: "" };

const inputCls =
  "w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition-colors";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = useCallback(
    (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value })),
    []
  );

  const handleLogin = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError("");
      setLoading(true);

      try {
        // Warn early if this address can only sign in via OAuth — otherwise the
        // user just sees a generic "invalid password" and gets stuck.
        const check = await post<{ oauthOnly: boolean; providers?: string }>(
          "/api/auth/check-provider",
          { email: form.email }
        ).catch(() => ({ oauthOnly: false }) as const);

        if (check.oauthOnly) {
          setError(`This email uses ${check.providers} sign-in. Please use that instead.`);
          return;
        }

        const result = await signIn("credentials", {
          email: form.email,
          password: form.password,
          redirect: false,
        });

        if (result?.error) setError("Invalid email or password");
        else router.push("/");
      } finally {
        setLoading(false);
      }
    },
    [form, router]
  );

  const handleSignup = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError("");
      setLoading(true);

      try {
        await post("/api/auth/signup", form);
        await signIn("credentials", {
          email: form.email,
          password: form.password,
          redirect: false,
        });
        router.push("/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create account");
      } finally {
        setLoading(false);
      }
    },
    [form, router]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 w-full max-w-sm shadow-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            Interview Mastery
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sign in to sync your progress across devices
          </p>
        </div>

        <div className="flex flex-col gap-3 mb-5">
          <OAuthButton provider="github" label="Continue with GitHub" />
          <OAuthButton provider="google" label="Continue with Google" />
        </div>

        <div className="flex items-center gap-3 mb-5">
          <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
          <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>

        <div
          className="flex mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden text-sm font-medium"
          role="tablist"
        >
          {(["login", "signup"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => {
                setTab(value);
                setError("");
              }}
              className={cn(
                "flex-1 py-2 transition-colors",
                tab === value
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              {value === "login" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form
          onSubmit={tab === "login" ? handleLogin : handleSignup}
          className="flex flex-col gap-3"
        >
          {tab === "signup" && (
            <input
              name="name"
              value={form.name}
              onChange={update("name")}
              placeholder="Your name"
              autoComplete="name"
              required
              className={inputCls}
            />
          )}
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={update("email")}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className={inputCls}
          />
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={update("password")}
            placeholder={tab === "signup" ? "At least 8 characters" : "Password"}
            autoComplete={tab === "signup" ? "new-password" : "current-password"}
            required
            minLength={tab === "signup" ? 8 : undefined}
            className={inputCls}
          />

          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Please wait…" : tab === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

function OAuthButton({ provider, label }: { provider: "github" | "google"; label: string }) {
  return (
    <button
      type="button"
      onClick={() => void signIn(provider, { callbackUrl: "/" })}
      className="w-full flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium py-2.5 rounded-lg transition-colors"
    >
      {label}
    </button>
  );
}
