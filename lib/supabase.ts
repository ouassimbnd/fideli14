import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let instance: SupabaseClient | null = null;
export const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export function supabase() {
  if (!configured) throw new Error("Supabase n’est pas configuré. Ajoutez les deux variables NEXT_PUBLIC_SUPABASE_* dans Vercel.");
  if (!instance) instance = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return instance;
}
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Une erreur est survenue."; }
