CREATE TABLE public.shift_stamps (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 hotel_id uuid NOT NULL REFERENCES public.hotels(id),
 houseman_id uuid NOT NULL REFERENCES public.profiles(id),
 supervisor_id uuid NOT NULL REFERENCES public.profiles(id),
 supervisor_name text NOT NULL,
 work_date date NOT NULL,
 approved_at timestamptz NOT NULL DEFAULT now(),
 verification_status text NOT NULL DEFAULT 'APPROVED & CLEARED' CHECK (verification_status = 'APPROVED & CLEARED'),
 summary jsonb NOT NULL DEFAULT '{}'::jsonb,
 UNIQUE(hotel_id,houseman_id,work_date)
);
GRANT SELECT ON public.shift_stamps TO authenticated;
GRANT ALL ON public.shift_stamps TO service_role;
ALTER TABLE public.shift_stamps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read relevant shift stamps" ON public.shift_stamps FOR SELECT TO authenticated USING (hotel_id = public.my_hotel() AND (houseman_id = auth.uid() OR public.my_role() = 'manager' OR (public.my_role() = 'supervisor' AND public.is_my_team(houseman_id))));
CREATE OR REPLACE FUNCTION public.approve_shift_stamp(_houseman_id uuid, _work_date date)
RETURNS public.shift_stamps LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE stamp public.shift_stamps; supervisor_label text; snapshot jsonb;
BEGIN
 IF auth.uid() IS NULL OR public.my_role() IS DISTINCT FROM 'supervisor'::public.staff_role OR NOT public.is_my_team(_houseman_id) OR public.hotel_of(_houseman_id) IS DISTINCT FROM public.my_hotel() OR NOT EXISTS (SELECT 1 FROM public.staff_roles WHERE user_id=_houseman_id AND role='houseman') THEN
 RAISE EXCEPTION 'Only the assigned supervisor can approve this staff member';
 END IF;
 IF _work_date IS NULL OR abs(_work_date - CURRENT_DATE) > 1 THEN RAISE EXCEPTION 'Approval must be for today'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(_houseman_id::text || _work_date::text));
 SELECT * INTO stamp FROM public.shift_stamps WHERE hotel_id=public.my_hotel() AND houseman_id=_houseman_id AND work_date=_work_date;
 IF FOUND THEN RETURN stamp; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.room_assignments WHERE houseman_id=_houseman_id AND hotel_id=public.my_hotel() AND work_date=_work_date) THEN RAISE EXCEPTION 'No rooms assigned for this shift'; END IF;
 IF EXISTS (SELECT 1 FROM public.room_assignments WHERE houseman_id=_houseman_id AND hotel_id=public.my_hotel() AND work_date=_work_date AND started_at IS NOT NULL AND ended_at IS NULL) THEN RAISE EXCEPTION 'Check out of active rooms before approving the shift'; END IF;
 SELECT coalesce(nullif(full_name,''),email) INTO supervisor_label FROM public.profiles WHERE id=auth.uid();
 SELECT jsonb_build_object('rooms',coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object('notes', (SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.created_at),'[]'::jsonb) FROM public.room_notes n WHERE n.assignment_id=a.id),'sessions',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.started_at),'[]'::jsonb) FROM public.room_sessions s WHERE s.assignment_id=a.id)) ORDER BY a.room_number),'[]'::jsonb)) INTO snapshot FROM public.room_assignments a WHERE a.houseman_id=_houseman_id AND a.hotel_id=public.my_hotel() AND a.work_date=_work_date;
 INSERT INTO public.shift_stamps(hotel_id,houseman_id,supervisor_id,supervisor_name,work_date,summary) VALUES(public.my_hotel(),_houseman_id,auth.uid(),coalesce(supervisor_label,'Supervisor'),_work_date,snapshot) RETURNING * INTO stamp;
 RETURN stamp;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_shift_stamp(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_shift_stamp(uuid,date) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_stamps;