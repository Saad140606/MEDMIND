// API endpoint generating historical adherence timelines and individual medication percentage reports for clinician review.
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createAuthenticatedClient } from '../../../../lib/supabaseClient';
import { extractToken } from '../../../../lib/authServer';
import { getCurrentProfileId } from '../../../../lib/db';
import { computeAdherenceFromRaw, computePerMedAdherence } from '../../../../lib/adherence';

export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Requires Supabase configuration' }, { status: 503 });
  }

  const token = await extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createAuthenticatedClient(token);
  const myProfileId = await getCurrentProfileId(token);
  if (!myProfileId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  const days = Math.min(Number(searchParams.get('days') || '7'), 30);

  if (!patientId) return NextResponse.json({ error: 'patientId is required' }, { status: 400 });

  
  // Verify that an ACTIVE relationship exists between the requesting doctor and the patient.
  const { data: link } = await client
    .from('doctor_patient')
    .select('id')
    .eq('doctor_id', myProfileId)
    .eq('patient_id', patientId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (!link) return NextResponse.json({ error: 'No active link with this patient' }, { status: 403 });

  
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];

  const [medsRes, logsRes, profileRes] = await Promise.all([
    client.from('medications').select('id, name, icon, color, time').eq('profile_id', patientId).order('id', { ascending: true }),
    client.from('dose_logs').select('medication_id, date_string').eq('profile_id', patientId).gte('date_string', sinceStr).order('date_string', { ascending: true }),
    client.from('profiles').select('name, streak, streak_history').eq('id', patientId).single(),
  ]);

  const medications = medsRes.data || [];
  const rawLogs = logsRes.data || [];
  const profile = profileRes.data;

  
  const medicationMap: Record<number, string> = {};
  medications.forEach((m: any) => { medicationMap[m.id] = m.name; });

  const medNames = medications.map((m: any) => m.name);
  const chartData = computeAdherenceFromRaw(medNames, rawLogs, medicationMap, days);
  const medicationBreakdown = computePerMedAdherence(
    medications.map((m: any) => ({ id: m.id, name: m.name })),
    rawLogs,
    days
  );

  return NextResponse.json({
    patientName: profile?.name || 'Unknown',
    streak: profile?.streak || 0,
    streakHistory: profile?.streak_history || Array(7).fill(false),
    chartData,
    medicationBreakdown,
    medications,
    days,
  });
}
