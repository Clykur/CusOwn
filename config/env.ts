export const env = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  app: {
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  cron: {
    secret: process.env.CRON_SECRET || '',
  },
  security: {
    salonTokenSecret: process.env.SALON_TOKEN_SECRET || process.env.CRON_SECRET || 'default-secret-change-in-production',
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  monitoring: {
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  },
  email: {
    serviceUrl: process.env.EMAIL_SERVICE_URL || '',
    apiKey: process.env.EMAIL_API_KEY || '',
  },
  sms: {
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },
  payment: {
    slotExpiryMinutes: parseInt(process.env.SLOT_EXPIRY_MINUTES || '10', 10),
    paymentExpiryMinutes: parseInt(process.env.PAYMENT_EXPIRY_MINUTES || '10', 10),
    maxPaymentAttempts: parseInt(process.env.MAX_PAYMENT_ATTEMPTS || '3', 10),
    autoRefundOnLateSuccess: process.env.AUTO_REFUND_ON_LATE_SUCCESS === 'true',
    upiMerchantVpa: process.env.UPI_MERCHANT_VPA || '',
    upiMerchantName: process.env.UPI_MERCHANT_NAME || 'CusOwn',
    upiWebhookSecret: process.env.UPI_WEBHOOK_SECRET || '',
  },
  booking: {
    expiryHours: parseInt(process.env.BOOKING_EXPIRY_HOURS || '24', 10),
    reminder24hBeforeHours: parseInt(process.env.REMINDER_24H_BEFORE_HOURS || '24', 10),
    reminder2hBeforeHours: parseInt(process.env.REMINDER_2H_BEFORE_HOURS || '2', 10),
    cancellationMinHoursBefore: parseInt(process.env.CANCELLATION_MIN_HOURS_BEFORE || '2', 10),
  },
} as const;

export const validateEnv = (): void => {
  const required = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: env.supabase.url },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: env.supabase.anonKey },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: env.supabase.serviceRoleKey },
  ];

  const missing = required.filter(({ value }) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.map(({ key }) => key).join(', ')}`
    );
  }
};

