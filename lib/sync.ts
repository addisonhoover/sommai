"use client";

import type { Palate, WineLogEntry } from "./types";
import { getSupabase } from "./supabase";

export interface CloudState {
  palates: Palate[];
  journal: WineLogEntry[];
  defaultTable: string[];
}

// Household-account model: one shared sign-in (email + password) that both
// phones use. Push overwrites the cloud row; pull replaces local state.
// Newest updated_at wins — simple and predictable for a two-person app.

export async function signIn(email: string, password: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return "Cloud sync isn't configured yet.";
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (!error) return null;
  // First time? Create the household account.
  if (/invalid login credentials/i.test(error.message)) {
    const { error: upErr } = await sb.auth.signUp({ email, password });
    return upErr ? upErr.message : null;
  }
  return error.message;
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

export async function currentUserEmail(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.email ?? null;
}

export async function pushState(state: CloudState): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return "Cloud sync isn't configured yet.";
  const { data } = await sb.auth.getUser();
  if (!data.user) return "Sign in first.";
  const { error } = await sb.from("sommai_state").upsert({
    user_id: data.user.id,
    palates: state.palates,
    journal: state.journal,
    default_table: state.defaultTable,
    updated_at: new Date().toISOString(),
  });
  return error ? error.message : null;
}

export async function pullState(): Promise<{ state: CloudState | null; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { state: null, error: "Cloud sync isn't configured yet." };
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { state: null, error: "Sign in first." };
  const { data, error } = await sb
    .from("sommai_state")
    .select("palates, journal, default_table")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) return { state: null, error: error.message };
  if (!data) return { state: null, error: null }; // nothing in the cloud yet
  return {
    state: {
      palates: (data.palates as Palate[]) ?? [],
      journal: (data.journal as WineLogEntry[]) ?? [],
      defaultTable: (data.default_table as string[]) ?? [],
    },
    error: null,
  };
}
