-- Backfill weekly/monthly/yearly calculated pricing based on legacy fields and price_per_day
-- Assumptions:
-- - price_per_day is the base daily rate for calculation
-- - Weekly = 7 days, Monthly = 30 days, Yearly = 365 days

-- Weekly
UPDATE public.properties
SET 
  weekly_rate = CASE 
    WHEN weekly_rate_type = 'percentage' AND price_per_day IS NOT NULL AND weekly_rate_value IS NOT NULL
      THEN ROUND((price_per_day * 7) * (1 - (LEAST(GREATEST(weekly_rate_value, 0), 100) / 100.0))::numeric, 2)
    WHEN weekly_rate_type = 'fixed' AND weekly_rate_value IS NOT NULL
      THEN ROUND(weekly_rate_value::numeric, 2)
    ELSE NULL
  END,
  weekly_percent = CASE 
    WHEN weekly_rate_type = 'percentage' AND weekly_rate_value IS NOT NULL
      THEN ROUND(LEAST(GREATEST(weekly_rate_value, 0), 100))::int
    WHEN weekly_rate_type = 'fixed' AND price_per_day IS NOT NULL AND weekly_rate_value IS NOT NULL AND (price_per_day * 7) > 0
      THEN ROUND(LEAST(GREATEST((1 - (weekly_rate_value / (price_per_day * 7))) * 100, 0), 100))::int
    ELSE NULL
  END
WHERE weekly_rate IS NULL OR weekly_percent IS NULL;

-- Monthly
UPDATE public.properties
SET 
  monthly_rate = CASE 
    WHEN monthly_rate_type = 'percentage' AND price_per_day IS NOT NULL AND monthly_rate_value IS NOT NULL
      THEN ROUND((price_per_day * 30) * (1 - (LEAST(GREATEST(monthly_rate_value, 0), 100) / 100.0))::numeric, 2)
    WHEN monthly_rate_type = 'fixed' AND monthly_rate_value IS NOT NULL
      THEN ROUND(monthly_rate_value::numeric, 2)
    ELSE NULL
  END,
  monthly_percent = CASE 
    WHEN monthly_rate_type = 'percentage' AND monthly_rate_value IS NOT NULL
      THEN ROUND(LEAST(GREATEST(monthly_rate_value, 0), 100))::int
    WHEN monthly_rate_type = 'fixed' AND price_per_day IS NOT NULL AND monthly_rate_value IS NOT NULL AND (price_per_day * 30) > 0
      THEN ROUND(LEAST(GREATEST((1 - (monthly_rate_value / (price_per_day * 30))) * 100, 0), 100))::int
    ELSE NULL
  END
WHERE monthly_rate IS NULL OR monthly_percent IS NULL;

-- Yearly
UPDATE public.properties
SET 
  yearly_rate = CASE 
    WHEN yearly_rate_type = 'percentage' AND price_per_day IS NOT NULL AND yearly_rate_value IS NOT NULL
      THEN ROUND((price_per_day * 365) * (1 - (LEAST(GREATEST(yearly_rate_value, 0), 100) / 100.0))::numeric, 2)
    WHEN yearly_rate_type = 'fixed' AND yearly_rate_value IS NOT NULL
      THEN ROUND(yearly_rate_value::numeric, 2)
    ELSE NULL
  END,
  yearly_percent = CASE 
    WHEN yearly_rate_type = 'percentage' AND yearly_rate_value IS NOT NULL
      THEN ROUND(LEAST(GREATEST(yearly_rate_value, 0), 100))::int
    WHEN yearly_rate_type = 'fixed' AND price_per_day IS NOT NULL AND yearly_rate_value IS NOT NULL AND (price_per_day * 365) > 0
      THEN ROUND(LEAST(GREATEST((1 - (yearly_rate_value / (price_per_day * 365))) * 100, 0), 100))::int
    ELSE NULL
  END
WHERE yearly_rate IS NULL OR yearly_percent IS NULL;
