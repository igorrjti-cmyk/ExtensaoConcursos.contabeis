// src/lib/supabase.ts
// Cliente Supabase — lê as variáveis de ambiente injetadas pelo Vercel
// Configure em: Vercel → Settings → Environment Variables
//   NEXT_PUBLIC_SUPABASE_URL  = https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY = eyJ...  (service_role, nunca exponha no frontend)

import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Retorna null quando as variáveis não estão configuradas (ex: dev local sem .env)
export function getSupabase() {
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
