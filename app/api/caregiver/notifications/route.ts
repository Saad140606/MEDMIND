// API endpoints to retrieve unread notification alerts for caregivers and mark them as acknowledged or read.
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, createAuthenticatedClient } from '../../../../lib/supabaseClient';
import { extractToken } from '../../../../lib/auth';
import { getCurrentProfileId } from '../../../../lib/db';

export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Requires Supabase configuration' }, { status: 503 });
  }

  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createAuthenticatedClient(token);
  const myProfileId = await getCurrentProfileId(token);
  if (!myProfileId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { data: notifications } = await client
    .from('notifications')
    .select('*')
    .eq('recipient_profile_id', myProfileId)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({ notifications: notifications || [] });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Requires Supabase configuration' }, { status: 503 });
  }

  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createAuthenticatedClient(token);
  const myProfileId = await getCurrentProfileId(token);
  if (!myProfileId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { notificationId } = await request.json();

  // Mark specified notification record as acknowledged by updating its read status.
  await client
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('recipient_profile_id', myProfileId);

  return NextResponse.json({ success: true });
}
