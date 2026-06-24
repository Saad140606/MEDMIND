import fs from 'fs/promises';
import path from 'path';
import { supabase, isSupabaseConfigured } from './supabaseClient';

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
  name: string;
  streak: number;
  streakHistory: boolean[];
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
  dateString: string; // YYYY-MM-DD
  loggedAt: string; // ISO string
}

export interface DatabaseState {
  user: UserProfile;
  medications: Medication[];
  hydration: HydrationData;
  refills: RefillData;
  logs: DoseLog[];
}

const DB_FILE = path.join(process.cwd(), 'db.json');

const DEFAULT_STATE: DatabaseState = {
  user: {
    name: "Ahmed",
    streak: 12,
    streakHistory: [true, true, true, true, true, false, false], // Sun to Sat
  },
  medications: [
    { id: 1, name: "Aspirin 81mg", icon: "💊", color: "#e84a5f", time: "08:00 AM", status: "taken", iconBg: "#2a0f14", requiresLock: false },
    { id: 2, name: "Vitamin D 1000IU", icon: "☀️", color: "#f59e0b", time: "10:00 AM", status: "taken", iconBg: "#2a1f0a", requiresLock: false },
    { id: 3, name: "Metformin 500mg", icon: "🔵", color: "#3b82f6", time: "02:00 PM", status: "due", iconBg: "#0a1530", requiresLock: true },
    { id: 4, name: "Lisinopril 10mg", icon: "⚙️", color: "#8b5cf6", time: "08:00 PM", status: "upcoming", iconBg: "#1a1030", requiresLock: false },
  ],
  hydration: {
    current: 1.2,
    goal: 2.5
  },
  refills: {
    pending: 2
  },
  logs: [
    // Pre-populate with Aspirin and Vitamin D logged today
    {
      id: "log-1",
      medicationId: 1,
      dateString: new Date().toISOString().split('T')[0],
      loggedAt: new Date().toISOString()
    },
    {
      id: "log-2",
      medicationId: 2,
      dateString: new Date().toISOString().split('T')[0],
      loggedAt: new Date().toISOString()
    }
  ]
};

// Ensure DB is initialized
async function ensureDb(): Promise<DatabaseState> {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, create it with default state
    await fs.writeFile(DB_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
    return DEFAULT_STATE;
  }
}

async function saveDb(state: DatabaseState): Promise<void> {
  await fs.writeFile(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// Helper to determine status dynamically based on current time
function getMedicationStatus(timeStr: string, isLogged: boolean, requiresLock: boolean): 'taken' | 'due' | 'upcoming' {
  if (isLogged) return 'taken';
  try {
    const parts = timeStr.split(' ');
    const time = parts[0];
    const modifier = parts[1];
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    
    const now = new Date();
    const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    
    return now >= scheduled ? 'due' : 'upcoming';
  } catch (e) {
    return requiresLock ? 'due' : 'due';
  }
}

// Automatic self-seeding for Supabase if the tables are empty
async function ensureSupabaseData(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data: profiles, error: pError } = await supabase.from('profiles').select('id').limit(1);
    if (pError) {
      console.error('Supabase checking profiles error:', pError);
      return;
    }
    if (!profiles || profiles.length === 0) {
      console.log('Supabase database is empty. Autoseeding default data...');
      
      const { data: profile, error: uError } = await supabase.from('profiles').insert({
        name: "Ahmed",
        streak: 12,
        streak_history: [true, true, true, true, true, false, false]
      }).select().single();
      
      if (uError || !profile) {
        console.error('Error seeding profile:', uError);
        return;
      }
      
      const { data: meds, error: mError } = await supabase.from('medications').insert([
        { profile_id: profile.id, name: "Aspirin 81mg", icon: "💊", color: "#e84a5f", time: "08:00 AM", requires_lock: false, icon_bg: "#2a0f14" },
        { profile_id: profile.id, name: "Vitamin D 1000IU", icon: "☀️", color: "#f59e0b", time: "10:00 AM", requires_lock: false, icon_bg: "#2a1f0a" },
        { profile_id: profile.id, name: "Metformin 500mg", icon: "🔵", color: "#3b82f6", time: "02:00 PM", requires_lock: true, icon_bg: "#0a1530" },
        { profile_id: profile.id, name: "Lisinopril 10mg", icon: "⚙️", color: "#8b5cf6", time: "08:00 PM", requires_lock: false, icon_bg: "#1a1030" }
      ]).select();
      
      if (mError || !meds) {
        console.error('Error seeding medications:', mError);
        return;
      }
      
      await supabase.from('hydration').insert({
        profile_id: profile.id,
        current: 1.2,
        goal: 2.5
      });
      
      await supabase.from('refills').insert({
        profile_id: profile.id,
        pending: 2
      });

      const aspirin = meds.find((m: any) => m.name.includes("Aspirin"));
      const vitD = meds.find((m: any) => m.name.includes("Vitamin D"));
      const todayStr = new Date().toISOString().split('T')[0];
      
      const logsToInsert = [];
      if (aspirin) {
        logsToInsert.push({ profile_id: profile.id, medication_id: aspirin.id, date_string: todayStr, logged_at: new Date().toISOString() });
      }
      if (vitD) {
        logsToInsert.push({ profile_id: profile.id, medication_id: vitD.id, date_string: todayStr, logged_at: new Date().toISOString() });
      }
      if (logsToInsert.length > 0) {
        await supabase.from('dose_logs').insert(logsToInsert);
      }
      
      console.log('Supabase database autoseeded successfully!');
    }
  } catch (error) {
    console.error('Failed to ensure Supabase database state:', error);
  }
}

export async function getDashboardData() {
  if (isSupabaseConfigured) {
    await ensureSupabaseData();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const [profileRes, medsRes, hydRes, refRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('*').limit(1).maybeSingle(),
      supabase.from('medications').select('*').order('id', { ascending: true }),
      supabase.from('hydration').select('*').limit(1).maybeSingle(),
      supabase.from('refills').select('*').limit(1).maybeSingle(),
      supabase.from('dose_logs').select('*').eq('date_string', todayStr)
    ]);

    const profile = profileRes.data || { name: 'Ahmed', streak: 12, streak_history: [true, true, true, true, true, false, false] };
    const medications = medsRes.data || [];
    const hydration = hydRes.data || { current: 1.2, goal: 2.5 };
    const refills = refRes.data || { pending: 2 };
    const logs = logsRes.data || [];

    const updatedMedications = medications.map((med: any) => {
      const isLoggedToday = logs.some((log: any) => log.medication_id === med.id);
      const currentStatus = getMedicationStatus(med.time, isLoggedToday, med.requires_lock);
      return {
        id: med.id,
        name: med.name,
        icon: med.icon,
        color: med.color,
        time: med.time,
        status: currentStatus,
        iconBg: med.icon_bg,
        requiresLock: med.requires_lock
      };
    });

    const total = updatedMedications.length;
    const taken = updatedMedications.filter((m: any) => m.status === 'taken').length;
    const percent = total > 0 ? Math.round((taken / total) * 100) : 0;

    return {
      user: {
        name: profile.name,
        streak: profile.streak,
        streakHistory: profile.streak_history
      },
      medications: updatedMedications,
      hydration: {
        current: Number(hydration.current),
        goal: Number(hydration.goal)
      },
      refills: {
        pending: refills.pending
      },
      adherence: {
        percent,
        taken,
        total
      }
    };
  }

  // Fallback to local db.json
  const db = await ensureDb();
  const todayStr = new Date().toISOString().split('T')[0];

  const updatedMedications = db.medications.map(med => {
    const isLoggedToday = db.logs.some(log => log.medicationId === med.id && log.dateString === todayStr);
    const currentStatus = getMedicationStatus(med.time, isLoggedToday, med.requiresLock);
    return {
      ...med,
      status: currentStatus
    };
  });

  const total = updatedMedications.length;
  const taken = updatedMedications.filter(m => m.status === 'taken').length;
  const percent = total > 0 ? Math.round((taken / total) * 100) : 0;

  return {
    user: db.user,
    medications: updatedMedications,
    hydration: db.hydration,
    refills: db.refills,
    adherence: {
      percent,
      taken,
      total
    }
  };
}

export async function logDose(medicationId: number) {
  if (isSupabaseConfigured) {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const [profileRes, medsRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('*').limit(1).maybeSingle(),
      supabase.from('medications').select('*').order('id', { ascending: true }),
      supabase.from('dose_logs').select('*').eq('date_string', todayStr)
    ]);
    
    const profile = profileRes.data;
    const medications = medsRes.data || [];
    const logs = logsRes.data || [];
    
    if (profile) {
      const alreadyLogged = logs.some((l: any) => l.medication_id === medicationId);
      if (!alreadyLogged) {
        await supabase.from('dose_logs').insert({
          profile_id: profile.id,
          medication_id: medicationId,
          date_string: todayStr,
          logged_at: new Date().toISOString()
        });
        
        // Re-fetch today's logs to verify if all meds are taken
        const { data: updatedLogs } = await supabase.from('dose_logs').select('*').eq('date_string', todayStr);
        const currentLogs = updatedLogs || [];
        
        const allTaken = medications.every((med: any) => 
          currentLogs.some((l: any) => l.medication_id === med.id)
        );
        
        if (allTaken) {
          const dayOfWeek = new Date().getDay();
          const updatedHistory = [...profile.streak_history];
          if (!updatedHistory[dayOfWeek]) {
            updatedHistory[dayOfWeek] = true;
            await supabase.from('profiles').update({
              streak_history: updatedHistory,
              streak: profile.streak + 1
            }).eq('id', profile.id);
          }
        }
      }
    }
    return getDashboardData();
  }

  // Fallback to local db.json
  const db = await ensureDb();
  const todayStr = new Date().toISOString().split('T')[0];

  const alreadyLogged = db.logs.some(log => log.medicationId === medicationId && log.dateString === todayStr);
  
  if (!alreadyLogged) {
    db.logs.push({
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      medicationId,
      dateString: todayStr,
      loggedAt: new Date().toISOString()
    });

    const allMeds = db.medications;
    const allLoggedToday = allMeds.every(med => {
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

export async function addHydration(amountLiters: number) {
  if (isSupabaseConfigured) {
    const { data: hydration } = await supabase.from('hydration').select('*').limit(1).maybeSingle();
    if (hydration) {
      const nextCurrent = Math.min(Number(hydration.goal), parseFloat((Number(hydration.current) + amountLiters).toFixed(2)));
      await supabase.from('hydration').update({ current: nextCurrent }).eq('profile_id', hydration.profile_id);
    }
    return getDashboardData();
  }

  // Fallback to local db.json
  const db = await ensureDb();
  db.hydration.current = Math.min(db.hydration.goal, parseFloat((db.hydration.current + amountLiters).toFixed(2)));
  await saveDb(db);
  return getDashboardData();
}

export async function resetDatabase() {
  if (isSupabaseConfigured) {
    const { data: profile } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
    if (profile) {
      await Promise.all([
        supabase.from('dose_logs').delete().eq('profile_id', profile.id),
        supabase.from('medications').delete().eq('profile_id', profile.id),
        supabase.from('hydration').delete().eq('profile_id', profile.id),
        supabase.from('refills').delete().eq('profile_id', profile.id),
      ]);
      await supabase.from('profiles').delete().eq('id', profile.id);
    }
    await ensureSupabaseData();
    return getDashboardData();
  }

  // Fallback to local db.json
  await saveDb(DEFAULT_STATE);
  return getDashboardData();
}
