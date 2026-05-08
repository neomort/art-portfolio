--
-- PostgreSQL database dump
--

\restrict N52T9F9pgSIDCt6lYjjd9bOp1zxOeDkX8OrN5QcngZLatifytGSeqwijrvtzX9H

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
-- Name: bookings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    property_id uuid NOT NULL,
    user_id uuid NOT NULL,
    proposal_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    price_total numeric NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'confirmed'::text NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stripe_payment_intent_id text,
    stripe_client_secret text,
    service_credit_applied_cents integer DEFAULT 0 NOT NULL,
    service_credit_applied_pi_id text,
    service_credit_applied_at timestamp with time zone,
    CONSTRAINT bookings_service_credit_applied_cents_nonneg CHECK ((service_credit_applied_cents >= 0))
);


ALTER TABLE public.bookings OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    company_name text,
    phone text,
    avatar_url text,
    business_type text,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stripe_account_id text,
    charges_enabled boolean DEFAULT false,
    payouts_enabled boolean DEFAULT false,
    about_brand text,
    is_admin boolean DEFAULT false,
    service_credit numeric DEFAULT 0
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: COLUMN profiles.stripe_account_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.stripe_account_id IS 'Stripe Connect Account ID for the user';


--
-- Name: COLUMN profiles.charges_enabled; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.charges_enabled IS 'Whether the Stripe account can create live charges';


--
-- Name: COLUMN profiles.payouts_enabled; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.payouts_enabled IS 'Whether Stripe can send payouts to this account';


--
-- Name: COLUMN profiles.about_brand; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.about_brand IS 'Information about the user''s brand (for merchants)';


--
-- Name: COLUMN profiles.is_admin; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.is_admin IS 'Indicates if the user has administrative privileges';


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: bookings unique_payment_intent; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT unique_payment_intent UNIQUE (stripe_payment_intent_id);


--
-- Name: idx_bookings_credit_pi_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_credit_pi_id ON public.bookings USING btree (service_credit_applied_pi_id);


--
-- Name: idx_bookings_payment_intent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_payment_intent ON public.bookings USING btree (stripe_payment_intent_id);


--
-- Name: bookings send_payment_confirmation_notification; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER send_payment_confirmation_notification AFTER UPDATE ON public.bookings FOR EACH ROW WHEN (((new.payment_status = 'paid'::text) AND (old.payment_status <> 'paid'::text))) EXECUTE FUNCTION public.send_payment_confirmation_notification();


--
-- Name: TRIGGER send_payment_confirmation_notification ON bookings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TRIGGER send_payment_confirmation_notification ON public.bookings IS 'Sends payment confirmation notifications when a booking payment status changes to paid';


--
-- Name: profiles trg_profiles_service_credit_nn; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_profiles_service_credit_nn BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.enforce_non_negative_service_credit();


--
-- Name: bookings update_bookings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bookings update_inquiry_on_payment; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_inquiry_on_payment AFTER UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_inquiry_status_on_payment();


--
-- Name: TRIGGER update_inquiry_on_payment ON bookings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TRIGGER update_inquiry_on_payment ON public.bookings IS 'Updates inquiry status to payment_completed when booking payment_status changes to paid';


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bookings bookings_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id);


--
-- Name: bookings bookings_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id);


--
-- Name: bookings bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: profiles Admins can update any profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.is_admin = true)))));


--
-- Name: profiles Enable delete for users based on user_id; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable delete for users based on user_id" ON public.profiles FOR DELETE USING ((auth.uid() = id));


--
-- Name: profiles Enable insert for authenticated users based on user_id; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users based on user_id" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Enable update for users based on user_id; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable update for users based on user_id" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Public profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);


--
-- Name: bookings Users can create bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create bookings" ON public.bookings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: bookings Users can view their related bookings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their related bookings" ON public.bookings FOR SELECT USING (((auth.uid() = user_id) OR (auth.uid() IN ( SELECT properties.venue_id
   FROM public.properties
  WHERE (properties.id = bookings.property_id)))));


--
-- Name: bookings Venue owners can create bookings for their properties; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Venue owners can create bookings for their properties" ON public.bookings FOR INSERT TO authenticated WITH CHECK ((auth.uid() IN ( SELECT properties.venue_id
   FROM public.properties
  WHERE (properties.id = bookings.property_id))));


--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE bookings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.bookings TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.bookings TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.bookings TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.profiles TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict N52T9F9pgSIDCt6lYjjd9bOp1zxOeDkX8OrN5QcngZLatifytGSeqwijrvtzX9H

