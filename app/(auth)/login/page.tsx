"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const callbackUrl = searchParams.get("callbackUrl")?.startsWith("/") ? searchParams.get("callbackUrl")! : "/dashboard";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false, callbackUrl });
    setSubmitting(false);
    if (!result?.ok) {
      setError("Incorrect email address or password.");
      return;
    }
    router.replace(result.url?.startsWith("/") ? result.url : callbackUrl);
    router.refresh();
  };

  return (
    <main className="mx-auto mt-20 max-w-md space-y-5 card">
      <div>
        <p className="text-sm text-slate-400">Repair Melder</p>
        <h1 className="mt-1 text-2xl font-semibold">Sign in</h1>
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block space-y-1.5 text-sm font-medium">
          <span>Email</span>
          <input className="input w-full" placeholder="name@company.com" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          <span>Password</span>
          <input className="input w-full" placeholder="Your password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error ? <p className="text-sm text-red-400" role="alert">{error}</p> : null}
        <button className="btn w-full" disabled={submitting} type="submit">{submitting ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="text-center text-sm text-slate-400">First time here? <Link className="font-semibold text-[#69f0df] hover:underline" href="/setup">Create the first administrator</Link>.</p>
    </main>
  );
}
