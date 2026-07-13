// Next.js API route handling server-side user registration, profile creation, and default patient data seeding.
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { email, password, name, role, phone } = await request.json();

    if (!email || !password || !name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!supabase || !supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase client is not configured' }, { status: 503 });
    }

    // 1. Register the user in Supabase auth (this triggers confirmation email if enabled in Supabase settings)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const user = authData.user;
    if (!user) {
      return NextResponse.json({ error: 'Signup failed — no user returned' }, { status: 400 });
    }

    // 2. Create the user profile in public.profiles using supabaseAdmin to bypass RLS policies
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: user.id,
        name,
        role,
        phone: phone || null,
        streak: 0,
        streak_history: [false, false, false, false, false, false, false],
      })
      .select()
      .single();

    if (profileError) {
      // Rollback auth user creation if profile insertion fails
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    // 3. Seed initial metrics if the role is PATIENT
    if (role === 'PATIENT') {
      try {
        await Promise.all([
          supabaseAdmin.from('medications').insert([
            { profile_id: profile.id, name: 'Aspirin 81mg', dosage: '81mg', icon: '💊', color: '#e84a5f', time: '08:00 AM', requires_lock: false, icon_bg: '#2a0f14' },
            { profile_id: profile.id, name: 'Vitamin D 1000IU', dosage: '1000IU', icon: '☀️', color: '#f59e0b', time: '10:00 AM', requires_lock: false, icon_bg: '#2a1f0a' },
            { profile_id: profile.id, name: 'Metformin 500mg', dosage: '500mg', icon: '🔵', color: '#3b82f6', time: '02:00 PM', requires_lock: true, icon_bg: '#0a1530' },
            { profile_id: profile.id, name: 'Lisinopril 10mg', dosage: '10mg', icon: '⚙️', color: '#8b5cf6', time: '08:00 PM', requires_lock: false, icon_bg: '#1a1030' },
          ]),
          supabaseAdmin.from('hydration').insert({ profile_id: profile.id, current: 0, goal: 2.5 }),
          supabaseAdmin.from('refills').insert({ profile_id: profile.id, pending: 0 })
        ]);
      } catch (seedError: any) {
        console.error('Error seeding patient data:', seedError);
        // We log the seeding error but do not break the signup process as the user and profile are already created.
      }
    }

    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    console.error('Signup API error:', err);
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}
