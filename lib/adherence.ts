// Core utility functions for computing daily/weekly patient medication adherence metrics and detecting missed doses.
import type { Medication, DoseLog } from './db';

export interface AdherenceResult {
  percent: number;
  taken: number;
  total: number;
}

export interface MissedMedication {
  id: number;
  name: string;
  time: string;
  scheduledMinutesAgo: number;
}





export function computeAdherence(
  medications: Medication[],
  logs: DoseLog[],
  daysBack = 1
): AdherenceResult {
  if (medications.length === 0) return { percent: 0, taken: 0, total: 0 };

  if (daysBack <= 1) {
    // Single day evaluation: match log entries for today against active medications list.
    const todayStr = new Date().toISOString().split('T')[0];
    const total = medications.length;
    const taken = medications.filter(med =>
      logs.some(log => log.medicationId === med.id && log.dateString === todayStr)
    ).length;
    const percent = total > 0 ? Math.round((taken / total) * 100) : 0;
    return { percent, taken, total };
  }

  // Multi-day evaluation: generate array of local date strings for the requested window.
  const dates: string[] = [];
  for (let i = 0; i < daysBack; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const total = medications.length * dates.length;
  let taken = 0;
  for (const dateStr of dates) {
    for (const med of medications) {
      if (logs.some(log => log.medicationId === med.id && log.dateString === dateStr)) {
        taken++;
      }
    }
  }

  const percent = total > 0 ? Math.round((taken / total) * 100) : 0;
  return { percent, taken, total };
}





export function computeMissed(medications: Medication[], logs: DoseLog[]): MissedMedication[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const missed: MissedMedication[] = [];

  for (const med of medications) {
    
    const isLogged = logs.some(log => log.medicationId === med.id && log.dateString === todayStr);
    if (isLogged) continue;

    
    try {
      // Decode 12-hour formatted medication times to 24-hour hour and minute parts.
      const parts = med.time.split(' ');
      const [timeStr, modifier] = parts;
      let [hours, minutes] = timeStr.split(':').map(Number);
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;

      // Project scheduled dose time onto today's date and find elapsed minutes since scheduled trigger.
      const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
      const minutesAgo = Math.floor((now.getTime() - scheduled.getTime()) / 60000);

      // Flag as missed if the scheduled intake window elapsed more than 60 minutes ago.
      if (minutesAgo >= 60) {
        missed.push({ id: med.id, name: med.name, time: med.time, scheduledMinutesAgo: minutesAgo });
      }
    } catch {
      
    }
  }

  return missed;
}





export function computeAdherenceFromRaw(
  medNames: string[],
  rawLogs: Array<{ medication_id: number; date_string: string }>,
  medicationMap: Record<number, string>, 
  daysBack: number
): Array<{ day: string; adherence: number }> {
  const result: Array<{ day: string; adherence: number }> = [];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = daysBack <= 7
      ? dayLabels[d.getDay()]
      : dateStr.slice(5); 

    const total = medNames.length;
    if (total === 0) {
      result.push({ day: dayLabel, adherence: 0 });
      continue;
    }

    const logsForDay = rawLogs.filter(l => l.date_string === dateStr);
    const uniqueMedsLogged = new Set(logsForDay.map(l => l.medication_id));
    const taken = [...uniqueMedsLogged].filter(id => medicationMap[id] !== undefined).length;
    const adherence = Math.round((taken / total) * 100);
    result.push({ day: dayLabel, adherence });
  }

  return result;
}




export function computePerMedAdherence(
  medications: Array<{ id: number; name: string }>,
  rawLogs: Array<{ medication_id: number; date_string: string }>,
  daysBack: number
): Array<{ name: string; percent: number; taken: number; total: number }> {
  return medications.map(med => {
    const total = daysBack;
    const taken = rawLogs.filter(l => l.medication_id === med.id).length;
    const percent = total > 0 ? Math.round((Math.min(taken, total) / total) * 100) : 0;
    return { name: med.name, percent, taken, total };
  });
}
