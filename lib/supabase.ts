"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cloud sync is optional by design — the camera and scanning never depend
// on it. When the env vars are absent, the app runs local-only.
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}

export function syncConfigured(): boolean {
  return getSupabase() !== null;
}
