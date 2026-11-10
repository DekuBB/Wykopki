INSERT INTO cities (name, emoji)
SELECT seed.name, seed.emoji
FROM (VALUES
  ('DĄBROWA GÓRNICZA', '🏰'),
  ('WROCŁAW', '🏢'),
  ('WARSZAWA', '🏙️'),
  ('CZĘSTOCHOWA', '🏭')
) AS seed(name, emoji)
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE cities.name = seed.name);
