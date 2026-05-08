/*
  # Add inquiry status flags for enhanced inquiry management

  1. New Columns
    - `initiator_closed` (boolean) - Whether the inquiry initiator has closed the inquiry
    - `responder_closed` (boolean) - Whether the inquiry responder has closed the inquiry  
    - `initiator_deleted` (boolean) - Whether the inquiry initiator has deleted the thread
    - `responder_deleted` (boolean) - Whether the inquiry responder has deleted the thread
    - `initiator_last_read_message_id` (uuid) - Last message read by the initiator
    - `responder_last_read_message_id` (uuid) - Last message read by the responder

  2. Constraints
    - Foreign key constraints for last_read_message_id columns
    - Default values for boolean flags

  3. Indexes
    - Performance indexes for the new boolean columns
*/

-- Add new columns to inquiries table
ALTER TABLE public.inquiries
ADD COLUMN initiator_closed BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN responder_closed BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN initiator_deleted BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN responder_deleted BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN initiator_last_read_message_id UUID,
ADD COLUMN responder_last_read_message_id UUID;

-- Add foreign key constraints for last_read_message_id columns
ALTER TABLE public.inquiries
ADD CONSTRAINT fk_initiator_last_read_message
FOREIGN KEY (initiator_last_read_message_id) REFERENCES public.messages(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_responder_last_read_message
FOREIGN KEY (responder_last_read_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

-- Add indexes for faster lookups on new columns
CREATE INDEX idx_inquiries_initiator_closed ON public.inquiries (initiator_closed);
CREATE INDEX idx_inquiries_responder_closed ON public.inquiries (responder_closed);
CREATE INDEX idx_inquiries_initiator_deleted ON public.inquiries (initiator_deleted);
CREATE INDEX idx_inquiries_responder_deleted ON public.inquiries (responder_deleted);

-- Add indexes for last read message tracking
CREATE INDEX idx_inquiries_initiator_last_read ON public.inquiries (initiator_last_read_message_id);
CREATE INDEX idx_inquiries_responder_last_read ON public.inquiries (responder_last_read_message_id);