import type { DonationStatus } from '@/types';

/** "45 min", "2 h 10 min", or "expired" for a minutes-remaining value. */
export function formatTimeLeft(minutes: number): string {
  if (minutes <= 0) return 'expired';
  const total = Math.floor(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const STATUS_LABEL: Record<DonationStatus, string> = {
  available: 'Available',
  claimed: 'Claimed',
  picked_up: 'Picked up',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}
