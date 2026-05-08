/*
  # Update default schedule time format to AM/PM

  1. Changes
    - Update the default daily_schedule JSONB to use AM/PM time format
    - Maintain existing functionality but with more user-friendly time display
    
  2. Notes
    - Existing schedules will need to be updated separately if needed
    - New schedules will use the AM/PM format by default
*/

-- Update the default schedule in the property_schedule table
ALTER TABLE property_schedule 
ALTER COLUMN daily_schedule SET DEFAULT '{
  "monday": {"enabled": true, "start": "9:00am", "end": "5:00pm"},
  "tuesday": {"enabled": true, "start": "9:00am", "end": "5:00pm"},
  "wednesday": {"enabled": true, "start": "9:00am", "end": "5:00pm"},
  "thursday": {"enabled": true, "start": "9:00am", "end": "5:00pm"},
  "friday": {"enabled": true, "start": "9:00am", "end": "5:00pm"},
  "saturday": {"enabled": false, "start": "9:00am", "end": "5:00pm"},
  "sunday": {"enabled": false, "start": "9:00am", "end": "5:00pm"}
}'::jsonb;