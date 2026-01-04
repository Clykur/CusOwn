-- Quick Migration: Set Admin Status for Specific User
-- Run this if you've already run migration_add_admin_support.sql but need to set admin status
-- Replace 'chinnuk0521@gmail.com' with your email if different

-- Method 1: Update existing profile
UPDATE user_profiles
SET user_type = 'admin',
    updated_at = NOW()
WHERE id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'chinnuk0521@gmail.com'
);

-- Method 2: Create profile if it doesn't exist
INSERT INTO user_profiles (id, user_type, full_name, created_at, updated_at)
SELECT 
  id,
  'admin',
  COALESCE(raw_user_meta_data->>'full_name', email),
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'chinnuk0521@gmail.com'
  AND id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO UPDATE
SET user_type = 'admin',
    updated_at = NOW();

-- Verify the update
SELECT 
  up.id,
  up.user_type,
  au.email,
  up.full_name
FROM user_profiles up
JOIN auth.users au ON up.id = au.id
WHERE au.email = 'chinnuk0521@gmail.com';

