-- Add selected user-selected adjustment IDs to inquiries
-- Persist the set of org-level user_selected_discount IDs that the requester selected in the inquiry flow

alter table if exists public.inquiries
  add column if not exists selected_adjustment_ids uuid[] default '{}'::uuid[];

comment on column public.inquiries.selected_adjustment_ids is 'Organization adjustment IDs (uuid) selected by the user during inquiry (e.g., user_selected_discount).';
