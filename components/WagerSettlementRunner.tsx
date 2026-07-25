import { useWagerSettlement } from '@/lib/useWagerSettlement';

// Headless. Mounted once at the root (after the auth/partnership/workouts/history
// providers) so wager-ledger settlement runs on every app foreground regardless
// of which screen the user lands on. Renders nothing.
export function WagerSettlementRunner() {
  useWagerSettlement();
  return null;
}
