// API endpoint resolving pending connection invites, enabling patients to approve or revoke linked caregiver/doctor access.
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createAuthenticatedClient } from '../../../../lib/supabaseClient';
import { extractToken } from '../../../../lib/auth';
import { getCurrentProfileId } from '../../../../lib/db';

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Requires Supabase configuration' }, { status: 503 });
  }

  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createAuthenticatedClient(token);
  const myProfileId = await getCurrentProfileId(token);
  if (!myProfileId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { connectionId, connectionType, action } = await request.json();
  
  

  if (!connectionId || !connectionType || !action) {
    return NextResponse.json({ error: 'connectionId, connectionType, and action are required' }, { status: 400 });
  }

  const newStatus = action === 'APPROVE' ? 'ACTIVE' : 'REVOKED';
  // Dynamically resolve target mapping table name ('caregiver_patient' vs 'doctor_patient') based on connection type.
  const table = connectionType === 'CAREGIVER' ? 'caregiver_patient' : 'doctor_patient';

  // Apply status updates to the resolved mapping table scoped to current user profile ID.
  const { error } = await client
    .from(table)
    .update({ status: newStatus })
    .eq('id', connectionId)
    .eq('patient_id', myProfileId); 

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, status: newStatus });
}
