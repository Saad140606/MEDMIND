// API endpoint compiling medication schedules, adherence metrics, and missed doses of active patients linked to a caregiver.
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createAuthenticatedClient } from '../../../../lib/supabaseClient';
import { extractToken } from '../../../../lib/authServer';
import { getCurrentProfileId, getMedicationStatus } from '../../../../lib/db';
import { computeMissed, computeAdherence } from '../../../../lib/adherence';
import type { Medication, DoseLog } from '../../../../lib/db';

export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Requires Supabase configuration', requiresSupabase: true }, { status: 503 });
  }

  const token = await extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createAuthenticatedClient(token);
  const myProfileId = await getCurrentProfileId(token);
  if (!myProfileId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  
  const { data: myProfile } = await client.from('profiles').select('role').eq('id', myProfileId).single();
  if (!myProfile || myProfile.role !== 'CAREGIVER') {
    return NextResponse.json({ error: 'Caregiver access required' }, { status: 403 });
  }

  
  const { data: links } = await client
    .from('caregiver_patient')
    .select('patient_id, status')
    .eq('caregiver_id', myProfileId);

  // Categorize active connections and check for outstanding pending invitations.
  const allLinks = links || [];
  const patientIds = allLinks.filter((l: any) => l.status === 'ACTIVE').map((l: any) => l.patient_id);
  const pendingLinks = allLinks.filter((l: any) => l.status === 'PENDING');

  if (patientIds.length === 0) {
    return NextResponse.json({ patients: [], pendingCount: pendingLinks.length });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  
  // Batch queries run in parallel for every single connected patient to collect schedules, logs, and compliance streaks.
  const patientsData = await Promise.all(
    patientIds.map(async (patientId: string) => {
      const [profileRes, medsRes, logsRes, weekLogsRes] = await Promise.all([
        client.from('profiles').select('id, name, role, phone, streak, streak_history, user_id').eq('id', patientId).single(),
        client.from('medications').select('*').eq('profile_id', patientId).order('id', { ascending: true }),
        client.from('dose_logs').select('*').eq('profile_id', patientId).eq('date_string', todayStr),
        client.from('dose_logs').select('*').eq('profile_id', patientId).order('date_string', { ascending: false }).limit(70),
      ]);

      const profile = profileRes.data;
      const rawMeds = medsRes.data || [];
      const todayLogs = logsRes.data || [];
      const weekLogs = weekLogsRes.data || [];

      
      const medications: Medication[] = rawMeds.map((m: any) => ({
        id: m.id,
        name: m.name,
        icon: m.icon,
        color: m.color,
        time: m.time,
        status: getMedicationStatus(m.time, todayLogs.some((l: any) => l.medication_id === m.id)),
        iconBg: m.icon_bg,
        requiresLock: m.requires_lock,
      }));

      const doseLogs: DoseLog[] = weekLogs.map((l: any) => ({
        id: l.id,
        medicationId: l.medication_id,
        dateString: l.date_string,
        loggedAt: l.logged_at,
      }));

      const todayDoseLogs: DoseLog[] = todayLogs.map((l: any) => ({
        id: l.id,
        medicationId: l.medication_id,
        dateString: l.date_string,
        loggedAt: l.logged_at,
      }));

      const todayAdherence = computeAdherence(medications, todayDoseLogs, 1);
      const weekAdherence = computeAdherence(medications, doseLogs, 7);
      const missed = computeMissed(medications, todayDoseLogs);

      return {
        id: patientId,
        name: profile?.name || 'Unknown',
        phone: profile?.phone || null,
        streak: profile?.streak || 0,
        streakHistory: profile?.streak_history || Array(7).fill(false),
        medications,
        todayAdherence,
        weekAdherence,
        missed,
        lastUpdated: new Date().toISOString(),
      };
    })
  );

  return NextResponse.json({ patients: patientsData, pendingCount: pendingLinks.length });
}
