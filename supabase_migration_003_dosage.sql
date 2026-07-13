-- Migration to add dosage column to medications table
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS dosage TEXT DEFAULT '' NOT NULL;
