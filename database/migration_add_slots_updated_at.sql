-- Add updated_at column to slots table if it doesn't exist
ALTER TABLE slots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_slots_updated_at 
  BEFORE UPDATE ON slots
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
