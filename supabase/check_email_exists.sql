-- Function to check if an email already exists in auth.users
-- This is a security definer function that can safely check auth.users
-- without exposing sensitive user data
CREATE OR REPLACE FUNCTION public.check_email_exists(check_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_count integer;
BEGIN
  -- Check if email exists in auth.users table
  SELECT COUNT(*)
  INTO email_count
  FROM auth.users
  WHERE email = check_email;
  
  -- Return true if email exists, false otherwise
  RETURN email_count > 0;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO authenticated, anon;

COMMENT ON FUNCTION public.check_email_exists IS 'Safely checks if an email is already registered without exposing user data';
