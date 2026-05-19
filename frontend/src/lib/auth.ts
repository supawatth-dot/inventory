import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  _supabase = createClient(url, key);
  return _supabase;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (data.session?.access_token) {
    localStorage.setItem('token', data.session.access_token);
  }
  return data;
}

export async function signOut() {
  localStorage.removeItem('token');
  await getSupabaseClient().auth.signOut();
}

export async function getSession() {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session;
}
