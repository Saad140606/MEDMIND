// Scheduled automated job scans patient schedules, identifies overdue doses, and alerts connected caregivers.
import { NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getMedicationStatus } from '../../../../lib/db';



export async function GET(request: Request) {
  
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Service Role Key unconfigured — skipping cron' }, { status: 500 });
  }

  // Use the administrative client to bypass RLS restrictions since this cron job runs as an internal system worker.
  const client = supabaseAdmin;

  const todayStr = new Date().toISOString().split('T')[0];
  let notificationsCreated = 0;

  try {
    
    const { data: patients, error: pError } = await client
      .from('profiles')
      .select('id, name')
      .eq('role', 'PATIENT');

    if (pError || !patients) {
      console.error('Cron: failed to fetch patients:', pError);
      return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
    }

    for (const patient of patients) {
      // Parallelize medication list and completed logs fetches for each patient.
      const [{ data: meds }, { data: logs }] = await Promise.all([
        client.from('medications').select('*').eq('profile_id', patient.id),
        client.from('dose_logs').select('medication_id').eq('profile_id', patient.id).eq('date_string', todayStr),
      ]);

      const medications = meds || [];
      const loggedMedIds = new Set((logs || []).map((l: any) => l.medication_id));

      // Filter out medications that have not been logged today and are overdue by 60+ minutes.
      const missedMeds = medications.filter((med: any) => {
        if (loggedMedIds.has(med.id)) return false;
        const status = getMedicationStatus(med.time, false);
        if (status !== 'due') return false; 

        try {
          const parts = med.time.split(' ');
          let [hours, minutes] = parts[0].split(':').map(Number);
          if (parts[1] === 'PM' && hours < 12) hours += 12;
          if (parts[1] === 'AM' && hours === 12) hours = 0;

          const now = new Date();
          const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
          const minutesAgo = Math.floor((now.getTime() - scheduled.getTime()) / 60000);
          return minutesAgo >= 60;
        } catch {
          return false;
        }
      });

      if (missedMeds.length === 0) continue;

      
      // Query all caregivers connected to this patient to check where to route alerts.
      const { data: caregiverLinks } = await client
        .from('caregiver_patient')
        .select('caregiver_id')
        .eq('patient_id', patient.id)
        .eq('status', 'ACTIVE');

      if (!caregiverLinks || caregiverLinks.length === 0) continue;

      
      for (const med of missedMeds) {
        for (const link of caregiverLinks) {
          
          // Prevent notification spam: query database to verify that this missed dose alert has not already been generated today.
          const { data: existing } = await client
            .from('notifications')
            .select('id')
            .eq('recipient_profile_id', link.caregiver_id)
            .eq('type', 'MISSED_DOSE')
            .contains('payload', { patient_id: patient.id, medication_id: med.id, date: todayStr })
            .maybeSingle();

          if (existing) continue; 

          await client.from('notifications').insert({
            recipient_profile_id: link.caregiver_id,
            type: 'MISSED_DOSE',
            payload: {
              patient_id: patient.id,
              patient_name: patient.name,
              medication_id: med.id,
              medication_name: med.name,
              scheduled_time: med.time,
              date: todayStr,
            },
          });
          notificationsCreated++;

          
        }
      }
    }

    return NextResponse.json({ success: true, notificationsCreated });
  } catch (err: any) {
    console.error('Cron check-missed-doses error:', err);
    return NextResponse.json({ error: err.message || 'Cron failed' }, { status: 500 });
  }
}
