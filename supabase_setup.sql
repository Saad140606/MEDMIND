-- MedMind Database Setup Script
-- Execute this script in your Supabase SQL Editor (https://supabase.com)

-- 1. Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS public.dose_logs CASCADE;
DROP TABLE IF EXISTS public.medications CASCADE;
DROP TABLE IF EXISTS public.hydration CASCADE;
DROP TABLE IF EXISTS public.refills CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. Create Profiles Table (Patient/User Profile)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    streak INTEGER DEFAULT 0 NOT NULL,
    streak_history BOOLEAN[] DEFAULT ARRAY[false, false, false, false, false, false, false] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create Medications Table
CREATE TABLE public.medications (
    id SERIAL PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    time TEXT NOT NULL, -- e.g., "08:00 AM"
    requires_lock BOOLEAN DEFAULT false NOT NULL,
    icon_bg TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Create Hydration Table
CREATE TABLE public.hydration (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    current NUMERIC(4, 2) DEFAULT 0.00 NOT NULL,
    goal NUMERIC(4, 2) DEFAULT 2.50 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Create Refills Table
CREATE TABLE public.refills (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    pending INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. Create Dose Logs Table
CREATE TABLE public.dose_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    medication_id INTEGER NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    date_string TEXT NOT NULL, -- YYYY-MM-DD format for local daily checks
    logged_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. Add Performance & Search Indexes
CREATE INDEX idx_dose_logs_date ON public.dose_logs(date_string);
CREATE INDEX idx_medications_profile ON public.medications(profile_id);
CREATE INDEX idx_dose_logs_medication ON public.dose_logs(medication_id);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hydration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dose_logs ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS Policies for Development (Public CRUD Access)
-- Note: In a production environment, restrict these using auth.uid() checks.
-- For local prototyping and testing, we permit public access via anon key.

CREATE POLICY "Allow public select on profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert on profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on profiles" ON public.profiles FOR UPDATE USING (true);

CREATE POLICY "Allow public select on medications" ON public.medications FOR SELECT USING (true);
CREATE POLICY "Allow public insert on medications" ON public.medications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on medications" ON public.medications FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on medications" ON public.medications FOR DELETE USING (true);

CREATE POLICY "Allow public select on hydration" ON public.hydration FOR SELECT USING (true);
CREATE POLICY "Allow public insert on hydration" ON public.hydration FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on hydration" ON public.hydration FOR UPDATE USING (true);

CREATE POLICY "Allow public select on refills" ON public.refills FOR SELECT USING (true);
CREATE POLICY "Allow public insert on refills" ON public.refills FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on refills" ON public.refills FOR UPDATE USING (true);

CREATE POLICY "Allow public select on dose_logs" ON public.dose_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on dose_logs" ON public.dose_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete on dose_logs" ON public.dose_logs FOR DELETE USING (true);

-- 10. Seed Initial Data for Demo Patient (Ahmed)
DO $$
DECLARE
    new_profile_id UUID;
    aspirin_id INTEGER;
    vitd_id INTEGER;
    today_str TEXT := to_char(now(), 'YYYY-MM-DD');
BEGIN
    -- A. Seed Patient Profile
    INSERT INTO public.profiles (name, streak, streak_history)
    VALUES ('Ahmed', 12, ARRAY[true, true, true, true, true, false, false])
    RETURNING id INTO new_profile_id;

    -- B. Seed Medications
    INSERT INTO public.medications (profile_id, name, icon, color, time, requires_lock, icon_bg)
    VALUES 
        (new_profile_id, 'Aspirin 81mg', '💊', '#e84a5f', '08:00 AM', false, '#2a0f14')
        RETURNING id INTO aspirin_id;

    INSERT INTO public.medications (profile_id, name, icon, color, time, requires_lock, icon_bg)
    VALUES 
        (new_profile_id, 'Vitamin D 1000IU', '☀️', '#f59e0b', '10:00 AM', false, '#2a1f0a')
        RETURNING id INTO vitd_id;

    INSERT INTO public.medications (profile_id, name, icon, color, time, requires_lock, icon_bg)
    VALUES 
        (new_profile_id, 'Metformin 500mg', '🔵', '#3b82f6', '02:00 PM', true, '#0a1530');

    INSERT INTO public.medications (profile_id, name, icon, color, time, requires_lock, icon_bg)
    VALUES 
        (new_profile_id, 'Lisinopril 10mg', '⚙️', '#8b5cf6', '08:00 PM', false, '#1a1030');

    -- C. Seed Hydration Goal
    INSERT INTO public.hydration (profile_id, current, goal)
    VALUES (new_profile_id, 1.2, 2.5);

    -- D. Seed Refills
    INSERT INTO public.refills (profile_id, pending)
    VALUES (new_profile_id, 2);

    -- E. Seed Dose Logs for Today (Aspirin & Vitamin D already logged)
    INSERT INTO public.dose_logs (profile_id, medication_id, date_string, logged_at)
    VALUES 
        (new_profile_id, aspirin_id, today_str, now()),
        (new_profile_id, vitd_id, today_str, now());
END $$;
