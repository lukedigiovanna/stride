/**
 * Persistent queue for set inserts that failed due to network unavailability.
 * Entries survive page reloads via localStorage and are replayed on reconnect.
 */

export interface PendingSetInsert {
  /** Client-generated temp ID used in local WorkoutContext state. */
  tempId: string;
  userId: string;
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  weightLbs: number;
  reps: number;
  notes: string | null;
  enqueuedAt: string;
}

const QUEUE_KEY = 'stride_pending_sets';

export function loadQueue(): PendingSetInsert[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingSetInsert[]) : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue: PendingSetInsert[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(entry: PendingSetInsert): void {
  const q = loadQueue();
  q.push(entry);
  saveQueue(q);
}

export function dequeue(tempId: string): void {
  const q = loadQueue().filter((e) => e.tempId !== tempId);
  saveQueue(q);
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}
