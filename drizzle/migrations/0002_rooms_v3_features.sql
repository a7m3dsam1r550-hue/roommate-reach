ALTER TABLE public.room_assignments ADD COLUMN room_status text;
ALTER TABLE public.room_assignments ADD CONSTRAINT room_status_valid CHECK (room_status IS NULL OR room_status IN ('DND','RS','DL','SN','SO','NL','VC','VD','OOS','OOO'));

-- sessions (multiple check-in/out per room per day)
CREATE TABLE public.room_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.room_assignments(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  houseman_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.room_sessions(assignment_id);
GRANT SELECT ON public.room_sessions TO authenticated;
GRANT ALL ON public.room_sessions TO service_role;
ALTER TABLE public.room_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read sessions" ON public.room_sessions FOR SELECT TO authenticated USING (
  houseman_id = auth.uid()
  OR (hotel_id = public.my_hotel() AND public.my_role() = 'manager')
  OR (hotel_id = public.my_hotel() AND public.my_role() = 'supervisor' AND public.is_my_team(houseman_id)));

-- notes, photos, maintenance
CREATE TABLE public.room_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.room_assignments(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL DEFAULT '',
  photos text[] NOT NULL DEFAULT '{}',
  is_maintenance boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.room_notes(assignment_id);
GRANT SELECT, INSERT ON public.room_notes TO authenticated;
GRANT ALL ON public.room_notes TO service_role;
ALTER TABLE public.room_notes ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.can_see_assignment(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.room_assignments a where a.id = _id and (
    a.houseman_id = auth.uid()
    or (a.hotel_id = public.my_hotel() and public.my_role() = 'manager')
    or (a.hotel_id = public.my_hotel() and public.my_role() = 'supervisor' and public.is_my_team(a.houseman_id))))
$$;
CREATE POLICY "read notes" ON public.room_notes FOR SELECT TO authenticated USING (public.can_see_assignment(assignment_id));
CREATE POLICY "write notes" ON public.room_notes FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND public.can_see_assignment(assignment_id)
  AND hotel_id = (select a.hotel_id from public.room_assignments a where a.id = assignment_id));

-- weekly tasks
CREATE TABLE public.weekly_tasks (
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hotel_id, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_tasks TO authenticated;
GRANT ALL ON public.weekly_tasks TO service_role;
ALTER TABLE public.weekly_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hotel read tasks" ON public.weekly_tasks FOR SELECT TO authenticated USING (hotel_id = public.my_hotel());
CREATE POLICY "manager write tasks" ON public.weekly_tasks FOR ALL TO authenticated
  USING (hotel_id = public.my_hotel() AND public.my_role() = 'manager')
  WITH CHECK (hotel_id = public.my_hotel() AND public.my_role() = 'manager');

-- daily broadcast banner
CREATE TABLE public.broadcasts (
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  message text NOT NULL DEFAULT '',
  author_id uuid NOT NULL DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hotel_id, work_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hotel read broadcasts" ON public.broadcasts FOR SELECT TO authenticated USING (hotel_id = public.my_hotel());
CREATE POLICY "sup write broadcasts" ON public.broadcasts FOR ALL TO authenticated
  USING (hotel_id = public.my_hotel() AND public.my_role() IN ('supervisor','manager'))
  WITH CHECK (hotel_id = public.my_hotel() AND public.my_role() IN ('supervisor','manager') AND author_id = auth.uid());

-- sign-offs and AM/PM report submissions
CREATE TABLE public.signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  kind text NOT NULL CHECK (kind IN ('am','pm','clearance')),
  author_id uuid NOT NULL DEFAULT auth.uid(),
  note text NOT NULL DEFAULT '',
  signature text NOT NULL DEFAULT '',
  report jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.signoffs TO authenticated;
GRANT ALL ON public.signoffs TO service_role;
ALTER TABLE public.signoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hotel read signoffs" ON public.signoffs FOR SELECT TO authenticated USING (hotel_id = public.my_hotel());
CREATE POLICY "sup insert signoffs" ON public.signoffs FOR INSERT TO authenticated
  WITH CHECK (hotel_id = public.my_hotel() AND public.my_role() IN ('supervisor','manager') AND author_id = auth.uid());

-- notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  houseman_id uuid,
  assignment_id uuid,
  kind text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.notifications(hotel_id, created_at DESC);
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mgr sup read notifications" ON public.notifications FOR SELECT TO authenticated USING (
  hotel_id = public.my_hotel() AND (public.my_role() = 'manager'
    OR (public.my_role() = 'supervisor' AND (houseman_id IS NULL OR public.is_my_team(houseman_id)))));

CREATE OR REPLACE FUNCTION public.notify_assignment_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.room_status is distinct from old.room_status then
    insert into public.notifications(hotel_id, houseman_id, assignment_id, kind, message)
    values (new.hotel_id, new.houseman_id, new.id, 'status', 'Room ' || new.room_number || ' status: ' || coalesce(new.room_status, 'cleared'));
  end if;
  return new;
end; $$;
CREATE TRIGGER notify_assignment_change AFTER UPDATE ON public.room_assignments FOR EACH ROW EXECUTE FUNCTION public.notify_assignment_change();

CREATE OR REPLACE FUNCTION public.notify_note() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r record;
begin
  if new.is_maintenance then
    select room_number, houseman_id into r from public.room_assignments where id = new.assignment_id;
    insert into public.notifications(hotel_id, houseman_id, assignment_id, kind, message)
    values (new.hotel_id, r.houseman_id, new.assignment_id, 'maintenance', 'Maintenance issue in room ' || r.room_number || ': ' || left(new.body, 120));
  end if;
  return new;
end; $$;
CREATE TRIGGER notify_note AFTER INSERT ON public.room_notes FOR EACH ROW EXECUTE FUNCTION public.notify_note();

-- PM guests only after first check-in
CREATE OR REPLACE FUNCTION public.guard_pm_guests() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.evening_guests is distinct from old.evening_guests and new.started_at is null and public.my_role() = 'houseman' then
    raise exception 'Check in before entering PM guests';
  end if;
  return new;
end; $$;
CREATE TRIGGER guard_pm_guests BEFORE UPDATE ON public.room_assignments FOR EACH ROW EXECUTE FUNCTION public.guard_pm_guests();

-- multi-session check in / out
CREATE OR REPLACE FUNCTION public.room_check_in(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare a record;
begin
  select * into a from public.room_assignments where id = _id and houseman_id = auth.uid() for update;
  if not found then raise exception 'Cannot check in'; end if;
  if exists (select 1 from public.room_sessions where assignment_id = _id and ended_at is null) then
    raise exception 'Already checked in';
  end if;
  insert into public.room_sessions(assignment_id, hotel_id, houseman_id) values (_id, a.hotel_id, a.houseman_id);
  perform set_config('app.timestamp_ok', '1', true);
  update public.room_assignments set started_at = coalesce(started_at, now()), ended_at = null where id = _id;
  insert into public.notifications(hotel_id, houseman_id, assignment_id, kind, message)
  values (a.hotel_id, a.houseman_id, _id, 'check_in', 'Check-in: room ' || a.room_number);
end; $$;

CREATE OR REPLACE FUNCTION public.room_check_out_note(_id uuid, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare a record;
begin
  select * into a from public.room_assignments where id = _id and houseman_id = auth.uid() for update;
  if not found then raise exception 'Cannot check out'; end if;
  update public.room_sessions set ended_at = now(), note = nullif(left(trim(coalesce(_note, '')), 1000), '')
   where assignment_id = _id and ended_at is null;
  if not found then raise exception 'Not checked in'; end if;
  perform set_config('app.timestamp_ok', '1', true);
  update public.room_assignments set ended_at = now() where id = _id;
  insert into public.notifications(hotel_id, houseman_id, assignment_id, kind, message)
  values (a.hotel_id, a.houseman_id, _id, 'check_out', 'Check-out: room ' || a.room_number);
end; $$;
CREATE OR REPLACE FUNCTION public.room_check_out(_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  select public.room_check_out_note(_id, null);
$$;
GRANT EXECUTE ON FUNCTION public.room_check_in(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.room_check_out(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.room_check_out_note(uuid, text) TO authenticated;

-- photo storage policies (bucket room-photos, path <hotel_id>/...)
CREATE POLICY "hotel read room photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'room-photos' AND (storage.foldername(name))[1] = public.my_hotel()::text);
CREATE POLICY "hotel upload room photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'room-photos' AND (storage.foldername(name))[1] = public.my_hotel()::text);

ALTER TABLE public.room_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_sessions, public.room_notes, public.notifications, public.broadcasts, public.signoffs, public.weekly_tasks;