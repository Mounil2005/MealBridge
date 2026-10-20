import {
  DEFAULT_CONFIG,
  effectiveDeadline,
  evaluateOffer,
  haversineKm,
  rankOffers,
  travelMinutes,
  type MatchOffer,
  type MatchOrg,
} from '../matching';

const NOW = new Date('2026-01-01T12:00:00Z');
const minutesFromNow = (m: number) => new Date(NOW.getTime() + m * 60_000).toISOString();

const org: MatchOrg = { lat: 19.076, lng: 72.8777, capacity: 100, max_radius_km: 15 };

/** An offer roughly `km` kilometres north of the org (1 degree latitude ~ 111.19 km). */
function offerAt(km: number, over: Partial<MatchOffer> = {}): MatchOffer {
  return {
    id: `offer-${km}`,
    lat: org.lat + km / 111.19,
    lng: org.lng,
    quantity: 50,
    prepared_at: minutesFromNow(-30),
    pickup_deadline: minutesFromNow(180),
    ...over,
  };
}

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(org, org)).toBe(0);
  });

  it('matches a known distance (Mumbai to Pune is about 120 km)', () => {
    const mumbai = { lat: 19.076, lng: 72.8777 };
    const pune = { lat: 18.5204, lng: 73.8567 };
    expect(haversineKm(mumbai, pune)).toBeGreaterThan(115);
    expect(haversineKm(mumbai, pune)).toBeLessThan(125);
  });

  it('is symmetric', () => {
    const a = { lat: 10, lng: 20 };
    const b = { lat: 11, lng: 22 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });
});

describe('travelMinutes', () => {
  it('converts distance and speed to minutes', () => {
    expect(travelMinutes(25, 25)).toBe(60);
    expect(travelMinutes(5, 30)).toBe(10);
  });
});

describe('effectiveDeadline', () => {
  it('uses the donor deadline when it comes first', () => {
    const offer = offerAt(1, { pickup_deadline: minutesFromNow(60) });
    expect(effectiveDeadline(offer).toISOString()).toBe(minutesFromNow(60));
  });

  it('uses the food-safety limit when the donor deadline is later', () => {
    const offer = offerAt(1, {
      prepared_at: minutesFromNow(-60),
      pickup_deadline: minutesFromNow(600),
    });
    // prepared 60 min ago + 4h safety window = 180 min from now
    expect(effectiveDeadline(offer).toISOString()).toBe(minutesFromNow(180));
  });
});

describe('evaluateOffer feasibility', () => {
  it('rejects an expired offer', () => {
    const r = evaluateOffer(offerAt(1, { pickup_deadline: minutesFromNow(-5) }), org, NOW);
    expect(r.feasible).toBe(false);
    expect(r.reason).toBe('expired');
    expect(r.score).toBe(0);
  });

  it('rejects food past its safety window even if the deadline is far away', () => {
    const r = evaluateOffer(
      offerAt(1, { prepared_at: minutesFromNow(-300), pickup_deadline: minutesFromNow(600) }),
      org,
      NOW,
    );
    expect(r.reason).toBe('expired');
  });

  it('rejects an offer outside the organization radius', () => {
    const r = evaluateOffer(offerAt(20), org, NOW);
    expect(r.feasible).toBe(false);
    expect(r.reason).toBe('out_of_radius');
  });

  it('rejects a nearby offer when travel time + buffer exceeds time left', () => {
    // 10 km at 25 km/h = 24 min travel + 15 min buffer = 39 min needed, only 30 left
    const r = evaluateOffer(offerAt(10, { pickup_deadline: minutesFromNow(30) }), org, NOW);
    expect(r.feasible).toBe(false);
    expect(r.reason).toBe('too_far_for_time');
  });

  it('accepts the same offer when there is enough time', () => {
    const r = evaluateOffer(offerAt(10, { pickup_deadline: minutesFromNow(60) }), org, NOW);
    expect(r.feasible).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });
});

describe('evaluateOffer scoring', () => {
  it('scores more urgent food higher at equal distance and quantity', () => {
    const urgent = evaluateOffer(offerAt(3, { pickup_deadline: minutesFromNow(60) }), org, NOW);
    const relaxed = evaluateOffer(offerAt(3, { pickup_deadline: minutesFromNow(240) }), org, NOW);
    expect(urgent.score).toBeGreaterThan(relaxed.score);
  });

  it('scores closer food higher at equal urgency and quantity', () => {
    const near = evaluateOffer(offerAt(1), org, NOW);
    const far = evaluateOffer(offerAt(8), org, NOW);
    expect(near.score).toBeGreaterThan(far.score);
  });

  it('scores a quantity that fits capacity higher, capped at full capacity', () => {
    const small = evaluateOffer(offerAt(3, { quantity: 10 }), org, NOW);
    const big = evaluateOffer(offerAt(3, { quantity: 100 }), org, NOW);
    const huge = evaluateOffer(offerAt(3, { quantity: 1000 }), org, NOW);
    expect(big.score).toBeGreaterThan(small.score);
    expect(huge.score).toBeCloseTo(big.score, 10);
  });

  it('keeps every score within 0-100', () => {
    for (const km of [0, 1, 5, 10, 14]) {
      const r = evaluateOffer(offerAt(km, { quantity: 9999 }), org, NOW);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it('does not divide by zero when capacity is 0', () => {
    const r = evaluateOffer(offerAt(2), { ...org, capacity: 0 }, NOW);
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.breakdown.quantity).toBe(0);
  });

  it('weights sum to 1 by default', () => {
    const { urgency, proximity, quantity } = DEFAULT_CONFIG.weights;
    expect(urgency + proximity + quantity).toBeCloseTo(1, 10);
  });
});

describe('rankOffers', () => {
  it('drops infeasible offers and orders the rest best-first', () => {
    const expired = offerAt(1, { id: 'expired', pickup_deadline: minutesFromNow(-1) });
    const unreachable = offerAt(10, { id: 'unreachable', pickup_deadline: minutesFromNow(30) });
    const urgentNear = offerAt(2, { id: 'urgent-near', pickup_deadline: minutesFromNow(50) });
    const relaxedFar = offerAt(9, { id: 'relaxed-far', pickup_deadline: minutesFromNow(240) });

    const ranked = rankOffers([relaxedFar, expired, unreachable, urgentNear], org, NOW);

    expect(ranked.map((r) => r.offer.id)).toEqual(['urgent-near', 'relaxed-far']);
  });

  it('returns an empty list when nothing is feasible', () => {
    expect(rankOffers([offerAt(1, { pickup_deadline: minutesFromNow(-10) })], org, NOW)).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const offers = [offerAt(5, { id: 'a' }), offerAt(1, { id: 'b' })];
    rankOffers(offers, org, NOW);
    expect(offers.map((o) => o.id)).toEqual(['a', 'b']);
  });
});
