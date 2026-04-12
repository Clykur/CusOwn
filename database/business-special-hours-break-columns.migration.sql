-- Optional lunch/break window per weekday (IST wall-clock times).
ALTER TABLE business_special_hours
  ADD COLUMN IF NOT EXISTS break_start_time TIME,
  ADD COLUMN IF NOT EXISTS break_end_time TIME;

COMMENT ON COLUMN business_special_hours.break_start_time IS 'IST break start; must fall within opening_time–closing_time when set.';
COMMENT ON COLUMN business_special_hours.break_end_time IS 'IST break end; must fall within opening_time–closing_time when set.';
