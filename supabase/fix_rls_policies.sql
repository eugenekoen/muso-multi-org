-- POLICY: Allow admins to update their own organization settings
-- Run this in the Supabase SQL Editor

-- 1. Enable UPDATE for organization members with 'Admin' role
CREATE POLICY "Allow admins to update their organization" 
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = organizations.id
    AND organization_members.user_id = auth.uid()
    AND organization_members.role = 'Admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = organizations.id
    AND organization_members.user_id = auth.uid()
    AND organization_members.role = 'Admin'
  )
);

-- 2. (Optional) Ensure Master Admin can always update
-- Replace with your actual master email if different
CREATE POLICY "Allow master admin to update all organizations"
ON public.organizations
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'eugenekoenn@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'eugenekoenn@gmail.com');
