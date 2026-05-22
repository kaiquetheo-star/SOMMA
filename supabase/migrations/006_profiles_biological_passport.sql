-- Biological Passport fields on profiles (SAD 4.2 / FSD Biological Passport)
-- Run in Supabase SQL Editor after 001_initial_schema.sql

alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists weight_kg numeric,
  add column if not exists height_cm numeric,
  add column if not exists body_fat_percentage numeric,
  add column if not exists current_injuries text,
  add column if not exists baseline_stress_level int;

alter table public.profiles
  drop constraint if exists profiles_weight_kg_check;

alter table public.profiles
  add constraint profiles_weight_kg_check
  check (weight_kg is null or weight_kg > 0);

alter table public.profiles
  drop constraint if exists profiles_height_cm_check;

alter table public.profiles
  add constraint profiles_height_cm_check
  check (height_cm is null or height_cm > 0);

alter table public.profiles
  drop constraint if exists profiles_body_fat_check;

alter table public.profiles
  add constraint profiles_body_fat_check
  check (body_fat_percentage is null or (body_fat_percentage >= 0 and body_fat_percentage <= 100));

alter table public.profiles
  drop constraint if exists profiles_stress_check;

alter table public.profiles
  add constraint profiles_stress_check
  check (
    baseline_stress_level is null
    or (baseline_stress_level between 1 and 10)
  );
