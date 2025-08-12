-- Create call_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE call_status_type AS ENUM ('incoming', 'in_progress', 'on_hold', 'completed', 'failed', 'transferred');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add status column to calls table for better real-time tracking
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS status call_status_type DEFAULT 'incoming';
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS caller_phone text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS call_duration_seconds integer;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS ai_confidence_score numeric(3,2);

-- Create call_events table for detailed tracking
CREATE TABLE IF NOT EXISTS public.call_events (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    event_data jsonb DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS for call_events
ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;

-- Create policy for call_events
CREATE POLICY "Medical staff can manage call events" ON public.call_events
    FOR ALL
    USING (
        call_id IN (
            SELECT id FROM public.calls 
            WHERE clinic_id IN (
                SELECT clinic_id FROM public.profiles 
                WHERE user_id = auth.uid()
            )
        ) AND 
        get_current_user_role() = ANY(ARRAY['owner', 'doctor', 'nurse', 'medical_assistant', 'admin'])
    );

-- Create function to update call duration automatically
CREATE OR REPLACE FUNCTION public.update_call_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
        NEW.call_duration_seconds = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for call duration
DROP TRIGGER IF EXISTS update_call_duration_trigger ON public.calls;
CREATE TRIGGER update_call_duration_trigger
    BEFORE UPDATE ON public.calls
    FOR EACH ROW
    EXECUTE FUNCTION public.update_call_duration();

-- Create function to log call events automatically
CREATE OR REPLACE FUNCTION public.log_call_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.call_events (call_id, event_type, event_data)
        VALUES (
            NEW.id,
            'status_change',
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'timestamp', now()
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status changes
DROP TRIGGER IF EXISTS log_call_status_change_trigger ON public.calls;
CREATE TRIGGER log_call_status_change_trigger
    AFTER UPDATE ON public.calls
    FOR EACH ROW
    EXECUTE FUNCTION public.log_call_status_change();