-- Add is_disabled column to organizations table
-- This column tracks whether an organization is disabled (e.g., due to unpaid bill)

ALTER TABLE organizations
ADD COLUMN is_disabled BOOLEAN DEFAULT false;

-- Create an index for faster filtering
CREATE INDEX idx_organizations_is_disabled ON organizations(is_disabled);
