-- Add calendar_token column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'calendar_token'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN calendar_token UUID DEFAULT gen_random_uuid();
    END IF;
END $$;

-- Create index on calendar_token for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_calendar_token ON public.profiles(calendar_token);

-- Drop old RPC function if exists
DROP FUNCTION IF EXISTS public.get_user_schedule_by_calendar_token(uuid);

-- Create RPC function to fetch user schedules by token
CREATE OR REPLACE FUNCTION public.get_user_schedule_by_calendar_token(p_token UUID)
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    user_email TEXT,
    schedule_id UUID,
    organization_id UUID,
    organization_name TEXT,
    service_date DATE,
    assigned_roles JSONB,
    all_team JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_name TEXT;
    v_email TEXT;
BEGIN
    -- Look up user by calendar token
    SELECT id, full_name, email INTO v_user_id, v_name, v_email
    FROM public.profiles
    WHERE calendar_token = p_token;

    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH matching_schedules AS (
        SELECT 
            s.id AS sched_id,
            s.organization_id AS org_id,
            o.name AS org_name,
            s.service_date AS s_date,
            s.leader_id,
            s.bass_id,
            s.keys_id,
            s.piano_id,
            s.drums_id,
            s.sound_id,
            s.av_id,
            s.guitar_ids,
            s.vocals_ids,
            s.custom_roles
        FROM public.service_schedules s
        JOIN public.organizations o ON s.organization_id = o.id
        WHERE (
            s.leader_id = v_user_id OR
            s.bass_id = v_user_id OR
            s.keys_id = v_user_id OR
            s.piano_id = v_user_id OR
            s.drums_id = v_user_id OR
            s.sound_id = v_user_id OR
            s.av_id = v_user_id OR
            (s.guitar_ids IS NOT NULL AND v_user_id = ANY(s.guitar_ids)) OR
            (s.vocals_ids IS NOT NULL AND v_user_id = ANY(s.vocals_ids)) OR
            (s.custom_roles IS NOT NULL AND s.custom_roles::text LIKE '%' || v_user_id::text || '%')
        )
    )
    SELECT 
        v_user_id,
        v_name,
        v_email,
        ms.sched_id,
        ms.org_id,
        ms.org_name,
        ms.s_date,
        -- Assigned roles JSON array for this specific user
        (
            SELECT jsonb_agg(role_name)
            FROM (
                SELECT 'Worship Leader' AS role_name WHERE ms.leader_id = v_user_id
                UNION ALL SELECT 'Bass' WHERE ms.bass_id = v_user_id
                UNION ALL SELECT 'Keys' WHERE ms.keys_id = v_user_id
                UNION ALL SELECT 'Piano' WHERE ms.piano_id = v_user_id
                UNION ALL SELECT 'Drums' WHERE ms.drums_id = v_user_id
                UNION ALL SELECT 'Sound' WHERE ms.sound_id = v_user_id
                UNION ALL SELECT 'AV' WHERE ms.av_id = v_user_id
                UNION ALL SELECT 'Guitar' WHERE ms.guitar_ids IS NOT NULL AND v_user_id = ANY(ms.guitar_ids)
                UNION ALL SELECT 'Vocals' WHERE ms.vocals_ids IS NOT NULL AND v_user_id = ANY(ms.vocals_ids)
            ) roles_sub
        ) AS assigned_roles,
        -- Complete team JSON for this service
        (
            SELECT jsonb_build_object(
                'leader', ms.leader_id,
                'bass', ms.bass_id,
                'keys', ms.keys_id,
                'piano', ms.piano_id,
                'drums', ms.drums_id,
                'sound', ms.sound_id,
                'av', ms.av_id,
                'guitars', ms.guitar_ids,
                'vocals', ms.vocals_ids,
                'custom', ms.custom_roles
            )
        ) AS all_team
    FROM matching_schedules ms
    ORDER BY ms.s_date ASC;
END;
$$;

-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_user_schedule_by_calendar_token(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.get_user_schedule_by_calendar_token IS 'Returns scheduled services and role assignments for a user matching a unique calendar token.';
