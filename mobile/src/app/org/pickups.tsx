import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Text } from 'react-native';

import { Body, Card, Empty, ErrorText, Loading, Screen, StatusBadge, Title } from '@/components/ui';
import { useLoad } from '@/hooks/useLoad';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { listMyClaims } from '@/lib/api';
import { useProfile } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';

export default function MyPickups() {
  const profile = useProfile();
  const [refreshing, setRefreshing] = useState(false);
  const { data, error, loading, reload } = useLoad(() => listMyClaims(profile.id), profile.id);

  useRealtimeRefresh(reload);

  if (loading) return <Loading />;

  return (
    <Screen>
      <Title>My pickups</Title>
      <ErrorText message={error} />
      <FlatList
        data={data ?? []}
        keyExtractor={(c) => c.id}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await reload();
          setRefreshing(false);
        }}
        contentContainerStyle={{ gap: 12, flexGrow: 1 }}
        ListEmptyComponent={<Empty title="No pickups yet" hint="Claim an offer from the Nearby offers tab." />}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/donation/${item.donation_id}`)}>
            <Text style={{ fontSize: 17, fontWeight: '600' }}>{item.donation.title}</Text>
            <Body muted>
              {item.donation.quantity} servings · collect by {formatDateTime(item.donation.pickup_deadline)}
            </Body>
            <StatusBadge status={item.donation.status} />
          </Card>
        )}
      />
    </Screen>
  );
}
