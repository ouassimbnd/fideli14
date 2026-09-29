"use client";
import { useEffect, useState } from "react";
import { supabase, errorMessage } from "@/lib/supabase";
export default function AuthCallback() {
  const [message,setMessage] = useState("Vérification de votre lien…");
  useEffect(() => { const run = async () => { try {
    const query = new URLSearchParams(location.search);
    const code = query.get("code");
    if (code) { const { error } = await supabase().auth.exchangeCodeForSession(code); if (error) throw error; }
    const { data: { user }, error } = await supabase().auth.getUser();
    if (error || !user) throw error || new Error("Lien expiré. Demandez un nouveau lien.");
    const next = query.get("next") || "/customer";
    location.replace(next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/customer");
  } catch (error) { setMessage(errorMessage(error)); } }; void run(); }, []);
  return <div className="container page narrow"><h1>Connexion</h1><p role="status">{message}</p></div>;
}
