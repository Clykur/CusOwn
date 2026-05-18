import os
import re

# List of members to move to @cusown/shared/client
CLIENT_MEMBERS = {
    # Hooks
    'useMounted', 'useUIStore', 'useBookingFlowStore', 'useCustomerBookingsStore',
    'useOwnerDashboardStore', 'useOwnerBusinessStore', 'useAdminDashboardStore',
    'useAnalyticsStore', 'useAsyncOperation', 'useBookingStatusPolling',
    'useBookingSyncChannel', 'useDebouncedSearch', 'useDedupFetch',
    'useMonitoredFetch', 'useOptimisticAction', 'useOptimisticUpdate',
    'useOptimisticMutation', 'useVisibilityRefresh', 'useSlotUpdates', 
    'useBookingsStats', 'useRealtimeUpdates', 'MODAL_IDS',
    
    # Store States
    'CustomerBookingsState', 'OwnerDashboardState', 'OwnerBusinessState',
    'AdminDashboardState', 'AnalyticsState', 'UIState', 'BookingFlowState',
    
    # Selectors
    'selectCustomerHasValidCache', 'selectOwnerDashboardHasValidCache',
    'selectBookingCounts', 'selectAvailableSlots', 'selectIsDateClosed',
    'selectDaysSelected', 'selectHasNoActivity',
    
    # Types (Store related)
    'Holiday', 'Closure', 'ReviewData', 'ShopPhoto', 'Toast', 'ToastVariant',
    'ModalState', 'AnalyticsOverview', 'DailyPoint', 'PeakHourPoint',
    'AdvancedAnalytics', 'PlatformMetrics', 'BookingTrend', 'OverviewExtras',
    'RevenueSnapshot', 'CustomerBooking', 'CustomerBookingsStats'
}

def process_file(filepath):
    try:
        with open(filepath, 'r') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return False

    # Find imports from @cusown/shared
    # Matches: import { A, B } from '@cusown/shared';
    # Or: import {
    #   A,
    #   B
    # } from '@cusown/shared';
    
    import_pattern = re.compile(r'import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+[\'"]@cusown\/shared[\'"];?', re.MULTILINE)
    
    new_content = content
    matches = list(import_pattern.finditer(content))
    
    # Process matches in reverse to avoid index shifting
    for match in reversed(matches):
        full_match = match.group(0)
        members_str = match.group(1)
        
        # Parse members
        members = [m.strip() for m in members_str.split(',')]
        members = [m for m in members if m] # remove empty strings
        
        # Check if any member needs to move
        shared_members = []
        client_members = []
        
        for m in members:
            # Handle 'type X' or 'X as Y'
            name = m.split(' as ')[0].strip()
            if name.startswith('type '):
                name = name[5:].strip()
            
            if name in CLIENT_MEMBERS:
                client_members.append(m)
            else:
                shared_members.append(m)
        
        if not client_members:
            continue
            
        # Reconstruct imports
        new_imports = []
        if shared_members:
            new_imports.append(f"import {{ {', '.join(shared_members)} }} from '@cusown/shared';")
        if client_members:
            new_imports.append(f"import {{ {', '.join(client_members)} }} from '@cusown/shared/client';")
            
        replacement = '\n'.join(new_imports)
        new_content = new_content[:match.start()] + replacement + new_content[match.end():]

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        return True
    return False

ROOT_DIR = os.getcwd()
search_dirs = [
    os.path.join(ROOT_DIR, 'apps/app'),
    os.path.join(ROOT_DIR, 'apps/marketing'),
    os.path.join(ROOT_DIR, 'packages/shared/src')
]

updated_count = 0
for search_dir in search_dirs:
    if not os.path.exists(search_dir):
        continue
    for root, _, files in os.walk(search_dir):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                filepath = os.path.join(root, file)
                if process_file(filepath):
                    updated_count += 1
                    print(f"Updated: {os.path.relpath(filepath, ROOT_DIR)}")

print(f"Total files updated: {updated_count}")
