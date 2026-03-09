"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [login, setLogin] = useState({ email: "", password: "" });
  const [registration, setRegistration] = useState({
    name: "",
    companyName: "",
    email: "",
    password: ""
  });

  function submitLogin() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(login)
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(payload?.message ?? "Login failed.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  function submitRegistration() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(registration)
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(payload?.message ?? "Registration failed.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  function submitLogout() {
    setMessage(null);
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <section className="section card">
      <p className="eyebrow">Customer access</p>
      <h1>Sign in to buy labels</h1>
      <p className="muted">
        CALFIE EXPRESS requires an account so each shipment stays tied to the right pricing profile,
        saved payment method, and post-shipment adjustment policy.
      </p>

      <div className="actions">
        <button className={mode === "login" ? "button primary" : "button"} type="button" onClick={() => setMode("login")}>Sign in</button>
        <button className={mode === "register" ? "button primary" : "button"} type="button" onClick={() => setMode("register")}>Create account</button>
        <button className="button" type="button" onClick={submitLogout} disabled={isPending}>Clear session</button>
      </div>

      {mode === "login" ? (
        <div className="form-grid">
          <label className="field">
            <span>Email</span>
            <input value={login.email} onChange={(event) => setLogin((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={login.password} onChange={(event) => setLogin((current) => ({ ...current, password: event.target.value }))} />
          </label>
        </div>
      ) : (
        <div className="form-grid">
          <label className="field">
            <span>Name</span>
            <input value={registration.name} onChange={(event) => setRegistration((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="field">
            <span>Company</span>
            <input value={registration.companyName} onChange={(event) => setRegistration((current) => ({ ...current, companyName: event.target.value }))} />
          </label>
          <label className="field">
            <span>Email</span>
            <input value={registration.email} onChange={(event) => setRegistration((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={registration.password} onChange={(event) => setRegistration((current) => ({ ...current, password: event.target.value }))} />
          </label>
        </div>
      )}

      <div className="actions">
        <button className="button primary" type="button" onClick={mode === "login" ? submitLogin : submitRegistration} disabled={isPending}>
          {isPending ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </div>

      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
