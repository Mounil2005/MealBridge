import { supabase } from './supabase';
import type {
  AdminStats,
  Claim,
  Donation,
  DonationWithDonor,
  NewDonation,
  Profile,
  SignupRole,
} from '@/types';

/** Unwraps a Supabase response, throwing a readable Error instead of returning { error }. */
function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error('No data returned');
  return res.data;
}

function check(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message);
}

// ---- auth -----------------------------------------------------------------

export async function signUp(input: {
  email: string;
  password: string;
  name: string;
  role: SignupRole;
  place?: { address: string; lat: number; lng: number };
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    // The database trigger copies these into the new profile row.
    options: { data: { name: input.name.trim(), role: input.role, ...input.place } },
  });
  if (error) throw new Error(error.message);
  // With email confirmation enabled in Supabase there is no session until the user confirms.
  return { needsEmailConfirmation: data.session === null };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

// ---- profiles -------------------------------------------------------------

export async function getProfile(id: string): Promise<Profile> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', id).single());
}

export type ProfilePatch = Partial<
  Pick<Profile, 'name' | 'phone' | 'address' | 'lat' | 'lng' | 'capacity' | 'max_radius_km'>
>;

export async function updateProfile(id: string, patch: ProfilePatch): Promise<Profile> {
  return unwrap(await supabase.from('profiles').update(patch).eq('id', id).select().single());
}

// ---- donations (donor side) -----------------------------------------------

export async function listMyDonations(donorId: string): Promise<Donation[]> {
  return unwrap(
    await supabase
      .from('donations')
      .select('*')
      .eq('donor_id', donorId)
      .order('created_at', { ascending: false }),
  );
}

export async function getDonation(id: string): Promise<Donation> {
  return unwrap(await supabase.from('donations').select('*').eq('id', id).single());
}

async function uploadPhoto(donorId: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const body = await response.arrayBuffer();
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  const safeExt = ext && /^[a-z0-9]{3,4}$/.test(ext) ? ext : 'jpg';
  const path = `${donorId}/${Date.now()}.${safeExt}`;

  const { error } = await supabase.storage.from('donation-photos').upload(path, body, {
    contentType: safeExt === 'png' ? 'image/png' : 'image/jpeg',
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return supabase.storage.from('donation-photos').getPublicUrl(path).data.publicUrl;
}

export async function createDonation(
  donorId: string,
  input: NewDonation,
  photoUri?: string | null,
): Promise<Donation> {
  const photo_url = photoUri ? await uploadPhoto(donorId, photoUri) : null;
  return unwrap(
    await supabase
      .from('donations')
      .insert({ ...input, donor_id: donorId, photo_url })
      .select()
      .single(),
  );
}

export async function cancelDonation(id: string): Promise<void> {
  check(await supabase.rpc('cancel_donation', { p_donation_id: id }));
}

// ---- donations (organization side) ----------------------------------------

export async function listOpenOffers(): Promise<Donation[]> {
  return unwrap(
    await supabase
      .from('donations')
      .select('*')
      .eq('status', 'available')
      .gt('pickup_deadline', new Date().toISOString()),
  );
}

export type ClaimWithDonation = Claim & { donation: Donation };

export async function listMyClaims(orgId: string): Promise<ClaimWithDonation[]> {
  return unwrap(
    await supabase
      .from('claims')
      .select('*, donation:donations(*)')
      .eq('org_id', orgId)
      .is('released_at', null)
      .order('claimed_at', { ascending: false }),
  ) as ClaimWithDonation[];
}

export async function claimDonation(id: string): Promise<void> {
  check(await supabase.rpc('claim_donation', { p_donation_id: id }));
}

export async function markPickedUp(id: string): Promise<void> {
  check(await supabase.rpc('mark_picked_up', { p_donation_id: id }));
}

export async function releaseClaim(id: string): Promise<void> {
  check(await supabase.rpc('release_claim', { p_donation_id: id }));
}

// ---- shared ---------------------------------------------------------------

/** The active claim on a donation, or null. Visible to the donor and to the claiming org only. */
export async function getActiveClaim(donationId: string): Promise<Claim | null> {
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .eq('donation_id', donationId)
    .is('released_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Marks overdue donations as expired. Cheap and idempotent, so the app calls it on load. */
export async function expireOverdue(): Promise<void> {
  check(await supabase.rpc('expire_overdue_donations'));
}

// ---- admin ----------------------------------------------------------------

export async function getAdminStats(): Promise<AdminStats> {
  return unwrap(await supabase.rpc('admin_stats')) as AdminStats;
}

/** Organizations awaiting approval come first, then the newest. */
export async function listOrganizations(): Promise<Profile[]> {
  return unwrap(
    await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'org')
      .order('is_verified', { ascending: true })
      .order('created_at', { ascending: false }),
  );
}

export async function setOrgVerified(orgId: string, verified: boolean): Promise<void> {
  check(await supabase.rpc('set_org_verified', { p_org_id: orgId, p_verified: verified }));
}

export async function listAllDonations(): Promise<DonationWithDonor[]> {
  return unwrap(
    await supabase
      .from('donations')
      .select('*, donor:profiles!donor_id(name)')
      .order('created_at', { ascending: false })
      .limit(200),
  ) as DonationWithDonor[];
}
