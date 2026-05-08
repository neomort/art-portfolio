drop extension if exists "pg_net";

alter table "public"."faq_entries" drop constraint "faq_entries_category_id_fkey";

alter table "public"."favorites" drop constraint "favorites_property_id_fkey";

alter table "public"."favorites" drop constraint "favorites_user_id_fkey";

alter table "public"."inquiries" drop constraint "fk_initiator_last_read_message";

alter table "public"."inquiries" drop constraint "fk_responder_last_read_message";

alter table "public"."messages" drop constraint "messages_sender_id_fkey";

alter table "public"."profiles" drop constraint "profiles_id_fkey";

alter table "public"."property_availability" drop constraint "property_availability_property_id_fkey";

alter table "public"."property_schedule" drop constraint "property_schedule_property_id_fkey";

alter table "public"."review_responses" drop constraint "review_responses_responder_id_fkey";

alter table "public"."review_responses" drop constraint "review_responses_review_id_fkey";

alter table "public"."reviews" drop constraint "reviews_reviewer_id_fkey";

alter table "public"."bookings" drop constraint "bookings_property_id_fkey";

alter table "public"."bookings" drop constraint "bookings_proposal_id_fkey";

alter table "public"."bookings" drop constraint "bookings_user_id_fkey";

alter table "public"."inquiries" drop constraint "inquiries_user_id_fkey";

alter table "public"."properties" drop constraint "properties_venue_id_fkey";


  create table "public"."analysis_results" (
    "id" uuid not null default gen_random_uuid(),
    "lease_id" uuid not null,
    "permissibility_status" text,
    "summary_text" text,
    "restrictions_summary" text,
    "responsibilities_summary" text,
    "monthly_lease_payment" numeric,
    "total_leased_area" numeric,
    "lease_area_unit" text default 'sq_ft'::text,
    "raw_ai_response" jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "term_length_months" integer,
    "renewal_options" text,
    "exclusivity_rights" text,
    "cam_charges" text,
    "termination_rights" text,
    "base_rent_psf" numeric
      );


alter table "public"."analysis_results" enable row level security;


  create table "public"."lease_clauses" (
    "id" uuid not null default gen_random_uuid(),
    "lease_id" uuid not null,
    "clause_type" text not null,
    "summary" text not null,
    "risk_flag" text not null default 'low'::text,
    "original_text" text not null,
    "page_number" integer,
    "confidence_score" numeric default 0.0,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."lease_clauses" enable row level security;


  create table "public"."leases" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "file_name" text not null,
    "file_path" text not null,
    "file_size" bigint not null,
    "upload_status" text default 'uploaded'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."leases" enable row level security;


  create table "public"."listings" (
    "id" uuid not null default gen_random_uuid(),
    "listing_name" text,
    "space_type" text,
    "rental_capacity" integer,
    "ideal_uses" text[],
    "about_space" text,
    "amenities" text[],
    "price_per_day" numeric(10,2),
    "price_per_weekend" numeric(10,2),
    "fast_responder" boolean default false,
    "base_uri" text not null,
    "photos" text[],
    "scraped_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "address_city" text,
    "address_state" text,
    "address_country" text,
    "neighborhood" text,
    "square_feet" integer,
    "weekly_rate_value" numeric(10,2),
    "monthly_rate_value" numeric(10,2),
    "yearly_rate_value" numeric(10,2)
      );


alter table "public"."listings" enable row level security;

alter table "public"."bookings" add column "service_credit_applied_at" timestamp with time zone;

alter table "public"."bookings" add column "service_credit_applied_cents" integer not null default 0;

alter table "public"."bookings" add column "service_credit_applied_pi_id" text;

alter table "public"."profiles" add column "service_credit" numeric default 0;

CREATE UNIQUE INDEX analysis_results_pkey ON public.analysis_results USING btree (id);

CREATE INDEX idx_analysis_results_lease_id ON public.analysis_results USING btree (lease_id);

CREATE INDEX idx_bookings_credit_pi_id ON public.bookings USING btree (service_credit_applied_pi_id);

CREATE INDEX idx_bookings_property_id ON public.bookings USING btree (property_id);

CREATE INDEX idx_inquiries_property_id ON public.inquiries USING btree (property_id);

CREATE INDEX idx_lease_clauses_lease_id ON public.lease_clauses USING btree (lease_id);

CREATE INDEX idx_lease_clauses_risk ON public.lease_clauses USING btree (risk_flag);

CREATE INDEX idx_lease_clauses_type ON public.lease_clauses USING btree (clause_type);

CREATE INDEX idx_leases_status ON public.leases USING btree (upload_status);

CREATE INDEX idx_leases_user_id ON public.leases USING btree (user_id);

CREATE INDEX idx_listings_address_city ON public.listings USING btree (address_city);

CREATE INDEX idx_listings_address_country ON public.listings USING btree (address_country);

CREATE INDEX idx_listings_address_state ON public.listings USING btree (address_state);

CREATE INDEX idx_listings_neighborhood ON public.listings USING btree (neighborhood);

CREATE INDEX idx_listings_price_per_day ON public.listings USING btree (price_per_day);

CREATE INDEX idx_listings_scraped_at ON public.listings USING btree (scraped_at);

CREATE INDEX idx_listings_space_type ON public.listings USING btree (space_type);

CREATE INDEX idx_listings_square_feet ON public.listings USING btree (square_feet);

CREATE UNIQUE INDEX lease_clauses_pkey ON public.lease_clauses USING btree (id);

CREATE UNIQUE INDEX leases_pkey ON public.leases USING btree (id);

CREATE UNIQUE INDEX listings_base_uri_key ON public.listings USING btree (base_uri);

CREATE UNIQUE INDEX listings_pkey ON public.listings USING btree (id);

alter table "public"."analysis_results" add constraint "analysis_results_pkey" PRIMARY KEY using index "analysis_results_pkey";

alter table "public"."lease_clauses" add constraint "lease_clauses_pkey" PRIMARY KEY using index "lease_clauses_pkey";

alter table "public"."leases" add constraint "leases_pkey" PRIMARY KEY using index "leases_pkey";

alter table "public"."listings" add constraint "listings_pkey" PRIMARY KEY using index "listings_pkey";

alter table "public"."analysis_results" add constraint "analysis_results_permissibility_status_check" CHECK ((permissibility_status = ANY (ARRAY['permitted_unrestricted'::text, 'permitted_with_notification'::text, 'permitted_with_consent'::text, 'prohibited_with_exceptions'::text, 'prohibited_absolute'::text, 'unclear'::text, 'permitted'::text, 'prohibited'::text, 'requires_permission'::text, 'ambiguous'::text]))) not valid;

alter table "public"."analysis_results" validate constraint "analysis_results_permissibility_status_check";

alter table "public"."bookings" add constraint "bookings_service_credit_applied_cents_nonneg" CHECK ((service_credit_applied_cents >= 0)) not valid;

alter table "public"."bookings" validate constraint "bookings_service_credit_applied_cents_nonneg";

alter table "public"."leases" add constraint "leases_upload_status_check" CHECK ((upload_status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'completed'::text, 'failed'::text]))) not valid;

alter table "public"."leases" validate constraint "leases_upload_status_check";

alter table "public"."listings" add constraint "listings_base_uri_key" UNIQUE using index "listings_base_uri_key";

alter table "public"."bookings" add constraint "bookings_property_id_fkey" FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE not valid;

alter table "public"."bookings" validate constraint "bookings_property_id_fkey";

alter table "public"."bookings" add constraint "bookings_proposal_id_fkey" FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL not valid;

alter table "public"."bookings" validate constraint "bookings_proposal_id_fkey";

alter table "public"."bookings" add constraint "bookings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."bookings" validate constraint "bookings_user_id_fkey";

alter table "public"."inquiries" add constraint "inquiries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."inquiries" validate constraint "inquiries_user_id_fkey";

alter table "public"."properties" add constraint "properties_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."properties" validate constraint "properties_venue_id_fkey";

grant delete on table "public"."analysis_results" to "anon";

grant insert on table "public"."analysis_results" to "anon";

grant references on table "public"."analysis_results" to "anon";

grant select on table "public"."analysis_results" to "anon";

grant trigger on table "public"."analysis_results" to "anon";

grant truncate on table "public"."analysis_results" to "anon";

grant update on table "public"."analysis_results" to "anon";

grant delete on table "public"."analysis_results" to "authenticated";

grant insert on table "public"."analysis_results" to "authenticated";

grant references on table "public"."analysis_results" to "authenticated";

grant select on table "public"."analysis_results" to "authenticated";

grant trigger on table "public"."analysis_results" to "authenticated";

grant truncate on table "public"."analysis_results" to "authenticated";

grant update on table "public"."analysis_results" to "authenticated";

grant delete on table "public"."analysis_results" to "service_role";

grant insert on table "public"."analysis_results" to "service_role";

grant references on table "public"."analysis_results" to "service_role";

grant select on table "public"."analysis_results" to "service_role";

grant trigger on table "public"."analysis_results" to "service_role";

grant truncate on table "public"."analysis_results" to "service_role";

grant update on table "public"."analysis_results" to "service_role";

grant delete on table "public"."lease_clauses" to "anon";

grant insert on table "public"."lease_clauses" to "anon";

grant references on table "public"."lease_clauses" to "anon";

grant select on table "public"."lease_clauses" to "anon";

grant trigger on table "public"."lease_clauses" to "anon";

grant truncate on table "public"."lease_clauses" to "anon";

grant update on table "public"."lease_clauses" to "anon";

grant delete on table "public"."lease_clauses" to "authenticated";

grant insert on table "public"."lease_clauses" to "authenticated";

grant references on table "public"."lease_clauses" to "authenticated";

grant select on table "public"."lease_clauses" to "authenticated";

grant trigger on table "public"."lease_clauses" to "authenticated";

grant truncate on table "public"."lease_clauses" to "authenticated";

grant update on table "public"."lease_clauses" to "authenticated";

grant delete on table "public"."lease_clauses" to "service_role";

grant insert on table "public"."lease_clauses" to "service_role";

grant references on table "public"."lease_clauses" to "service_role";

grant select on table "public"."lease_clauses" to "service_role";

grant trigger on table "public"."lease_clauses" to "service_role";

grant truncate on table "public"."lease_clauses" to "service_role";

grant update on table "public"."lease_clauses" to "service_role";

grant delete on table "public"."leases" to "anon";

grant insert on table "public"."leases" to "anon";

grant references on table "public"."leases" to "anon";

grant select on table "public"."leases" to "anon";

grant trigger on table "public"."leases" to "anon";

grant truncate on table "public"."leases" to "anon";

grant update on table "public"."leases" to "anon";

grant delete on table "public"."leases" to "authenticated";

grant insert on table "public"."leases" to "authenticated";

grant references on table "public"."leases" to "authenticated";

grant select on table "public"."leases" to "authenticated";

grant trigger on table "public"."leases" to "authenticated";

grant truncate on table "public"."leases" to "authenticated";

grant update on table "public"."leases" to "authenticated";

grant delete on table "public"."leases" to "service_role";

grant insert on table "public"."leases" to "service_role";

grant references on table "public"."leases" to "service_role";

grant select on table "public"."leases" to "service_role";

grant trigger on table "public"."leases" to "service_role";

grant truncate on table "public"."leases" to "service_role";

grant update on table "public"."leases" to "service_role";

grant delete on table "public"."listings" to "anon";

grant insert on table "public"."listings" to "anon";

grant references on table "public"."listings" to "anon";

grant select on table "public"."listings" to "anon";

grant trigger on table "public"."listings" to "anon";

grant truncate on table "public"."listings" to "anon";

grant update on table "public"."listings" to "anon";

grant delete on table "public"."listings" to "authenticated";

grant insert on table "public"."listings" to "authenticated";

grant references on table "public"."listings" to "authenticated";

grant select on table "public"."listings" to "authenticated";

grant trigger on table "public"."listings" to "authenticated";

grant truncate on table "public"."listings" to "authenticated";

grant update on table "public"."listings" to "authenticated";

grant delete on table "public"."listings" to "service_role";

grant insert on table "public"."listings" to "service_role";

grant references on table "public"."listings" to "service_role";

grant select on table "public"."listings" to "service_role";

grant trigger on table "public"."listings" to "service_role";

grant truncate on table "public"."listings" to "service_role";

do $$
begin
  if to_regclass('public.organization_adjustments') is not null then
    grant delete on table "public"."organization_adjustments" to "service_role";
    grant insert on table "public"."organization_adjustments" to "service_role";
    grant references on table "public"."organization_adjustments" to "service_role";
    grant select on table "public"."organization_adjustments" to "service_role";
    grant trigger on table "public"."organization_adjustments" to "service_role";
    grant truncate on table "public"."organization_adjustments" to "service_role";
    grant update on table "public"."organization_adjustments" to "service_role";
  end if;
exception when others then
  -- keep migration idempotent in environments without this table
  null;
end $$;

  on "public"."analysis_results"
  as permissive
  for insert
  to authenticated
with check ((lease_id IN ( SELECT leases.id
  WHERE (leases.user_id = auth.uid()))));



  create policy "System can update analysis results"
  on "public"."analysis_results"
  as permissive
  for update
  to authenticated
using ((lease_id IN ( SELECT leases.id
   FROM leases
  WHERE (leases.user_id = auth.uid()))))
with check ((lease_id IN ( SELECT leases.id
   FROM leases
  WHERE (leases.user_id = auth.uid()))));



  create policy "Users can view their own analysis results"
  on "public"."analysis_results"
  as permissive
  for select
  to authenticated
using ((lease_id IN ( SELECT leases.id
   FROM leases
  WHERE (leases.user_id = auth.uid()))));



  create policy "Users can view their bookings or bookings for their properties"
  on "public"."bookings"
  as permissive
  for select
  to authenticated
using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = bookings.property_id) AND (p.venue_id = auth.uid()))))));



  create policy "Users can view their inquiries or inquiries for their propertie"
  on "public"."inquiries"
  as permissive
  for select
  to authenticated
using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = inquiries.property_id) AND (p.venue_id = auth.uid()))))));



  create policy "System can insert lease clauses"
  on "public"."lease_clauses"
  as permissive
  for insert
  to authenticated
with check ((lease_id IN ( SELECT leases.id
   FROM leases
  WHERE (leases.user_id = auth.uid()))));



  create policy "Users can view clauses for their own leases"
  on "public"."lease_clauses"
  as permissive
  for select
  to authenticated
using ((lease_id IN ( SELECT leases.id
   FROM leases
  WHERE (leases.user_id = auth.uid()))));



  create policy "Users can delete their own leases"
  on "public"."leases"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "Users can insert their own leases"
  on "public"."leases"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users can update their own leases"
  on "public"."leases"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can view their own leases"
  on "public"."leases"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "Allow all operations for authenticated users"
  on "public"."listings"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Allow read access for anonymous users"
  on "public"."listings"
  as permissive
  for select
  to anon
using (true);



  create policy "Participants can read inquiry messages"
  on "public"."messages"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM inquiries i
  WHERE ((i.id = messages.inquiry_id) AND ((i.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM properties p
          WHERE ((p.id = i.property_id) AND (p.venue_id = auth.uid())))))))));



  create policy "Authenticated read minimal"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Public can read reviews"
  on "public"."reviews"
  as permissive
  for select
  to public
using (true);


CREATE TRIGGER update_analysis_results_updated_at BEFORE UPDATE ON public.analysis_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leases_updated_at BEFORE UPDATE ON public.leases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


