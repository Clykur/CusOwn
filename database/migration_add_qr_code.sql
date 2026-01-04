-- Migration: Add QR code column to businesses table
-- This stores the QR code image as base64 or text reference
-- SAFE to run - won't break existing data

-- Add qr_code column to store QR code data
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- Add index for QR code lookups (if needed)
-- CREATE INDEX IF NOT EXISTS idx_businesses_qr_code ON businesses(qr_code) WHERE qr_code IS NOT NULL;

-- Note: QR code will be generated automatically when a business is created
-- Owners can access their QR code via /owner/[bookingLink] page

