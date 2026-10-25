export type Role = 'donor' | 'org';

export type DonationStatus = 'available' | 'claimed' | 'picked_up' | 'expired' | 'cancelled';

export interface Profile {
  id: string;
  role: Role;
  name: string;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  capacity: number;
  max_radius_km: number;
  is_verified: boolean;
}

export interface Donation {
  id: string;
  donor_id: string;
  title: string;
  description: string | null;
  quantity: number;
  prepared_at: string;
  pickup_deadline: string;
  address: string | null;
  lat: number;
  lng: number;
  photo_url: string | null;
  status: DonationStatus;
  created_at: string;
}

export interface Claim {
  id: string;
  donation_id: string;
  org_id: string;
  claimed_at: string;
  picked_up_at: string | null;
  released_at: string | null;
}

export type NewDonation = Pick<
  Donation,
  'title' | 'description' | 'quantity' | 'prepared_at' | 'pickup_deadline' | 'address' | 'lat' | 'lng'
>;
