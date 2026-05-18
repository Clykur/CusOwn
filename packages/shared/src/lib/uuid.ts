/**
 * UUID v7 (time-ordered) for app-generated IDs when needed.
 * Database defaults use uuid_generate_v7() in PostgreSQL; use this when
 * you must generate the ID in the app (e.g. before insert or for idempotency).
 */
import { uuidv7 as uuidv7Fn } from 'uuidv7';

export function generateUuidV7(): string {
  return uuidv7Fn();
}

export { uuidv7Fn as uuidv7 };
