"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/session")
      .then((res) => res.json())
      .then((data) => setOpen(data.restricted === false))
      .catch(() => {});
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not unlock the desk.");
      const value = new URLSearchParams(window.location.search).get("next") || "/";
      const next = value.startsWith("/") && !value.startsWith("//") ? value : "/";
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err.message);
      setPending(false);
    }
  }

  return (
    <main className="gate">
      <form className="gate-card" onSubmit={onSubmit}>
        <p className="kicker">Idea Validation Desk</p>
        <h1>Open the desk</h1>
        {open ? (
          <p>
            This server has no dashboard passphrase. The file API is open either way.{" "}
            <Link href="/">Continue to the files</Link>.
          </p>
        ) : (
          <>
            <p>
              The file API stays open for the bots. This passphrase only locks the
              reading view.
            </p>
            <label>
              Passphrase
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn primary" disabled={pending}>
              {pending ? "Checking…" : "Continue"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
