import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
  duration?: number;
  dataCreated?: any;
  dataAccessed?: any;
}

export class TestRunner {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const testStart = Date.now();
    let testDetails: any = {};
    
    try {
      console.log(`\n🧪 Running: ${name}`);
      console.log(`   ⏱️  Started at: ${new Date().toLocaleTimeString()}`);
      
      await testFn();
      
      const duration = Date.now() - testStart;
      this.results.push({ 
        name, 
        passed: true, 
        duration,
        details: testDetails 
      });
      
      console.log(`✅ PASSED: ${name}`);
      console.log(`   ⏱️  Duration: ${duration}ms`);
      if (testDetails.dataCreated) {
        console.log(`   📝 Data Created: ${JSON.stringify(testDetails.dataCreated, null, 2).split('\n').slice(0, 5).join('\n      ')}`);
      }
      if (testDetails.dataAccessed) {
        console.log(`   📊 Data Accessed: ${JSON.stringify(testDetails.dataAccessed, null, 2).split('\n').slice(0, 5).join('\n      ')}`);
      }
    } catch (error) {
      const duration = Date.now() - testStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.push({ 
        name, 
        passed: false, 
        error: errorMessage,
        duration 
      });
      console.error(`❌ FAILED: ${name}`);
      console.error(`   ⏱️  Duration: ${duration}ms`);
      console.error(`   Error: ${errorMessage}`);
      throw error;
    }
  }

  async runTestSafe(name: string, testFn: () => Promise<void>): Promise<void> {
    try {
      console.log(`\n🧪 Running: ${name}`);
      await testFn();
      this.results.push({ name, passed: true });
      console.log(`✅ PASSED: ${name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.push({ name, passed: false, error: errorMessage });
      console.error(`❌ FAILED: ${name}`);
      console.error(`   Error: ${errorMessage}`);
    }
  }

  getResults(): TestResult[] {
    return this.results;
  }

  printSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    console.log('\n' + '='.repeat(70));
    console.log('📊 DETAILED TEST SUMMARY');
    console.log('='.repeat(70));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const avgDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0) / total;
    const totalTestDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);

    console.log(`\n📈 Overall Statistics:`);
    console.log(`   Total Tests: ${total}`);
    console.log(`   ✅ Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
    console.log(`   ❌ Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`);
    console.log(`   ⏱️  Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log(`   ⏱️  Average Test Duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`   ⏱️  Test Execution Time: ${totalTestDuration.toFixed(0)}ms`);

    if (passed > 0) {
      console.log(`\n✅ Passed Tests:`);
      this.results
        .filter(r => r.passed)
        .forEach((r, idx) => {
          console.log(`   ${idx + 1}. ${r.name}`);
          if (r.duration) {
            console.log(`      ⏱️  Duration: ${r.duration}ms`);
          }
          if (r.details?.dataCreated) {
            const created = r.details.dataCreated;
            if (typeof created === 'object') {
              const keys = Object.keys(created);
              console.log(`      📝 Created: ${keys.join(', ')}`);
            }
          }
        });
    }

    if (failed > 0) {
      console.log(`\n❌ Failed Tests:`);
      this.results
        .filter(r => !r.passed)
        .forEach((r, idx) => {
          console.log(`   ${idx + 1}. ${r.name}`);
          if (r.duration) {
            console.log(`      ⏱️  Duration: ${r.duration}ms`);
          }
          if (r.error) {
            console.log(`      ❌ Error: ${r.error}`);
          }
        });
    }

    console.log('\n' + '='.repeat(70) + '\n');
  }
}

export async function getRandomBusiness(): Promise<any> {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('suspended', false)
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(`No active business found: ${error?.message || 'No data'}`);
  }

  return data;
}

/**
 * Generate slots for a business if they don't exist
 * Uses DSA: Queue-based slot generation
 */
async function ensureSlotsExist(businessId: string, date: string): Promise<void> {
  const { data: existing } = await supabase
    .from('slots')
    .select('id')
    .eq('business_id', businessId)
    .eq('date', date)
    .limit(1);

  if (existing && existing.length > 0) {
    return; // Slots already exist
  }

  // Get business config
  const { data: business } = await supabase
    .from('businesses')
    .select('opening_time, closing_time, slot_duration')
    .eq('id', businessId)
    .single();

  if (!business || !business.opening_time || !business.closing_time || !business.slot_duration) {
    throw new Error('Business missing time configuration');
  }

  // Generate slots using queue-based approach
  const slots: any[] = [];
  const opening = parseTime(business.opening_time);
  const closing = parseTime(business.closing_time);
  const duration = business.slot_duration;

  let current = opening;
  while (current < closing) {
    const end = Math.min(current + duration, closing);
    slots.push({
      business_id: businessId,
      date,
      start_time: formatTime(current),
      end_time: formatTime(end),
      status: 'available',
    });
    current = end;
  }

  if (slots.length > 0) {
    const { error } = await supabase.from('slots').insert(slots);
    if (error) {
      throw new Error(`Failed to generate slots: ${error.message}`);
    }
  }
}

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
}

export async function getRandomAvailableSlot(businessId: string): Promise<any> {
  // Try multiple dates (tomorrow, day after, etc.) - BFS approach
  const dates: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  // Try each date until we find available slots
  for (const dateStr of dates) {
    // Ensure slots exist for this date
    try {
      await ensureSlotsExist(businessId, dateStr);
    } catch (error) {
      continue; // Try next date
    }

    const { data, error } = await supabase
      .from('slots')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'available')
      .eq('date', dateStr)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data;
    }
  }

  throw new Error(`No available slots found for business ${businessId.substring(0, 8)}... after checking 7 days`);
}

export async function getOrCreateTestUser(email: string, userType: 'customer' | 'owner' = 'customer'): Promise<any> {
  // Create new user using admin API (always create with unique email)
  const { data: newUser, error } = await supabase.auth.admin.createUser({
    email,
    password: 'TestPassword123!',
    email_confirm: true,
  });
  
  if (error) {
    // If user already exists, the error will indicate that
    // For testing, we'll throw and let the test handle it
    throw new Error(`Failed to create test user: ${error.message}. Email may already exist.`);
  }
  
  if (!newUser.user) {
    throw new Error('Failed to create test user: No user returned');
  }
  
  const userId = newUser.user.id;

  // Check and create profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    const { error: insertError } = await supabase.from('user_profiles').insert({
      id: userId,
      user_type: userType,
      full_name: `Test ${userType}`,
      phone_number: '+919876543210',
    });
    if (insertError) {
      console.warn(`Failed to create profile: ${insertError.message}`);
    }
  } else {
    // Update user type if needed
    if (profile.user_type !== userType) {
      await supabase
        .from('user_profiles')
        .update({ user_type: userType })
        .eq('id', userId);
    }
  }

  return { id: userId, email, userType };
}

export async function cleanupTestData(bookingIds: string[], slotIds: string[]): Promise<void> {
  if (bookingIds.length > 0) {
    await supabase.from('bookings').delete().in('id', bookingIds);
  }
  if (slotIds.length > 0) {
    await supabase.from('slots').update({ status: 'available', reserved_until: null }).in('id', slotIds);
  }
}

export async function simulateUserAction(action: string, details?: any): Promise<void> {
  console.log(`   👤 User Action: ${action}`);
  if (details) {
    const detailsStr = JSON.stringify(details, null, 2);
    const lines = detailsStr.split('\n').slice(0, 3);
    if (lines.length > 0) {
      console.log(`      Details: ${lines.join('\n      ')}`);
    }
  }
  await new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * DSA: State Machine Tracker for testing state transitions
 */
export class StateMachineTracker {
  private stateGraph: Map<string, Set<string>> = new Map();
  private transitions: Array<{ from: string; to: string; timestamp: number }> = [];
  private currentState: string = 'initial';

  constructor(validTransitions: Record<string, string[]>) {
    for (const [from, toStates] of Object.entries(validTransitions)) {
      this.stateGraph.set(from, new Set(toStates));
    }
  }

  transition(to: string): boolean {
    const validNextStates = this.stateGraph.get(this.currentState);
    if (!validNextStates || !validNextStates.has(to)) {
      return false;
    }
    this.transitions.push({
      from: this.currentState,
      to,
      timestamp: Date.now(),
    });
    this.currentState = to;
    return true;
  }

  getCurrentState(): string {
    return this.currentState;
  }

  getTransitions(): Array<{ from: string; to: string; timestamp: number }> {
    return [...this.transitions];
  }

  isValidPath(): boolean {
    return this.transitions.length > 0 && this.currentState !== 'initial';
  }
}

/**
 * DSA: Queue-based workflow tester
 */
export class WorkflowQueue {
  private queue: Array<{ action: string; priority: number; data?: any }> = [];
  private completed: Array<{ action: string; result: any; timestamp: number }> = [];

  enqueue(action: string, priority: number = 0, data?: any): void {
    this.queue.push({ action, priority, data });
    this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  async processNext(): Promise<any> {
    if (this.queue.length === 0) {
      return null;
    }
    const item = this.queue.shift()!;
    const result = { action: item.action, data: item.data };
    this.completed.push({
      action: item.action,
      result,
      timestamp: Date.now(),
    });
    return result;
  }

  getCompleted(): Array<{ action: string; result: any; timestamp: number }> {
    return [...this.completed];
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}

/**
 * DSA: Hash Map for tracking test state
 */
export class TestStateTracker {
  private stateMap: Map<string, any> = new Map();
  private history: Array<{ key: string; value: any; timestamp: number }> = [];

  set(key: string, value: any): void {
    this.history.push({ key, value, timestamp: Date.now() });
    this.stateMap.set(key, value);
  }

  get(key: string): any {
    return this.stateMap.get(key);
  }

  has(key: string): boolean {
    return this.stateMap.has(key);
  }

  getAll(): Map<string, any> {
    return new Map(this.stateMap);
  }

  getHistory(): Array<{ key: string; value: any; timestamp: number }> {
    return [...this.history];
  }

  clear(): void {
    this.stateMap.clear();
    this.history = [];
  }
}
