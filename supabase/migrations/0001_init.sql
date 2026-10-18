-- Spendly schema. All money is stored as integer cents.
-- Every table carries user_id and is protected by row-level security:
-- a user can only read and write rows where user_id = auth.uid().

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  currency text not null default 'EUR',
  locale text not null default 'en-IE',
  month_start_day smallint not null default 1 check (month_start_day between 1 and 28),
  savings_goal bigint not null default 0 check (savings_goal >= 0),
  last_payment_method text not null default 'Card',
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('allowance', 'job', 'scholarship', 'other')),
  name text not null,
  amount bigint not null check (amount >= 0),
  day_of_month smallint not null default 1 check (day_of_month between 1 and 31),
  created_at timestamptz not null default now()
);

create table public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  amount bigint not null check (amount >= 0),
  day_of_month smallint not null default 1 check (day_of_month between 1 and 31),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- One row per budget period. "period" is the first day of the period
-- (which depends on profiles.month_start_day).
create table public.months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  period date not null,
  carry_in bigint not null default 0,          -- leftover added from the previous month
  leftover_action text check (leftover_action in ('savings', 'next_month')),
  leftover_amount bigint not null default 0,   -- what was left when the month was closed
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, period)
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  period date not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount bigint not null default 0 check (amount >= 0),
  unique (user_id, period, category_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  amount bigint not null check (amount > 0),
  category_id uuid not null references public.categories (id) on delete cascade,
  description text not null default '',
  spent_on date not null default current_date,
  payment_method text not null default 'Card',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index expenses_user_spent_on on public.expenses (user_id, spent_on desc);
create index budgets_user_period on public.budgets (user_id, period);
create index categories_user on public.categories (user_id);
create index income_sources_user on public.income_sources (user_id);
create index fixed_costs_user on public.fixed_costs (user_id);

-- Row-level security: same policy on every table.
do $$
declare t text;
begin
  foreach t in array array['profiles', 'income_sources', 'fixed_costs', 'categories', 'months', 'budgets', 'expenses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows: select" on public.%I for select using (user_id = auth.uid())', t);
    execute format('create policy "own rows: insert" on public.%I for insert with check (user_id = auth.uid())', t);
    execute format('create policy "own rows: update" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "own rows: delete" on public.%I for delete using (user_id = auth.uid())', t);
  end loop;
end $$;

-- Lets a signed-in user delete their own account. Every table cascades from auth.users.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
