// API endpoint fetching all active patient profiles currently assigned to the requesting clinician.
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createAuthenticatedClient } from '../../../../lib/supabaseClient';
import { extractToken } from '../../../../lib/authServer';
import { getCurrentProfileId } from '../../../../lib/db';

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
  if (!myProfile || myProfile.role !== 'DOCTOR') {
    return NextResponse.json({ error: 'Doctor access required' }, { status: 403 });
  }

  // Query all active connections linking this doctor's profile to patients.
  const { data: links } = await client
    .from('doctor_patient')
    .select('patient_id, status, patient:patient_id(id, name, phone)')
    .eq('doctor_id', myProfileId)
    .eq('status', 'ACTIVE');

  const patients = (links || []).map((l: any) => ({
    id: l.patient_id,
    name: l.patient?.name || 'Unknown',
    phone: l.patient?.phone || null,
  }));

  return NextResponse.json({ patients });
}
