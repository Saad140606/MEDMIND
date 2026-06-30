// API endpoint retrieving all active/pending caregiver and doctor links for the authenticated client profile.
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createAuthenticatedClient } from '../../../lib/supabaseClient';
import { extractToken } from '../../../lib/auth';
import { getCurrentProfileId } from '../../../lib/db';

export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Connections require Supabase configuration' }, { status: 503 });
  }

  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createAuthenticatedClient(token);
  const myProfileId = await getCurrentProfileId(token);
  if (!myProfileId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { data: profile } = await client.from('profiles').select('role').eq('id', myProfileId).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // If request profile is a Caregiver, retrieve all linked patients mapping.
  if (profile.role === 'CAREGIVER') {
    const { data: links } = await client
      .from('caregiver_patient')
      .select('*, patient:patient_id(id,name,role)')
      .eq('caregiver_id', myProfileId);
    return NextResponse.json({ connections: links || [], role: 'CAREGIVER' });
  }

  // If request profile is a Doctor, retrieve all linked patients mapping.
  if (profile.role === 'DOCTOR') {
    const { data: links } = await client
      .from('doctor_patient')
      .select('*, patient:patient_id(id,name,role)')
      .eq('doctor_id', myProfileId);
    return NextResponse.json({ connections: links || [], role: 'DOCTOR' });
  }

  
  const [{ data: caregiverLinks }, { data: doctorLinks }] = await Promise.all([
    client.from('caregiver_patient').select('*, caregiver:caregiver_id(id,name,role)').eq('patient_id', myProfileId),
    client.from('doctor_patient').select('*, doctor:doctor_id(id,name,role)').eq('patient_id', myProfileId),
  ]);

  return NextResponse.json({ caregiverLinks: caregiverLinks || [], doctorLinks: doctorLinks || [], role: 'PATIENT' });
}
