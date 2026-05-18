
const shared = require('../packages/shared/dist/index.js');
console.log('requireAdmin:', !!shared.requireAdmin);
console.log('adminService:', !!shared.adminService);
console.log('adminAnalyticsService:', !!shared.adminAnalyticsService);
