-- Add median_time_ms values for modes 6-9
UPDATE config
SET value = '{"2": 5000, "3": 8000, "4": 15000, "5": 25000, "6": 40000, "7": 60000, "8": 90000, "9": 120000}'
WHERE key = 'median_time_ms';
