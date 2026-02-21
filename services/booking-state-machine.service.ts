/**
 * Booking state machine: directed graph (adjacency map).
 * Loads booking_states + booking_state_transitions; validates transitions in O(1).
 * No hardcoded status if-else trees.
 */

import { requireSupabaseAdmin } from '@/lib/supabase/server';

/** Adjacency: from_state_name -> (event -> to_state_name). Refreshed by TTL. */
let transitionMap: Map<string, Map<string, string>> | null = null;
let terminalStates: Set<string> | null = null;
let stateMachineBuiltAt = 0;
const STATE_MACHINE_TTL_MS = 60_000;

export type BookingEvent = 'confirm' | 'reject' | 'cancel' | 'expire';

/**
 * Load states and transitions from DB; build adjacency map and terminal set.
 */
async function buildTransitionGraph(): Promise<{
  map: Map<string, Map<string, string>>;
  terminal: Set<string>;
}> {
  const supabase = requireSupabaseAdmin();
  const [statesRes, transRes] = await Promise.all([
    supabase.from('booking_states').select('id, name, is_terminal'),
    supabase.from('booking_state_transitions').select('from_state_id, event, to_state_id'),
  ]);
  if (statesRes.error) throw new Error(statesRes.error.message || 'Failed to load booking_states');
  if (transRes.error)
    throw new Error(transRes.error.message || 'Failed to load booking_state_transitions');

  const idToName = new Map<string, string>();
  const terminal = new Set<string>();
  for (const s of statesRes.data ?? []) {
    idToName.set(s.id, s.name);
    if (s.is_terminal) terminal.add(s.name);
  }

  const map = new Map<string, Map<string, string>>();
  for (const t of transRes.data ?? []) {
    const fromName = idToName.get(t.from_state_id);
    const toName = idToName.get(t.to_state_id);
    if (!fromName || !toName) continue;
    let events = map.get(fromName);
    if (!events) {
      events = new Map();
      map.set(fromName, events);
    }
    events.set(t.event, toName);
  }
  return { map, terminal };
}

async function getGraph(): Promise<{
  map: Map<string, Map<string, string>>;
  terminal: Set<string>;
}> {
  const now = Date.now();
  if (transitionMap && terminalStates && now - stateMachineBuiltAt < STATE_MACHINE_TTL_MS) {
    return { map: transitionMap, terminal: terminalStates };
  }
  const built = await buildTransitionGraph();
  transitionMap = built.map;
  terminalStates = built.terminal;
  stateMachineBuiltAt = now;
  return built;
}

/**
 * O(1): whether transition from state with event is allowed.
 */
export async function canTransition(fromStateName: string, event: string): Promise<boolean> {
  const { map } = await getGraph();
  const events = map.get(fromStateName);
  return events?.has(event) ?? false;
}

/**
 * O(1): next state name for (fromState, event) or null if invalid.
 */
export async function getNextState(fromStateName: string, event: string): Promise<string | null> {
  const { map } = await getGraph();
  const events = map.get(fromStateName);
  return events?.get(event) ?? null;
}

/**
 * O(1): whether state is terminal (no outgoing transitions).
 */
export async function isTerminalState(stateName: string): Promise<boolean> {
  const { terminal } = await getGraph();
  return terminal.has(stateName);
}

export function invalidateBookingStateMachineCache(): void {
  transitionMap = null;
  terminalStates = null;
  stateMachineBuiltAt = 0;
}
