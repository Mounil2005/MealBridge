# MealBridge - Surplus Food Rescue Network

A cross-platform (iOS + Android) mobile app that connects restaurants and event organizers who have surplus food with verified community organizations that can collect it.

**What makes it different:** offers are matched on *delivery feasibility and time remaining*, not just distance. An organization only sees food it can physically reach before the pickup deadline (or before the food stops being safe), ranked by urgency, proximity and quantity fit.

## How it works

1. **Donors** list food: title, servings, when it was prepared, pickup window, location, optional photo.
2. **Verified organizations** see a ranked feed of offers they can actually reach in time.
3. An organization **claims** an offer; the claim is atomic, so two organizations can never win the same food.
4. Status is tracked live from listing to collection: `Available -> Claimed -> Picked up` (or `Expired` / `Cancelled`).

## Matching engine

Implemented in [`mobile/src/lib/matching.ts`](mobile/src/lib/matching.ts) as pure, unit-tested functions.

**Step 1 - feasibility filter.** An offer is dropped if any of these hold:

- it is past its deadline, or past the food-safety window (`prepared_at + 4 h`), whichever comes first
- it is outside the organization's travel radius
- `travel_time + 15 min buffer >= time_left`, where `travel_time = distance / 25 km/h`

**Step 2 - score the rest (0-100):**

```
urgency   = 1 - minutes_left / 6h       (less time left -> more urgent)
proximity = 1 - distance / max_radius
quantity  = min(servings / org_capacity, 1)

score = 100 * (0.5*urgency + 0.3*proximity + 0.2*quantity)
```

Distance uses the Haversine formula. All constants live in `DEFAULT_CONFIG`.

## Tech stack

| Layer | Choice |
|---|---|
| App | React Native + Expo (SDK 58), TypeScript, Expo Router |
| Backend | Supabase: Postgres, Auth, Realtime, Storage |
| Device | `expo-location`, `expo-image-picker` |
| Tests | Jest (`jest-expo`) |

## Security model

All rules are enforced in the database, not the app (see [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)):

- Row level security on every table.
- `role` and `is_verified` cannot be changed by the user (column-level grants). Verification is an admin action.
- Claim, pick-up, release, cancel and expiry are Postgres functions that lock the row and validate state, so transitions are atomic and tamper-proof.
- Contact details are visible only between the two parties of an active claim.
- Photo uploads are restricted to the uploader's own folder.

## Getting started

**Prerequisites:** Node 20+ and a free [Supabase](https://supabase.com) project. Install the Expo Go app on your phone.

1. **Database.** In the Supabase dashboard open *SQL Editor*, then run each file in `supabase/migrations/` in order (`0001_init.sql`, then `0002_profile_address.sql`).
2. **Auth settings (development).** *Authentication -> Providers -> Email*: turn off "Confirm email" so signup logs you straight in.
3. **Configure the app.**
   ```bash
   cd mobile
   cp .env.example .env     # then fill in your Supabase URL and anon/publishable key
   npm install
   npx expo start
   ```
   Scan the QR code with Expo Go.
4. **Verify an organization.** New organizations start unverified. In the SQL Editor:
   ```sql
   update public.profiles set is_verified = true where name = 'Your Org Name';
   ```

### Trying it end to end

Use two accounts (two phones, or sign out and back in): create a **Donor** and post food, then create an **Organization**, verify it with the SQL above, set its location in *Profile*, and the offer appears in *Nearby offers*. Claim it and watch the donor's screen update live.

## Scripts

Run from `mobile/`:

| Command | Purpose |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm test` | Unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Project layout

```
mobile/
  src/app/        screens (Expo Router): (auth), donor/, org/, donation/[id]
  src/lib/        matching engine, Supabase client, API layer, auth, location
  src/hooks/      data loading, realtime refresh, clock
  src/components/ shared UI
supabase/
  migrations/     schema, RLS policies, state-transition functions
```

## Roadmap

- Map view of offers
- Push notifications for new nearby offers and status changes
- Admin screen for organization verification
- Scheduled expiry job (`pg_cron`) in addition to expire-on-load
- PostGIS for server-side radius queries at larger scale
