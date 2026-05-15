// Client-safe exports (Utils, Hooks, Performance, Constants, Types)

// Lib
export * from './lib/supabase/client';
export * from './lib/supabase/auth';
export * from './lib/utils/response';
export * from './lib/utils/navigation';
export * from './lib/utils/url';
export * from './lib/utils/security';
export * from './lib/utils/string';
export * from './lib/utils/cn';
export { getClientIp } from './lib/security/client-ip.security';
export * from './lib/utils/time';
export * from './lib/slot-capacity-timeline';
export * from './lib/utils/validation';
export * from './lib/utils/analytics-chart-format';
export * from './lib/time/ist';
export * from './lib/utils/error-handler';
export * from './lib/utils/csrf-client';
export * from './lib/utils/fetch-dedup';
export * from './lib/utils/admin-fetch.client';
export * from './lib/utils/batch-requests';
export * from './lib/utils/user-state.client';
export * from './lib/cache/reviews-cache';
export * from './lib/cache/business-profile-cache';
export * from './lib/prefetch/customer-dashboard';
export * from './lib/uuid';
export * from './lib/utils/session-cache';
export { default as generateWhatsAppLink } from './lib/whatsapp';
export * from './lib/store/index';

// Auth helpers (server-side)
export * from './lib/auth/getOAuthRedirect';

// Security helpers
export * from './lib/security/csrf';

// Auth helpers (server-side)
export * from './lib/supabase/server-auth';
export * from './services/access.service';
export { authEventsService } from './services/auth-events.service';

// Auth (Client-side session)
export * from './lib/auth/server-session-client';

// Performance & Monitoring
export * from './lib/monitoring/index';
export * from './lib/observability/structured-log';

// Types
export * from './types';