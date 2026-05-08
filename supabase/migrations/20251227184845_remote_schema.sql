create extension if not exists "pg_cron" with schema "pg_catalog";

create extension if not exists "btree_gist" with schema "extensions";

drop extension if exists "pg_net";

create type "public"."per_unit" as enum ('per_hour', 'per_day', 'per_week', 'per_month', 'per_booking');

drop policy "Users can create bookings" on "public"."bookings";

drop policy "Users can view their related bookings" on "public"."bookings";

drop policy "Allow inquiry participants or org members to update" on "public"."inquiries";

drop policy "Inquiry creators and property owners can delete inquiries" on "public"."inquiries";

drop policy "Participants and org members can read inquiries" on "public"."inquiries";

drop policy "Participants and org members can update inquiries" on "public"."inquiries";

drop policy "Users can create inquiries" on "public"."inquiries";

drop policy "Users can delete messages" on "public"."messages";

drop policy "Users can insert messages" on "public"."messages";

drop policy "Users can update messages" on "public"."messages";

drop policy "Users can view messages" on "public"."messages";

drop policy "Public profiles are viewable by everyone" on "public"."profiles";

drop policy "Properties are viewable by everyone" on "public"."properties";

drop policy "Users can delete their own properties" on "public"."properties";

drop policy "Users can insert their own properties" on "public"."properties";

drop policy "Users can update their own properties" on "public"."properties";

drop policy "Property availability is viewable by everyone" on "public"."property_availability";

drop policy "Property owners can manage availability" on "public"."property_availability";

drop policy "Property owners can create proposals" on "public"."proposals";

drop policy "Users can view their related proposals" on "public"."proposals";

drop policy "Users can delete sent_notifications" on "public"."sent_notifications";

drop policy "Users can insert sent_notifications" on "public"."sent_notifications";

drop policy "Users can update sent_notifications" on "public"."sent_notifications";

drop policy "Users can view sent_notifications" on "public"."sent_notifications";

drop policy "Users can update their own profile" on "public"."profiles";

revoke delete on table "public"."analysis_results" from "anon";

revoke insert on table "public"."analysis_results" from "anon";

revoke references on table "public"."analysis_results" from "anon";

revoke select on table "public"."analysis_results" from "anon";

revoke trigger on table "public"."analysis_results" from "anon";

revoke truncate on table "public"."analysis_results" from "anon";

revoke update on table "public"."analysis_results" from "anon";

revoke references on table "public"."analysis_results" from "authenticated";

revoke trigger on table "public"."analysis_results" from "authenticated";

revoke truncate on table "public"."analysis_results" from "authenticated";

revoke delete on table "public"."bookings" from "anon";

revoke insert on table "public"."bookings" from "anon";

revoke references on table "public"."bookings" from "anon";

revoke select on table "public"."bookings" from "anon";

revoke trigger on table "public"."bookings" from "anon";

revoke truncate on table "public"."bookings" from "anon";

revoke update on table "public"."bookings" from "anon";

revoke delete on table "public"."edge_rate_limits" from "anon";

revoke insert on table "public"."edge_rate_limits" from "anon";

revoke references on table "public"."edge_rate_limits" from "anon";

revoke select on table "public"."edge_rate_limits" from "anon";

revoke trigger on table "public"."edge_rate_limits" from "anon";

revoke truncate on table "public"."edge_rate_limits" from "anon";

revoke update on table "public"."edge_rate_limits" from "anon";

revoke delete on table "public"."edge_rate_limits" from "authenticated";

revoke insert on table "public"."edge_rate_limits" from "authenticated";

revoke references on table "public"."edge_rate_limits" from "authenticated";

revoke select on table "public"."edge_rate_limits" from "authenticated";

revoke trigger on table "public"."edge_rate_limits" from "authenticated";

revoke truncate on table "public"."edge_rate_limits" from "authenticated";

revoke update on table "public"."edge_rate_limits" from "authenticated";

revoke delete on table "public"."edge_rate_limits" from "service_role";

revoke insert on table "public"."edge_rate_limits" from "service_role";

revoke references on table "public"."edge_rate_limits" from "service_role";

revoke select on table "public"."edge_rate_limits" from "service_role";

revoke trigger on table "public"."edge_rate_limits" from "service_role";

revoke truncate on table "public"."edge_rate_limits" from "service_role";

revoke update on table "public"."edge_rate_limits" from "service_role";

revoke delete on table "public"."faq_categories" from "anon";

revoke insert on table "public"."faq_categories" from "anon";

revoke references on table "public"."faq_categories" from "anon";

revoke select on table "public"."faq_categories" from "anon";

revoke trigger on table "public"."faq_categories" from "anon";

revoke truncate on table "public"."faq_categories" from "anon";

revoke update on table "public"."faq_categories" from "anon";

revoke references on table "public"."faq_categories" from "authenticated";

revoke trigger on table "public"."faq_categories" from "authenticated";

revoke truncate on table "public"."faq_categories" from "authenticated";

revoke delete on table "public"."faq_entries" from "anon";

revoke insert on table "public"."faq_entries" from "anon";

revoke references on table "public"."faq_entries" from "anon";

revoke select on table "public"."faq_entries" from "anon";

revoke trigger on table "public"."faq_entries" from "anon";

revoke truncate on table "public"."faq_entries" from "anon";

revoke update on table "public"."faq_entries" from "anon";

revoke references on table "public"."faq_entries" from "authenticated";

revoke trigger on table "public"."faq_entries" from "authenticated";

revoke truncate on table "public"."faq_entries" from "authenticated";

revoke delete on table "public"."favorites" from "anon";

revoke insert on table "public"."favorites" from "anon";

revoke references on table "public"."favorites" from "anon";

revoke select on table "public"."favorites" from "anon";

revoke trigger on table "public"."favorites" from "anon";

revoke truncate on table "public"."favorites" from "anon";

revoke update on table "public"."favorites" from "anon";

revoke references on table "public"."favorites" from "authenticated";

revoke trigger on table "public"."favorites" from "authenticated";

revoke truncate on table "public"."favorites" from "authenticated";

revoke update on table "public"."favorites" from "authenticated";

revoke delete on table "public"."favorites" from "service_role";

revoke insert on table "public"."favorites" from "service_role";

revoke references on table "public"."favorites" from "service_role";

revoke select on table "public"."favorites" from "service_role";

revoke trigger on table "public"."favorites" from "service_role";

revoke truncate on table "public"."favorites" from "service_role";

revoke update on table "public"."favorites" from "service_role";

revoke delete on table "public"."inquiries" from "anon";

revoke insert on table "public"."inquiries" from "anon";

revoke references on table "public"."inquiries" from "anon";

revoke trigger on table "public"."inquiries" from "anon";

revoke truncate on table "public"."inquiries" from "anon";

revoke update on table "public"."inquiries" from "anon";

revoke delete on table "public"."lease_clauses" from "anon";

revoke insert on table "public"."lease_clauses" from "anon";

revoke references on table "public"."lease_clauses" from "anon";

revoke select on table "public"."lease_clauses" from "anon";

revoke trigger on table "public"."lease_clauses" from "anon";

revoke truncate on table "public"."lease_clauses" from "anon";

revoke update on table "public"."lease_clauses" from "anon";

revoke references on table "public"."lease_clauses" from "authenticated";

revoke trigger on table "public"."lease_clauses" from "authenticated";

revoke truncate on table "public"."lease_clauses" from "authenticated";

revoke delete on table "public"."leases" from "anon";

revoke insert on table "public"."leases" from "anon";

revoke references on table "public"."leases" from "anon";

revoke select on table "public"."leases" from "anon";

revoke trigger on table "public"."leases" from "anon";

revoke truncate on table "public"."leases" from "anon";

revoke update on table "public"."leases" from "anon";

revoke references on table "public"."leases" from "authenticated";

revoke trigger on table "public"."leases" from "authenticated";

revoke truncate on table "public"."leases" from "authenticated";

revoke delete on table "public"."messages" from "anon";

revoke insert on table "public"."messages" from "anon";

revoke references on table "public"."messages" from "anon";

revoke trigger on table "public"."messages" from "anon";

revoke truncate on table "public"."messages" from "anon";

revoke update on table "public"."messages" from "anon";

revoke delete on table "public"."organization_adjustments" from "anon";

revoke insert on table "public"."organization_adjustments" from "anon";

revoke references on table "public"."organization_adjustments" from "anon";

revoke select on table "public"."organization_adjustments" from "anon";

revoke trigger on table "public"."organization_adjustments" from "anon";

revoke truncate on table "public"."organization_adjustments" from "anon";

revoke update on table "public"."organization_adjustments" from "anon";

revoke references on table "public"."organization_adjustments" from "authenticated";

revoke trigger on table "public"."organization_adjustments" from "authenticated";

revoke truncate on table "public"."organization_adjustments" from "authenticated";

revoke delete on table "public"."organization_credit_ledger" from "anon";

revoke insert on table "public"."organization_credit_ledger" from "anon";

revoke references on table "public"."organization_credit_ledger" from "anon";

revoke select on table "public"."organization_credit_ledger" from "anon";

revoke trigger on table "public"."organization_credit_ledger" from "anon";

revoke truncate on table "public"."organization_credit_ledger" from "anon";

revoke update on table "public"."organization_credit_ledger" from "anon";

revoke delete on table "public"."organization_credit_ledger" from "authenticated";

revoke insert on table "public"."organization_credit_ledger" from "authenticated";

revoke references on table "public"."organization_credit_ledger" from "authenticated";

revoke select on table "public"."organization_credit_ledger" from "authenticated";

revoke trigger on table "public"."organization_credit_ledger" from "authenticated";

revoke truncate on table "public"."organization_credit_ledger" from "authenticated";

revoke update on table "public"."organization_credit_ledger" from "authenticated";

revoke delete on table "public"."organization_credit_ledger" from "service_role";

revoke insert on table "public"."organization_credit_ledger" from "service_role";

revoke references on table "public"."organization_credit_ledger" from "service_role";

revoke select on table "public"."organization_credit_ledger" from "service_role";

revoke trigger on table "public"."organization_credit_ledger" from "service_role";

revoke truncate on table "public"."organization_credit_ledger" from "service_role";

revoke update on table "public"."organization_credit_ledger" from "service_role";

revoke delete on table "public"."organization_member_invites" from "anon";

revoke insert on table "public"."organization_member_invites" from "anon";

revoke references on table "public"."organization_member_invites" from "anon";

revoke select on table "public"."organization_member_invites" from "anon";

revoke trigger on table "public"."organization_member_invites" from "anon";

revoke truncate on table "public"."organization_member_invites" from "anon";

revoke update on table "public"."organization_member_invites" from "anon";

revoke delete on table "public"."organization_member_invites" from "authenticated";

revoke insert on table "public"."organization_member_invites" from "authenticated";

revoke references on table "public"."organization_member_invites" from "authenticated";

revoke trigger on table "public"."organization_member_invites" from "authenticated";

revoke truncate on table "public"."organization_member_invites" from "authenticated";

revoke update on table "public"."organization_member_invites" from "authenticated";

revoke delete on table "public"."organization_members" from "anon";

revoke insert on table "public"."organization_members" from "anon";

revoke references on table "public"."organization_members" from "anon";

revoke trigger on table "public"."organization_members" from "anon";

revoke truncate on table "public"."organization_members" from "anon";

revoke update on table "public"."organization_members" from "anon";

revoke delete on table "public"."organization_members" from "authenticated";

revoke insert on table "public"."organization_members" from "authenticated";

revoke references on table "public"."organization_members" from "authenticated";

revoke trigger on table "public"."organization_members" from "authenticated";

revoke truncate on table "public"."organization_members" from "authenticated";

revoke update on table "public"."organization_members" from "authenticated";

revoke delete on table "public"."organization_members" from "service_role";

revoke insert on table "public"."organization_members" from "service_role";

revoke references on table "public"."organization_members" from "service_role";

revoke select on table "public"."organization_members" from "service_role";

revoke trigger on table "public"."organization_members" from "service_role";

revoke truncate on table "public"."organization_members" from "service_role";

revoke update on table "public"."organization_members" from "service_role";

revoke delete on table "public"."organizations" from "anon";

revoke insert on table "public"."organizations" from "anon";

revoke references on table "public"."organizations" from "anon";

revoke select on table "public"."organizations" from "anon";

revoke trigger on table "public"."organizations" from "anon";

revoke truncate on table "public"."organizations" from "anon";

revoke update on table "public"."organizations" from "anon";

revoke delete on table "public"."organizations" from "authenticated";

revoke references on table "public"."organizations" from "authenticated";

revoke trigger on table "public"."organizations" from "authenticated";

revoke truncate on table "public"."organizations" from "authenticated";

revoke delete on table "public"."pages" from "anon";

revoke insert on table "public"."pages" from "anon";

revoke references on table "public"."pages" from "anon";

revoke trigger on table "public"."pages" from "anon";

revoke truncate on table "public"."pages" from "anon";

revoke update on table "public"."pages" from "anon";

revoke references on table "public"."pages" from "authenticated";

revoke trigger on table "public"."pages" from "authenticated";

revoke truncate on table "public"."pages" from "authenticated";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "anon";

revoke select on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."profiles" from "authenticated";

revoke references on table "public"."profiles" from "authenticated";

revoke trigger on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

revoke delete on table "public"."profiles" from "service_role";

revoke insert on table "public"."profiles" from "service_role";

revoke references on table "public"."profiles" from "service_role";

revoke trigger on table "public"."profiles" from "service_role";

revoke truncate on table "public"."profiles" from "service_role";

revoke update on table "public"."profiles" from "service_role";

revoke delete on table "public"."properties" from "anon";

revoke insert on table "public"."properties" from "anon";

revoke references on table "public"."properties" from "anon";

revoke trigger on table "public"."properties" from "anon";

revoke truncate on table "public"."properties" from "anon";

revoke update on table "public"."properties" from "anon";

revoke delete on table "public"."property_availability" from "anon";

revoke insert on table "public"."property_availability" from "anon";

revoke references on table "public"."property_availability" from "anon";

revoke select on table "public"."property_availability" from "anon";

revoke trigger on table "public"."property_availability" from "anon";

revoke truncate on table "public"."property_availability" from "anon";

revoke update on table "public"."property_availability" from "anon";

revoke delete on table "public"."property_availability" from "authenticated";

revoke insert on table "public"."property_availability" from "authenticated";

revoke references on table "public"."property_availability" from "authenticated";

revoke select on table "public"."property_availability" from "authenticated";

revoke trigger on table "public"."property_availability" from "authenticated";

revoke truncate on table "public"."property_availability" from "authenticated";

revoke update on table "public"."property_availability" from "authenticated";

revoke delete on table "public"."property_availability" from "service_role";

revoke insert on table "public"."property_availability" from "service_role";

revoke references on table "public"."property_availability" from "service_role";

revoke select on table "public"."property_availability" from "service_role";

revoke trigger on table "public"."property_availability" from "service_role";

revoke truncate on table "public"."property_availability" from "service_role";

revoke update on table "public"."property_availability" from "service_role";

revoke delete on table "public"."property_schedule" from "anon";

revoke insert on table "public"."property_schedule" from "anon";

revoke references on table "public"."property_schedule" from "anon";

revoke trigger on table "public"."property_schedule" from "anon";

revoke truncate on table "public"."property_schedule" from "anon";

revoke update on table "public"."property_schedule" from "anon";

revoke references on table "public"."property_schedule" from "authenticated";

revoke trigger on table "public"."property_schedule" from "authenticated";

revoke truncate on table "public"."property_schedule" from "authenticated";

revoke delete on table "public"."proposals" from "anon";

revoke insert on table "public"."proposals" from "anon";

revoke references on table "public"."proposals" from "anon";

revoke select on table "public"."proposals" from "anon";

revoke trigger on table "public"."proposals" from "anon";

revoke truncate on table "public"."proposals" from "anon";

revoke update on table "public"."proposals" from "anon";

revoke delete on table "public"."review_responses" from "anon";

revoke insert on table "public"."review_responses" from "anon";

revoke references on table "public"."review_responses" from "anon";

revoke trigger on table "public"."review_responses" from "anon";

revoke truncate on table "public"."review_responses" from "anon";

revoke update on table "public"."review_responses" from "anon";

revoke delete on table "public"."review_responses" from "authenticated";

revoke insert on table "public"."review_responses" from "authenticated";

revoke references on table "public"."review_responses" from "authenticated";

revoke trigger on table "public"."review_responses" from "authenticated";

revoke truncate on table "public"."review_responses" from "authenticated";

revoke update on table "public"."review_responses" from "authenticated";

revoke delete on table "public"."review_responses" from "service_role";

revoke insert on table "public"."review_responses" from "service_role";

revoke references on table "public"."review_responses" from "service_role";

revoke select on table "public"."review_responses" from "service_role";

revoke trigger on table "public"."review_responses" from "service_role";

revoke truncate on table "public"."review_responses" from "service_role";

revoke update on table "public"."review_responses" from "service_role";

revoke delete on table "public"."reviews" from "anon";

revoke insert on table "public"."reviews" from "anon";

revoke references on table "public"."reviews" from "anon";

revoke trigger on table "public"."reviews" from "anon";

revoke truncate on table "public"."reviews" from "anon";

revoke update on table "public"."reviews" from "anon";

revoke delete on table "public"."reviews" from "authenticated";

revoke insert on table "public"."reviews" from "authenticated";

revoke references on table "public"."reviews" from "authenticated";

revoke trigger on table "public"."reviews" from "authenticated";

revoke truncate on table "public"."reviews" from "authenticated";

revoke update on table "public"."reviews" from "authenticated";

revoke delete on table "public"."reviews" from "service_role";

revoke insert on table "public"."reviews" from "service_role";

revoke references on table "public"."reviews" from "service_role";

revoke select on table "public"."reviews" from "service_role";

revoke trigger on table "public"."reviews" from "service_role";

revoke truncate on table "public"."reviews" from "service_role";

revoke update on table "public"."reviews" from "service_role";

revoke delete on table "public"."sent_notifications" from "anon";

revoke insert on table "public"."sent_notifications" from "anon";

revoke references on table "public"."sent_notifications" from "anon";

revoke trigger on table "public"."sent_notifications" from "anon";

revoke truncate on table "public"."sent_notifications" from "anon";

revoke update on table "public"."sent_notifications" from "anon";

revoke delete on table "public"."system_settings" from "anon";

revoke insert on table "public"."system_settings" from "anon";

revoke references on table "public"."system_settings" from "anon";

revoke select on table "public"."system_settings" from "anon";

revoke trigger on table "public"."system_settings" from "anon";

revoke truncate on table "public"."system_settings" from "anon";

revoke update on table "public"."system_settings" from "anon";

revoke delete on table "public"."system_settings" from "authenticated";

revoke insert on table "public"."system_settings" from "authenticated";

revoke references on table "public"."system_settings" from "authenticated";

revoke trigger on table "public"."system_settings" from "authenticated";

revoke truncate on table "public"."system_settings" from "authenticated";

revoke delete on table "public"."webhook_logs" from "anon";

revoke insert on table "public"."webhook_logs" from "anon";

revoke references on table "public"."webhook_logs" from "anon";

revoke select on table "public"."webhook_logs" from "anon";

revoke trigger on table "public"."webhook_logs" from "anon";

revoke truncate on table "public"."webhook_logs" from "anon";

revoke update on table "public"."webhook_logs" from "anon";

revoke delete on table "public"."webhook_logs" from "authenticated";

revoke insert on table "public"."webhook_logs" from "authenticated";

revoke references on table "public"."webhook_logs" from "authenticated";

revoke select on table "public"."webhook_logs" from "authenticated";

revoke trigger on table "public"."webhook_logs" from "authenticated";

revoke truncate on table "public"."webhook_logs" from "authenticated";

revoke update on table "public"."webhook_logs" from "authenticated";

revoke delete on table "public"."webhook_logs" from "service_role";

revoke insert on table "public"."webhook_logs" from "service_role";

revoke references on table "public"."webhook_logs" from "service_role";

revoke select on table "public"."webhook_logs" from "service_role";

revoke trigger on table "public"."webhook_logs" from "service_role";

revoke truncate on table "public"."webhook_logs" from "service_role";

revoke update on table "public"."webhook_logs" from "service_role";

revoke delete on table "public"."webhook_notification_log" from "anon";

revoke insert on table "public"."webhook_notification_log" from "anon";

revoke references on table "public"."webhook_notification_log" from "anon";

revoke select on table "public"."webhook_notification_log" from "anon";

revoke trigger on table "public"."webhook_notification_log" from "anon";

revoke truncate on table "public"."webhook_notification_log" from "anon";

revoke update on table "public"."webhook_notification_log" from "anon";

alter table "public"."organization_member_invites" drop constraint "organization_member_invites_invited_by_fkey";

alter table "public"."properties" drop constraint "properties_organization_id_fkey";

drop index if exists "public"."idx_bookings_property_id";

drop index if exists "public"."idx_bookings_user_id";

drop index if exists "public"."idx_inquiries_property_id";

drop index if exists "public"."idx_inquiries_user_id";

drop index if exists "public"."idx_organizations_slug";

drop index if exists "public"."idx_profiles_email";

drop index if exists "public"."idx_properties_venue_id";

alter type "public"."org_adjustment_type" rename to "org_adjustment_type__old_version_to_be_dropped";

create type "public"."org_adjustment_type" as enum ('user_selected_discount', 'capacity_surcharge', 'off_hours_adjustment', 'off_days_adjustment');

alter table "public"."organization_adjustments" alter column type type "public"."org_adjustment_type" using type::text::"public"."org_adjustment_type";

drop type "public"."org_adjustment_type__old_version_to_be_dropped";

alter table "public"."analysis_results" alter column "created_at" set default now();

alter table "public"."analysis_results" alter column "id" set default gen_random_uuid();

alter table "public"."analysis_results" alter column "lease_area_unit" set default 'sq_ft'::text;

alter table "public"."analysis_results" alter column "updated_at" set default now();

alter table "public"."analysis_results" enable row level security;

alter table "public"."bookings" add column "end_at" timestamp with time zone;

alter table "public"."bookings" add column "kind" text default 'daily'::text;

alter table "public"."bookings" add column "service_credit_applied_at" timestamp with time zone;

alter table "public"."bookings" add column "service_credit_applied_cents" integer not null default 0;

alter table "public"."bookings" add column "service_credit_applied_pi_id" text;

alter table "public"."bookings" add column "start_at" timestamp with time zone;

alter table "public"."bookings" disable row level security;

alter table "public"."edge_rate_limits" alter column "created_at" set default now();

alter table "public"."edge_rate_limits" alter column "id" set default gen_random_uuid();

alter table "public"."faq_categories" alter column "created_at" set default now();

alter table "public"."faq_categories" alter column "id" set default gen_random_uuid();

alter table "public"."faq_categories" alter column "position" set default 0;

alter table "public"."faq_categories" enable row level security;

alter table "public"."faq_entries" alter column "created_at" set default now();

alter table "public"."faq_entries" alter column "id" set default gen_random_uuid();

alter table "public"."faq_entries" alter column "position" set default 0;

alter table "public"."faq_entries" alter column "published" set default true;

alter table "public"."faq_entries" alter column "tags" set default '{}'::text[];

alter table "public"."faq_entries" enable row level security;

alter table "public"."favorites" alter column "created_at" set default now();

alter table "public"."favorites" alter column "id" set default gen_random_uuid();

alter table "public"."favorites" enable row level security;

alter table "public"."import_datamining" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."import_datamining" alter column "processing_status" set default 'pending'::text;

alter table "public"."import_datamining" enable row level security;

alter table "public"."inquiries" add column "end_at" timestamp with time zone;

alter table "public"."inquiries" add column "headcount" integer;

alter table "public"."inquiries" add column "initiator_closed" boolean not null default false;

alter table "public"."inquiries" add column "initiator_deleted" boolean not null default false;

alter table "public"."inquiries" add column "initiator_last_read_message_id" uuid;

alter table "public"."inquiries" add column "responder_closed" boolean not null default false;

alter table "public"."inquiries" add column "responder_deleted" boolean not null default false;

alter table "public"."inquiries" add column "responder_last_read_message_id" uuid;

alter table "public"."inquiries" add column "selected_adjustment_ids" uuid[] default '{}'::uuid[];

alter table "public"."inquiries" add column "start_at" timestamp with time zone;

alter table "public"."inquiries" disable row level security;

alter table "public"."lease_clauses" alter column "confidence_score" set default 0.0;

alter table "public"."lease_clauses" alter column "created_at" set default now();

alter table "public"."lease_clauses" alter column "id" set default gen_random_uuid();

alter table "public"."lease_clauses" alter column "risk_flag" set default 'low'::text;

alter table "public"."lease_clauses" enable row level security;

alter table "public"."leases" alter column "created_at" set default now();

alter table "public"."leases" alter column "id" set default gen_random_uuid();

alter table "public"."leases" alter column "updated_at" set default now();

alter table "public"."leases" alter column "upload_status" set default 'uploaded'::text;

alter table "public"."leases" enable row level security;

alter table "public"."messages" alter column "created_at" set default now();

alter table "public"."messages" alter column "id" set default gen_random_uuid();

alter table "public"."messages" disable row level security;

alter table "public"."organization_adjustments" alter column "created_at" set default now();

alter table "public"."organization_adjustments" alter column "data" set default '{}'::jsonb;

alter table "public"."organization_adjustments" alter column "id" set default gen_random_uuid();

alter table "public"."organization_adjustments" alter column "sort_order" set default 0;

alter table "public"."organization_adjustments" alter column "updated_at" set default now();

alter table "public"."organization_adjustments" enable row level security;

alter table "public"."organization_credit_ledger" alter column "created_at" set default now();

alter table "public"."organization_credit_ledger" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."organization_credit_ledger" alter column "reason" set default 'service_credit_applied'::text;

alter table "public"."organization_credit_ledger" enable row level security;

alter table "public"."organization_inquiry_forms" alter column "id" set default gen_random_uuid();

alter table "public"."organization_inquiry_forms" alter column "survey_json" set default '{}'::jsonb;

alter table "public"."organization_inquiry_forms" alter column "updated_at" set default now();

alter table "public"."organization_inquiry_forms" alter column "version" set default 1;

alter table "public"."organization_inquiry_forms" enable row level security;

alter table "public"."organization_member_invites" alter column "id" set default gen_random_uuid();

alter table "public"."organization_member_invites" enable row level security;

alter table "public"."organization_members" enable row level security;

alter table "public"."organizations" add column "about_brand" text;

alter table "public"."organizations" add column "business_type" text;

alter table "public"."organizations" add column "charges_enabled" boolean default false;

alter table "public"."organizations" add column "default_timezone" text;

alter table "public"."organizations" add column "payouts_enabled" boolean default false;

alter table "public"."organizations" add column "service_credit" numeric not null default 0;

alter table "public"."organizations" add column "stripe_account_id" text;

alter table "public"."pages" alter column "created_at" set default now();

alter table "public"."pages" alter column "id" set default gen_random_uuid();

alter table "public"."pages" alter column "page_type" set default 'Information'::text;

alter table "public"."pages" alter column "type" set default 'Information'::text;

alter table "public"."pages" alter column "updated_at" set default now();

alter table "public"."pages" enable row level security;

alter table "public"."profiles" drop column "business_type";

alter table "public"."profiles" drop column "charges_enabled";

alter table "public"."profiles" drop column "company_name";

alter table "public"."profiles" drop column "payouts_enabled";

alter table "public"."profiles" drop column "service_credit";

alter table "public"."profiles" drop column "stripe_account_id";

alter table "public"."profiles" alter column "brevo_opt_in" set default false;

alter table "public"."profiles" alter column "is_admin" set default false;

alter table "public"."profiles" alter column "survey_answers" set default '[]'::jsonb;

alter table "public"."properties" add column "applied_adjustment_ids" uuid[] default '{}'::uuid[];

alter table "public"."properties" add column "capacity" integer;

alter table "public"."properties" add column "currency" text;

alter table "public"."properties" add column "downloadable_files" jsonb;

alter table "public"."properties" add column "fast_responder" boolean;

alter table "public"."properties" add column "featured" boolean default false;

alter table "public"."properties" add column "fee_description" text;

alter table "public"."properties" add column "fee_type" text default 'percentage'::text;

alter table "public"."properties" add column "fee_value" numeric default 0;

alter table "public"."properties" add column "floor_plan" text;

alter table "public"."properties" add column "iana_timezone" text;

alter table "public"."properties" add column "location_type" text[];

alter table "public"."properties" add column "metro_area" text;

alter table "public"."properties" add column "monthly_percent" integer;

alter table "public"."properties" add column "monthly_rate" numeric(10,2);

alter table "public"."properties" add column "monthly_rate_type" text;

alter table "public"."properties" add column "monthly_rate_value" numeric;

alter table "public"."properties" add column "neighborhood" text;

alter table "public"."properties" add column "price_per_hour" numeric;

alter table "public"."properties" add column "published" boolean default false;

alter table "public"."properties" add column "space_attributes" text[] not null default '{}'::text[];

alter table "public"."properties" add column "tax_rate" numeric default 0;

alter table "public"."properties" add column "virtual_tour_url" text;

alter table "public"."properties" add column "weekly_percent" integer;

alter table "public"."properties" add column "weekly_rate" numeric(10,2);

alter table "public"."properties" add column "weekly_rate_type" text;

alter table "public"."properties" add column "weekly_rate_value" numeric;

alter table "public"."properties" add column "yearly_percent" integer;

alter table "public"."properties" add column "yearly_rate" numeric(10,2);

alter table "public"."properties" add column "yearly_rate_type" text;

alter table "public"."properties" add column "yearly_rate_value" numeric;

alter table "public"."properties" disable row level security;

alter table "public"."property_schedule" alter column "created_at" set default now();

alter table "public"."property_schedule" alter column "daily_schedule" set default '{"friday": {"end": "5:00pm", "start": "9:00am", "enabled": true}, "monday": {"end": "5:00pm", "start": "9:00am", "enabled": true}, "sunday": {"end": "5:00pm", "start": "9:00am", "enabled": false}, "tuesday": {"end": "5:00pm", "start": "9:00am", "enabled": true}, "saturday": {"end": "5:00pm", "start": "9:00am", "enabled": false}, "thursday": {"end": "5:00pm", "start": "9:00am", "enabled": true}, "wednesday": {"end": "5:00pm", "start": "9:00am", "enabled": true}}'::jsonb;

alter table "public"."property_schedule" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."property_schedule" alter column "limit_availability" set default true;

alter table "public"."property_schedule" alter column "updated_at" set default now();

alter table "public"."property_schedule" enable row level security;

alter table "public"."proposals" add column "request_id" text;

alter table "public"."proposals" disable row level security;

alter table "public"."review_reminders" alter column "created_at" set default now();

alter table "public"."review_reminders" alter column "id" set default gen_random_uuid();

alter table "public"."review_reminders" alter column "reminder_type" set default 'review_first'::text;

alter table "public"."review_reminders" alter column "updated_at" set default now();

alter table "public"."review_reminders" enable row level security;

alter table "public"."review_responses" alter column "created_at" set default now();

alter table "public"."review_responses" alter column "id" set default gen_random_uuid();

alter table "public"."review_responses" alter column "updated_at" set default now();

alter table "public"."review_responses" enable row level security;

alter table "public"."reviews" alter column "created_at" set default now();

alter table "public"."reviews" alter column "id" set default gen_random_uuid();

alter table "public"."reviews" alter column "review_eligibility" set default '{"booking_id": null, "inquiry_id": null, "payment_status": "none", "completed_booking": false}'::jsonb;

alter table "public"."reviews" alter column "status" set default 'pending'::text;

alter table "public"."reviews" alter column "updated_at" set default now();

alter table "public"."reviews" alter column "verified_booking" set default false;

alter table "public"."reviews" enable row level security;

alter table "public"."sent_notifications" alter column "created_at" set default now();

alter table "public"."sent_notifications" alter column "has_attachments" set default false;

alter table "public"."sent_notifications" alter column "id" set default gen_random_uuid();

alter table "public"."sent_notifications" disable row level security;

alter table "public"."system_settings" alter column "created_at" set default now();

alter table "public"."system_settings" alter column "id" set default gen_random_uuid();

alter table "public"."system_settings" alter column "updated_at" set default now();

alter table "public"."system_settings" enable row level security;

alter table "public"."webhook_logs" alter column "created_at" set default now();

alter table "public"."webhook_logs" alter column "id" set default gen_random_uuid();

alter table "public"."webhook_logs" enable row level security;

alter table "public"."webhook_notification_log" alter column "created_at" set default now();

alter table "public"."webhook_notification_log" alter column "has_attachments" set default false;

alter table "public"."webhook_notification_log" alter column "id" set default gen_random_uuid();

CREATE UNIQUE INDEX analysis_results_pkey ON public.analysis_results USING btree (id);

CREATE INDEX bookings_created_at_idx ON public.bookings USING btree (created_at DESC);

CREATE INDEX bookings_property_created_at_idx ON public.bookings USING btree (property_id, created_at DESC);

CREATE INDEX bookings_status_created_at_idx ON public.bookings USING btree (status, created_at DESC);

CREATE INDEX bookings_user_created_at_idx ON public.bookings USING btree (user_id, created_at DESC);

CREATE INDEX edge_rate_limits_ip_func_created_at_idx ON public.edge_rate_limits USING btree (ip, function, created_at DESC);

CREATE UNIQUE INDEX edge_rate_limits_pkey ON public.edge_rate_limits USING btree (id);

CREATE INDEX edge_rate_limits_user_func_created_at_idx ON public.edge_rate_limits USING btree (user_id, function, created_at DESC);

CREATE UNIQUE INDEX faq_categories_pkey ON public.faq_categories USING btree (id);

CREATE UNIQUE INDEX faq_categories_slug_key ON public.faq_categories USING btree (slug);

CREATE INDEX faq_entries_category_position_idx ON public.faq_entries USING btree (category_id, "position");

CREATE UNIQUE INDEX faq_entries_pkey ON public.faq_entries USING btree (id);

CREATE INDEX faq_entries_tags_gin_idx ON public.faq_entries USING gin (tags);

CREATE INDEX faq_entries_tsv_idx ON public.faq_entries USING gin (search_tsv);

CREATE UNIQUE INDEX favorites_pkey ON public.favorites USING btree (id);

CREATE INDEX idx_analysis_results_lease_id ON public.analysis_results USING btree (lease_id);

CREATE INDEX idx_bookings_credit_pi_id ON public.bookings USING btree (service_credit_applied_pi_id);

CREATE INDEX idx_bookings_property_time ON public.bookings USING btree (property_id, start_at, end_at);

CREATE INDEX idx_bookings_proposal_id ON public.bookings USING btree (proposal_id);

CREATE INDEX idx_favorites_property_id ON public.favorites USING btree (property_id);

CREATE INDEX idx_favorites_user_id ON public.favorites USING btree (user_id);

CREATE INDEX idx_import_datamining_processing_status ON public.import_datamining USING btree (processing_status);

CREATE INDEX idx_inquiries_initiator_closed ON public.inquiries USING btree (initiator_closed);

CREATE INDEX idx_inquiries_initiator_deleted ON public.inquiries USING btree (initiator_deleted);

CREATE INDEX idx_inquiries_initiator_last_read ON public.inquiries USING btree (initiator_last_read_message_id);

CREATE INDEX idx_inquiries_responder_closed ON public.inquiries USING btree (responder_closed);

CREATE INDEX idx_inquiries_responder_deleted ON public.inquiries USING btree (responder_deleted);

CREATE INDEX idx_inquiries_responder_last_read ON public.inquiries USING btree (responder_last_read_message_id);

CREATE INDEX idx_lease_clauses_lease_id ON public.lease_clauses USING btree (lease_id);

CREATE INDEX idx_lease_clauses_risk ON public.lease_clauses USING btree (risk_flag);

CREATE INDEX idx_lease_clauses_type ON public.lease_clauses USING btree (clause_type);

CREATE INDEX idx_leases_status ON public.leases USING btree (upload_status);

CREATE INDEX idx_leases_user_id ON public.leases USING btree (user_id);

CREATE INDEX idx_org_adjustments_org ON public.organization_adjustments USING btree (organization_id);

CREATE INDEX idx_org_adjustments_org_sort ON public.organization_adjustments USING btree (organization_id, sort_order);

CREATE INDEX idx_org_member_invites_email ON public.organization_member_invites USING btree (lower(email));

CREATE INDEX idx_org_member_invites_org ON public.organization_member_invites USING btree (organization_id);

CREATE INDEX idx_profiles_brevo_opt_in ON public.profiles USING btree (brevo_opt_in);

CREATE INDEX idx_profiles_primary_organization_id ON public.profiles USING btree (primary_organization_id);

CREATE INDEX idx_properties_featured ON public.properties USING btree (featured) WHERE (featured = true);

CREATE INDEX idx_properties_metro_area ON public.properties USING btree (metro_area);

CREATE INDEX idx_properties_neighborhood ON public.properties USING btree (neighborhood);

CREATE INDEX idx_properties_price_per_hour ON public.properties USING btree (price_per_hour) WHERE (price_per_hour IS NOT NULL);

CREATE INDEX idx_property_schedule_dates ON public.property_schedule USING btree (property_id, available_from, available_until);

CREATE INDEX idx_property_schedule_ical_url ON public.property_schedule USING btree (property_id) WHERE (ical_url IS NOT NULL);

CREATE INDEX idx_property_schedule_limit_availability ON public.property_schedule USING btree (property_id, limit_availability);

CREATE INDEX idx_proposals_inquiry_id ON public.proposals USING btree (inquiry_id);

CREATE INDEX idx_review_responses_review_id ON public.review_responses USING btree (review_id);

CREATE INDEX idx_reviews_property_id ON public.reviews USING btree (property_id);

CREATE INDEX idx_reviews_rating ON public.reviews USING btree (rating);

CREATE INDEX idx_reviews_reviewer_id ON public.reviews USING btree (reviewer_id);

CREATE INDEX idx_reviews_status ON public.reviews USING btree (status);

CREATE INDEX idx_sent_notifications_request_id ON public.sent_notifications USING btree (request_id);

CREATE INDEX import_datamining_organization_id_idx ON public.import_datamining USING btree (organization_id);

CREATE UNIQUE INDEX import_datamining_pkey ON public.import_datamining USING btree (id);

CREATE UNIQUE INDEX lease_clauses_pkey ON public.lease_clauses USING btree (id);

CREATE UNIQUE INDEX leases_pkey ON public.leases USING btree (id);

CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id);

CREATE UNIQUE INDEX organization_adjustments_pkey ON public.organization_adjustments USING btree (id);

CREATE UNIQUE INDEX organization_credit_ledger_booking_id_payment_intent_id_key ON public.organization_credit_ledger USING btree (booking_id, payment_intent_id);

CREATE UNIQUE INDEX organization_credit_ledger_pkey ON public.organization_credit_ledger USING btree (id);

CREATE UNIQUE INDEX organization_inquiry_forms_organization_id_key ON public.organization_inquiry_forms USING btree (organization_id);

CREATE UNIQUE INDEX organization_inquiry_forms_pkey ON public.organization_inquiry_forms USING btree (id);

CREATE UNIQUE INDEX organization_member_invites_organization_id_email_key ON public.organization_member_invites USING btree (organization_id, email);

CREATE UNIQUE INDEX pages_pkey ON public.pages USING btree (id);

CREATE UNIQUE INDEX pages_slug_key ON public.pages USING btree (slug);

CREATE INDEX properties_applied_adjustment_ids_gin ON public.properties USING gin (applied_adjustment_ids);

CREATE UNIQUE INDEX property_schedule_pkey ON public.property_schedule USING btree (id);

CREATE UNIQUE INDEX property_schedule_property_id_key ON public.property_schedule USING btree (property_id);

CREATE UNIQUE INDEX proposals_request_id_key ON public.proposals USING btree (request_id) WHERE (request_id IS NOT NULL);

CREATE UNIQUE INDEX review_reminders_booking_id_reminder_type_key ON public.review_reminders USING btree (booking_id, reminder_type);

CREATE INDEX review_reminders_guest_idx ON public.review_reminders USING btree (guest_id);

CREATE UNIQUE INDEX review_reminders_pkey ON public.review_reminders USING btree (id);

CREATE INDEX review_reminders_review_id_idx ON public.review_reminders USING btree (review_id);

CREATE INDEX review_reminders_scheduled_for_idx ON public.review_reminders USING btree (scheduled_for);

CREATE INDEX review_reminders_sent_at_idx ON public.review_reminders USING btree (sent_at);

CREATE UNIQUE INDEX review_responses_pkey ON public.review_responses USING btree (id);

CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id);

CREATE UNIQUE INDEX sent_notifications_pkey ON public.sent_notifications USING btree (id);

CREATE UNIQUE INDEX sent_notifications_request_id_key ON public.sent_notifications USING btree (request_id);

CREATE UNIQUE INDEX system_settings_key_key ON public.system_settings USING btree (key);

CREATE UNIQUE INDEX system_settings_pkey ON public.system_settings USING btree (id);

CREATE UNIQUE INDEX unique_user_property_favorite ON public.favorites USING btree (user_id, property_id);

CREATE UNIQUE INDEX ux_property_schedule_property_id ON public.property_schedule USING btree (property_id);

CREATE UNIQUE INDEX webhook_logs_pkey ON public.webhook_logs USING btree (id);

CREATE UNIQUE INDEX webhook_notification_log_pkey ON public.webhook_notification_log USING btree (id);

alter table "public"."analysis_results" add constraint "analysis_results_pkey" PRIMARY KEY using index "analysis_results_pkey";

alter table "public"."edge_rate_limits" add constraint "edge_rate_limits_pkey" PRIMARY KEY using index "edge_rate_limits_pkey";

alter table "public"."faq_categories" add constraint "faq_categories_pkey" PRIMARY KEY using index "faq_categories_pkey";

alter table "public"."faq_entries" add constraint "faq_entries_pkey" PRIMARY KEY using index "faq_entries_pkey";

alter table "public"."favorites" add constraint "favorites_pkey" PRIMARY KEY using index "favorites_pkey";

alter table "public"."import_datamining" add constraint "import_datamining_pkey" PRIMARY KEY using index "import_datamining_pkey";

alter table "public"."lease_clauses" add constraint "lease_clauses_pkey" PRIMARY KEY using index "lease_clauses_pkey";

alter table "public"."leases" add constraint "leases_pkey" PRIMARY KEY using index "leases_pkey";

alter table "public"."messages" add constraint "messages_pkey" PRIMARY KEY using index "messages_pkey";

alter table "public"."organization_adjustments" add constraint "organization_adjustments_pkey" PRIMARY KEY using index "organization_adjustments_pkey";

alter table "public"."organization_credit_ledger" add constraint "organization_credit_ledger_pkey" PRIMARY KEY using index "organization_credit_ledger_pkey";

alter table "public"."organization_inquiry_forms" add constraint "organization_inquiry_forms_pkey" PRIMARY KEY using index "organization_inquiry_forms_pkey";

alter table "public"."pages" add constraint "pages_pkey" PRIMARY KEY using index "pages_pkey";

alter table "public"."property_schedule" add constraint "property_schedule_pkey" PRIMARY KEY using index "property_schedule_pkey";

alter table "public"."review_reminders" add constraint "review_reminders_pkey" PRIMARY KEY using index "review_reminders_pkey";

alter table "public"."review_responses" add constraint "review_responses_pkey" PRIMARY KEY using index "review_responses_pkey";

alter table "public"."reviews" add constraint "reviews_pkey" PRIMARY KEY using index "reviews_pkey";

alter table "public"."sent_notifications" add constraint "sent_notifications_pkey" PRIMARY KEY using index "sent_notifications_pkey";

alter table "public"."system_settings" add constraint "system_settings_pkey" PRIMARY KEY using index "system_settings_pkey";

alter table "public"."webhook_logs" add constraint "webhook_logs_pkey" PRIMARY KEY using index "webhook_logs_pkey";

alter table "public"."webhook_notification_log" add constraint "webhook_notification_log_pkey" PRIMARY KEY using index "webhook_notification_log_pkey";

alter table "public"."analysis_results" add constraint "analysis_results_lease_id_fkey" FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE not valid;

alter table "public"."analysis_results" validate constraint "analysis_results_lease_id_fkey";

alter table "public"."analysis_results" add constraint "analysis_results_permissibility_status_check" CHECK ((permissibility_status = ANY (ARRAY['permitted_unrestricted'::text, 'permitted_with_notification'::text, 'permitted_with_consent'::text, 'prohibited_with_exceptions'::text, 'prohibited_absolute'::text, 'unclear'::text, 'permitted'::text, 'prohibited'::text, 'requires_permission'::text, 'ambiguous'::text]))) not valid;

alter table "public"."analysis_results" validate constraint "analysis_results_permissibility_status_check";

alter table "public"."bookings" add constraint "bookings_kind_check" CHECK ((kind = ANY (ARRAY['daily'::text, 'hourly'::text, 'blocked'::text]))) not valid;

alter table "public"."bookings" validate constraint "bookings_kind_check";

alter table "public"."bookings" add constraint "bookings_service_credit_applied_cents_nonneg" CHECK ((service_credit_applied_cents >= 0)) not valid;

alter table "public"."bookings" validate constraint "bookings_service_credit_applied_cents_nonneg";

alter table "public"."faq_categories" add constraint "faq_categories_slug_key" UNIQUE using index "faq_categories_slug_key";

alter table "public"."faq_entries" add constraint "faq_entries_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.faq_categories(id) ON DELETE SET NULL not valid;

alter table "public"."faq_entries" validate constraint "faq_entries_category_id_fkey";

alter table "public"."favorites" add constraint "favorites_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE not valid;

alter table "public"."favorites" validate constraint "favorites_property_id_fkey";

alter table "public"."favorites" add constraint "favorites_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."favorites" validate constraint "favorites_user_id_fkey";

alter table "public"."favorites" add constraint "unique_user_property_favorite" UNIQUE using index "unique_user_property_favorite";

alter table "public"."import_datamining" add constraint "import_datamining_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."import_datamining" validate constraint "import_datamining_organization_id_fkey";

alter table "public"."import_datamining" add constraint "import_datamining_processing_status_check" CHECK ((processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'skipped'::text]))) not valid;

alter table "public"."import_datamining" validate constraint "import_datamining_processing_status_check";

alter table "public"."inquiries" add constraint "fk_initiator_last_read_message" FOREIGN KEY (initiator_last_read_message_id) REFERENCES public.messages(id) ON DELETE SET NULL not valid;

alter table "public"."inquiries" validate constraint "fk_initiator_last_read_message";

alter table "public"."inquiries" add constraint "fk_responder_last_read_message" FOREIGN KEY (responder_last_read_message_id) REFERENCES public.messages(id) ON DELETE SET NULL not valid;

alter table "public"."inquiries" validate constraint "fk_responder_last_read_message";

alter table "public"."lease_clauses" add constraint "lease_clauses_lease_id_fkey" FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE not valid;

alter table "public"."lease_clauses" validate constraint "lease_clauses_lease_id_fkey";

alter table "public"."leases" add constraint "leases_upload_status_check" CHECK ((upload_status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'completed'::text, 'failed'::text]))) not valid;

alter table "public"."leases" validate constraint "leases_upload_status_check";

alter table "public"."leases" add constraint "leases_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."leases" validate constraint "leases_user_id_fkey";

alter table "public"."messages" add constraint "messages_inquiry_id_fkey" FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_inquiry_id_fkey";

alter table "public"."messages" add constraint "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES public.profiles(id) not valid;

alter table "public"."messages" validate constraint "messages_sender_id_fkey";

alter table "public"."organization_adjustments" add constraint "organization_adjustments_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."organization_adjustments" validate constraint "organization_adjustments_organization_id_fkey";

alter table "public"."organization_credit_ledger" add constraint "organization_credit_ledger_amount_cents_check" CHECK ((amount_cents >= 0)) not valid;

alter table "public"."organization_credit_ledger" validate constraint "organization_credit_ledger_amount_cents_check";

alter table "public"."organization_credit_ledger" add constraint "organization_credit_ledger_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE not valid;

alter table "public"."organization_credit_ledger" validate constraint "organization_credit_ledger_booking_id_fkey";

alter table "public"."organization_credit_ledger" add constraint "organization_credit_ledger_booking_id_payment_intent_id_key" UNIQUE using index "organization_credit_ledger_booking_id_payment_intent_id_key";

alter table "public"."organization_credit_ledger" add constraint "organization_credit_ledger_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."organization_credit_ledger" validate constraint "organization_credit_ledger_organization_id_fkey";

alter table "public"."organization_inquiry_forms" add constraint "organization_inquiry_forms_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE not valid;

alter table "public"."organization_inquiry_forms" validate constraint "organization_inquiry_forms_organization_id_fkey";

alter table "public"."organization_inquiry_forms" add constraint "organization_inquiry_forms_organization_id_key" UNIQUE using index "organization_inquiry_forms_organization_id_key";

alter table "public"."organization_inquiry_forms" add constraint "organization_inquiry_forms_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.profiles(id) not valid;

alter table "public"."organization_inquiry_forms" validate constraint "organization_inquiry_forms_updated_by_fkey";

alter table "public"."organization_member_invites" add constraint "organization_member_invites_organization_id_email_key" UNIQUE using index "organization_member_invites_organization_id_email_key";

alter table "public"."organization_member_invites" add constraint "organization_member_invites_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text]))) not valid;

alter table "public"."organization_member_invites" validate constraint "organization_member_invites_role_check";

alter table "public"."pages" add constraint "pages_slug_key" UNIQUE using index "pages_slug_key";

alter table "public"."pages" add constraint "valid_page_types" CHECK ((page_type = ANY (ARRAY['Support'::text, 'Legal'::text, 'News'::text, 'Information'::text, 'Landing Page'::text, 'Features'::text]))) not valid;

alter table "public"."pages" validate constraint "valid_page_types";

alter table "public"."profiles" add constraint "profiles_primary_organization_id_fkey" FOREIGN KEY (primary_organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_primary_organization_id_fkey";

alter table "public"."properties" add constraint "properties_fee_type_check" CHECK ((fee_type = ANY (ARRAY['percentage'::text, 'fixed'::text]))) not valid;

alter table "public"."properties" validate constraint "properties_fee_type_check";

alter table "public"."properties" add constraint "properties_monthly_rate_type_check" CHECK (((monthly_rate_type IS NULL) OR (monthly_rate_type = ANY (ARRAY['fixed'::text, 'percentage'::text])))) not valid;

alter table "public"."properties" validate constraint "properties_monthly_rate_type_check";

alter table "public"."properties" add constraint "properties_weekly_rate_type_check" CHECK (((weekly_rate_type IS NULL) OR (weekly_rate_type = ANY (ARRAY['fixed'::text, 'percentage'::text])))) not valid;

alter table "public"."properties" validate constraint "properties_weekly_rate_type_check";

alter table "public"."properties" add constraint "properties_yearly_rate_type_check" CHECK (((yearly_rate_type IS NULL) OR (yearly_rate_type = ANY (ARRAY['fixed'::text, 'percentage'::text])))) not valid;

alter table "public"."properties" validate constraint "properties_yearly_rate_type_check";

alter table "public"."property_schedule" add constraint "property_schedule_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE not valid;

alter table "public"."property_schedule" validate constraint "property_schedule_property_id_fkey";

alter table "public"."property_schedule" add constraint "property_schedule_property_id_key" UNIQUE using index "property_schedule_property_id_key";

alter table "public"."review_reminders" add constraint "review_reminders_booking_id_fkey" FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE not valid;

alter table "public"."review_reminders" validate constraint "review_reminders_booking_id_fkey";

alter table "public"."review_reminders" add constraint "review_reminders_booking_id_reminder_type_key" UNIQUE using index "review_reminders_booking_id_reminder_type_key";

alter table "public"."review_reminders" add constraint "review_reminders_guest_id_fkey" FOREIGN KEY (guest_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."review_reminders" validate constraint "review_reminders_guest_id_fkey";

alter table "public"."review_reminders" add constraint "review_reminders_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE not valid;

alter table "public"."review_reminders" validate constraint "review_reminders_property_id_fkey";

alter table "public"."review_reminders" add constraint "review_reminders_review_id_fkey" FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE SET NULL not valid;

alter table "public"."review_reminders" validate constraint "review_reminders_review_id_fkey";

alter table "public"."review_responses" add constraint "review_responses_content_check" CHECK ((length(content) <= 1000)) not valid;

alter table "public"."review_responses" validate constraint "review_responses_content_check";

alter table "public"."review_responses" add constraint "review_responses_responder_id_fkey" FOREIGN KEY (responder_id) REFERENCES public.profiles(id) not valid;

alter table "public"."review_responses" validate constraint "review_responses_responder_id_fkey";

alter table "public"."review_responses" add constraint "review_responses_review_id_fkey" FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE not valid;

alter table "public"."review_responses" validate constraint "review_responses_review_id_fkey";

alter table "public"."reviews" add constraint "reviews_content_check" CHECK (((length(content) >= 20) AND (length(content) <= 1000))) not valid;

alter table "public"."reviews" validate constraint "reviews_content_check";

alter table "public"."reviews" add constraint "reviews_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE not valid;

alter table "public"."reviews" validate constraint "reviews_property_id_fkey";

alter table "public"."reviews" add constraint "reviews_rating_check" CHECK (((rating >= 1) AND (rating <= 5))) not valid;

alter table "public"."reviews" validate constraint "reviews_rating_check";

alter table "public"."reviews" add constraint "reviews_reviewer_id_fkey" FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) not valid;

alter table "public"."reviews" validate constraint "reviews_reviewer_id_fkey";

alter table "public"."reviews" add constraint "reviews_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."reviews" validate constraint "reviews_status_check";

alter table "public"."sent_notifications" add constraint "sent_notifications_request_id_key" UNIQUE using index "sent_notifications_request_id_key";

alter table "public"."system_settings" add constraint "system_settings_key_key" UNIQUE using index "system_settings_key_key";

alter table "public"."organization_member_invites" add constraint "organization_member_invites_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."organization_member_invites" validate constraint "organization_member_invites_invited_by_fkey";

alter table "public"."properties" add constraint "properties_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."properties" validate constraint "properties_organization_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public._normalize_slug(s text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select regexp_replace(lower(trim(coalesce(s,''))), '[^a-z0-9]+', '-', 'g')
$function$
;

CREATE OR REPLACE FUNCTION public.add_user_to_primary_org()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  SELECT id, primary_organization_id INTO v_user_id, v_org_id
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, v_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_org_service_credit(p_booking_id uuid, p_payment_intent_id text, p_org_id uuid, p_amount_cents integer, p_reason text DEFAULT 'service_credit_applied'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inserted boolean := false;
  affected_rows integer := 0;
BEGIN
  -- Insert ledger entry if not exists
  INSERT INTO public.organization_credit_ledger (organization_id, booking_id, payment_intent_id, amount_cents, reason)
  VALUES (p_org_id, p_booking_id, p_payment_intent_id, p_amount_cents, COALESCE(p_reason, 'service_credit_applied'))
  ON CONFLICT (booking_id, payment_intent_id) DO NOTHING;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  inserted := affected_rows > 0;

  IF inserted THEN
    -- Decrement org credit in dollars, never below zero
    UPDATE public.organizations
    SET service_credit = GREATEST(0, COALESCE(service_credit, 0) - (p_amount_cents / 100.0)),
        updated_at = now()
    WHERE id = p_org_id;
  END IF;

  RETURN inserted;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auth_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'is_admin')::boolean,
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_edge_rate_limits()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  delete from public.edge_rate_limits
  where created_at < now() - interval '30 days';
$function$
;

CREATE OR REPLACE FUNCTION public.convert_invites_for_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_profile_id uuid;
BEGIN
  v_profile_id := NEW.id;
  v_email := NEW.email;

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN NEW;
  END IF;

  -- Upsert members for all invites matching this email
  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT imi.organization_id, v_profile_id, imi.role
  FROM public.organization_member_invites imi
  WHERE lower(imi.email) = lower(v_email)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- Mark invites accepted
  UPDATE public.organization_member_invites imi
  SET accepted_at = now()
  WHERE lower(imi.email) = lower(v_email)
    AND accepted_at IS NULL;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment(booking_id text, property_title text, start_date date, end_date date, location text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  ics_content TEXT;
  encoded_content TEXT;
  attachment_name TEXT;
BEGIN
  -- Generate a unique attachment name
  attachment_name := 'booking-' || substring(booking_id, 1, 8) || '.ics';
  
  -- Create the ICS content
  ics_content := public.generate_ics_calendar_content(
    'Booking at ' || property_title,
    start_date,
    end_date,
    location,
    'Your booking confirmation from SplitSpace. View details at https://splitspace.app/dashboard'
  );
  
  -- Encode the ICS content to base64
  encoded_content := public.safe_encode_base64_text(ics_content);
  
  -- If encoding failed, return NULL
  IF encoded_content IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Create and return the attachment object
  RETURN public.validate_email_attachment_object(
    encoded_content,
    attachment_name,
    'application/octet-stream'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating ICS attachment: %', SQLERRM;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v2(booking_id text, property_title text, start_date date, end_date date, location text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  ics_content TEXT;
  encoded_content TEXT;
  attachment_name TEXT;
  event_title TEXT;
  description TEXT;
  adjusted_end_date DATE;
BEGIN
  -- Generate a unique attachment name with proper extension
  attachment_name := 'booking-' || substring(booking_id, 1, 8) || '.ics';
  
  -- Create a clean event title
  event_title := 'Booking at ' || COALESCE(property_title, 'Property');
  
  -- Create a helpful description
  description := 'Your booking confirmation from SplitSpace. View details at https://splitspace.app/dashboard';
  
  -- For all-day events in iCalendar, the end date is exclusive
  adjusted_end_date := end_date + INTERVAL '1 day';
  
  -- Create the ICS content with proper CRLF line endings
  ics_content := 
    'BEGIN:VCALENDAR' || CHR(13) || CHR(10) ||
    'VERSION:2.0' || CHR(13) || CHR(10) ||
    'CALSCALE:GREGORIAN' || CHR(13) || CHR(10) ||
    'PRODID:-//SplitSpace//Booking//EN' || CHR(13) || CHR(10) ||
    'METHOD:PUBLISH' || CHR(13) || CHR(10) ||
    'BEGIN:VEVENT' || CHR(13) || CHR(10) ||
    'DTSTART;VALUE=DATE:' || TO_CHAR(start_date, 'YYYYMMDD') || CHR(13) || CHR(10) ||
    'DTEND;VALUE=DATE:' || TO_CHAR(adjusted_end_date, 'YYYYMMDD') || CHR(13) || CHR(10) ||
    'SUMMARY:' || event_title || CHR(13) || CHR(10);
    
  -- Add description if provided
  IF description IS NOT NULL AND description != '' THEN
    ics_content := ics_content || 
      'DESCRIPTION:' || REPLACE(description, CHR(10), '\n') || CHR(13) || CHR(10);
  END IF;
  
  -- Add location if provided
  IF location IS NOT NULL AND location != '' THEN
    ics_content := ics_content || 
      'LOCATION:' || location || CHR(13) || CHR(10);
  END IF;
  
  -- Complete the ICS content
  ics_content := ics_content ||
    'END:VEVENT' || CHR(13) || CHR(10) ||
    'END:VCALENDAR';
  
  -- Encode the ICS content to base64
  encoded_content := public.encode_ics_content_safely(ics_content);
  
  -- If encoding failed, return NULL
  IF encoded_content IS NULL THEN
    RAISE WARNING 'Failed to encode ICS content for booking %', booking_id;
    RETURN NULL;
  END IF;
  
  -- Create and return the attachment object with proper MIME type
  RETURN jsonb_build_object(
    'content', encoded_content,
    'name', attachment_name,
    'contentType', 'text/calendar'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating ICS attachment: %', SQLERRM;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v3(booking_id text, property_title text, start_date date, end_date date, location text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  ics_content TEXT;
  encoded_content TEXT;
  attachment_name TEXT;
  event_title TEXT;
  description TEXT;
  log_id UUID;
BEGIN
  -- Log the function call for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    booking_id,
    response_data
  ) VALUES (
    'create_calendar_attachment',
    'started',
    booking_id,
    jsonb_build_object(
      'property_title', property_title,
      'start_date', start_date,
      'end_date', end_date,
      'location', location
    )
  ) RETURNING id INTO log_id;
  
  -- Generate a unique attachment name with proper extension
  attachment_name := 'booking-' || substring(booking_id, 1, 8) || '.ics';
  
  -- Create a clean event title
  event_title := 'Booking at ' || COALESCE(property_title, 'Property');
  
  -- Create a helpful description
  description := 'Your booking confirmation from SplitSpace. View details at https://splitspace.app/dashboard';
  
  -- Create the ICS content using the improved function
  ics_content := public.create_ics_calendar_content_v3(
    event_title,
    start_date,
    end_date,
    location,
    description,
    TRUE  -- is_all_day
  );
  
  -- Log the generated ICS content for debugging
  UPDATE public.webhook_notification_log
  SET response_data = jsonb_build_object(
    'ics_content_length', LENGTH(ics_content),
    'ics_content_preview', LEFT(ics_content, 100),
    'attachment_name', attachment_name
  )
  WHERE id = log_id;
  
  -- If ICS content generation failed, return NULL
  IF ics_content IS NULL OR ics_content = '' THEN
    UPDATE public.webhook_notification_log
    SET status = 'error', error = 'Failed to generate ICS content'
    WHERE id = log_id;
    
    RETURN NULL;
  END IF;
  
  -- Encode the ICS content to base64
  encoded_content := encode(convert_to(ics_content, 'UTF8'), 'base64');
  
  -- If encoding failed, return NULL
  IF encoded_content IS NULL THEN
    UPDATE public.webhook_notification_log
    SET status = 'error', error = 'Failed to encode ICS content'
    WHERE id = log_id;
    
    RETURN NULL;
  END IF;
  
  -- Log successful encoding
  UPDATE public.webhook_notification_log
  SET status = 'success',
      response_data = jsonb_build_object(
        'encoded_content_length', LENGTH(encoded_content),
        'attachment_name', attachment_name,
        'content_type', 'text/calendar'
      )
  WHERE id = log_id;
  
  -- Create and return the attachment object with proper MIME type
  RETURN jsonb_build_object(
    'content', encoded_content,
    'name', attachment_name,
    'contentType', 'text/calendar'
  );
EXCEPTION WHEN OTHERS THEN
  -- Log any errors
  UPDATE public.webhook_notification_log
  SET status = 'error',
      error = SQLERRM,
      response_data = jsonb_build_object(
        'error_detail', SQLERRM,
        'error_hint', SQLSTATE
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v4(booking_id text, location text, property_title text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  log_id UUID;
BEGIN
  -- Log the function call with incorrect parameter order
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    booking_id,
    response_data
  ) VALUES (
    'create_calendar_attachment_v4_redirect',
    'started',
    booking_id,
    jsonb_build_object(
      'property_title', property_title,
      'location', location,
      'note', 'Called with incorrect parameter order, redirecting to v5'
    )
  ) RETURNING id INTO log_id;
  
  -- Call the v5 function with the correct parameter order
  RETURN public.create_booking_calendar_attachment_v5(
    booking_id,
    property_title,
    NULL, -- start_date (will use default)
    NULL, -- end_date (will use default)
    location
  );
EXCEPTION WHEN OTHERS THEN
  -- Log any errors
  UPDATE public.webhook_notification_log
  SET status = 'error',
      error = SQLERRM,
      response_data = jsonb_build_object(
        'error_detail', SQLERRM,
        'error_hint', SQLSTATE,
        'function_version', 'v4_redirect'
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v4(booking_id text, property_title text, start_date date, end_date date, location text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  ics_content TEXT;
  encoded_content TEXT;
  attachment_name TEXT;
  event_title TEXT;
  description TEXT;
  log_id UUID;
BEGIN
  -- Log the function call for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    booking_id,
    response_data
  ) VALUES (
    'create_calendar_attachment_v4',
    'started',
    booking_id,
    jsonb_build_object(
      'property_title', property_title,
      'start_date', start_date,
      'end_date', end_date,
      'location', location,
      'function_version', 'v4'
    )
  ) RETURNING id INTO log_id;
  
  -- Generate a unique attachment name with proper extension
  attachment_name := 'booking-' || substring(booking_id, 1, 8) || '.ics';
  
  -- Create a clean event title
  event_title := 'Booking at ' || COALESCE(property_title, 'Property');
  
  -- Create a helpful description
  description := 'Your booking confirmation from SplitSpace. View details at https://splitspace.app/dashboard';
  
  -- Create the ICS content using the improved function
  ics_content := public.create_ics_calendar_content_v4(
    event_title,
    start_date,
    end_date,
    location,
    description,
    TRUE  -- is_all_day
  );
  
  -- Log the generated ICS content for debugging
  UPDATE public.webhook_notification_log
  SET response_data = jsonb_build_object(
    'ics_content_length', LENGTH(ics_content),
    'ics_content_preview', LEFT(ics_content, 100),
    'attachment_name', attachment_name,
    'function_version', 'v4'
  )
  WHERE id = log_id;
  
  -- If ICS content generation failed, return NULL
  IF ics_content IS NULL OR ics_content = '' THEN
    UPDATE public.webhook_notification_log
    SET status = 'error', error = 'Failed to generate ICS content'
    WHERE id = log_id;
    
    RETURN NULL;
  END IF;
  
  -- Encode the ICS content to base64
  encoded_content := encode(convert_to(ics_content, 'UTF8'), 'base64');
  
  -- If encoding failed, return NULL
  IF encoded_content IS NULL THEN
    UPDATE public.webhook_notification_log
    SET status = 'error', error = 'Failed to encode ICS content'
    WHERE id = log_id;
    
    RETURN NULL;
  END IF;
  
  -- Log successful encoding
  UPDATE public.webhook_notification_log
  SET status = 'success',
      response_data = jsonb_build_object(
        'encoded_content_length', LENGTH(encoded_content),
        'attachment_name', attachment_name,
        'content_type', 'text/calendar',
        'function_version', 'v4'
      )
  WHERE id = log_id;
  
  -- Create and return the attachment object with proper MIME type
  RETURN jsonb_build_object(
    'content', encoded_content,
    'name', attachment_name,
    'contentType', 'text/calendar'
  );
EXCEPTION WHEN OTHERS THEN
  -- Log any errors
  UPDATE public.webhook_notification_log
  SET status = 'error',
      error = SQLERRM,
      response_data = jsonb_build_object(
        'error_detail', SQLERRM,
        'error_hint', SQLSTATE,
        'function_version', 'v4'
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v5(booking_id text, property_title text, start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, location text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  ics_content TEXT;
  encoded_content TEXT;
  attachment_name TEXT;
  event_title TEXT;
  description TEXT;
  log_id UUID;
  actual_start_date DATE;
  actual_end_date DATE;
BEGIN
  -- Log the function call for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    booking_id,
    response_data
  ) VALUES (
    'create_calendar_attachment_v5',
    'started',
    booking_id,
    jsonb_build_object(
      'property_title', property_title,
      'start_date', start_date,
      'end_date', end_date,
      'location', location,
      'function_version', 'v5'
    )
  ) RETURNING id INTO log_id;
  
  -- Handle NULL dates by using current date and next day as fallback
  actual_start_date := COALESCE(start_date, CURRENT_DATE);
  actual_end_date := COALESCE(end_date, CURRENT_DATE + INTERVAL '1 day');
  
  -- Generate a unique attachment name with proper extension
  attachment_name := 'booking-' || substring(booking_id, 1, 8) || '.ics';
  
  -- Create a clean event title
  event_title := 'Booking at ' || COALESCE(property_title, 'Property');
  
  -- Create a helpful description
  description := 'Your booking confirmation from SplitSpace. View details at https://splitspace.app/dashboard';
  
  -- Create the ICS content using the improved function
  ics_content := public.create_ics_calendar_content_v4(
    event_title,
    actual_start_date,
    actual_end_date,
    location,
    description,
    TRUE  -- is_all_day
  );
  
  -- Log the generated ICS content for debugging
  UPDATE public.webhook_notification_log
  SET response_data = jsonb_build_object(
    'ics_content_length', LENGTH(ics_content),
    'ics_content_preview', LEFT(ics_content, 100),
    'attachment_name', attachment_name,
    'function_version', 'v5',
    'actual_start_date', actual_start_date,
    'actual_end_date', actual_end_date
  )
  WHERE id = log_id;
  
  -- If ICS content generation failed, return NULL
  IF ics_content IS NULL OR ics_content = '' THEN
    UPDATE public.webhook_notification_log
    SET status = 'error', error = 'Failed to generate ICS content'
    WHERE id = log_id;
    
    RETURN NULL;
  END IF;
  
  -- Encode the ICS content to base64
  encoded_content := encode(convert_to(ics_content, 'UTF8'), 'base64');
  
  -- If encoding failed, return NULL
  IF encoded_content IS NULL THEN
    UPDATE public.webhook_notification_log
    SET status = 'error', error = 'Failed to encode ICS content'
    WHERE id = log_id;
    
    RETURN NULL;
  END IF;
  
  -- Log successful encoding
  UPDATE public.webhook_notification_log
  SET status = 'success',
      response_data = jsonb_build_object(
        'encoded_content_length', LENGTH(encoded_content),
        'attachment_name', attachment_name,
        'content_type', 'text/calendar',
        'function_version', 'v5'
      )
  WHERE id = log_id;
  
  -- Create and return the attachment object with proper MIME type
  RETURN jsonb_build_object(
    'content', encoded_content,
    'name', attachment_name,
    'contentType', 'text/calendar'
  );
EXCEPTION WHEN OTHERS THEN
  -- Log any errors
  UPDATE public.webhook_notification_log
  SET status = 'error',
      error = SQLERRM,
      response_data = jsonb_build_object(
        'error_detail', SQLERRM,
        'error_hint', SQLSTATE,
        'function_version', 'v5'
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v6(booking_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  log_id UUID;
  booking_record RECORD;
  property_record RECORD;
  property_title TEXT;
  location TEXT;
  start_date DATE;
  end_date DATE;
  result JSONB;
  location_parts TEXT[];
  frontend_base_url TEXT;
BEGIN
  -- Get the frontend base URL
  frontend_base_url := public.get_frontend_base_url();

  -- Log the function call for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    booking_id,
    response_data
  ) VALUES (
    'create_calendar_attachment_v6_auto',
    'started',
    booking_id,
    jsonb_build_object(
      'function_version', 'v6_auto',
      'parameter_count', 1,
      'frontend_base_url', frontend_base_url
    )
  ) RETURNING id INTO log_id;
  
  -- Fetch the booking record with property details
  BEGIN
    SELECT 
      b.start_date, 
      b.end_date,
      p.title AS property_title,
      p.address_street,
      p.address_city,
      p.address_state,
      p.address_postal_code,
      p.address_country
    INTO property_record
    FROM public.bookings b
    JOIN public.properties p ON b.property_id = p.id
    WHERE b.id::TEXT = booking_id;
    
    -- Check if booking was found
    IF property_record IS NULL THEN
      RAISE NOTICE 'Booking or property not found with ID: %', booking_id;
      
      UPDATE public.webhook_notification_log
      SET status = 'error',
          error = 'Booking or property not found with ID: ' || booking_id,
          response_data = jsonb_build_object(
            'error_type', 'booking_or_property_not_found',
            'booking_id', booking_id
          )
      WHERE id = log_id;
      
      RETURN NULL;
    END IF;
    
    -- Extract data from the property record
    property_title := property_record.property_title;
    start_date := property_record.start_date;
    end_date := property_record.end_date;
    
    -- Build a complete location string with all address components
    location_parts := ARRAY[]::TEXT[];
    
    -- Add street address if available
    IF property_record.address_street IS NOT NULL AND property_record.address_street != '' THEN
      location_parts := array_append(location_parts, property_record.address_street);
    END IF;
    
    -- Add city if available
    IF property_record.address_city IS NOT NULL AND property_record.address_city != '' THEN
      location_parts := array_append(location_parts, property_record.address_city);
    END IF;
    
    -- Add state if available
    IF property_record.address_state IS NOT NULL AND property_record.address_state != '' THEN
      location_parts := array_append(location_parts, property_record.address_state);
    END IF;
    
    -- Add postal code if available
    IF property_record.address_postal_code IS NOT NULL AND property_record.address_postal_code != '' THEN
      location_parts := array_append(location_parts, property_record.address_postal_code);
    END IF;
    
    -- Add country if available
    IF property_record.address_country IS NOT NULL AND property_record.address_country != '' THEN
      location_parts := array_append(location_parts, property_record.address_country);
    END IF;
    
    -- Join all parts with commas
    location := array_to_string(location_parts, ', ');
    
    -- Log the data found
    UPDATE public.webhook_notification_log
    SET response_data = jsonb_build_object(
      'property_title', property_title,
      'location', location,
      'start_date', start_date,
      'end_date', end_date,
      'function_version', 'v6_auto',
      'booking_found', TRUE,
      'location_parts_count', array_length(location_parts, 1),
      'frontend_base_url', frontend_base_url
    )
    WHERE id = log_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log database query error
    UPDATE public.webhook_notification_log
    SET status = 'error',
        error = 'Error fetching booking and property data: ' || SQLERRM,
        response_data = jsonb_build_object(
          'error_detail', SQLERRM,
          'error_hint', SQLSTATE,
          'booking_id', booking_id
        )
    WHERE id = log_id;
    
    RETURN NULL;
  END;
  
  -- Call the original function with all five parameters
  result := public.create_booking_calendar_attachment_v6(
    booking_id,
    property_title,
    start_date,
    end_date,
    location
  );
  
  -- Log the result
  UPDATE public.webhook_notification_log
  SET status = CASE WHEN result IS NULL THEN 'error' ELSE 'success' END,
      error = CASE WHEN result IS NULL THEN 'Failed to create calendar attachment' ELSE NULL END,
      response_data = jsonb_build_object(
        'result', result IS NOT NULL,
        'has_result', result IS NOT NULL,
        'function_version', 'v6_auto',
        'redirect_success', result IS NOT NULL,
        'frontend_base_url', frontend_base_url
      )
  WHERE id = log_id;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Log any unexpected errors
  UPDATE public.webhook_notification_log
  SET status = 'error',
      error = 'Unexpected error in auto function: ' || SQLERRM,
      response_data = jsonb_build_object(
        'error_detail', SQLERRM,
        'error_hint', SQLSTATE,
        'function_version', 'v6_auto'
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v6(booking_id text, location text, property_title text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  log_id UUID;
  booking_record RECORD;
  start_date DATE;
  end_date DATE;
  result JSONB;
BEGIN
  -- Log the function call for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    booking_id,
    response_data
  ) VALUES (
    'create_calendar_attachment_v6_overloaded',
    'started',
    booking_id,
    jsonb_build_object(
      'property_title', property_title,
      'location', location,
      'function_version', 'v6_overloaded',
      'parameter_count', 3
    )
  ) RETURNING id INTO log_id;
  
  -- Fetch the booking record to get start_date and end_date
  BEGIN
    SELECT b.start_date, b.end_date 
    INTO booking_record
    FROM public.bookings b
    WHERE b.id::TEXT = booking_id;
    
    -- Check if booking was found
    IF booking_record IS NULL THEN
      RAISE NOTICE 'Booking not found with ID: %', booking_id;
      
      UPDATE public.webhook_notification_log
      SET status = 'error',
          error = 'Booking not found with ID: ' || booking_id,
          response_data = jsonb_build_object(
            'error_type', 'booking_not_found',
            'booking_id', booking_id
          )
      WHERE id = log_id;
      
      RETURN NULL;
    END IF;
    
    -- Extract dates from the booking record
    start_date := booking_record.start_date;
    end_date := booking_record.end_date;
    
    -- Log the dates found
    UPDATE public.webhook_notification_log
    SET response_data = jsonb_build_object(
      'property_title', property_title,
      'location', location,
      'start_date', start_date,
      'end_date', end_date,
      'function_version', 'v6_overloaded',
      'booking_found', TRUE
    )
    WHERE id = log_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log database query error
    UPDATE public.webhook_notification_log
    SET status = 'error',
        error = 'Error fetching booking dates: ' || SQLERRM,
        response_data = jsonb_build_object(
          'error_detail', SQLERRM,
          'error_hint', SQLSTATE,
          'booking_id', booking_id
        )
    WHERE id = log_id;
    
    RETURN NULL;
  END;
  
  -- Call the original function with all five parameters
  result := public.create_booking_calendar_attachment_v6(
    booking_id,
    property_title,
    start_date,
    end_date,
    location
  );
  
  -- Log the result
  UPDATE public.webhook_notification_log
  SET status = CASE WHEN result IS NULL THEN 'error' ELSE 'success' END,
      error = CASE WHEN result IS NULL THEN 'Failed to create calendar attachment' ELSE NULL END,
      response_data = jsonb_build_object(
        'result', result,
        'has_result', result IS NOT NULL,
        'function_version', 'v6_overloaded',
        'redirect_success', result IS NOT NULL
      )
  WHERE id = log_id;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Log any unexpected errors
  UPDATE public.webhook_notification_log
  SET status = 'error',
      error = 'Unexpected error in overloaded function: ' || SQLERRM,
      response_data = jsonb_build_object(
        'error_detail', SQLERRM,
        'error_hint', SQLSTATE,
        'function_version', 'v6_overloaded'
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_calendar_attachment_v6(booking_id text, property_title text, start_date date, end_date date, location text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  ics_content TEXT;
  encoded_content TEXT;
  attachment_name TEXT;
  event_title TEXT;
  description TEXT;
  log_id UUID;
  actual_start_date DATE;
  actual_end_date DATE;
  frontend_base_url TEXT;
BEGIN
  -- Get the frontend base URL
  frontend_base_url := public.get_frontend_base_url();

  -- Log the function call for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    booking_id,
    response_data
  ) VALUES (
    'create_calendar_attachment_v6',
    'started',
    booking_id,
    jsonb_build_object(
      'property_title', property_title,
      'start_date', start_date,
      'end_date', end_date,
      'location', location,
      'function_version', 'v6',
      'frontend_base_url', frontend_base_url
    )
  ) RETURNING id INTO log_id;
  
  -- Handle NULL dates by using current date and next day as fallback
  actual_start_date := COALESCE(start_date, CURRENT_DATE);
  actual_end_date := COALESCE(end_date, CURRENT_DATE + INTERVAL '1 day');
  
  -- Generate a unique attachment name with proper extension
  attachment_name := 'booking-' || substring(booking_id, 1, 8) || '.ics';
  
  -- Create a clean event title
  event_title := 'Booking at ' || COALESCE(property_title, 'Property');
  
  -- Create a specific description with booking ID and correct domain
  description := 'Your booking confirmation from SplitSpace. View details at ' || frontend_base_url || '/dashboard?booking=' || booking_id;
  
  -- Create the ICS content using the improved function
  ics_content := public.create_ics_calendar_content_v5(
    event_title,
    actual_start_date,
    actual_end_date,
    location,
    description,
    booking_id,
    TRUE  -- is_all_day
  );
  
  -- Log the generated ICS content for debugging
  UPDATE public.webhook_notification_log
  SET response_data = jsonb_build_object(
    'ics_content_length', LENGTH(ics_content),
    'ics_content_preview', LEFT(ics_content, 100),
    'attachment_name', attachment_name,
    'function_version', 'v6',
    'actual_start_date', actual_start_date,
    'actual_end_date', actual_end_date,
    'frontend_base_url', frontend_base_url
  )
  WHERE id = log_id;
  
  -- If ICS content generation failed, return NULL
  IF ics_content IS NULL OR ics_content = '' THEN
    UPDATE public.webhook_notification_log
    SET status = 'error', error = 'Failed to generate ICS content'
    WHERE id = log_id;
    
    RETURN NULL;
  END IF;
  
  -- Encode the ICS content to base64
  encoded_content := encode(convert_to(ics_content, 'UTF8'), 'base64');
  
  -- If encoding failed, return NULL
  IF encoded_content IS NULL THEN
    UPDATE public.webhook_notification_log
    SET status = 'error', error = 'Failed to encode ICS content'
    WHERE id = log_id;
    
    RETURN NULL;
  END IF;
  
  -- Log successful encoding
  UPDATE public.webhook_notification_log
  SET status = 'success',
      response_data = jsonb_build_object(
        'encoded_content_length', LENGTH(encoded_content),
        'attachment_name', attachment_name,
        'content_type', 'text/calendar',
        'function_version', 'v6',
        'frontend_base_url', frontend_base_url
      )
  WHERE id = log_id;
  
  -- Create and return the attachment object with proper MIME type
  RETURN jsonb_build_object(
    'content', encoded_content,
    'name', attachment_name,
    'contentType', 'text/calendar'
  );
EXCEPTION WHEN OTHERS THEN
  -- Log any errors
  UPDATE public.webhook_notification_log
  SET status = 'error',
      error = SQLERRM,
      response_data = jsonb_build_object(
        'error_detail', SQLERRM,
        'error_hint', SQLSTATE,
        'function_version', 'v6'
      )
  WHERE id = log_id;
  
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_booking_ics_attachment(booking_id uuid, property_title text, start_date date, end_date date, location text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  ics_content TEXT;
  encoded_content TEXT;
  attachment_name TEXT;
  result JSONB;
BEGIN
  -- Generate a unique attachment name
  attachment_name := 'booking-' || substring(booking_id::text, 1, 8) || '.ics';
  
  -- Create the ICS content using the helper function
  ics_content := public.create_ics_calendar_content(
    'Booking at ' || property_title,
    start_date,
    end_date,
    location,
    'Your booking confirmation from SplitSpace. View details at https://splitspace.app/dashboard'
  );
  
  -- Encode the ICS content to base64
  encoded_content := public.encode_ics_content(ics_content);
  
  -- If encoding failed, return NULL
  IF encoded_content IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Create the attachment object
  result := jsonb_build_object(
    'content', encoded_content,
    'name', attachment_name,
    'contentType', 'application/ics'
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Log the error and return NULL
  RAISE NOTICE 'Error creating ICS attachment: %', SQLERRM;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_ics_calendar_content(event_title text, start_date date, end_date date, location text, description text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  ics_content TEXT;
  adjusted_end_date DATE;
BEGIN
  -- For all-day events in iCalendar, the end date is exclusive
  -- So we need to add one day to the end date
  adjusted_end_date := end_date + INTERVAL '1 day';
  
  -- Create the ICS content
  ics_content := 
    'BEGIN:VCALENDAR' || CHR(13) || CHR(10) ||
    'VERSION:2.0' || CHR(13) || CHR(10) ||
    'CALSCALE:GREGORIAN' || CHR(13) || CHR(10) ||
    'PRODID:-//SplitSpace//Booking//EN' || CHR(13) || CHR(10) ||
    'METHOD:PUBLISH' || CHR(13) || CHR(10) ||
    'BEGIN:VEVENT' || CHR(13) || CHR(10) ||
    'DTSTART;VALUE=DATE:' || TO_CHAR(start_date, 'YYYYMMDD') || CHR(13) || CHR(10) ||
    'DTEND;VALUE=DATE:' || TO_CHAR(adjusted_end_date, 'YYYYMMDD') || CHR(13) || CHR(10) ||
    'SUMMARY:' || event_title || CHR(13) || CHR(10) ||
    'DESCRIPTION:' || REPLACE(description, CHR(10), '\n') || CHR(13) || CHR(10) ||
    'LOCATION:' || location || CHR(13) || CHR(10) ||
    'END:VEVENT' || CHR(13) || CHR(10) ||
    'END:VCALENDAR';
  
  RETURN ics_content;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_ics_calendar_content_v3(event_title text, start_date date, end_date date, location text DEFAULT ''::text, description text DEFAULT ''::text, is_all_day boolean DEFAULT true)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  ics_content TEXT;
  adjusted_end_date DATE;
  safe_title TEXT;
  safe_description TEXT;
  safe_location TEXT;
  uid TEXT;
  now_timestamp TIMESTAMP;
BEGIN
  -- Generate a unique ID for the event
  uid := gen_random_uuid()::TEXT;
  now_timestamp := now() AT TIME ZONE 'UTC';
  
  -- Sanitize inputs to avoid breaking the ICS format
  safe_title := REGEXP_REPLACE(COALESCE(event_title, 'Event'), '[\\;,]', ' ', 'g');
  safe_description := REGEXP_REPLACE(COALESCE(description, ''), '[\\;,]', ' ', 'g');
  safe_location := REGEXP_REPLACE(COALESCE(location, ''), '[\\;,]', ' ', 'g');
  
  -- For all-day events in iCalendar, the end date is exclusive
  IF is_all_day THEN
    adjusted_end_date := end_date + INTERVAL '1 day';
  ELSE
    adjusted_end_date := end_date;
  END IF;
  
  -- Create the ICS content with proper CRLF line endings
  ics_content := 
    'BEGIN:VCALENDAR' || CHR(13) || CHR(10) ||
    'VERSION:2.0' || CHR(13) || CHR(10) ||
    'CALSCALE:GREGORIAN' || CHR(13) || CHR(10) ||
    'PRODID:-//SplitSpace//Booking//EN' || CHR(13) || CHR(10) ||
    'METHOD:PUBLISH' || CHR(13) || CHR(10) ||
    'BEGIN:VEVENT' || CHR(13) || CHR(10) ||
    'UID:' || uid || CHR(13) || CHR(10) ||
    'DTSTAMP:' || TO_CHAR(now_timestamp, 'YYYYMMDD"T"HH24MISS"Z"') || CHR(13) || CHR(10);
    
  -- Add start and end dates based on whether it's an all-day event
  IF is_all_day THEN
    ics_content := ics_content ||
      'DTSTART;VALUE=DATE:' || TO_CHAR(start_date, 'YYYYMMDD') || CHR(13) || CHR(10) ||
      'DTEND;VALUE=DATE:' || TO_CHAR(adjusted_end_date, 'YYYYMMDD') || CHR(13) || CHR(10);
  ELSE
    -- For timed events, use UTC time format
    ics_content := ics_content ||
      'DTSTART:' || TO_CHAR(start_date, 'YYYYMMDD"T"120000"Z"') || CHR(13) || CHR(10) ||
      'DTEND:' || TO_CHAR(adjusted_end_date, 'YYYYMMDD"T"120000"Z"') || CHR(13) || CHR(10);
  END IF;
  
  -- Add summary (title)
  ics_content := ics_content || 'SUMMARY:' || safe_title || CHR(13) || CHR(10);
  
  -- Add description if provided
  IF safe_description != '' THEN
    ics_content := ics_content || 'DESCRIPTION:' || REPLACE(safe_description, CHR(10), '\n') || CHR(13) || CHR(10);
  END IF;
  
  -- Add location if provided
  IF safe_location != '' THEN
    ics_content := ics_content || 'LOCATION:' || safe_location || CHR(13) || CHR(10);
  END IF;
  
  -- Complete the ICS content
  ics_content := ics_content ||
    'END:VEVENT' || CHR(13) || CHR(10) ||
    'END:VCALENDAR';
  
  RETURN ics_content;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_ics_calendar_content_v4(event_title text, start_date date, end_date date, location text DEFAULT ''::text, description text DEFAULT ''::text, is_all_day boolean DEFAULT true)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  ics_content TEXT;
  adjusted_end_date DATE;
  safe_title TEXT;
  safe_description TEXT;
  safe_location TEXT;
  uid TEXT;
  now_timestamp TIMESTAMP;
BEGIN
  -- Generate a unique ID for the event
  uid := gen_random_uuid()::TEXT;
  now_timestamp := now() AT TIME ZONE 'UTC';
  
  -- Sanitize inputs to avoid breaking the ICS format
  safe_title := REGEXP_REPLACE(COALESCE(event_title, 'Event'), '[\\;,]', ' ', 'g');
  safe_description := REGEXP_REPLACE(COALESCE(description, ''), '[\\;,]', ' ', 'g');
  safe_location := REGEXP_REPLACE(COALESCE(location, ''), '[\\;,]', ' ', 'g');
  
  -- For all-day events in iCalendar, the end date is exclusive
  IF is_all_day THEN
    adjusted_end_date := end_date + INTERVAL '1 day';
  ELSE
    adjusted_end_date := end_date;
  END IF;
  
  -- Create the ICS content with proper CRLF line endings
  ics_content := 
    'BEGIN:VCALENDAR' || CHR(13) || CHR(10) ||
    'VERSION:2.0' || CHR(13) || CHR(10) ||
    'CALSCALE:GREGORIAN' || CHR(13) || CHR(10) ||
    'PRODID:-//SplitSpace//Booking//EN' || CHR(13) || CHR(10) ||
    'METHOD:PUBLISH' || CHR(13) || CHR(10) ||
    'BEGIN:VEVENT' || CHR(13) || CHR(10) ||
    'UID:' || uid || CHR(13) || CHR(10) ||
    'DTSTAMP:' || TO_CHAR(now_timestamp, 'YYYYMMDD"T"HH24MISS"Z"') || CHR(13) || CHR(10);
    
  -- Add start and end dates based on whether it's an all-day event
  IF is_all_day THEN
    ics_content := ics_content ||
      'DTSTART;VALUE=DATE:' || TO_CHAR(start_date, 'YYYYMMDD') || CHR(13) || CHR(10) ||
      'DTEND;VALUE=DATE:' || TO_CHAR(adjusted_end_date, 'YYYYMMDD') || CHR(13) || CHR(10);
  ELSE
    -- For timed events, use UTC time format
    ics_content := ics_content ||
      'DTSTART:' || TO_CHAR(start_date, 'YYYYMMDD"T"120000"Z"') || CHR(13) || CHR(10) ||
      'DTEND:' || TO_CHAR(adjusted_end_date, 'YYYYMMDD"T"120000"Z"') || CHR(13) || CHR(10);
  END IF;
  
  -- Add summary (title)
  ics_content := ics_content || 'SUMMARY:' || safe_title || CHR(13) || CHR(10);
  
  -- Add description if provided
  IF safe_description != '' THEN
    ics_content := ics_content || 'DESCRIPTION:' || REPLACE(safe_description, CHR(10), '\n') || CHR(13) || CHR(10);
  END IF;
  
  -- Add location if provided
  IF safe_location != '' THEN
    ics_content := ics_content || 'LOCATION:' || safe_location || CHR(13) || CHR(10);
  END IF;
  
  -- Complete the ICS content
  ics_content := ics_content ||
    'END:VEVENT' || CHR(13) || CHR(10) ||
    'END:VCALENDAR';
  
  RETURN ics_content;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_ics_calendar_content_v5(event_title text, start_date date, end_date date, location text DEFAULT ''::text, description text DEFAULT ''::text, uid text DEFAULT NULL::text, is_all_day boolean DEFAULT true)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  ics_content TEXT;
  event_uid TEXT;
  formatted_start TEXT;
  formatted_end TEXT;
  frontend_base_url TEXT;
BEGIN
  -- Get the frontend base URL
  frontend_base_url := public.get_frontend_base_url();
  
  -- Generate a UUID if none provided
  event_uid := COALESCE(uid, gen_random_uuid()::TEXT);
  
  -- Format dates for ICS
  IF is_all_day THEN
    -- For all-day events, use simple date format without time
    formatted_start := TO_CHAR(start_date, 'YYYYMMDD');
    -- For all-day events in ICS, the end date should be the day after the actual end
    -- because the end date is exclusive in the ICS spec for all-day events
    formatted_end := TO_CHAR(end_date + INTERVAL '1 day', 'YYYYMMDD');
  ELSE
    -- For timed events, include time component (assuming UTC)
    formatted_start := TO_CHAR(start_date, 'YYYYMMDD') || 'T000000Z';
    formatted_end := TO_CHAR(end_date, 'YYYYMMDD') || 'T235959Z';
  END IF;
  
  -- Build the ICS content with proper line endings and format
  ics_content := 'BEGIN:VCALENDAR' || CHR(13) || CHR(10) ||
                 'VERSION:2.0' || CHR(13) || CHR(10) ||
                 'PRODID:-//SplitSpace//Booking Calendar//EN' || CHR(13) || CHR(10) ||
                 'CALSCALE:GREGORIAN' || CHR(13) || CHR(10) ||
                 'METHOD:PUBLISH' || CHR(13) || CHR(10) ||
                 'BEGIN:VEVENT' || CHR(13) || CHR(10) ||
                 'UID:' || event_uid || CHR(13) || CHR(10);
  
  -- Add start and end dates with appropriate format based on all-day flag
  IF is_all_day THEN
    ics_content := ics_content ||
                   'DTSTART;VALUE=DATE:' || formatted_start || CHR(13) || CHR(10) ||
                   'DTEND;VALUE=DATE:' || formatted_end || CHR(13) || CHR(10);
  ELSE
    ics_content := ics_content ||
                   'DTSTART:' || formatted_start || CHR(13) || CHR(10) ||
                   'DTEND:' || formatted_end || CHR(13) || CHR(10);
  END IF;
  
  -- Add summary (title)
  ics_content := ics_content ||
                 'SUMMARY:' || COALESCE(event_title, 'Booking') || CHR(13) || CHR(10);
  
  -- Add location if provided
  IF location IS NOT NULL AND location != '' THEN
    ics_content := ics_content ||
                   'LOCATION:' || location || CHR(13) || CHR(10);
  END IF;
  
  -- Add description if provided, with the correct domain
  IF description IS NOT NULL AND description != '' THEN
    -- Replace any instances of splitspace.app with the correct domain
    description := REPLACE(description, 'https://splitspace.app', frontend_base_url);
    
    ics_content := ics_content ||
                   'DESCRIPTION:' || description || CHR(13) || CHR(10);
  END IF;
  
  -- Add creation timestamp
  ics_content := ics_content ||
                 'DTSTAMP:' || TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || CHR(13) || CHR(10);
  
  -- Complete the event and calendar
  ics_content := ics_content ||
                 'END:VEVENT' || CHR(13) || CHR(10) ||
                 'END:VCALENDAR';
  
  RETURN ics_content;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.debug_user_org_membership()
 RETURNS TABLE(user_id uuid, primary_org_id uuid, is_member boolean, member_role text, org_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.primary_organization_id as primary_org_id,
    EXISTS(
      SELECT 1 FROM public.organization_members om 
      WHERE om.organization_id = p.primary_organization_id 
      AND om.user_id = p.id
    ) as is_member,
    om.role as member_role,
    o.name as org_name
  FROM public.profiles p
  LEFT JOIN public.organization_members om ON om.organization_id = p.primary_organization_id AND om.user_id = p.id
  LEFT JOIN public.organizations o ON o.id = p.primary_organization_id
  WHERE p.id = auth.uid();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.dequeue_due_review_reminders(p_limit integer DEFAULT 20)
 RETURNS TABLE(reminder_id uuid, booking_id uuid, reminder_type text, scheduled_for timestamp with time zone, property_id uuid, property_title text, start_date date, end_date date, guest_id uuid, guest_email text, guest_name text, review_submitted_at timestamp with time zone, review_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(p_limit, 0) <= 0 then
    p_limit := 20;
  end if;

  return query
  with due as (
    select id
    from public.review_reminders
    where sent_at is null
      and review_submitted_at is null
      and scheduled_for <= now()
      and (processing_started_at is null or processing_started_at < now() - interval '15 minutes')
    order by scheduled_for
    limit p_limit
    for update skip locked
  ), updated as (
    update public.review_reminders r
    set processing_started_at = now()
    from due
    where r.id = due.id
    returning r.*
  )
  select
    u.id as reminder_id,
    u.booking_id,
    u.reminder_type,
    u.scheduled_for,
    u.property_id,
    p.title as property_title,
    b.start_date,
    b.end_date,
    u.guest_id,
    prof.email as guest_email,
    prof.full_name as guest_name,
    u.review_submitted_at,
    u.review_id
  from updated u
  join public.bookings b on b.id = u.booking_id
  join public.properties p on p.id = u.property_id
  join public.profiles prof on prof.id = u.guest_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.encode_ics_content(ics_content text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  encoded TEXT;
BEGIN
  -- Encode the ICS content to base64
  encoded := encode(convert_to(ics_content, 'UTF8'), 'base64');
  RETURN encoded;
EXCEPTION WHEN OTHERS THEN
  -- Log the error and return NULL
  RAISE NOTICE 'Error encoding ICS content: %', SQLERRM;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.encode_ics_content_safely(ics_content text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  encoded TEXT;
BEGIN
  -- Use proper encoding for UTF-8 text
  encoded := encode(convert_to(ics_content, 'UTF8'), 'base64');
  RETURN encoded;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error encoding ICS content: %', SQLERRM;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_non_negative_service_credit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if NEW.service_credit is null then
    NEW.service_credit := 0;
  end if;
  if NEW.service_credit < 0 then
    NEW.service_credit := 0;
  end if;
  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.faq_entries_tsv_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.question,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.answer_md,'')), 'B');
  return new;
end
$function$
;

CREATE OR REPLACE FUNCTION public.fix_missing_org_memberships()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Add missing memberships for organization creators
  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT DISTINCT 
    o.id as organization_id,
    p.id as user_id,
    'owner' as role
  FROM public.organizations o
  JOIN public.profiles p ON p.primary_organization_id = o.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = o.id AND om.user_id = p.id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fix_webhook_property_query()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  -- Log that the fix was applied
  INSERT INTO public.webhook_notification_log (
    notification_type,
    status,
    response_data
  ) VALUES (
    'fix_webhook_property_query',
    'success',
    jsonb_build_object(
      'message', 'Fixed the property query in the webhook function',
      'timestamp', now(),
      'note', 'This is a marker function to indicate the SQL fix has been applied'
    )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_ics_calendar_content(title text, start_date date, end_date date, location text DEFAULT ''::text, description text DEFAULT ''::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  ics_content TEXT;
  adjusted_end_date DATE;
BEGIN
  -- For all-day events in iCalendar, the end date is exclusive
  adjusted_end_date := end_date + INTERVAL '1 day';
  
  -- Create the ICS content with proper CRLF line endings
  ics_content := 
    'BEGIN:VCALENDAR' || CHR(13) || CHR(10) ||
    'VERSION:2.0' || CHR(13) || CHR(10) ||
    'CALSCALE:GREGORIAN' || CHR(13) || CHR(10) ||
    'PRODID:-//SplitSpace//Booking//EN' || CHR(13) || CHR(10) ||
    'METHOD:PUBLISH' || CHR(13) || CHR(10) ||
    'BEGIN:VEVENT' || CHR(13) || CHR(10) ||
    'DTSTART;VALUE=DATE:' || TO_CHAR(start_date, 'YYYYMMDD') || CHR(13) || CHR(10) ||
    'DTEND;VALUE=DATE:' || TO_CHAR(adjusted_end_date, 'YYYYMMDD') || CHR(13) || CHR(10) ||
    'SUMMARY:' || title || CHR(13) || CHR(10);
    
  -- Add description if provided
  IF description IS NOT NULL AND description != '' THEN
    ics_content := ics_content || 
      'DESCRIPTION:' || REPLACE(description, CHR(10), '\n') || CHR(13) || CHR(10);
  END IF;
  
  -- Add location if provided
  IF location IS NOT NULL AND location != '' THEN
    ics_content := ics_content || 
      'LOCATION:' || location || CHR(13) || CHR(10);
  END IF;
  
  -- Complete the ICS content
  ics_content := ics_content ||
    'END:VEVENT' || CHR(13) || CHR(10) ||
    'END:VCALENDAR';
  
  RETURN ics_content;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_frontend_base_url()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  frontend_url TEXT;
BEGIN
  -- Try to get the frontend URL from system_settings
  SELECT value INTO frontend_url
  FROM public.system_settings
  WHERE key = 'frontend_base_url';
  
  -- Return the found URL or default to https://splitspace.com
  RETURN COALESCE(frontend_url, 'https://splitspace.com');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.insert_inquiry_for_user(p_property_id uuid, p_user_id uuid, p_start_date date, p_end_date date, p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_headcount integer, p_selected_adjustment_ids uuid[], p_message text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  -- Insert directly; rely on table defaults for id and timestamps
  insert into public.inquiries (
    property_id,
    user_id,
    start_date,
    end_date,
    start_at,
    end_at,
    headcount,
    selected_adjustment_ids,
    message,
    status
  ) values (
    p_property_id,
    p_user_id,
    p_start_date,
    p_end_date,
    p_start_at,
    p_end_at,
    p_headcount,
    p_selected_adjustment_ids,
    coalesce(p_message, 'Guest inquiry'),
    'pending'
  ) returning id into v_id;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  );
$function$
;

CREATE OR REPLACE FUNCTION public.log_notification_attempt()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  -- Log the attempt to webhook_notification_log for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    recipient_email,
    status,
    created_at
  ) VALUES (
    NEW.email_type,
    NEW.recipient_email,
    'attempt_logged',
    NOW()
  );
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.promote_invites_for_email(p_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id uuid;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN;
  END IF;

  -- Find a profile with matching email
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    -- Nothing to do if no profile yet
    RETURN;
  END IF;

  -- Upsert membership(s)
  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT imi.organization_id, v_profile_id, imi.role
  FROM public.organization_member_invites imi
  WHERE lower(imi.email) = lower(p_email)
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- Mark invites accepted
  UPDATE public.organization_member_invites
  SET accepted_at = now()
  WHERE lower(email) = lower(p_email)
    AND accepted_at IS NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.review_reminders_handle_review_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.review_reminders rr
  set review_submitted_at = null,
      review_id = null,
      updated_at = now()
  where rr.review_id = old.id;

  return old;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.review_reminders_handle_review_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_booking_id uuid;
begin
  v_booking_id := null;

  -- Prefer explicit booking_id from review_eligibility JSON when provided
  begin
    if new.review_eligibility ? 'booking_id' then
      v_booking_id := nullif(new.review_eligibility->>'booking_id', '')::uuid;
    end if;
  exception when others then
    v_booking_id := null;
  end;

  -- Fallback: most recent booking for this property/user
  if v_booking_id is null then
    select b.id
      into v_booking_id
    from public.bookings b
    where b.property_id = new.property_id
      and b.user_id = new.reviewer_id
    order by coalesce(b.end_at, b.end_date::timestamptz, b.created_at) desc
    limit 1;
  end if;

  if v_booking_id is null then
    return new;
  end if;

  update public.review_reminders rr
  set review_submitted_at = new.created_at,
      review_id = new.id,
      updated_at = now()
  where rr.booking_id = v_booking_id
    and rr.guest_id = new.reviewer_id
    and rr.review_submitted_at is null;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.safe_encode_base64_text(input_text text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RETURN encode(convert_to(input_text, 'UTF8'), 'base64');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error encoding to base64: %', SQLERRM;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.schedule_review_reminder_for_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_scheduled_for timestamptz;
begin
  -- Only consider bookings that are marked completed
  if new.status is distinct from 'completed' then
    return new;
  end if;

  -- Require a guest/user and property to target
  if new.user_id is null or new.property_id is null then
    return new;
  end if;

  -- Determine when to send: prefer precise end_at when available, otherwise assume end_date at midnight
  v_scheduled_for := coalesce(new.end_at, new.end_date::timestamptz) + interval '7 days';

  -- Guard against missing timestamps (e.g., null end_date) by defaulting to now + 7 days
  if v_scheduled_for is null then
    v_scheduled_for := now() + interval '7 days';
  end if;

  insert into public.review_reminders (booking_id, property_id, guest_id, scheduled_for)
  values (new.id, new.property_id, new.user_id, v_scheduled_for)
  on conflict (booking_id, reminder_type) do update
    set property_id = excluded.property_id,
        guest_id = excluded.guest_id,
        scheduled_for = excluded.scheduled_for,
        processing_started_at = null,
        error_message = null,
        updated_at = now()
    where review_reminders.sent_at is null;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.send_payment_confirmation_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_email TEXT;
  v_customer_name TEXT;
  v_property_title TEXT;
  v_venue_owner_email TEXT;
  v_venue_owner_name TEXT;
  v_request_id TEXT;
  v_proposal_id UUID;
  v_inquiry_id UUID;
BEGIN
  -- Only proceed if payment_status changed to 'paid'
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' THEN
    -- Get the proposal_id and related inquiry_id
    v_proposal_id := NEW.proposal_id;
    
    IF v_proposal_id IS NOT NULL THEN
      -- Get the inquiry_id from the proposal
      SELECT inquiry_id INTO v_inquiry_id
      FROM public.proposals
      WHERE id = v_proposal_id;
      
      IF v_inquiry_id IS NOT NULL THEN
        -- Get customer information
        SELECT 
          p.email, 
          p.full_name
        INTO v_customer_email, v_customer_name
        FROM public.profiles p
        JOIN public.inquiries i ON i.user_id = p.id
        WHERE i.id = v_inquiry_id;
        
        -- Get property title and venue owner information (prefer org name)
        SELECT 
          prop.title,
          owner.email,
          COALESCE(org.name, owner.full_name) AS venue_owner_name
        INTO 
          v_property_title,
          v_venue_owner_email,
          v_venue_owner_name
        FROM public.properties prop
        JOIN public.profiles owner ON prop.venue_id = owner.id
        LEFT JOIN public.organizations org ON org.id = owner.primary_organization_id
        JOIN public.inquiries i ON i.property_id = prop.id
        WHERE i.id = v_inquiry_id;
        
        -- Generate unique request IDs for idempotency
        v_request_id := 'payment_confirmation_' || NEW.id;
        
        -- Log the notification attempt for customer
        INSERT INTO public.sent_notifications (
          request_id,
          email_type,
          recipient_email
        ) VALUES (
          v_request_id || '_customer',
          'booking_confirmed',
          v_customer_email
        );
        
        -- Log the notification attempt for venue owner
        INSERT INTO public.sent_notifications (
          request_id,
          email_type,
          recipient_email
        ) VALUES (
          v_request_id || '_owner',
          'payment_received',
          v_venue_owner_email
        );
        
        -- Also log to webhook_notification_log for debugging
        INSERT INTO public.webhook_notification_log (
          payment_intent_id,
          booking_id,
          notification_type,
          recipient_email,
          recipient_name,
          status,
          response_data
        ) VALUES (
          NEW.stripe_payment_intent_id,
          NEW.id::text,
          'payment_confirmation_trigger',
          v_customer_email || ', ' || v_venue_owner_email,
          v_customer_name || ', ' || v_venue_owner_name,
          'trigger_fired',
          jsonb_build_object(
            'property_title', v_property_title,
            'booking_id', NEW.id,
            'amount', NEW.price_total,
            'currency', NEW.currency,
            'request_id', v_request_id
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_payment_request_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inquiry_data RECORD;
  v_customer_email TEXT;
  v_customer_name TEXT;
  v_property_title TEXT;
  v_venue_owner_name TEXT;
  v_request_id TEXT;
BEGIN
  -- Get the inquiry data with related information
  SELECT 
    i.id AS inquiry_id,
    i.user_id,
    p.title AS property_title,
    p.venue_id
  INTO v_inquiry_data
  FROM public.inquiries i
  JOIN public.properties p ON i.property_id = p.id
  WHERE i.id = NEW.inquiry_id;
  
  -- Get customer information
  SELECT 
    email, 
    full_name
  INTO v_customer_email, v_customer_name
  FROM public.profiles
  WHERE id = v_inquiry_data.user_id;
  
  -- Get venue owner name: prefer organization name, fallback to profile full_name
  SELECT 
    COALESCE(o.name, p.full_name)
  INTO v_venue_owner_name
  FROM public.profiles p
  LEFT JOIN public.organizations o ON o.id = p.primary_organization_id
  WHERE p.id = v_inquiry_data.venue_id;
  
  -- Set property title
  v_property_title := v_inquiry_data.property_title;
  
  -- Generate a unique request ID for idempotency
  v_request_id := 'payment_request_' || NEW.id;
  
  -- Log the notification attempt
  INSERT INTO public.sent_notifications (
    request_id,
    email_type,
    recipient_email
  ) VALUES (
    v_request_id,
    'inquiry_response',
    v_customer_email
  );
  
  -- Also log to webhook_notification_log for debugging
  INSERT INTO public.webhook_notification_log (
    notification_type,
    recipient_email,
    recipient_name,
    status,
    booking_id,
    response_data
  ) VALUES (
    'payment_request',
    v_customer_email,
    v_customer_name,
    'trigger_fired',
    NEW.id::text,
    jsonb_build_object(
      'property_title', v_property_title,
      'venue_owner', v_venue_owner_name,
      'request_id', v_request_id,
      'amount', NEW.price_total,
      'currency', NEW.currency
    )
  );
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_organization_members_set_primary()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  update public.profiles p
  set primary_organization_id = NEW.organization_id
  where p.id = NEW.user_id
    and p.primary_organization_id is null;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_profiles_ensure_org_membership()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id uuid;
  v_member_exists boolean;
BEGIN
  -- Only proceed if company_name changed and primary_organization_id is null
  IF (TG_OP = 'UPDATE' AND OLD.company_name IS DISTINCT FROM NEW.company_name AND NEW.primary_organization_id IS NULL) 
     OR (TG_OP = 'INSERT' AND NEW.company_name IS NOT NULL AND NEW.primary_organization_id IS NULL) THEN
    
    -- Find or create organization
    select id into v_org_id from public.organizations where lower(name) = lower(NEW.company_name) limit 1;
    if v_org_id is null then
      insert into public.organizations(name, created_at, updated_at)
      values (NEW.company_name, now(), now())
      returning id into v_org_id;
    end if;
    
    -- Ensure membership exists with 'owner' role
    select exists(
      select 1 from public.organization_members om where om.organization_id = v_org_id and om.user_id = NEW.id
    ) into v_member_exists;
    if not v_member_exists then
      insert into public.organization_members(organization_id, user_id, role)
      values (v_org_id, NEW.id, 'owner');
    end if;
    
    -- Set primary_organization_id on NEW row
    NEW.primary_organization_id := v_org_id;
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.update_inquiry_status_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  -- Only proceed if payment_status changed to 'paid'
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' THEN
    -- Find the proposal associated with this booking
    IF NEW.proposal_id IS NOT NULL THEN
      -- Find the inquiry_id using explicit table aliases
      UPDATE public.inquiries i
      SET 
        status = 'payment_completed',
        updated_at = NOW()
      FROM public.proposals p
      WHERE 
        p.id = NEW.proposal_id AND
        i.id = p.inquiry_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_email_attachment_object(content text, name text, content_type text DEFAULT 'application/octet-stream'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  result JSONB;
BEGIN
  -- Basic validation
  IF content IS NULL OR name IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Create the attachment object
  result := jsonb_build_object(
    'content', content,
    'name', name,
    'contentType', COALESCE(content_type, 'application/octet-stream')
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error validating attachment: %', SQLERRM;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_review_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  -- Only allow status changes by property owners
  IF OLD.status != NEW.status AND NOT EXISTS (
    SELECT 1 FROM properties
    WHERE id = NEW.property_id
    AND venue_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only property owners can change review status';
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;


  create policy "Service role can manage analysis results"
  on "public"."analysis_results"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "System can insert analysis results"
  on "public"."analysis_results"
  as permissive
  for insert
  to authenticated
with check ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE (leases.user_id = auth.uid()))));



  create policy "System can update analysis results"
  on "public"."analysis_results"
  as permissive
  for update
  to authenticated
using ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE (leases.user_id = auth.uid()))))
with check ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE (leases.user_id = auth.uid()))));



  create policy "Users can view their own analysis results"
  on "public"."analysis_results"
  as permissive
  for select
  to authenticated
using ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE (leases.user_id = auth.uid()))));



  create policy "Admins manage categories"
  on "public"."faq_categories"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))));



  create policy "Public can read categories"
  on "public"."faq_categories"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "faq_categories_modify"
  on "public"."faq_categories"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))));



  create policy "faq_categories_select"
  on "public"."faq_categories"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Admins manage entries"
  on "public"."faq_entries"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))));



  create policy "Public can read published entries"
  on "public"."faq_entries"
  as permissive
  for select
  to anon, authenticated
using ((published = true));



  create policy "faq_entries_modify"
  on "public"."faq_entries"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))));



  create policy "faq_entries_select"
  on "public"."faq_entries"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users can add their own favorites"
  on "public"."favorites"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users can delete their own favorites"
  on "public"."favorites"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "Users can view their own favorites"
  on "public"."favorites"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "favorites_delete_own"
  on "public"."favorites"
  as permissive
  for delete
  to authenticated
using ((user_id = auth.uid()));



  create policy "favorites_insert_own"
  on "public"."favorites"
  as permissive
  for insert
  to authenticated
with check ((user_id = auth.uid()));



  create policy "favorites_select_own"
  on "public"."favorites"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "Service role can manage lease clauses"
  on "public"."lease_clauses"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "System can insert lease clauses"
  on "public"."lease_clauses"
  as permissive
  for insert
  to authenticated
with check ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE (leases.user_id = auth.uid()))));



  create policy "Users can view clauses for their own leases"
  on "public"."lease_clauses"
  as permissive
  for select
  to authenticated
using ((lease_id IN ( SELECT leases.id
   FROM public.leases
  WHERE (leases.user_id = auth.uid()))));



  create policy "Service role can manage leases"
  on "public"."leases"
  as permissive
  for all
  to service_role
using (true)
with check (true);



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



  create policy "org_adjustments_delete"
  on "public"."organization_adjustments"
  as permissive
  for delete
  to authenticated
using (public.is_org_member_with_role(organization_id, ARRAY['owner'::text, 'admin'::text]));



  create policy "org_adjustments_insert"
  on "public"."organization_adjustments"
  as permissive
  for insert
  to authenticated
with check (public.is_org_member_with_role(organization_id, ARRAY['owner'::text, 'admin'::text]));



  create policy "org_adjustments_manage"
  on "public"."organization_adjustments"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_adjustments.organization_id) AND (om.user_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_adjustments.organization_id) AND (om.user_id = auth.uid())))));



  create policy "org_adjustments_public_if_published"
  on "public"."organization_adjustments"
  as permissive
  for select
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.organization_id = organization_adjustments.organization_id) AND (p.published = true)))));



  create policy "org_adjustments_public_select"
  on "public"."organization_adjustments"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "org_adjustments_select_member"
  on "public"."organization_adjustments"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_adjustments.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text]))))));



  create policy "org_adjustments_update"
  on "public"."organization_adjustments"
  as permissive
  for update
  to authenticated
using (public.is_org_member_with_role(organization_id, ARRAY['owner'::text, 'admin'::text]))
with check (public.is_org_member_with_role(organization_id, ARRAY['owner'::text, 'admin'::text]));



  create policy "org_credit_ledger_delete"
  on "public"."organization_credit_ledger"
  as permissive
  for delete
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_credit_ledger.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true))))));



  create policy "org_credit_ledger_insert"
  on "public"."organization_credit_ledger"
  as permissive
  for insert
  to authenticated
with check (((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_credit_ledger.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true))))));



  create policy "org_credit_ledger_select"
  on "public"."organization_credit_ledger"
  as permissive
  for select
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_credit_ledger.organization_id) AND (om.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true))))));



  create policy "org_credit_ledger_update"
  on "public"."organization_credit_ledger"
  as permissive
  for update
  to authenticated
using (false)
with check (false);



  create policy "oif_delete"
  on "public"."organization_inquiry_forms"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = organization_inquiry_forms.organization_id) AND (m.user_id = auth.uid()) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "oif_insert"
  on "public"."organization_inquiry_forms"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = organization_inquiry_forms.organization_id) AND (m.user_id = auth.uid()) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "oif_select"
  on "public"."organization_inquiry_forms"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = organization_inquiry_forms.organization_id) AND (m.user_id = auth.uid())))));



  create policy "oif_update"
  on "public"."organization_inquiry_forms"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = organization_inquiry_forms.organization_id) AND (m.user_id = auth.uid()) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "org_invites_delete"
  on "public"."organization_member_invites"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_member_invites.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "org_invites_insert"
  on "public"."organization_member_invites"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_member_invites.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "org_invites_select"
  on "public"."organization_member_invites"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_member_invites.organization_id) AND (om.user_id = auth.uid())))));



  create policy "org_invites_update"
  on "public"."organization_member_invites"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_member_invites.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_member_invites.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "org_member_invites_modify"
  on "public"."organization_member_invites"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_member_invites.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_member_invites.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "org_member_invites_select"
  on "public"."organization_member_invites"
  as permissive
  for select
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_member_invites.organization_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.email) = lower(organization_member_invites.email)))))));



  create policy "org_members_delete"
  on "public"."organization_members"
  as permissive
  for delete
  to authenticated
using (((user_id = auth.uid()) OR public.is_org_admin(organization_id) OR public.is_platform_admin()));



  create policy "org_members_insert"
  on "public"."organization_members"
  as permissive
  for insert
  to authenticated
with check ((public.is_org_admin(organization_id) OR public.is_platform_admin()));



  create policy "org_members_select"
  on "public"."organization_members"
  as permissive
  for select
  to authenticated
using (((user_id = auth.uid()) OR public.is_org_admin(organization_id) OR public.is_platform_admin()));



  create policy "org_members_select_own"
  on "public"."organization_members"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "org_members_update"
  on "public"."organization_members"
  as permissive
  for update
  to authenticated
using ((public.is_org_admin(organization_id) OR public.is_platform_admin()))
with check ((public.is_org_admin(organization_id) OR public.is_platform_admin()));



  create policy "Allow authenticated users to create organizations"
  on "public"."organizations"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Users can update their organizations"
  on "public"."organizations"
  as permissive
  for update
  to authenticated
using ((id IN ( SELECT profiles.primary_organization_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.primary_organization_id IS NOT NULL)))))
with check ((id IN ( SELECT profiles.primary_organization_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.primary_organization_id IS NOT NULL)))));



  create policy "Users can view their organizations"
  on "public"."organizations"
  as permissive
  for select
  to authenticated
using ((id IN ( SELECT profiles.primary_organization_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.primary_organization_id IS NOT NULL)))));



  create policy "org_business_type_select"
  on "public"."organizations"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = organizations.id) AND (m.user_id = auth.uid())))));



  create policy "org_business_type_update"
  on "public"."organizations"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = organizations.id) AND (m.user_id = auth.uid()) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "organizations_select_authenticated"
  on "public"."organizations"
  as permissive
  for select
  to authenticated
using (true);



  create policy "orgs_public_select_with_published_properties"
  on "public"."organizations"
  as permissive
  for select
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.organization_id = organizations.id) AND (p.published = true)))));



  create policy "orgs_select_member_or_admin"
  on "public"."organizations"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_organization_id = organizations.id) OR (p.is_admin = true))))));



  create policy "orgs_select_public"
  on "public"."organizations"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "orgs_update_member_or_admin"
  on "public"."organizations"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_organization_id = organizations.id) OR (p.is_admin = true))))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND ((p.primary_organization_id = organizations.id) OR (p.is_admin = true))))));



  create policy "service role manage organizations"
  on "public"."organizations"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Admins can delete pages"
  on "public"."pages"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));



  create policy "Admins can insert pages"
  on "public"."pages"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));



  create policy "Admins can update pages"
  on "public"."pages"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));



  create policy "Pages are viewable by everyone"
  on "public"."pages"
  as permissive
  for select
  to public
using (true);



  create policy "Public can read pages"
  on "public"."pages"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "pages_modify"
  on "public"."pages"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))));



  create policy "pages_public_read"
  on "public"."pages"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "pages_select"
  on "public"."pages"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Admins can update any profile (jwt)"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using (public.auth_is_admin())
with check (public.auth_is_admin());



  create policy "Admins can view all profiles (jwt)"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (public.auth_is_admin());



  create policy "Allow reading counterpart profiles in conversations"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (((id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.inquiries i
     JOIN public.properties pr ON ((pr.id = i.property_id)))
  WHERE (((profiles.id = i.user_id) AND ((i.user_id = auth.uid()) OR (pr.venue_id = auth.uid()))) OR ((profiles.id = pr.venue_id) AND ((i.user_id = auth.uid()) OR (pr.venue_id = auth.uid()))))))));



  create policy "Authenticated read minimal"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Enable delete for users based on user_id"
  on "public"."profiles"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = id));



  create policy "Enable insert for authenticated users based on user_id"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = id));



  create policy "Enable update for users based on user_id"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((auth.uid() = id))
with check ((auth.uid() = id));



  create policy "profiles_insert_own"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((id = auth.uid()));



  create policy "profiles_select_own"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((id = auth.uid()));



  create policy "profiles_select_self"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((id = auth.uid()));



  create policy "profiles_update_own"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((id = auth.uid()))
with check ((id = auth.uid()));



  create policy "service role read profiles"
  on "public"."profiles"
  as permissive
  for select
  to service_role
using (true);



  create policy "property_availability_manage_org"
  on "public"."property_availability"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.properties prop
     JOIN public.organization_members om ON ((om.organization_id = prop.organization_id)))
  WHERE ((prop.id = property_availability.property_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM (public.properties prop
     JOIN public.organization_members om ON ((om.organization_id = prop.organization_id)))
  WHERE ((prop.id = property_availability.property_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));



  create policy "property_availability_public_if_published"
  on "public"."property_availability"
  as permissive
  for select
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.id = property_availability.property_id) AND (p.published = true)))));



  create policy "property_availability_select_public"
  on "public"."property_availability"
  as permissive
  for select
  to public
using (true);



  create policy "Property owners can manage schedules"
  on "public"."property_schedule"
  as permissive
  for all
  to public
using ((auth.uid() IN ( SELECT properties.venue_id
   FROM public.properties
  WHERE (properties.id = property_schedule.property_id))))
with check ((auth.uid() IN ( SELECT properties.venue_id
   FROM public.properties
  WHERE (properties.id = property_schedule.property_id))));



  create policy "Property schedules are publicly viewable"
  on "public"."property_schedule"
  as permissive
  for select
  to public
using (true);



  create policy "property_schedule_delete"
  on "public"."property_schedule"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.properties p
     LEFT JOIN public.organization_members om ON (((om.organization_id = p.organization_id) AND (om.user_id = auth.uid()))))
  WHERE ((p.id = property_schedule.property_id) AND ((p.venue_id = auth.uid()) OR (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))))));



  create policy "property_schedule_insert"
  on "public"."property_schedule"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM (public.properties p
     LEFT JOIN public.organization_members om ON (((om.organization_id = p.organization_id) AND (om.user_id = auth.uid()))))
  WHERE ((p.id = property_schedule.property_id) AND ((p.venue_id = auth.uid()) OR (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))))));



  create policy "property_schedule_owner_read"
  on "public"."property_schedule"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.id = property_schedule.property_id) AND (p.venue_id = auth.uid())))));



  create policy "property_schedule_public_if_published"
  on "public"."property_schedule"
  as permissive
  for select
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.id = property_schedule.property_id) AND (p.published = true)))));



  create policy "property_schedule_select"
  on "public"."property_schedule"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.properties p
     LEFT JOIN public.organization_members om ON (((om.organization_id = p.organization_id) AND (om.user_id = auth.uid()))))
  WHERE ((p.id = property_schedule.property_id) AND ((p.venue_id = auth.uid()) OR (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))))));



  create policy "property_schedule_update"
  on "public"."property_schedule"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.properties p
     LEFT JOIN public.organization_members om ON (((om.organization_id = p.organization_id) AND (om.user_id = auth.uid()))))
  WHERE ((p.id = property_schedule.property_id) AND ((p.venue_id = auth.uid()) OR (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))))))
with check ((EXISTS ( SELECT 1
   FROM (public.properties p
     LEFT JOIN public.organization_members om ON (((om.organization_id = p.organization_id) AND (om.user_id = auth.uid()))))
  WHERE ((p.id = property_schedule.property_id) AND ((p.venue_id = auth.uid()) OR (om.role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))))));



  create policy "review_reminders_service_role_all"
  on "public"."review_reminders"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));



  create policy "Property owners can update their responses"
  on "public"."review_responses"
  as permissive
  for update
  to public
using ((responder_id = auth.uid()))
with check ((responder_id = auth.uid()));



  create policy "Review responses are viewable by everyone"
  on "public"."review_responses"
  as permissive
  for select
  to public
using (true);



  create policy "Users can insert review responses"
  on "public"."review_responses"
  as permissive
  for insert
  to authenticated
with check (((auth.uid() = responder_id) AND (EXISTS ( SELECT 1
   FROM (public.reviews r
     JOIN public.properties p ON ((r.property_id = p.id)))
  WHERE ((r.id = review_responses.review_id) AND (p.venue_id = auth.uid()))))));



  create policy "Venue owners can respond to reviews"
  on "public"."review_responses"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM (public.reviews r
     JOIN public.properties p ON ((r.property_id = p.id)))
  WHERE ((r.id = review_responses.review_id) AND (p.venue_id = auth.uid()) AND (auth.uid() = review_responses.responder_id)))));



  create policy "review_responses_public_for_approved_reviews"
  on "public"."review_responses"
  as permissive
  for select
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.reviews r
  WHERE ((r.id = review_responses.review_id) AND (r.status = 'approved'::text)))));



  create policy "Reviews are viewable by everyone"
  on "public"."reviews"
  as permissive
  for select
  to public
using (true);



  create policy "Users can create reviews"
  on "public"."reviews"
  as permissive
  for insert
  to public
with check (((reviewer_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.properties
  WHERE (properties.id = reviews.property_id)))));



  create policy "Users can delete their own reviews"
  on "public"."reviews"
  as permissive
  for delete
  to public
using ((reviewer_id = auth.uid()));



  create policy "Users can update their own reviews"
  on "public"."reviews"
  as permissive
  for update
  to public
using ((reviewer_id = auth.uid()))
with check ((reviewer_id = auth.uid()));



  create policy "reviews_insert_authenticated"
  on "public"."reviews"
  as permissive
  for insert
  to authenticated
with check ((reviewer_id = auth.uid()));



  create policy "reviews_public_approved"
  on "public"."reviews"
  as permissive
  for select
  to anon, authenticated
using ((status = 'approved'::text));



  create policy "Admins can manage system settings"
  on "public"."system_settings"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));



  create policy "Public can read system settings"
  on "public"."system_settings"
  as permissive
  for select
  to public
using (true);



  create policy "system_settings_select_all"
  on "public"."system_settings"
  as permissive
  for select
  to authenticated
using (true);



  create policy "system_settings_select_safe_subset"
  on "public"."system_settings"
  as permissive
  for select
  to authenticated
using (((key = ANY (ARRAY['email_sender'::text, 'auth_email_confirm_enabled'::text])) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true))))));



  create policy "system_settings_update_admin"
  on "public"."system_settings"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))));



  create policy "Admins can view webhook logs"
  on "public"."webhook_logs"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));



  create policy "Users can update their own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id))
with check ((auth.uid() = id));


CREATE TRIGGER update_analysis_results_updated_at BEFORE UPDATE ON public.analysis_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER bookings_schedule_review_reminder AFTER INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.schedule_review_reminder_for_booking();

CREATE TRIGGER send_payment_confirmation_notification AFTER UPDATE ON public.bookings FOR EACH ROW WHEN (((new.payment_status = 'paid'::text) AND (old.payment_status <> 'paid'::text))) EXECUTE FUNCTION public.send_payment_confirmation_notification();

CREATE TRIGGER update_inquiry_on_payment AFTER UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_inquiry_status_on_payment();

CREATE TRIGGER faq_entries_tsv_update BEFORE INSERT OR UPDATE ON public.faq_entries FOR EACH ROW EXECUTE FUNCTION public.faq_entries_tsv_trigger();

CREATE TRIGGER update_leases_updated_at BEFORE UPDATE ON public.leases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_timestamp BEFORE UPDATE ON public.organization_adjustments FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER trg_organization_members_set_primary_ai AFTER INSERT ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.trg_organization_members_set_primary();

CREATE TRIGGER trg_add_creator_as_org_owner AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_org_owner();

CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_convert_invites_on_profile_insert AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.convert_invites_for_profile();

CREATE TRIGGER trg_convert_invites_on_profile_update AFTER UPDATE OF email ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.convert_invites_for_profile();

CREATE TRIGGER update_property_schedule_updated_at BEFORE UPDATE ON public.property_schedule FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER send_payment_request_notification_trigger AFTER INSERT ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.send_payment_request_notification();

CREATE TRIGGER review_reminders_set_updated_at BEFORE UPDATE ON public.review_reminders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_review_responses_updated_at BEFORE UPDATE ON public.review_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER review_reminders_after_review_delete AFTER DELETE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.review_reminders_handle_review_delete();

CREATE TRIGGER review_reminders_after_review_insert AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.review_reminders_handle_review_insert();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER validate_review_status BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.validate_review_status();

CREATE TRIGGER log_notification_attempt BEFORE INSERT ON public.sent_notifications FOR EACH ROW EXECUTE FUNCTION public.log_notification_attempt();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


  create policy "Users can delete their own lease documents"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'lease-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can update their own lease documents"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'lease-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))
with check (((bucket_id = 'lease-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can upload their own lease documents"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'lease-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can view their own lease documents"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'lease-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



