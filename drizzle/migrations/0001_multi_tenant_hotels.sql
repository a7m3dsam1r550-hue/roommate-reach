CREATE TYPE public.staff_role AS ENUM ('super_admin','hotel_admin','manager','supervisor','houseman');

CREATE TABLE public.hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  max_managers integer NOT NULL DEFAULT 2 CHECK (max_managers >= 0),
  max_supervisors integer NOT NULL DEFAULT 5 CHECK (max_supervisors >= 0),
  max_staff integer NOT NULL DEFAULT 30 CHECK (max_staff >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotels TO authenticated;
GRANT ALL ON public.hotels TO service_role;

CREATE TABLE public.staff_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id uuid REFERENCES public.hotels(id) ON DELETE CASCADE,
  role public.staff_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'super_admin') = (hotel_id IS NULL))
);
GRANT SELECT ON public.staff_roles TO authenticated;
GRANT ALL ON public.staff_roles TO service_role;

CREATE TABLE public.team_members (
  staff_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  supervisor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

ALTER TABLE public.room_assignments ADD COLUMN hotel_id uuid REFERENCES public.hotels(id) ON DELETE CASCADE;
ALTER TABLE public.room_assignments DROP CONSTRAINT room_assignments_room_number_work_date_key;
ALTER TABLE public.room_assignments ADD CONSTRAINT room_assignments_hotel_room_date_key UNIQUE (hotel_id, room_number, work_date);

-- helpers
CREATE OR REPLACE FUNCTION public.my_role() RETURNS public.staff_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select role from public.staff_roles where user_id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.my_hotel() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select hotel_id from public.staff_roles where user_id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.hotel_of(_user uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select hotel_id from public.staff_roles where user_id = _user
$$;
CREATE OR REPLACE FUNCTION public.is_my_team(_staff uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.team_members where staff_id = _staff and supervisor_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.super_admin_exists() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.staff_roles where role = 'super_admin')
$$;
CREATE OR REPLACE FUNCTION public.list_hotels() RETURNS TABLE(id uuid, name text, code text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select id, name, code from public.hotels order by name
$$;
GRANT EXECUTE ON FUNCTION public.list_hotels() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_exists() TO anon, authenticated;

-- RLS: hotels
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin manage hotels" ON public.hotels FOR ALL TO authenticated
  USING (public.my_role() = 'super_admin') WITH CHECK (public.my_role() = 'super_admin');
CREATE POLICY "members read own hotel" ON public.hotels FOR SELECT TO authenticated
  USING (id = public.my_hotel());

-- RLS: staff_roles
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read roles" ON public.staff_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.my_role() = 'super_admin'
    OR (hotel_id = public.my_hotel() AND public.my_role() IN ('hotel_admin','manager','supervisor')));

-- RLS: team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager manage teams" ON public.team_members FOR ALL TO authenticated
  USING (public.my_role() = 'manager' AND hotel_id = public.my_hotel())
  WITH CHECK (public.my_role() = 'manager' AND hotel_id = public.my_hotel()
    AND public.hotel_of(staff_id) = hotel_id AND public.hotel_of(supervisor_id) = hotel_id);
CREATE POLICY "supervisor read team" ON public.team_members FOR SELECT TO authenticated
  USING (supervisor_id = auth.uid());

-- RLS: profiles
DROP POLICY IF EXISTS "own profile or admin" ON public.profiles;
CREATE POLICY "own or same hotel profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.my_role() = 'super_admin'
    OR (public.hotel_of(id) = public.my_hotel() AND public.my_role() IN ('hotel_admin','manager','supervisor')));

-- RLS: room_assignments
DROP POLICY IF EXISTS "admin all" ON public.room_assignments;
CREATE POLICY "manager all in hotel" ON public.room_assignments FOR ALL TO authenticated
  USING (public.my_role() = 'manager' AND hotel_id = public.my_hotel())
  WITH CHECK (public.my_role() = 'manager' AND hotel_id = public.my_hotel() AND public.hotel_of(houseman_id) = hotel_id);
CREATE POLICY "supervisor read team rooms" ON public.room_assignments FOR SELECT TO authenticated
  USING (public.my_role() = 'supervisor' AND hotel_id = public.my_hotel() AND public.is_my_team(houseman_id));

-- set hotel_id automatically on insert
CREATE OR REPLACE FUNCTION public.set_assignment_hotel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.hotel_id is null then new.hotel_id := public.hotel_of(new.houseman_id); end if;
  return new;
end; $$;
CREATE TRIGGER set_assignment_hotel BEFORE INSERT ON public.room_assignments FOR EACH ROW EXECUTE FUNCTION public.set_assignment_hotel();

CREATE OR REPLACE FUNCTION public.guard_assignment_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if public.my_role() = 'manager' or auth.uid() is null or current_setting('app.timestamp_ok', true) = '1' then
    return new;
  end if;
  if new.houseman_id <> old.houseman_id or new.room_number <> old.room_number or new.work_date <> old.work_date
     or new.hotel_id is distinct from old.hotel_id
     or new.started_at is distinct from old.started_at or new.ended_at is distinct from old.ended_at then
    raise exception 'Not allowed';
  end if;
  if (new.morning_guests is not null and (new.morning_guests < 0 or new.morning_guests > 50))
     or (new.evening_guests is not null and (new.evening_guests < 0 or new.evening_guests > 50)) then
    raise exception 'Invalid guest count';
  end if;
  return new;
end; $$;

-- signup: first account becomes super admin; others get roles from the account-creation function
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  if not exists (select 1 from public.staff_roles where role = 'super_admin') then
    insert into public.staff_roles (user_id, hotel_id, role) values (new.id, null, 'super_admin');
  end if;
  return new;
end; $$;

COMMENT ON TABLE public.user_roles IS 'DEPRECATED: replaced by staff_roles';
COMMENT ON FUNCTION public.admin_exists() IS 'DEPRECATED: replaced by super_admin_exists';