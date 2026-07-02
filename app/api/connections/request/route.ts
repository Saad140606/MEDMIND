// API endpoint letting caregivers/doctors submit user connection requests and automatically post consent notifications to patients.
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createAuthenticatedClient } from '../../../../lib/supabaseClient';
import { extractToken } from '../../../../lib/authServer';
import { getCurrentProfileId } from '../../../../lib/db';

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Connection requests require Supabase configuration' }, { status: 503 });
  }

  const token = await extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createAuthenticatedClient(token);
  const myProfileId = await getCurrentProfileId(token);
  if (!myProfileId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  
  const { data: myProfile } = await client.from('profiles').select('role').eq('id', myProfileId).single();
  if (!myProfile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (myProfile.role === 'PATIENT') {
    return NextResponse.json({ error: 'Patients cannot initiate connection requests' }, { status: 403 });
  }

  const body = await request.json();
  const { patientEmail } = body;
  if (!patientEmail) return NextResponse.json({ error: 'patientEmail is required' }, { status: 400 });

  
  
  
  // Execute a Postgres RPC database function to search profiles safely by email address.
  const { data: patientProfileData, error: searchError } = await client
    .rpc('get_profile_by_email', { p_email: patientEmail })
    .maybeSingle();

  const patientProfile = patientProfileData as any;

  if (searchError || !patientProfile) {
    return NextResponse.json({ error: 'Patient not found with that email. They must have a MedMind account.' }, { status: 404 });
  }

  if (patientProfile.role !== 'PATIENT') {
    return NextResponse.json({ error: 'That account is not a Patient role' }, { status: 400 });
  }

  if (patientProfile.id === myProfileId) {
    return NextResponse.json({ error: 'Cannot connect to yourself' }, { status: 400 });
  }

  if (myProfile.role === 'CAREGIVER') {
    // Register caregiver-to-patient request entry in the relational mapping table.
    const { error } = await client.from('caregiver_patient').upsert({
      caregiver_id: myProfileId,
      patient_id: patientProfile.id,
      status: 'PENDING',
    }, { onConflict: 'caregiver_id,patient_id' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Send visual consent request notification alert to the target patient profile.
    try {
      await client.from('notifications').insert({
        recipient_profile_id: patientProfile.id,
        type: 'CONNECTION_REQUEST',
        payload: { from_profile_id: myProfileId, from_name: myProfile.role, connection_type: 'CAREGIVER' },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, message: 'Connection request sent to patient' });
  }

  if (myProfile.role === 'DOCTOR') {
    const { error } = await client.from('doctor_patient').upsert({
      doctor_id: myProfileId,
      patient_id: patientProfile.id,
      status: 'PENDING',
    }, { onConflict: 'doctor_id,patient_id' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    try {
      await client.from('notifications').insert({
        recipient_profile_id: patientProfile.id,
        type: 'CONNECTION_REQUEST',
        payload: { from_profile_id: myProfileId, from_name: myProfile.role, connection_type: 'DOCTOR' },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, message: 'Connection request sent to patient' });
  }

  return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
}
