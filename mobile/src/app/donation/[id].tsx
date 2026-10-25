import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Linking, ScrollView } from 'react-native';

import { Body, Button, Card, ErrorText, Loading, Screen, StatusBadge, Title } from '@/components/ui';
import { useLoad } from '@/hooks/useLoad';
import { useNow } from '@/hooks/useNow';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import {
  cancelDonation,
  claimDonation,
  getActiveClaim,
  getDonation,
  getProfile,
  markPickedUp,
  releaseClaim,
} from '@/lib/api';
import { useProfile } from '@/lib/auth';
import { formatDateTime, formatTimeLeft } from '@/lib/format';
import { effectiveDeadline } from '@/lib/matching';
import type { Profile } from '@/types';

export default function DonationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useProfile();
  const now = useNow(30_000);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, loading, reload } = useLoad(async () => {
    const donation = await getDonation(id);
    const claim = await getActiveClaim(id);
    // Donors and organizations may read the other party's profile only while a claim is active
    // (enforced by RLS). Admins may read both parties at any time.
    const fetchProfile = (profileId: string) => getProfile(profileId).catch(() => null);
    const people: { label: string; profile: Profile }[] = [];
    if (me.role === 'donor') {
      const org = claim && (await fetchProfile(claim.org_id));
      if (org) people.push({ label: 'Claimed by', profile: org });
    } else {
      const donor = (claim || me.role === 'admin') && (await fetchProfile(donation.donor_id));
      if (donor) people.push({ label: 'Donor', profile: donor });
      const org = me.role === 'admin' && claim && (await fetchProfile(claim.org_id));
      if (org) people.push({ label: 'Claimed by', profile: org });
    }
    return { donation, claim, people };
  }, id);

  useRealtimeRefresh(reload);

  async function run(action: () => Promise<void>, leaveAfter = false) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      if (leaveAfter) router.back();
      else await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  function confirm(title: string, message: string, onConfirm: () => void) {
    Alert.alert(title, message, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: onConfirm },
    ]);
  }

  if (loading) return <Loading />;
  if (!data) {
    return (
      <Screen>
        <ErrorText message={error ?? 'This donation could not be loaded. It may no longer be available.'} />
        <Button label="Go back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const { donation, claim, people } = data;
  const isDonor = me.role === 'donor';
  const isOrg = me.role === 'org';
  const myClaim = claim?.org_id === me.id;
  const minutesLeft = (effectiveDeadline(donation).getTime() - now.getTime()) / 60_000;
  const open = donation.status === 'available' || donation.status === 'claimed';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        {donation.photo_url ? (
          <Image source={{ uri: donation.photo_url }} style={{ height: 200, borderRadius: 10 }} />
        ) : null}
        <Title>{donation.title}</Title>
        <StatusBadge status={donation.status} />
        {donation.description ? <Body>{donation.description}</Body> : null}
        <Body>{donation.quantity} servings</Body>
        <Body muted>Prepared {formatDateTime(donation.prepared_at)}</Body>
        <Body muted>Collect by {formatDateTime(donation.pickup_deadline)}</Body>
        {open ? <Body muted>{formatTimeLeft(minutesLeft)} left before it is no longer safe to collect</Body> : null}
        {donation.address ? <Body>Pickup: {donation.address}</Body> : null}

        {people.map(({ label, profile }) => (
          <Card key={label}>
            <Body muted>{label}</Body>
            <Body>{profile.name}</Body>
            {profile.address ? <Body muted>{profile.address}</Body> : null}
            {profile.phone ? (
              <Button
                label={`Call ${profile.phone}`}
                variant="secondary"
                onPress={() => Linking.openURL(`tel:${profile.phone}`)}
              />
            ) : null}
          </Card>
        ))}

        <ErrorText message={actionError ?? error} />

        {isOrg && donation.status === 'available' ? (
          <Button label="Claim this food" loading={busy} onPress={() => run(() => claimDonation(donation.id))} />
        ) : null}

        {isOrg && myClaim && donation.status === 'claimed' ? (
          <>
            <Button label="Mark as picked up" loading={busy} onPress={() => run(() => markPickedUp(donation.id))} />
            <Button
              label="Release claim"
              variant="secondary"
              disabled={busy}
              onPress={() =>
                confirm('Release this claim?', 'The food goes back to the pool for other organizations.', () =>
                  run(() => releaseClaim(donation.id)),
                )
              }
            />
          </>
        ) : null}

        {isDonor && open ? (
          <Button
            label="Cancel donation"
            variant="danger"
            disabled={busy}
            onPress={() =>
              confirm('Cancel this donation?', 'If an organization already claimed it, they will see it as cancelled.', () =>
                run(() => cancelDonation(donation.id)),
              )
            }
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
