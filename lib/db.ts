import fs from 'fs/promises';
import path from 'path';

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

export async function getDashboardData() {
  const db = await ensureDb();
  const todayStr = new Date().toISOString().split('T')[0];

  // Map database logs to current daily status dynamically
  const updatedMedications = db.medications.map(med => {
    const isLoggedToday = db.logs.some(log => log.medicationId === med.id && log.dateString === todayStr);
    
    // Determine status
    let currentStatus = med.status;
    if (isLoggedToday) {
      currentStatus = 'taken';
    } else {
      // If it was marked as taken in static state but no log exists, resolve back to original non-taken state
      if (med.status === 'taken') {
        // If it is past its time, make it due, else upcoming
        // For simple mockup matching, we keep it as 'due' if it's not logged
        currentStatus = med.requiresLock ? 'due' : 'due';
      }
    }

    return {
      ...med,
      status: currentStatus as 'taken' | 'due' | 'upcoming'
    };
  });

  // Calculate adherence
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
  const db = await ensureDb();
  const todayStr = new Date().toISOString().split('T')[0];

  // Check if already logged today to prevent duplicates
  const alreadyLogged = db.logs.some(log => log.medicationId === medicationId && log.dateString === todayStr);
  
  if (!alreadyLogged) {
    db.logs.push({
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      medicationId,
      dateString: todayStr,
      loggedAt: new Date().toISOString()
    });

    // Check if ALL medications are taken today to update streak or streakHistory
    const allMeds = db.medications;
    const allLoggedToday = allMeds.every(med => {
      if (med.id === medicationId) return true; // Just logged this one
      return db.logs.some(log => log.medicationId === med.id && log.dateString === todayStr);
    });

    if (allLoggedToday) {
      // Update today's slot in streakHistory
      const dayOfWeek = new Date().getDay(); // 0 is Sunday, 6 is Saturday
      const updatedHistory = [...db.user.streakHistory];
      if (!updatedHistory[dayOfWeek]) {
        updatedHistory[dayOfWeek] = true;
        db.user.streakHistory = updatedHistory;
        db.user.streak += 1; // Increment streak if it wasn't already marked
      }
    }

    await saveDb(db);
  }

  return getDashboardData();
}

export async function addHydration(amountLiters: number) {
  const db = await ensureDb();
  db.hydration.current = Math.min(db.hydration.goal, parseFloat((db.hydration.current + amountLiters).toFixed(2)));
  await saveDb(db);
  return getDashboardData();
}

export async function resetDatabase() {
  await saveDb(DEFAULT_STATE);
  return getDashboardData();
}
