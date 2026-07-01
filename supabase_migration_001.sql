-- Migration script extending user profiles, establishing doctor/caregiver relationships, and setting up auth-scoped RLS policies.

-- Only delete records with null user_id if the column already exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    DELETE FROM public.dose_logs WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id IS NULL);
    DELETE FROM public.medications WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id IS NULL);
    DELETE FROM public.hydration WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id IS NULL);
    DELETE FROM public.refills WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id IS NULL);
    DELETE FROM public.profiles WHERE user_id IS NULL;
  END IF;
END$$;

-- ─────────────────────────────────────────────
-- 1. Extend profiles table
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'PATIENT' CHECK (role IN ('PATIENT','CAREGIVER','DOCTOR')),
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Unique constraint on user_id (one profile per auth user)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END$$;

-- ─────────────────────────────────────────────
-- 2. Caregiver ↔ Patient relationship table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.caregiver_patient (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','REVOKED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(caregiver_id, patient_id)
);

-- ─────────────────────────────────────────────
-- 3. Doctor ↔ Patient relationship table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.doctor_patient (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','REVOKED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(doctor_id, patient_id)
);

-- ─────────────────────────────────────────────
-- 4. Notifications table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_caregiver_patient_caregiver ON public.caregiver_patient(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_patient_patient ON public.caregiver_patient(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_doctor ON public.doctor_patient(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_patient ON public.doctor_patient(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- ─────────────────────────────────────────────
-- 5. Enable RLS on new tables
-- ─────────────────────────────────────────────
ALTER TABLE public.caregiver_patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 6. Drop old open dev policies on existing tables
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public select on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public insert on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update on profiles" ON public.profiles;

DROP POLICY IF EXISTS "Allow public select on medications" ON public.medications;
DROP POLICY IF EXISTS "Allow public insert on medications" ON public.medications;
DROP POLICY IF EXISTS "Allow public update on medications" ON public.medications;
DROP POLICY IF EXISTS "Allow public delete on medications" ON public.medications;

DROP POLICY IF EXISTS "Allow public select on hydration" ON public.hydration;
DROP POLICY IF EXISTS "Allow public insert on hydration" ON public.hydration;
DROP POLICY IF EXISTS "Allow public update on hydration" ON public.hydration;

DROP POLICY IF EXISTS "Allow public select on refills" ON public.refills;
DROP POLICY IF EXISTS "Allow public insert on refills" ON public.refills;
DROP POLICY IF EXISTS "Allow public update on refills" ON public.refills;

DROP POLICY IF EXISTS "Allow public select on dose_logs" ON public.dose_logs;
DROP POLICY IF EXISTS "Allow public insert on dose_logs" ON public.dose_logs;
DROP POLICY IF EXISTS "Allow public delete on dose_logs" ON public.dose_logs;

-- ─────────────────────────────────────────────
-- 7. Auth-scoped RLS policies
-- ─────────────────────────────────────────────

-- Helper function: retrieves the profile ID linked to the currently authenticated user session.
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

-- Caregivers/Doctors can view their patients' profiles
CREATE POLICY "Caregiver can view patient profiles" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT patient_id FROM public.caregiver_patient
      WHERE caregiver_id = public.get_my_profile_id() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "Doctor can view patient profiles" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT patient_id FROM public.doctor_patient
      WHERE doctor_id = public.get_my_profile_id() AND status = 'ACTIVE'
    )
  );

-- MEDICATIONS
CREATE POLICY "Users can CRUD own medications" ON public.medications
  FOR ALL USING (profile_id = public.get_my_profile_id());

CREATE POLICY "Caregiver can view patient medications" ON public.medications
  FOR SELECT USING (
    profile_id IN (
      SELECT patient_id FROM public.caregiver_patient
      WHERE caregiver_id = public.get_my_profile_id() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "Doctor can view patient medications" ON public.medications
  FOR SELECT USING (
    profile_id IN (
      SELECT patient_id FROM public.doctor_patient
      WHERE doctor_id = public.get_my_profile_id() AND status = 'ACTIVE'
    )
  );

-- HYDRATION
CREATE POLICY "Users can CRUD own hydration" ON public.hydration
  FOR ALL USING (profile_id = public.get_my_profile_id());

-- REFILLS
CREATE POLICY "Users can CRUD own refills" ON public.refills
  FOR ALL USING (profile_id = public.get_my_profile_id());

-- DOSE_LOGS
CREATE POLICY "Users can CRUD own dose_logs" ON public.dose_logs
  FOR ALL USING (profile_id = public.get_my_profile_id());

CREATE POLICY "Caregiver can view patient dose_logs" ON public.dose_logs
  FOR SELECT USING (
    profile_id IN (
      SELECT patient_id FROM public.caregiver_patient
      WHERE caregiver_id = public.get_my_profile_id() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "Doctor can view patient dose_logs" ON public.dose_logs
  FOR SELECT USING (
    profile_id IN (
      SELECT patient_id FROM public.doctor_patient
      WHERE doctor_id = public.get_my_profile_id() AND status = 'ACTIVE'
    )
  );

-- CAREGIVER_PATIENT
CREATE POLICY "Caregiver can view own links" ON public.caregiver_patient
  FOR SELECT USING (caregiver_id = public.get_my_profile_id());

CREATE POLICY "Patient can view incoming links" ON public.caregiver_patient
  FOR SELECT USING (patient_id = public.get_my_profile_id());

CREATE POLICY "Caregiver can create link requests" ON public.caregiver_patient
  FOR INSERT WITH CHECK (caregiver_id = public.get_my_profile_id());

CREATE POLICY "Patient can update link status" ON public.caregiver_patient
  FOR UPDATE USING (patient_id = public.get_my_profile_id());

CREATE POLICY "Caregiver can delete own links" ON public.caregiver_patient
  FOR DELETE USING (caregiver_id = public.get_my_profile_id());

-- DOCTOR_PATIENT
CREATE POLICY "Doctor can view own links" ON public.doctor_patient
  FOR SELECT USING (doctor_id = public.get_my_profile_id());

CREATE POLICY "Patient can view incoming doctor links" ON public.doctor_patient
  FOR SELECT USING (patient_id = public.get_my_profile_id());

CREATE POLICY "Doctor can create link requests" ON public.doctor_patient
  FOR INSERT WITH CHECK (doctor_id = public.get_my_profile_id());

CREATE POLICY "Patient can update doctor link status" ON public.doctor_patient
  FOR UPDATE USING (patient_id = public.get_my_profile_id());

CREATE POLICY "Doctor can delete own links" ON public.doctor_patient
  FOR DELETE USING (doctor_id = public.get_my_profile_id());

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (recipient_profile_id = public.get_my_profile_id());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (recipient_profile_id = public.get_my_profile_id());

-- Allow inserts by authenticated users to enable cron checking engines to issue patient alerts using default client APIs.
CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────
-- 8. Profile Search RPC by Email (SECURITY DEFINER to read auth.users)
-- ─────────────────────────────────────────────
-- Database function to resolve and retrieve public profiles associated with a given email address.
-- This function runs with SECURITY DEFINER to securely read from the protected auth.users schema table.
CREATE OR REPLACE FUNCTION public.get_profile_by_email(p_email TEXT)
RETURNS SETOF public.profiles
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM public.profiles p
  JOIN auth.users u ON p.user_id = u.id
  WHERE u.email = p_email;
END;
$$ LANGUAGE plpgsql;
