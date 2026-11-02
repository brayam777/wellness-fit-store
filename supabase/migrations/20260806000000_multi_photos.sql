-- Lets each product carry multiple photos, shown as a swipeable carousel on
-- the site instead of a single photo per product (photos only, no video).

alter table public.wellness_products
  add column if not exists media jsonb not null default '[]'::jsonb;

update public.wellness_products
set media = jsonb_build_array(jsonb_build_object('url', image_url, 'type', 'image'))
where image_url is not null and jsonb_array_length(media) = 0;

alter table public.wellness_products drop column if exists image_url;
