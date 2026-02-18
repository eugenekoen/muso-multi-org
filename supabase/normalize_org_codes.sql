-- Update the get_org_by_code function to normalize codes for matching
-- This ensures codes like "GCC2024", "gcc2024", "G CC-2024" all match the same organization

-- Drop the existing function first (required because return type is changing)
DROP FUNCTION IF EXISTS public.get_org_by_code(text) CASCADE;

-- Now create the updated function with normalization
CREATE FUNCTION public.get_org_by_code(code_input text)
RETURNS TABLE(id uuid, name text, signup_code text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Normalize the input code: remove spaces, special chars, convert to uppercase
  -- Then match against normalized signup_code in the database
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.signup_code
  FROM public.organizations o
  WHERE UPPER(REGEXP_REPLACE(o.signup_code, '[^A-Z0-9]', '', 'g')) = UPPER(REGEXP_REPLACE(code_input, '[^A-Z0-9]', '', 'g'))
    AND (o.is_disabled IS NULL OR o.is_disabled = false);
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.get_org_by_code(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_org_by_code IS 'Retrieves an organization by its signup code with normalization for case-insensitive and special-character-insensitive matching. Returns only enabled organizations.';
