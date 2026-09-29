-- Contrôle à lancer après schema.sql dans le SQL Editor Supabase.
-- Il ne remplace pas les tests avec deux vrais commerces et deux vrais clients.
do $$
declare missing text;
begin
  select string_agg(c.relname,', ') into missing
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in
    ('businesses','programs','customers','memberships','visits','redemptions','private_feedback','physical_cards')
    and c.relkind='r' and not c.relrowsecurity;
  if missing is not null then raise exception 'RLS absent sur : %',missing; end if;
  if (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in
      ('businesses','programs','customers','memberships','visits','redemptions','private_feedback','physical_cards') and c.relkind='r') <> 8
    then raise exception 'Une ou plusieurs tables Fideli manquent'; end if;
  if exists(select 1 from pg_catalog.pg_policies where schemaname='public' and tablename in
    ('visits','redemptions','physical_cards','private_feedback') and cmd in ('INSERT','UPDATE','DELETE','ALL'))
    then raise exception 'Une politique de modification directe existe sur une table sensible'; end if;
  if not exists(select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='memberships' and policyname='membership_scoped_read')
    then raise exception 'Politique de lecture des cartes manquante'; end if;
  raise notice 'Structure RLS Fideli vérifiée. Testez maintenant les permissions avec des comptes distincts.';
end $$;
