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
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = createBrowserSupabaseClient();
  
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Signup failed — no user returned');

  
  const { error: profileError } = await supabase.from('profiles').insert({
    user_id: data.user.id,
    name,
    role,
    phone: phone || null,
    streak: 0,
    streak_history: [false, false, false, false, false, false, false],
  });
  if (profileError) throw profileError;

  
  // Seeding: if the user is a Patient, insert default tracking tables (medications list, hydration metrics, refills tracker).
  if (role === 'PATIENT') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', data.user.id)
      .single();

    if (profile) {
      await supabase.from('medications').insert([
        { profile_id: profile.id, name: 'Aspirin 81mg', icon: '💊', color: '#e84a5f', time: '08:00 AM', requires_lock: false, icon_bg: '#2a0f14' },
        { profile_id: profile.id, name: 'Vitamin D 1000IU', icon: '☀️', color: '#f59e0b', time: '10:00 AM', requires_lock: false, icon_bg: '#2a1f0a' },
        { profile_id: profile.id, name: 'Metformin 500mg', icon: '🔵', color: '#3b82f6', time: '02:00 PM', requires_lock: true, icon_bg: '#0a1530' },
        { profile_id: profile.id, name: 'Lisinopril 10mg', icon: '⚙️', color: '#8b5cf6', time: '08:00 PM', requires_lock: false, icon_bg: '#1a1030' },
      ]);
      await supabase.from('hydration').insert({ profile_id: profile.id, current: 0, goal: 2.5 });
      await supabase.from('refills').insert({ profile_id: profile.id, pending: 0 });
    }
  }

  return data;
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
