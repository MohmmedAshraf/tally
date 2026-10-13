create table public.accounts (
  id text primary key,
  account text,
  owner text,
  plan text,
  mrr double precision,
  seats integer,
  score double precision,
  growth double precision,
  health integer,
  renewal date,
  active boolean,
  email text,
  website text,
  tenure integer
);

alter publication supabase_realtime add table public.accounts;
