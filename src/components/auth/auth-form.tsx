"use client";

import { FormEvent, type CSSProperties, useState } from "react";
import { useRouter } from "next/navigation";

const authButtonBaseStyle: CSSProperties = {
  appearance: "none",
  borderRadius: "999px",
  padding: "0.85rem 1.35rem",
  fontSize: "1rem",
  fontWeight: 700,
  border: "1px solid transparent",
  cursor: "pointer",
  transition: "all 160ms ease",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "48px"
};

const authPrimaryButtonStyle: CSSProperties = {
  ...authButtonBaseStyle,
  background: "#c85c2b",
  color: "#fffdf7",
  borderColor: "#c85c2b"
};

const authSecondaryButtonStyle: CSSProperties = {
  ...authButtonBaseStyle,
  background: "#f7f4ee",
  color: "#16233b",
  borderColor: "#d9d2c4"
};

const authDisabledPrimaryStyle: CSSProperties = {
  ...authButtonBaseStyle,
  background: "#e8ddca",
  color: "#fffaf0",
  borderColor: "#e8ddca",
  cursor: "not-allowed"
};

const authDisabledSecondaryStyle: CSSProperties = {
  ...authButtonBaseStyle,
  background: "#f1ebe0",
  color: "#7d766b",
  borderColor: "#e3daca",
  cursor: "not-allowed"
};

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [registration, setRegistration] = useState({
    name: "",
    companyName: "",
    email: "",
    password: ""
  });

  async function submitLogin() {
    setMessage(null);

    if (!login.email.trim() || !login.password.trim()) {
      setMessage("Please enter both email and password.");
      return;
    }

    if (!login.email.includes("@")) {
      setMessage("Please enter the full email address for sign in.");
      return;
    }

    try {
      setIsPending(true);
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
    } finally {
      setIsPending(false);
    }
  }

  async function submitRegistration() {
    setMessage(null);

    if (!registration.name.trim() || !registration.email.trim() || !registration.password.trim()) {
      setMessage("Please complete name, email, and password.");
      return;
    }

    if (!registration.email.includes("@")) {
      setMessage("Please enter a valid email address.");
      return;
    }

    try {
      setIsPending(true);
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
    } finally {
      setIsPending(false);
    }
  }

  async function submitLogout() {
    setMessage(null);
    try {
      setIsPending(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "login") {
      await submitLogin();
      return;
    }

    await submitRegistration();
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
        <button
          className={mode === "login" ? "button primary" : "button"}
          style={mode === "login" ? authPrimaryButtonStyle : authSecondaryButtonStyle}
          type="button"
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
        <button
          className={mode === "register" ? "button primary" : "button"}
          style={mode === "register" ? authPrimaryButtonStyle : authSecondaryButtonStyle}
          type="button"
          onClick={() => setMode("register")}
        >
          Create account
        </button>
        <button
          className="button"
          style={isPending ? authDisabledSecondaryStyle : authSecondaryButtonStyle}
          type="button"
          onClick={submitLogout}
          disabled={isPending}
        >
          Clear session
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === "login" ? (
          <div className="form-grid">
            <label className="field">
              <span>Email</span>
              <input
                value={login.email}
                onChange={(event) => setLogin((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={login.password}
                onChange={(event) => setLogin((current) => ({ ...current, password: event.target.value }))}
              />
            </label>
          </div>
        ) : (
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input
                value={registration.name}
                onChange={(event) => setRegistration((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Company</span>
              <input
                value={registration.companyName}
                onChange={(event) => setRegistration((current) => ({ ...current, companyName: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                value={registration.email}
                onChange={(event) => setRegistration((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={registration.password}
                onChange={(event) => setRegistration((current) => ({ ...current, password: event.target.value }))}
              />
            </label>
          </div>
        )}

        <div className="actions">
          <button
            className="button primary"
            style={isPending ? authDisabledPrimaryStyle : authPrimaryButtonStyle}
            type="submit"
            disabled={isPending}
          >
            {isPending ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </div>
      </form>

      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
