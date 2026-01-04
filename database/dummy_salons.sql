-- Dummy Salons Data
-- Run this in Supabase SQL Editor to add test data
-- DELETE THESE LATER - This is for testing only

INSERT INTO salons (
  salon_name,
  owner_name,
  whatsapp_number,
  opening_time,
  closing_time,
  slot_duration,
  booking_link,
  location,
  address
) VALUES
-- Bangalore Salons
('Elite Hair Studio', 'Rajesh Kumar', '+919876543210', '09:00:00', '20:00:00', 30, 'elite-hair-studio', 'Bangalore', '123 MG Road, Bangalore, Karnataka 560001'),
('Style Zone Salon', 'Priya Sharma', '+919876543211', '10:00:00', '21:00:00', 30, 'style-zone-salon', 'Bangalore', '456 Brigade Road, Bangalore, Karnataka 560025'),
('Glamour Cuts', 'Amit Patel', '+919876543212', '09:30:00', '19:30:00', 45, 'glamour-cuts', 'Bangalore', '789 Indiranagar, Bangalore, Karnataka 560038'),

-- Mumbai Salons
('Royal Hair Salon', 'Sunita Mehta', '+919876543213', '10:00:00', '20:00:00', 30, 'royal-hair-salon', 'Mumbai', '321 Andheri West, Mumbai, Maharashtra 400053'),
('Trendy Looks', 'Vikram Singh', '+919876543214', '09:00:00', '21:00:00', 30, 'trendy-looks', 'Mumbai', '654 Bandra, Mumbai, Maharashtra 400050'),
('Luxury Cuts', 'Anjali Desai', '+919876543215', '10:30:00', '20:30:00', 45, 'luxury-cuts', 'Mumbai', '987 Powai, Mumbai, Maharashtra 400076'),

-- Delhi Salons
('Classic Hair Studio', 'Rohit Verma', '+919876543216', '09:00:00', '20:00:00', 30, 'classic-hair-studio', 'Delhi', '147 Connaught Place, New Delhi 110001'),
('Modern Styles', 'Kavita Gupta', '+919876543217', '10:00:00', '21:00:00', 30, 'modern-styles', 'Delhi', '258 Saket, New Delhi 110017'),
('Elite Beauty Salon', 'Manish Agarwal', '+919876543218', '09:30:00', '19:30:00', 45, 'elite-beauty-salon', 'Delhi', '369 Vasant Kunj, New Delhi 110070'),

-- Hyderabad Salons
('Premium Cuts', 'Sneha Reddy', '+919876543219', '10:00:00', '20:00:00', 30, 'premium-cuts', 'Hyderabad', '741 Hitech City, Hyderabad, Telangana 500081'),
('Style Hub', 'Arjun Rao', '+919876543220', '09:00:00', '21:00:00', 30, 'style-hub', 'Hyderabad', '852 Banjara Hills, Hyderabad, Telangana 500034'),

-- Chennai Salons
('Hair Masters', 'Lakshmi Iyer', '+919876543221', '09:30:00', '20:30:00', 30, 'hair-masters', 'Chennai', '963 T Nagar, Chennai, Tamil Nadu 600017'),
('Glamour Studio', 'Ramesh Nair', '+919876543222', '10:00:00', '21:00:00', 45, 'glamour-studio', 'Chennai', '159 Anna Nagar, Chennai, Tamil Nadu 600040'),

-- Pune Salons
('Trendsetters Salon', 'Meera Joshi', '+919876543223', '09:00:00', '20:00:00', 30, 'trendsetters-salon', 'Pune', '357 Koregaon Park, Pune, Maharashtra 411001'),
('Chic Cuts', 'Nikhil Kulkarni', '+919876543224', '10:00:00', '21:00:00', 30, 'chic-cuts', 'Pune', '468 Hinjewadi, Pune, Maharashtra 411057');

-- Generate slots for all inserted salons (today and tomorrow)
DO $$
DECLARE
  salon_rec RECORD;
  slot_date DATE;
  slot_start_time TIME;
  slot_end_time TIME;
BEGIN
  FOR salon_rec IN 
    SELECT id, opening_time, closing_time, slot_duration 
    FROM salons 
    WHERE location IS NOT NULL
  LOOP
    -- Generate for today and tomorrow
    FOR slot_date IN 
      SELECT generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', INTERVAL '1 day')::DATE
    LOOP
      slot_start_time := salon_rec.opening_time;
      
      WHILE slot_start_time < salon_rec.closing_time
      LOOP
        slot_end_time := slot_start_time + (salon_rec.slot_duration || ' minutes')::INTERVAL;
        
        IF slot_end_time <= salon_rec.closing_time THEN
          INSERT INTO slots (salon_id, date, start_time, end_time, status)
          VALUES (salon_rec.id, slot_date, slot_start_time, slot_end_time, 'available')
          ON CONFLICT (salon_id, date, start_time, end_time) DO NOTHING;
        END IF;
        
        slot_start_time := slot_end_time;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- To delete all dummy data later, run:
-- DELETE FROM bookings WHERE salon_id IN (SELECT id FROM salons WHERE location IS NOT NULL);
-- DELETE FROM slots WHERE salon_id IN (SELECT id FROM salons WHERE location IS NOT NULL);
-- DELETE FROM salons WHERE location IS NOT NULL;

