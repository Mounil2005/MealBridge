/**
 * MealBridge matching engine.
 *
 * Pure functions only (no React, no network) so the logic is easy to test and explain:
 *   1. Feasibility filter - can this organization physically collect the food in time?
 *   2. Score - rank the feasible offers by urgency, proximity and quantity fit.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface MatchOffer extends GeoPoint {
  id: string;
  quantity: number;
  /** ISO timestamp the food was prepared. */
  prepared_at: string;
  /** ISO timestamp after which the donor can no longer hand the food over. */
  pickup_deadline: string;
}

export interface MatchOrg extends GeoPoint {
  /** Servings the organization can take in one pickup. */
  capacity: number;
  /** Farthest the organization is willing to travel, in km. */
  max_radius_km: number;
}

export interface MatchConfig {
  /** Average door-to-door travel speed in km/h (city traffic). */
  avgSpeedKmph: number;
  /** Extra minutes for parking, handover and loading. */
  bufferMinutes: number;
  /** Prepared food is treated as unsafe this many hours after preparation. */
  maxFoodAgeHours: number;
  /** Time-left horizon (hours) used to normalise urgency. */
  urgencyHorizonHours: number;
  weights: { urgency: number; proximity: number; quantity: number };
}

export const DEFAULT_CONFIG: MatchConfig = {
  avgSpeedKmph: 25,
  bufferMinutes: 15,
  maxFoodAgeHours: 4,
  urgencyHorizonHours: 6,
  weights: { urgency: 0.5, proximity: 0.3, quantity: 0.2 },
};

export type InfeasibleReason = 'expired' | 'out_of_radius' | 'too_far_for_time';

export interface MatchResult {
  offerId: string;
  feasible: boolean;
  reason?: InfeasibleReason;
  distanceKm: number;
  travelMinutes: number;
  /** Minutes until the food can no longer be collected (earlier of deadline and food-safety limit). */
  minutesLeft: number;
  /** 0-100, higher is better. 0 when infeasible. */
  score: number;
  breakdown: { urgency: number; proximity: number; quantity: number };
}

const EARTH_RADIUS_KM = 6371;
const MS_PER_MINUTE = 60_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Great-circle distance between two points (Haversine formula). */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function travelMinutes(distanceKm: number, avgSpeedKmph: number): number {
  return (distanceKm / avgSpeedKmph) * 60;
}

/** The moment food stops being collectable: donor deadline or food-safety limit, whichever is first. */
export function effectiveDeadline(offer: MatchOffer, config: MatchConfig = DEFAULT_CONFIG): Date {
  const deadline = new Date(offer.pickup_deadline).getTime();
  const safeUntil =
    new Date(offer.prepared_at).getTime() + config.maxFoodAgeHours * 60 * MS_PER_MINUTE;
  return new Date(Math.min(deadline, safeUntil));
}

export function evaluateOffer(
  offer: MatchOffer,
  org: MatchOrg,
  now: Date = new Date(),
  config: MatchConfig = DEFAULT_CONFIG,
): MatchResult {
  const distanceKm = haversineKm(org, offer);
  const travel = travelMinutes(distanceKm, config.avgSpeedKmph);
  const minutesLeft = (effectiveDeadline(offer, config).getTime() - now.getTime()) / MS_PER_MINUTE;

  const base = {
    offerId: offer.id,
    distanceKm,
    travelMinutes: travel,
    minutesLeft,
    score: 0,
    breakdown: { urgency: 0, proximity: 0, quantity: 0 },
  };

  if (minutesLeft <= 0) return { ...base, feasible: false, reason: 'expired' };
  if (distanceKm > org.max_radius_km) return { ...base, feasible: false, reason: 'out_of_radius' };
  if (travel + config.bufferMinutes >= minutesLeft) {
    return { ...base, feasible: false, reason: 'too_far_for_time' };
  }

  const breakdown = {
    urgency: clamp01(1 - minutesLeft / (config.urgencyHorizonHours * 60)),
    proximity: clamp01(1 - distanceKm / org.max_radius_km),
    quantity: org.capacity > 0 ? clamp01(offer.quantity / org.capacity) : 0,
  };
  const { weights } = config;
  const score =
    100 *
    (weights.urgency * breakdown.urgency +
      weights.proximity * breakdown.proximity +
      weights.quantity * breakdown.quantity);

  return { ...base, feasible: true, score, breakdown };
}

/** Returns feasible offers only, best match first. Ties break toward the more urgent offer. */
export function rankOffers<T extends MatchOffer>(
  offers: T[],
  org: MatchOrg,
  now: Date = new Date(),
  config: MatchConfig = DEFAULT_CONFIG,
): Array<{ offer: T; match: MatchResult }> {
  return offers
    .map((offer) => ({ offer, match: evaluateOffer(offer, org, now, config) }))
    .filter(({ match }) => match.feasible)
    .sort((a, b) => b.match.score - a.match.score || a.match.minutesLeft - b.match.minutesLeft);
}
