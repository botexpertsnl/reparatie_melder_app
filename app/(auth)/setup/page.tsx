"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetch("/api/setup", { cache: "no-store" })
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!response.ok) throw new Error(payload.error ?? "Could not verify setup status.");
        setState(payload.data?.setupRequired ? "ready" : "unavailable");
      })
      .catch((setupError: unknown) => {
        setError(setupError instanceof Error ? setupError.message : "Could not verify setup status.");
        setState("unavailable");
      });
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Could not create administrator.");
      router.replace("/login?setup=complete");
      router.refresh();
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : "Could not create administrator.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto mt-16 max-w-md space-y-5 card">
      <div>
        <p className="text-sm text-slate-400">Repair Melder</p>
        <h1 className="mt-1 text-2xl font-semibold">Create the first administrator</h1>
        <p className="mt-2 text-sm text-slate-400">This page works only once. It closes automatically after the first administrator is created.</p>
      </div>
      {state === "loading" ? <p className="text-sm text-slate-400">Checking setup status…</p> : null}
      {state === "unavailable" ? <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-amber-100">{error ?? "Setup has already been completed. Sign in with an existing administrator account."}</p> : null}
      {state === "ready" ? (
        <form className="space-y-4" onSubmit={onSubmit}>
          <input className="input w-full" placeholder="Your name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
          <input className="input w-full" placeholder="name@company.com" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <input className="input w-full" placeholder="Choose a password (12+ characters)" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} />
          {error ? <p className="text-sm text-red-400" role="alert">{error}</p> : null}
          <button className="btn w-full" disabled={submitting} type="submit">{submitting ? "Creating administrator…" : "Create administrator"}</button>
        </form>
      ) : null}
    </main>
  );
}
