"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase, errorMessage, configured } from "@/lib/supabase";

export default function BusinessLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const client = supabase();
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback?next=/business/new` },
        });
        if (error) throw error;
        if (data.session) location.assign("/business/new");
        else setMessage("Compte créé. Confirmez votre adresse avec le lien reçu par email, puis configurez votre commerce.");
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.assign("/business");
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="container auth-layout">
        <aside className="auth-aside">
          <span className="kicker">ESPACE COMMERÇANT</span>
          <h2>Fidélisez vos clients.<br /><em>Mesurez ce qui marche.</em></h2>
          <ul>
            <li>✳ QR code et carte digitale en quelques minutes</li>
            <li>◫ Ajout à Apple Wallet pour vos clients</li>
            <li>📊 Analyses : visites, fidélisation, meilleurs clients</li>
          </ul>
        </aside>
        <div className="auth-panel">
          <div className="auth-card">
            <span className="kicker">{mode === "login" ? "CONNEXION" : "NOUVEAU COMPTE"}</span>
            <h1>{mode === "login" ? "Connexion" : "Créer mon compte"}</h1>
            <p>Votre établissement, vos clients, votre programme.</p>
            {!configured ? (
              <p role="alert">Configurez Supabase avant de créer un compte.</p>
            ) : (
              <form onSubmit={submit}>
                <label>
                  Email professionnel
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </label>
                <label>
                  Mot de passe
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                </label>
                <button className="button dark" disabled={busy}>
                  {mode === "login" ? "Se connecter" : "Créer mon compte"}
                </button>
              </form>
            )}
            {message && <p role="status">{message}</p>}
            <button
              className="text-switch"
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setMessage("");
              }}
            >
              {mode === "login" ? "Nouveau commerçant ? Créer un compte" : "Déjà inscrit ? Se connecter"}
            </button>
            <p>
              <Link href="/privacy">Confidentialité et données personnelles</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
