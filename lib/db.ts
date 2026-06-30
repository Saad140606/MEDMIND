// Primary data access layer providing dual-support for local JSON file fallback storage and remote Supabase queries.
import fs from 'fs/promises';
import path from 'path';
import { supabase, isSupabaseConfigured, createAuthenticatedClient } from './supabaseClient';



export interface Medication {
  id: number;
  name: string;
  icon: string;
  color: string;
  time: string;
  status: 'taken' | 'due' | 'upcoming';
  iconBg: string;
  requiresLock: boolean;
}

export interface UserProfile {
  id?: string;
  name: string;
  streak: number;
  streakHistory: boolean[];
  role?: 'PATIENT' | 'CAREGIVER' | 'DOCTOR';
  phone?: string;
}

export interface HydrationData {
  current: number;
  goal: number;
}

export interface RefillData {
  pending: number;
}

export interface DoseLog {
  id: string;
  medicationId: number;
  dateString: string; 
  loggedAt: string;   
}

export interface DatabaseState {
  user: UserProfile;
  medications: Medication[];
  hydration: HydrationData;
  refills: RefillData;
  logs: DoseLog[];
}



const DB_FILE = path.join(process.cwd(), 'db.json');

// Fall back to a local JSON store when Supabase is unavailable.
const DEFAULT_STATE: DatabaseState = {
  user: {
    name: 'Ahmed',
    streak: 12,
    streakHistory: [true, true, true, true, true, false, false],
  },
  medications: [
    { id: 1, name: 'Aspirin 81mg',      icon: '💊', color: '#e84a5f', time: '08:00 AM', status: 'taken',    iconBg: '#2a0f14', requiresLock: false },
    { id: 2, name: 'Vitamin D 1000IU',  icon: '☀️', color: '#f59e0b', time: '10:00 AM', status: 'taken',    iconBg: '#2a1f0a', requiresLock: false },
    { id: 3, name: 'Metformin 500mg',   icon: '🔵', color: '#3b82f6', time: '02:00 PM', status: 'due',      iconBg: '#0a1530', requiresLock: true  },
    { id: 4, name: 'Lisinopril 10mg',   icon: '⚙️', color: '#8b5cf6', time: '08:00 PM', status: 'upcoming', iconBg: '#1a1030', requiresLock: false },
  ],
  hydration: { current: 1.2, goal: 2.5 },
  refills: { pending: 2 },
  logs: [
    // Pre-populate with Aspirin and Vitamin D logged today
    { id: 'log-1', medicationId: 1, dateString: new Date().toISOString().split('T')[0], loggedAt: new Date().toISOString() },
    { id: 'log-2', medicationId: 2, dateString: new Date().toISOString().split('T')[0], loggedAt: new Date().toISOString() },
  ],
};

// Ensure DB is initialized
async function ensureDb(): Promise<DatabaseState> {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    // If file doesn't exist, create it with default state
    await fs.writeFile(DB_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
    return DEFAULT_STATE;
  }
}

async function saveDb(state: DatabaseState): Promise<void> {
  await fs.writeFile(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// Helper to determine status dynamically based on current time
export function getMedicationStatus(timeStr: string, isLogged: boolean): 'taken' | 'due' | 'upcoming' {
  if (isLogged) return 'taken';
  try {
    // Parse scheduled medication time (e.g. "08:00 AM" or "02:30 PM") into numeric hours and minutes.
    const parts = timeStr.split(' ');
    const time = parts[0];
    const modifier = parts[1];
    let [hours, minutes] = time.split(':').map(Number);
    // Convert 12-hour clock representation to standard 24-hour integers.
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    const now = new Date();
    // Reconstruct the scheduled time on today's calendar date to compare it with the current time.
    const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    return now >= scheduled ? 'due' : 'upcoming';
  } catch {
    return 'due';
  }
}








export function getSupabaseClient(accessToken?: string | null) {
  if (!isSupabaseConfigured) return null;
  if (accessToken) {
    return createAuthenticatedClient(accessToken);
  }
  return supabase;
}





export async function getCurrentProfileId(accessToken?: string | null): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const client = getSupabaseClient(accessToken);
  if (!client) return null;
  try {
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;
    const { data: profile } = await client
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    return profile?.id ?? null;
  } catch {
    return null;
  }
}



function mapDbMed(med: any, logs: any[], todayStr: string): Medication {
  // Convert database rows into the medication shape used by the UI.
  const isLoggedToday = logs.some((log: any) => log.medication_id === med.id && log.date_string === todayStr);
  return {
    id: med.id,
    name: med.name,
    icon: med.icon,
    color: med.color,
    time: med.time,
    status: getMedicationStatus(med.time, isLoggedToday),
    iconBg: med.icon_bg,
    requiresLock: med.requires_lock,
  };
}



export async function getDashboardData(accessToken?: string | null) {
  if (isSupabaseConfigured) {
    const client = getSupabaseClient(accessToken);
    if (!client) throw new Error('Supabase client unavailable');

    const todayStr = new Date().toISOString().split('T')[0];
    const profileId = await getCurrentProfileId(accessToken);

    if (!profileId) {
      
      return {
        user: { name: 'Unknown', streak: 0, streakHistory: Array(7).fill(false) },
        medications: [],
        hydration: { current: 0, goal: 2.5 },
        refills: { pending: 0 },
        adherence: { percent: 0, taken: 0, total: 0 },
      };
    }

    // Parallelize remote database fetching using Promise.all to avoid waterfall delays.
    const [profileRes, medsRes, hydRes, refRes, logsRes] = await Promise.all([
      client.from('profiles').select('*').eq('id', profileId).single(),
      client.from('medications').select('*').eq('profile_id', profileId).order('id', { ascending: true }),
      client.from('hydration').select('*').eq('profile_id', profileId).maybeSingle(),
      client.from('refills').select('*').eq('profile_id', profileId).maybeSingle(),
      client.from('dose_logs').select('*').eq('profile_id', profileId).eq('date_string', todayStr),
    ]);

    const profile = profileRes.data || { name: 'User', streak: 0, streak_history: Array(7).fill(false) };
    const medications = medsRes.data || [];
    const hydration = hydRes.data || { current: 0, goal: 2.5 };
    const refills = refRes.data || { pending: 0 };
    const logs = logsRes.data || [];

    // Map remote database records to UI shapes and compute current day's compliance ratios.
    const updatedMedications = medications.map((med: any) => mapDbMed(med, logs, todayStr));
    const total = updatedMedications.length;
    const taken = updatedMedications.filter((m: Medication) => m.status === 'taken').length;
    const percent = total > 0 ? Math.round((taken / total) * 100) : 0;

    return {
      user: { name: profile.name, streak: profile.streak, streakHistory: profile.streak_history, id: profile.id, role: profile.role, phone: profile.phone },
      medications: updatedMedications,
      hydration: { current: Number(hydration.current), goal: Number(hydration.goal) },
      refills: { pending: refills.pending },
      adherence: { percent, taken, total },
    };
  }

  // Fallback to local db.json
  const db = await ensureDb();
  const todayStr = new Date().toISOString().split('T')[0];
  const updatedMedications = db.medications.map(med => {
    const isLoggedToday = db.logs.some(log => log.medicationId === med.id && log.dateString === todayStr);
    return { ...med, status: getMedicationStatus(med.time, isLoggedToday) };
  });
  const total = updatedMedications.length;
  const taken = updatedMedications.filter(m => m.status === 'taken').length;
  const percent = total > 0 ? Math.round((taken / total) * 100) : 0;
  return {
    user: db.user,
    medications: updatedMedications,
    hydration: db.hydration,
    refills: db.refills,
    adherence: { percent, taken, total },
  };
}



export async function logDose(medicationId: number, accessToken?: string | null) {
  if (isSupabaseConfigured) {
    const client = getSupabaseClient(accessToken);
    if (!client) throw new Error('Supabase client unavailable');

    const todayStr = new Date().toISOString().split('T')[0];
    const profileId = await getCurrentProfileId(accessToken);
    if (!profileId) throw new Error('Profile not found');

    const [medsRes, logsRes] = await Promise.all([
      client.from('medications').select('*').eq('profile_id', profileId),
      client.from('dose_logs').select('*').eq('profile_id', profileId).eq('date_string', todayStr),
    ]);

    const medications = medsRes.data || [];
    const logs = logsRes.data || [];
    const alreadyLogged = logs.some((l: any) => l.medication_id === medicationId);

    if (!alreadyLogged) {
      // Record a new dose logging entry with ISO timestamp and local date string.
      await client.from('dose_logs').insert({
        profile_id: profileId,
        medication_id: medicationId,
        date_string: todayStr,
        logged_at: new Date().toISOString(),
      });

      const { data: updatedLogs } = await client.from('dose_logs').select('*').eq('profile_id', profileId).eq('date_string', todayStr);
      const currentLogs = updatedLogs || [];
      // Evaluate if all scheduled medications for today have matching dose logs.
      const allTaken = medications.every((med: any) => currentLogs.some((l: any) => l.medication_id === med.id));

      if (allTaken) {
        const { data: profile } = await client.from('profiles').select('*').eq('id', profileId).single();
        if (profile) {
          // Increment the user's compliance streak and register today's completion in the weekly completed history array.
          const dayOfWeek = new Date().getDay();
          const updatedHistory = [...(profile.streak_history || Array(7).fill(false))];
          if (!updatedHistory[dayOfWeek]) {
            updatedHistory[dayOfWeek] = true;
            await client.from('profiles').update({ streak_history: updatedHistory, streak: (profile.streak || 0) + 1 }).eq('id', profileId);
          }
        }
      }
    }

    return getDashboardData(accessToken);
  }

  
  const db = await ensureDb();
  const todayStr = new Date().toISOString().split('T')[0];
  const alreadyLogged = db.logs.some(log => log.medicationId === medicationId && log.dateString === todayStr);

  if (!alreadyLogged) {
    db.logs.push({
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      medicationId,
      dateString: todayStr,
      loggedAt: new Date().toISOString(),
    });

    const allLoggedToday = db.medications.every(med => {
      if (med.id === medicationId) return true;
      return db.logs.some(log => log.medicationId === med.id && log.dateString === todayStr);
    });

    if (allLoggedToday) {
      const dayOfWeek = new Date().getDay();
      const updatedHistory = [...db.user.streakHistory];
      if (!updatedHistory[dayOfWeek]) {
        updatedHistory[dayOfWeek] = true;
        db.user.streakHistory = updatedHistory;
        db.user.streak += 1;
      }
    }

    await saveDb(db);
  }

  return getDashboardData();
}



export async function addHydration(amountLiters: number, accessToken?: string | null) {
  if (isSupabaseConfigured) {
    const client = getSupabaseClient(accessToken);
    if (!client) throw new Error('Supabase client unavailable');

    const profileId = await getCurrentProfileId(accessToken);
    if (!profileId) throw new Error('Profile not found');

    const { data: hydration } = await client.from('hydration').select('*').eq('profile_id', profileId).single();
    if (hydration) {
      // Add the intake increment and format as float to prevent JavaScript floating point inaccuracies (e.g. 0.1 + 0.2 = 0.30000000000000004).
      const nextCurrent = Math.min(Number(hydration.goal), parseFloat((Number(hydration.current) + amountLiters).toFixed(2)));
      await client.from('hydration').update({ current: nextCurrent }).eq('profile_id', profileId);
    }
    return getDashboardData(accessToken);
  }

  const db = await ensureDb();
  db.hydration.current = Math.min(db.hydration.goal, parseFloat((db.hydration.current + amountLiters).toFixed(2)));
  await saveDb(db);
  return getDashboardData();
}



export async function resetDatabase(accessToken?: string | null) {
  if (isSupabaseConfigured) {
    const client = getSupabaseClient(accessToken);
    if (!client) throw new Error('Supabase client unavailable');

    const profileId = await getCurrentProfileId(accessToken);
    if (!profileId) throw new Error('Profile not found');

    await Promise.all([
      client.from('dose_logs').delete().eq('profile_id', profileId),
      client.from('hydration').update({ current: 0 }).eq('profile_id', profileId),
    ]);

    return getDashboardData(accessToken);
  }

  await saveDb(DEFAULT_STATE);
  return getDashboardData();
}



export async function getPatientMedications(profileId: string, accessToken?: string | null): Promise<Medication[]> {
  if (isSupabaseConfigured) {
    const client = getSupabaseClient(accessToken);
    if (!client) return [];
    const todayStr = new Date().toISOString().split('T')[0];
    const [medsRes, logsRes] = await Promise.all([
      client.from('medications').select('*').eq('profile_id', profileId),
      client.from('dose_logs').select('*').eq('profile_id', profileId).eq('date_string', todayStr),
    ]);
    const meds = medsRes.data || [];
    const logs = logsRes.data || [];
    return meds.map((m: any) => mapDbMed(m, logs, todayStr));
  }
  const db = await ensureDb();
  return db.medications;
}



export async function getRawMedications(profileId: string, client?: any) {
  const c = client || supabase;
  if (!isSupabaseConfigured || !c) return [];
  const { data } = await c.from('medications').select('*').eq('profile_id', profileId);
  return data || [];
}

export async function getRawDoseLogs(profileId: string, daysBack = 7, client?: any) {
  const c = client || supabase;
  if (!isSupabaseConfigured || !c) return [];
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const sinceStr = since.toISOString().split('T')[0];
  const { data } = await c.from('dose_logs').select('*').eq('profile_id', profileId).gte('date_string', sinceStr).order('date_string', { ascending: true });
  return data || [];
}
