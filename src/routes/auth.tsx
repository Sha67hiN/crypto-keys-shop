import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ActionButton, FieldLabel, Panel, TextField } from "@/components/site/Pieces";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Keyvault account marketplace" },
      {
        name: "description",
        content:
          "Sign in or create a Keyvault account to buy credentials and view your delivered accounts.",
      },
      { property: "og:title", content: "Sign in · Keyvault" },
      {
        property: "og:description",
        content: "Access your Keyvault orders and delivered account credentials.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setNotice("Account created. Confirm your email, then sign in.");
          setMode("signin");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md py-12">
      <Panel className="animate-reveal">
        <p className="label-mono">Account access</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-snow">
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-fog">
          Your purchases and delivered credentials live in your orders tab.
        </p>

        <div className="mt-5 space-y-3">
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextField value={email} onChange={setEmail} type="email" placeholder="you@mail.com" />
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <TextField
              value={password}
              onChange={setPassword}
              type="password"
              placeholder="At least 6 characters"
            />
          </div>
        </div>

        {error && <p className="mt-3 font-mono text-xs text-rose">{error}</p>}
        {notice && <p className="mt-3 font-mono text-xs text-amber">{notice}</p>}

        <ActionButton className="mt-5 w-full" onClick={submit} disabled={busy}>
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </ActionButton>

        <button
          className="mt-4 w-full font-mono text-[11px] text-fog transition-colors hover:text-snow"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
        >
          {mode === "signin"
            ? "No account yet? Create one"
            : "Already registered? Sign in instead"}
        </button>

        <Link to="/" className="mt-3 block text-center font-mono text-[11px] text-fog hover:text-snow">
          Back to store
        </Link>
      </Panel>
    </div>
  );
}
