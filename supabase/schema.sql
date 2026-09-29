-- Fideli MVP. À exécuter dans Supabase SQL Editor avant de déployer le site.
-- Les anciens établissements n'ont pas de propriétaire : leur owner_id doit être attribué
-- manuellement à un utilisateur Auth vérifié avant qu'ils soient administrables.
create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.businesses add column if not exists owner_id uuid references auth.users(id);
alter table public.businesses add column if not exists category text;
alter table public.businesses add column if not exists address text;
create unique index if not exists businesses_owner_unique on public.businesses(owner_id) where owner_id is not null;
alter table public.businesses drop constraint if exists businesses_slug_format;
alter table public.businesses add constraint businesses_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 50);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reward_name text not null,
  required_visits integer not null check (required_visits > 0),
  active boolean not null default true
);
create unique index if not exists one_active_program_per_business on public.programs(business_id) where active;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (customer_id, program_id)
);
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  redeemed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.private_feedback (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  visit_id uuid not null unique references public.visits(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now()
);
create table if not exists public.physical_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  membership_id uuid references public.memberships(id) on delete set null,
  status text not null default 'unassigned' check (status in ('unassigned','active','lost','replaced')),
  created_at timestamptz not null default now()
);
create unique index if not exists one_active_card_per_membership on public.physical_cards(membership_id) where status = 'active';
create index if not exists membership_program_idx on public.memberships(program_id);
create index if not exists visits_membership_idx on public.visits(membership_id);
create index if not exists redemptions_membership_idx on public.redemptions(membership_id);
create index if not exists cards_business_idx on public.physical_cards(business_id);

create or replace function public.owns_business(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.businesses where id = p_id and owner_id = (select auth.uid()));
$$;
revoke all on function public.owns_business(uuid) from public;
grant execute on function public.owns_business(uuid) to authenticated;

create or replace function public.merchant_can_read_customer(p_customer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m join public.programs p on p.id=m.program_id
    join public.businesses b on b.id=p.business_id
    where m.customer_id=p_customer and b.owner_id=(select auth.uid()));
$$;
revoke all on function public.merchant_can_read_customer(uuid) from public;
grant execute on function public.merchant_can_read_customer(uuid) to authenticated;

alter table public.businesses enable row level security;
alter table public.programs enable row level security;
alter table public.customers enable row level security;
alter table public.memberships enable row level security;
alter table public.visits enable row level security;
alter table public.redemptions enable row level security;
alter table public.private_feedback enable row level security;
alter table public.physical_cards enable row level security;

-- Supprime aussi les anciennes politiques éventuellement permissives avant d'installer celles du MVP.
-- À exécuter après sauvegarde : les accès d'anciennes versions sont volontairement remplacés.
do $$
declare item record;
begin
  for item in select schemaname,tablename,policyname from pg_catalog.pg_policies
    where schemaname='public' and tablename in
    ('businesses','programs','customers','memberships','visits','redemptions','private_feedback','physical_cards')
  loop
    execute format('drop policy %I on %I.%I',item.policyname,item.schemaname,item.tablename);
  end loop;
end $$;

-- Business name and active program are public for /join/[slug]. No customer data is public.
drop policy if exists business_public_read on public.businesses;
create policy business_public_read on public.businesses for select to anon,authenticated using (true);
drop policy if exists business_owner_insert on public.businesses;
create policy business_owner_insert on public.businesses for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists business_owner_update on public.businesses;
create policy business_owner_update on public.businesses for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists program_public_read on public.programs;
create policy program_public_read on public.programs for select to anon,authenticated using (active or (select public.owns_business(business_id)));
drop policy if exists program_owner_insert on public.programs;
create policy program_owner_insert on public.programs for insert to authenticated with check ((select public.owns_business(business_id)));
drop policy if exists program_owner_update on public.programs;
-- Le seuil de récompense est figé après création : le modifier rétroactivement fausserait les soldes.

drop policy if exists customer_scoped_read on public.customers;
create policy customer_scoped_read on public.customers for select to authenticated using (
  auth_user_id = (select auth.uid()) or (select public.merchant_can_read_customer(id))
);
drop policy if exists customer_self_insert on public.customers;
create policy customer_self_insert on public.customers for insert to authenticated with check (auth_user_id=(select auth.uid()));
drop policy if exists customer_self_update on public.customers;
create policy customer_self_update on public.customers for update to authenticated using (auth_user_id=(select auth.uid())) with check (auth_user_id=(select auth.uid()));
drop policy if exists membership_scoped_read on public.memberships;
create policy membership_scoped_read on public.memberships for select to authenticated using (
  exists(select 1 from public.customers c where c.id=customer_id and c.auth_user_id=(select auth.uid())) or
  exists(select 1 from public.programs p where p.id=program_id and (select public.owns_business(p.business_id)))
);
drop policy if exists membership_self_insert on public.memberships;
create policy membership_self_insert on public.memberships for insert to authenticated with check (
  exists(select 1 from public.customers c where c.id=customer_id and c.auth_user_id=(select auth.uid())) and
  exists(select 1 from public.programs p where p.id=program_id and p.active)
);
drop policy if exists visit_scoped_read on public.visits;
create policy visit_scoped_read on public.visits for select to authenticated using (
  exists(select 1 from public.memberships m join public.customers c on c.id=m.customer_id
  join public.programs p on p.id=m.program_id where m.id=membership_id
  and (c.auth_user_id=(select auth.uid()) or (select public.owns_business(p.business_id))))
);
drop policy if exists redemption_scoped_read on public.redemptions;
create policy redemption_scoped_read on public.redemptions for select to authenticated using (
  exists(select 1 from public.memberships m join public.customers c on c.id=m.customer_id
  join public.programs p on p.id=m.program_id where m.id=membership_id
  and (c.auth_user_id=(select auth.uid()) or (select public.owns_business(p.business_id))))
);
drop policy if exists feedback_scoped_read on public.private_feedback;
create policy feedback_scoped_read on public.private_feedback for select to authenticated using (
  exists(select 1 from public.memberships m join public.customers c on c.id=m.customer_id
  join public.programs p on p.id=m.program_id where m.id=membership_id
  and (c.auth_user_id=(select auth.uid()) or (select public.owns_business(p.business_id))))
);
drop policy if exists card_scoped_read on public.physical_cards;
create policy card_scoped_read on public.physical_cards for select to authenticated using (
  (select public.owns_business(business_id)) or exists(
    select 1 from public.memberships m join public.customers c on c.id=m.customer_id
    where m.id=membership_id and c.auth_user_id=(select auth.uid())
  )
);
-- No direct INSERT/UPDATE/DELETE policies for points, cards or feedback. Use RPC below.

create or replace function public.record_visit(p_membership uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_business uuid; v_id uuid;
begin
  select p.business_id into v_business from public.memberships m join public.programs p on p.id=m.program_id where m.id=p_membership and p.active;
  if v_business is null or not public.owns_business(v_business) then raise exception 'Accès refusé'; end if;
  insert into public.visits(membership_id,recorded_by) values(p_membership,auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.redeem_reward(p_membership uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_business uuid; v_required integer; v_balance integer; v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_membership::text,0));
  select p.business_id,p.required_visits*10 into v_business,v_required from public.memberships m join public.programs p on p.id=m.program_id where m.id=p_membership and p.active;
  if v_business is null or not public.owns_business(v_business) then raise exception 'Accès refusé'; end if;
  select (select count(*)*10 from public.visits where membership_id=p_membership)
    +(select count(*)*5 from public.private_feedback where membership_id=p_membership)
    -(select count(*)*v_required from public.redemptions where membership_id=p_membership) into v_balance;
  if v_balance<v_required then raise exception 'Points insuffisants'; end if;
  insert into public.redemptions(membership_id,redeemed_by) values(p_membership,auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.submit_feedback(p_membership uuid,p_rating integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_visit uuid; v_id uuid;
begin
  if p_rating not between 1 and 5 then raise exception 'Note invalide'; end if;
  if not exists(select 1 from public.memberships m join public.customers c on c.id=m.customer_id where m.id=p_membership and c.auth_user_id=auth.uid()) then raise exception 'Accès refusé'; end if;
  select v.id into v_visit from public.visits v where v.membership_id=p_membership
    and not exists(select 1 from public.private_feedback f where f.visit_id=v.id)
    order by v.created_at desc,v.id desc limit 1;
  if v_visit is null then raise exception 'Aucune visite à évaluer'; end if;
  insert into public.private_feedback(membership_id,visit_id,rating) values(p_membership,v_visit,p_rating) returning id into v_id;
  return v_id;
end $$;

create or replace function public.issue_card(p_business uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_token uuid;
begin
  if not public.owns_business(p_business) then raise exception 'Accès refusé'; end if;
  insert into public.physical_cards(business_id) values(p_business) returning token into v_token;
  return v_token;
end $$;
create or replace function public.claim_card(p_token uuid,p_membership uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_card public.physical_cards%rowtype; v_business uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_membership::text,0));
  select * into v_card from public.physical_cards where token=p_token for update;
  select p.business_id into v_business from public.memberships m join public.customers c on c.id=m.customer_id
    join public.programs p on p.id=m.program_id where m.id=p_membership and c.auth_user_id=auth.uid();
  if v_business is null or v_card.id is null or v_card.business_id<>v_business or v_card.status<>'unassigned' then raise exception 'Carte indisponible'; end if;
  update public.physical_cards set status='replaced' where membership_id=p_membership and status='active';
  update public.physical_cards set membership_id=p_membership,status='active' where id=v_card.id;
end $$;
create or replace function public.report_lost_card(p_membership uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.memberships m join public.customers c on c.id=m.customer_id where m.id=p_membership and c.auth_user_id=auth.uid()) then raise exception 'Accès refusé'; end if;
  update public.physical_cards set status='lost' where membership_id=p_membership and status='active';
end $$;
-- Supprime les données métier; la suppression du compte Auth lui-même nécessite un flux admin séparé.

revoke all on function public.record_visit(uuid),public.redeem_reward(uuid),public.submit_feedback(uuid,integer),public.issue_card(uuid),public.claim_card(uuid,uuid),public.report_lost_card(uuid) from public;
grant execute on function public.record_visit(uuid),public.redeem_reward(uuid),public.submit_feedback(uuid,integer),public.issue_card(uuid),public.claim_card(uuid,uuid),public.report_lost_card(uuid) to authenticated;

create or replace function public.card_destination(p_token uuid) returns text
language sql stable security definer set search_path = '' as $$
 select b.slug from public.physical_cards c join public.businesses b on b.id=c.business_id
 where c.token=p_token and (c.status='unassigned' or (c.status='active' and c.membership_id is not null));
$$;
revoke all on function public.card_destination(uuid) from public;
grant execute on function public.card_destination(uuid) to anon,authenticated;

-- Création atomique de l'établissement et de son programme.
create or replace function public.create_business(p_name text,p_slug text,p_reward text,p_visits integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or length(trim(p_name)) not between 2 and 80
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) not between 3 and 50
    or length(trim(p_reward)) not between 2 and 100 or p_visits not between 1 and 100 then
    raise exception 'Informations invalides';
  end if;
  if exists(select 1 from public.businesses where owner_id=auth.uid()) then raise exception 'Un commerce existe déjà pour ce compte'; end if;
  insert into public.businesses(owner_id,name,slug) values(auth.uid(),trim(p_name),p_slug) returning id into v_id;
  insert into public.programs(business_id,reward_name,required_visits) values(v_id,trim(p_reward),p_visits);
  return v_id;
end $$;
revoke all on function public.create_business(text,text,text,integer) from public;
grant execute on function public.create_business(text,text,text,integer) to authenticated;

create or replace function public.invalidate_cards_on_membership_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.physical_cards set status='lost' where membership_id=old.id and status='active';
  return old;
end $$;
drop trigger if exists invalidate_cards_on_membership_delete on public.memberships;
create trigger invalidate_cards_on_membership_delete before delete on public.memberships
for each row execute function public.invalidate_cards_on_membership_delete();
revoke all on function public.invalidate_cards_on_membership_delete() from public;

-- Tableau de bord paginé. Les totaux ne dépendent pas de la limite de lignes de l'API.
create or replace function public.business_overview(p_business uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_program public.programs%rowtype; v_clients bigint; v_visits bigint; v_redemptions bigint; v_members jsonb;
begin
  if not public.owns_business(p_business) then raise exception 'Accès refusé'; end if;
  if p_offset < 0 or p_offset > 100000 then raise exception 'Page invalide'; end if;
  select * into v_program from public.programs where business_id=p_business and active limit 1;
  if v_program.id is null then raise exception 'Programme introuvable'; end if;
  select count(*) into v_clients from public.memberships where program_id=v_program.id;
  select count(*) into v_visits from public.visits v join public.memberships m on m.id=v.membership_id where m.program_id=v_program.id;
  select count(*) into v_redemptions from public.redemptions r join public.memberships m on m.id=r.membership_id where m.program_id=v_program.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.display_name,'visits',x.visits,
      'redeemed',x.redeemed,'points',greatest(0,x.visits*10+x.feedback*5-x.redeemed*v_program.required_visits*10)) order by x.joined_at desc,x.id desc),'[]'::jsonb)
  into v_members from (
    select m.id,m.joined_at,c.display_name,
      (select count(*) from public.visits where membership_id=m.id) visits,
      (select count(*) from public.redemptions where membership_id=m.id) redeemed,
      (select count(*) from public.private_feedback where membership_id=m.id) feedback
    from public.memberships m join public.customers c on c.id=m.customer_id
    where m.program_id=v_program.id order by m.joined_at desc,m.id desc limit 25 offset p_offset
  ) x;
  return jsonb_build_object('clients',v_clients,'visits',v_visits,'redemptions',v_redemptions,'members',v_members);
end $$;
revoke all on function public.business_overview(uuid,integer) from public;
grant execute on function public.business_overview(uuid,integer) to authenticated;

create or replace function public.customer_card_summary(p_membership uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_visits bigint; v_feedback bigint; v_redemptions bigint; v_can_rate boolean;
begin
  if not exists(select 1 from public.memberships m join public.customers c on c.id=m.customer_id
    where m.id=p_membership and c.auth_user_id=auth.uid()) then raise exception 'Accès refusé'; end if;
  select count(*) into v_visits from public.visits where membership_id=p_membership;
  select count(*) into v_feedback from public.private_feedback where membership_id=p_membership;
  select count(*) into v_redemptions from public.redemptions where membership_id=p_membership;
  select exists(select 1 from public.visits v where v.membership_id=p_membership
    and not exists(select 1 from public.private_feedback f where f.visit_id=v.id)) into v_can_rate;
  return jsonb_build_object('visits',v_visits,'feedback',v_feedback,'redeemed',v_redemptions,'canRate',v_can_rate);
end $$;
revoke all on function public.customer_card_summary(uuid) from public;
grant execute on function public.customer_card_summary(uuid) to authenticated;

-- Tableau d'analyses pour l'espace commerçant : tendance sur 30 jours, fidélisation,
-- répartition par jour de semaine et meilleurs clients. Calculé côté base pour rester
-- rapide même avec beaucoup de visites, et protégé par owns_business comme le reste.
create or replace function public.business_analytics(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_program public.programs%rowtype;
  v_total_members bigint;
  v_total_visits bigint;
  v_total_redemptions bigint;
  v_returning bigint;
  v_series jsonb;
  v_top jsonb;
  v_dow jsonb;
begin
  if not public.owns_business(p_business) then raise exception 'Accès refusé'; end if;
  select * into v_program from public.programs where business_id=p_business and active limit 1;
  if v_program.id is null then raise exception 'Programme introuvable'; end if;

  select count(*) into v_total_members from public.memberships where program_id=v_program.id;
  select count(*) into v_total_visits from public.visits v join public.memberships m on m.id=v.membership_id where m.program_id=v_program.id;
  select count(*) into v_total_redemptions from public.redemptions r join public.memberships m on m.id=r.membership_id where m.program_id=v_program.id;
  select count(*) into v_returning from (
    select m.id from public.memberships m join public.visits v on v.membership_id=m.id
    where m.program_id=v_program.id group by m.id having count(*)>=2
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('date',to_char(d,'YYYY-MM-DD'),'visits',coalesce(vc.c,0),'members',coalesce(mc.c,0)) order by d),'[]'::jsonb)
  into v_series
  from generate_series(current_date-29,current_date,interval '1 day') d
  left join (select date_trunc('day',v.created_at)::date dd,count(*) c from public.visits v join public.memberships m on m.id=v.membership_id
    where m.program_id=v_program.id and v.created_at>=current_date-29 group by dd) vc on vc.dd=d::date
  left join (select date_trunc('day',m.joined_at)::date dd,count(*) c from public.memberships m
    where m.program_id=v_program.id and m.joined_at>=current_date-29 group by dd) mc on mc.dd=d::date;

  select coalesce(jsonb_agg(jsonb_build_object('name',x.display_name,'points',x.points) order by x.points desc,x.display_name),'[]'::jsonb) into v_top
  from (
    select c.display_name,
      greatest(0,(select count(*) from public.visits where membership_id=m.id)*10
        +(select count(*) from public.private_feedback where membership_id=m.id)*5
        -(select count(*) from public.redemptions where membership_id=m.id)*v_program.required_visits*10) points
    from public.memberships m join public.customers c on c.id=m.customer_id
    where m.program_id=v_program.id order by points desc limit 5
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('dow',y.dow,'visits',y.c) order by y.dow),'[]'::jsonb) into v_dow
  from (
    select s.dow,coalesce(count(v.id),0) c
    from generate_series(0,6) s(dow)
    left join public.visits v on extract(dow from v.created_at)::int=s.dow
      and v.membership_id in (select id from public.memberships where program_id=v_program.id)
    group by s.dow
  ) y;

  return jsonb_build_object(
    'totalMembers',v_total_members,'totalVisits',v_total_visits,'totalRedemptions',v_total_redemptions,
    'returningMembers',v_returning,
    'retentionRate',case when v_total_members=0 then 0 else round(v_returning::numeric/v_total_members*100) end,
    'avgVisits',case when v_total_members=0 then 0 else round(v_total_visits::numeric/v_total_members,1) end,
    'redemptionRate',case when v_total_visits=0 then 0 else round(v_total_redemptions::numeric/v_total_visits*100) end,
    'series',v_series,'topMembers',v_top,'dayOfWeek',v_dow
  );
end $$;
revoke all on function public.business_analytics(uuid) from public;
grant execute on function public.business_analytics(uuid) to authenticated;
