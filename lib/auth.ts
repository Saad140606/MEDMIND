// Manages client-side and server-side user authentication, sessions, role-based registration, and authorization token extraction.
import { createBrowserSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export interface UserProfile {
  id: string;
  name: string;
  role: 'PATIENT' | 'CAREGIVER' | 'DOCTOR';
  phone?: string;
  streak: number;
  streak_history: boolean[];
}

export async function getSession() {
  if (!isSupabaseConfigured) return null;
  const supabase = createBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser(): Promise<{ session: any; profile: UserProfile | null } | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createBrowserSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role, phone, streak, streak_history, user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  return { session, profile };
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  const supabase = createBrowserSupabaseClient();
  await supabase.auth.signOut();
}

export async function signIn(email: string, password: string) {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string, name: string, role: 'PATIENT' | 'CAREGIVER' | 'DOCTOR', phone?: string) {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, role, phone }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Signup failed');
  }
  return json;
}

export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  // Read and parse cookie headers manually to parse key-value dictionaries.
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );
  
  // Locate the Supabase auth-token (which holds the user's JWT access_token inside serialized JSON).
  const tokenKey = Object.keys(cookies).find(k => k.includes('auth-token'));
  if (tokenKey) {
    try {
      const parsed = JSON.parse(decodeURIComponent(cookies[tokenKey]));
      return parsed.access_token || null;
    } catch {
      return null;
    }
  }
  return null;
}
