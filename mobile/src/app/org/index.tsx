import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Text } from 'react-native';

import { Body, Card, Empty, ErrorText, Loading, Screen, Title } from '@/components/ui';
import { useLoad } from '@/hooks/useLoad';
import { useNow } from '@/hooks/useNow';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { expireOverdue, listOpenOffers } from '@/lib/api';
import { useProfile } from '@/lib/auth';
import { formatDistance, formatTimeLeft } from '@/lib/format';
import { rankOffers, type MatchOrg } from '@/lib/matching';

export default function NearbyOffers() {
  const profile = useProfile();
  const [refreshing, setRefreshing] = useState(false);
  // Time keeps passing, so re-rank periodically: an offer can become unreachable while on screen.
  const now = useNow(30_000);

  const canBrowse = profile.is_verified && profile.lat !== null && profile.lng !== null;

  const { data, error, loading, reload } = useLoad(async () => {
    if (!canBrowse) return [];
    await expireOverdue().catch(() => undefined);
    return listOpenOffers();
  }, String(canBrowse));

  useRealtimeRefresh(reload);

  const org: MatchOrg | null = useMemo(
    () =>
      profile.lat !== null && profile.lng !== null
        ? {
            lat: profile.lat,
            lng: profile.lng,
            capacity: profile.capacity,
            max_radius_km: profile.max_radius_km,
          }
        : null,
    [profile.lat, profile.lng, profile.capacity, profile.max_radius_km],
  );

  const ranked = useMemo(() => (org && data ? rankOffers(data, org, now) : []), [data, org, now]);
  const hiddenCount = (data?.length ?? 0) - ranked.length;

  if (!profile.is_verified) {
    return (
      <Screen>
        <Empty
          title="Awaiting verification"
          hint="An admin needs to verify your organization before you can see and claim food offers."
        />
      </Screen>
    );
  }
  if (!org) {
    return (
      <Screen>
        <Empty title="Set your location" hint="Open the Profile tab and save your location to see nearby offers." />
      </Screen>
    );
  }
  if (loading) return <Loading />;

  return (
    <Screen>
      <Title>Nearby offers</Title>
      <ErrorText message={error} />
      {hiddenCount > 0 ? (
        <Body muted>
          {hiddenCount} offer{hiddenCount === 1 ? '' : 's'} hidden: out of range or not reachable before the deadline.
        </Body>
      ) : null}
      <FlatList
        data={ranked}
        keyExtractor={({ offer }) => offer.id}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await reload();
          setRefreshing(false);
        }}
        contentContainerStyle={{ gap: 12, flexGrow: 1 }}
        ListEmptyComponent={
          <Empty title="Nothing you can reach in time" hint="New offers appear here automatically." />
        }
        renderItem={({ item: { offer, match } }) => (
          <Card onPress={() => router.push(`/donation/${offer.id}`)}>
            <Text style={{ fontSize: 17, fontWeight: '600' }}>{offer.title}</Text>
            <Body>{offer.quantity} servings</Body>
            <Body muted>
              {formatDistance(match.distanceKm)} away · ~{formatTimeLeft(match.travelMinutes)} travel
            </Body>
            <Body muted>{formatTimeLeft(match.minutesLeft)} left to collect</Body>
            <Body muted>Match score {Math.round(match.score)}/100</Body>
          </Card>
        )}
      />
    </Screen>
  );
}
