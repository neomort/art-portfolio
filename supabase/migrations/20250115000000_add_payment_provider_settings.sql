-- Add payment provider settings to organizations table
-- Created at: 2025-01-15 UTC

-- Add payment provider column (stripe, authorizenet, etc)
alter table "public"."organizations" 
add column "payment_provider" text not null default 'stripe';

-- Add Authorize.net specific fields
alter table "public"."organizations" 
add column "authorizenet_api_login_id" text;

alter table "public"."organizations" 
add column "authorizenet_transaction_key" text;

alter table "public"."organizations" 
add column "authorizenet_sandbox_mode" boolean default true;

-- Add constraint to ensure valid payment provider values
alter table "public"."organizations" 
add constraint "organizations_payment_provider_check" 
check (payment_provider in ('stripe', 'authorizenet'));

-- Add indexes for payment provider fields
create index if not exists "organizations_payment_provider_idx" 
on "public"."organizations" (payment_provider);

-- Add comment to document the new fields
comment on column "public"."organizations"."payment_provider" is 'Primary payment processor for this organization (stripe or authorizenet)';
comment on column "public"."organizations"."authorizenet_api_login_id" is 'Authorize.net API Login ID (encrypted)';
comment on column "public"."organizations"."authorizenet_transaction_key" is 'Authorize.net Transaction Key (encrypted)';
comment on column "public"."organizations"."authorizenet_sandbox_mode" is 'Whether to use Authorize.net sandbox environment';
