-- Standardizes existing product names to "Title Case" (first letter of each
-- word capitalized), matching what the admin panel now enforces on save.

update public.wellness_products set name = initcap(name);
