ALTER TABLE public.room_assignments DROP CONSTRAINT room_status_valid;

ALTER TABLE public.room_assignments ADD CONSTRAINT room_status_valid
  CHECK (room_status IS NULL OR room_status = ANY (ARRAY[
    'D.N.D'::text, 'R.S'::text, 'D.L'::text, 'S.N'::text, 'S.O'::text,
    'N.L'::text, 'V.C'::text, 'V.D'::text, 'O.O.S'::text, 'O.O.O'::text,
    'OCC'::text
  ]));

COMMENT ON CONSTRAINT room_status_valid ON public.room_assignments IS 'Allowed room status codes; OCC (Occupied) added. NULL allowed until check-in, which defaults to V.D.';

CREATE OR REPLACE FUNCTION public.room_check_in(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a record;
begin
  select * into a from public.room_assignments where id = _id and houseman_id = auth.uid() for update;
  if not found then raise exception 'Cannot check in'; end if;
  if exists (select 1 from public.room_sessions where assignment_id = _id and ended_at is null) then
    raise exception 'Already checked in';
  end if;
  insert into public.room_sessions(assignment_id, hotel_id, houseman_id) values (_id, a.hotel_id, a.houseman_id);
  perform set_config('app.timestamp_ok', '1', true);
  update public.room_assignments
    set started_at = coalesce(started_at, now()),
        ended_at = null,
        room_status = coalesce(room_status, 'V.D')
    where id = _id;
  insert into public.notifications(hotel_id, houseman_id, assignment_id, kind, message)
  values (a.hotel_id, a.houseman_id, _id, 'check_in', 'Check-in: room ' || a.room_number);
end; $function$;
