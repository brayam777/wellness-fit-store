-- Adds promotional pricing + a single "featured" product for the homepage
-- banner. Safe to run multiple times.

alter table public.wellness_products
  add column if not exists original_price numeric,
  add column if not exists featured boolean not null default false;

delete from public.wellness_products where name = 'Jaqueta Corta Vento';

-- Leftover test product from earlier testing.
delete from public.wellness_products where lower(name) = lower('homi lindo da maria');

insert into public.wellness_products (name, category, price, original_price, featured)
select 'Macaquinho Ieza', 'Macaquinhos', 95.90, 130.90, true
where not exists (select 1 from public.wellness_products where name = 'Macaquinho Ieza');
