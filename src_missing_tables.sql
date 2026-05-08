--
-- PostgreSQL database dump
--

\restrict zYynDYRqFM89WsuCnIeBvjwlAge3NxXvV6U5Z9CcwPbO53lnvkELcWPEmf1kYzI

-- Dumped from database version 15.8
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: analysis_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analysis_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lease_id uuid NOT NULL,
    permissibility_status text,
    summary_text text,
    restrictions_summary text,
    responsibilities_summary text,
    monthly_lease_payment numeric,
    total_leased_area numeric,
    lease_area_unit text DEFAULT 'sq_ft'::text,
    raw_ai_response jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    term_length_months integer,
    renewal_options text,
    exclusivity_rights text,
    cam_charges text,
    termination_rights text,
    base_rent_psf numeric,
    CONSTRAINT analysis_results_permissibility_status_check CHECK ((permissibility_status = ANY (ARRAY['permitted_unrestricted'::text, 'permitted_with_notification'::text, 'permitted_with_consent'::text, 'prohibited_with_exceptions'::text, 'prohibited_absolute'::text, 'unclear'::text, 'permitted'::text, 'prohibited'::text, 'requires_permission'::text, 'ambiguous'::text])))
);


ALTER TABLE public.analysis_results OWNER TO postgres;

--
-- Name: lease_clauses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lease_clauses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lease_id uuid NOT NULL,
    clause_type text NOT NULL,
    summary text NOT NULL,
    risk_flag text DEFAULT 'low'::text NOT NULL,
    original_text text NOT NULL,
    page_number integer,
    confidence_score numeric DEFAULT 0.0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lease_clauses OWNER TO postgres;

--
-- Name: leases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size bigint NOT NULL,
    upload_status text DEFAULT 'uploaded'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT leases_upload_status_check CHECK ((upload_status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


ALTER TABLE public.leases OWNER TO postgres;

--
-- Name: analysis_results analysis_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_results
    ADD CONSTRAINT analysis_results_pkey PRIMARY KEY (id);


--
-- Name: lease_clauses lease_clauses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lease_clauses
    ADD CONSTRAINT lease_clauses_pkey PRIMARY KEY (id);


--
-- Name: leases leases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_pkey PRIMARY KEY (id);


--
-- Name: idx_analysis_results_lease_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analysis_results_lease_id ON public.analysis_results USING btree (lease_id);


--
-- Name: idx_lease_clauses_lease_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lease_clauses_lease_id ON public.lease_clauses USING btree (lease_id);


--
-- Name: idx_lease_clauses_risk; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lease_clauses_risk ON public.lease_clauses USING btree (risk_flag);


--
-- Name: idx_lease_clauses_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lease_clauses_type ON public.lease_clauses USING btree (clause_type);


--
-- Name: idx_leases_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leases_status ON public.leases USING btree (upload_status);


--
-- Name: idx_leases_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leases_user_id ON public.leases USING btree (user_id);


--
-- Name: analysis_results update_analysis_results_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_analysis_results_updated_at BEFORE UPDATE ON public.analysis_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leases update_leases_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_leases_updated_at BEFORE UPDATE ON public.leases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: analysis_results analysis_results_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analysis_results
    ADD CONSTRAINT analysis_results_lease_id_fkey FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;


--
-- Name: lease_clauses lease_clauses_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lease_clauses
    ADD CONSTRAINT lease_clauses_lease_id_fkey FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;


--
-- Name: leases leases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: analysis_results System can insert analysis results; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert analysis results" ON public.analysis_results FOR INSERT TO authenticated WITH CHECK ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE (leases.user_id = auth.uid()))));


--
-- Name: lease_clauses System can insert lease clauses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert lease clauses" ON public.lease_clauses FOR INSERT TO authenticated WITH CHECK ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE (leases.user_id = auth.uid()))));


--
-- Name: analysis_results System can update analysis results; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can update analysis results" ON public.analysis_results FOR UPDATE TO authenticated USING ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE (leases.user_id = auth.uid())))) WITH CHECK ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE (leases.user_id = auth.uid()))));


--
-- Name: leases Users can delete their own leases; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own leases" ON public.leases FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: leases Users can insert their own leases; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own leases" ON public.leases FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: leases Users can update their own leases; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own leases" ON public.leases FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: lease_clauses Users can view clauses for their own leases; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view clauses for their own leases" ON public.lease_clauses FOR SELECT TO authenticated USING ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE (leases.user_id = auth.uid()))));


--
-- Name: analysis_results Users can view their own analysis results; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own analysis results" ON public.analysis_results FOR SELECT TO authenticated USING ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE (leases.user_id = auth.uid()))));


--
-- Name: leases Users can view their own leases; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own leases" ON public.leases FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: analysis_results; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

--
-- Name: lease_clauses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lease_clauses ENABLE ROW LEVEL SECURITY;

--
-- Name: leases; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE analysis_results; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.analysis_results TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.analysis_results TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.analysis_results TO service_role;


--
-- Name: TABLE lease_clauses; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.lease_clauses TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.lease_clauses TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.lease_clauses TO service_role;


--
-- Name: TABLE leases; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.leases TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.leases TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.leases TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict zYynDYRqFM89WsuCnIeBvjwlAge3NxXvV6U5Z9CcwPbO53lnvkELcWPEmf1kYzI

