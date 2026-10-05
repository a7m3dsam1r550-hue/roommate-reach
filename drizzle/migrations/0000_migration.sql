create type public.app_role as enum ('admin', 'houseman');

create table public.profiles (
  id uuid primary key,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.admin_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where role = 'admin')
$$;
grant execute on function public.admin_exists() to anon, authenticated;

create policy "own profile or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid());
create policy "own roles or admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'houseman');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.room_assignments (
  id uuid primary key default gen_random_uuid(),
  houseman_id uuid not null references public.profiles(id) on delete cascade,
  room_number text not null,
  work_date date not null default current_date,
  morning_guests integer,
  evening_guests integer,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (room_number, work_date)
);
grant select, insert, update, delete on public.room_assignments to authenticated;
grant all on public.room_assignments to service_role;
alter table public.room_assignments enable row level security;

create policy "admin all" on public.room_assignments for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "houseman read own" on public.room_assignments for select to authenticated
  using (houseman_id = auth.uid());
create policy "houseman update own" on public.room_assignments for update to authenticated
  using (houseman_id = auth.uid()) with check (houseman_id = auth.uid());

-- housemen may only change guest counts directly
create or replace function public.guard_assignment_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.has_role(auth.uid(), 'admin') or auth.uid() is null or current_setting('app.timestamp_ok', true) = '1' then
    return new;
  end if;
  if new.houseman_id <> old.houseman_id or new.room_number <> old.room_number or new.work_date <> old.work_date
     or new.started_at is distinct from old.started_at or new.ended_at is distinct from old.ended_at then
    raise exception 'Not allowed';
  end if;
  if (new.morning_guests is not null and (new.morning_guests < 0 or new.morning_guests > 50))
     or (new.evening_guests is not null and (new.evening_guests < 0 or new.evening_guests > 50)) then
    raise exception 'Invalid guest count';
  end if;
  return new;
end; $$;
create trigger guard_assignment before update on public.room_assignments
  for each row execute function public.guard_assignment_update();

create or replace function public.room_check_in(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.timestamp_ok', '1', true);
  update public.room_assignments set started_at = now()
   where id = _id and houseman_id = auth.uid() and started_at is null;
  if not found then raise exception 'Cannot check in'; end if;
end; $$;

create or replace function public.room_check_out(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.timestamp_ok', '1', true);
  update public.room_assignments set ended_at = now()
   where id = _id and houseman_id = auth.uid() and started_at is not null and ended_at is null;
  if not found then raise exception 'Cannot check out'; end if;
end; $$;
grant execute on function public.room_check_in(uuid) to authenticated;
grant execute on function public.room_check_out(uuid) to authenticated;

alter table public.room_assignments replica identity full;
alter publication supabase_realtime add table public.room_assignments;