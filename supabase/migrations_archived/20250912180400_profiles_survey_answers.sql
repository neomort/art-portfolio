-- Add survey_answers to profiles for storing onboarding questionnaire answers
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS survey_answers jsonb DEFAULT '[]'::jsonb;

-- Optional: restrict json to array at write-time via a CHECK (kept permissive here)
-- ALTER TABLE public.profiles
--   ADD CONSTRAINT profiles_survey_answers_is_array
--   CHECK (jsonb_typeof(survey_answers) = 'array');
