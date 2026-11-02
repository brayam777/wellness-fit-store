-- Schema for the standalone Wellness Fit Store Supabase project
-- (Supabase account barayamgamer@gmail.com).
-- Safe to run multiple times.

create table if not exists public.wellness_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price numeric not null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.wellness_products enable row level security;

create table if not exists public.wellness_admins (
  email text primary key,
  added_at timestamptz not null default now()
);

alter table public.wellness_admins enable row level security;

-- security definer function so admin-table policies don't recurse into themselves
create or replace function public.is_wellness_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.wellness_admins where email = auth.jwt() ->> 'email');
$$;

drop policy if exists "Public can view wellness products" on public.wellness_products;
create policy "Public can view wellness products"
  on public.wellness_products for select
  using (true);

drop policy if exists "Admin can manage wellness products" on public.wellness_products;
create policy "Admin can manage wellness products"
  on public.wellness_products for all
  using (public.is_wellness_admin())
  with check (public.is_wellness_admin());

drop policy if exists "Admins can view admin list" on public.wellness_admins;
create policy "Admins can view admin list"
  on public.wellness_admins for select
  using (public.is_wellness_admin());

drop policy if exists "Admins can add admins" on public.wellness_admins;
create policy "Admins can add admins"
  on public.wellness_admins for insert
  with check (public.is_wellness_admin());

drop policy if exists "Admins can remove admins" on public.wellness_admins;
create policy "Admins can remove admins"
  on public.wellness_admins for delete
  using (public.is_wellness_admin());

create or replace function public.wellness_prevent_last_admin_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.wellness_admins) <= 1 then
    raise exception 'Não é possível remover o último administrador.';
  end if;
  return old;
end;
$$;

drop trigger if exists wellness_admins_prevent_last_delete on public.wellness_admins;
create trigger wellness_admins_prevent_last_delete
  before delete on public.wellness_admins
  for each row execute function public.wellness_prevent_last_admin_delete();

insert into public.wellness_admins (email) values ('brayamfelipe02@gmail.com')
on conflict (email) do nothing;

insert into storage.buckets (id, name, public)
values ('wellness-photos', 'wellness-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public can view wellness photos" on storage.objects;
create policy "Public can view wellness photos"
  on storage.objects for select
  using (bucket_id = 'wellness-photos');

drop policy if exists "Admin can upload wellness photos" on storage.objects;
create policy "Admin can upload wellness photos"
  on storage.objects for insert
  with check (bucket_id = 'wellness-photos' and public.is_wellness_admin());

drop policy if exists "Admin can update wellness photos" on storage.objects;
create policy "Admin can update wellness photos"
  on storage.objects for update
  using (bucket_id = 'wellness-photos' and public.is_wellness_admin());

drop policy if exists "Admin can delete wellness photos" on storage.objects;
create policy "Admin can delete wellness photos"
  on storage.objects for delete
  using (bucket_id = 'wellness-photos' and public.is_wellness_admin());

-- Only seeds the example catalog the first time (table still empty), so
-- re-running this script never duplicates products.
insert into public.wellness_products (name, category, price)
select * from (values
  ('Legging Suplex Preta', 'Leggings', 99.90),
  ('Legging Estampada Bolso', 'Leggings', 109.90),
  ('Top Fitness Nadador', 'Tops', 59.90),
  ('Top Cropped Alça Fina', 'Tops', 54.90),
  ('Conjunto Legging + Top', 'Conjuntos', 149.90),
  ('Conjunto Short + Cropped', 'Conjuntos', 129.90),
  ('Short Saia Fitness', 'Shorts', 79.90),
  ('Jaqueta Corta Vento', 'Jaquetas', 139.90)
) as v(name, category, price)
where not exists (select 1 from public.wellness_products);
