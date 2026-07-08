// Automated cron endpoint that performs database read, write, and cleanup operations on a schedule
// to generate active PostgreSQL database traffic and prevent Supabase project pausing.
import { NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(request: Request) {
  // Optional security check if CRON_SECRET is configured
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Service Role Key unconfigured' }, { status: 500 });
  }

  const client = supabaseAdmin;
  const heartbeatStatuses = [
    'system_active',
    'heartbeat_pulse_ok',
    'database_ping_successful',
    'routine_maintenance_check',
    'service_healthy'
  ];
  const randomStatus = heartbeatStatuses[Math.floor(Math.random() * heartbeatStatuses.length)];

  try {
    // 1. Write Activity: Insert new heartbeat
    const { data: inserted, error: insertError } = await client
      .from('heartbeats')
      .insert({ status: randomStatus })
      .select()
      .single();

    if (insertError) {
      console.error('Heartbeat insert failed:', insertError);
      return NextResponse.json({ error: 'Database write failed', details: insertError }, { status: 500 });
    }

    // 2. Read Activity: Fetch recent heartbeats
    const { data: recent, error: readError } = await client
      .from('heartbeats')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (readError) {
      console.error('Heartbeat read failed:', readError);
      return NextResponse.json({ error: 'Database read failed', details: readError }, { status: 500 });
    }

    // 3. Cleanup Activity: Delete heartbeat records older than 24 hours to prevent table bloat
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: deleteError } = await client
      .from('heartbeats')
      .delete()
      .lt('created_at', oneDayAgo);

    if (deleteError) {
      console.warn('Heartbeat cleanup failed:', deleteError);
    }

    return NextResponse.json({
      success: true,
      message: 'Database activity simulated successfully',
      inserted: inserted,
      recent_heartbeats: recent,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Heartbeat cron exception:', err);
    return NextResponse.json({ error: err.message || 'Heartbeat cron failed' }, { status: 500 });
  }
}
