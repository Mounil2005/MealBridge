import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Text } from 'react-native';

import { Body, Card, Empty, ErrorText, Loading, Screen, StatusBadge, Title } from '@/components/ui';
import { useLoad } from '@/hooks/useLoad';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { expireOverdue, listMyDonations } from '@/lib/api';
import { useProfile } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';

export default function MyDonations() {
  const profile = useProfile();
  const [refreshing, setRefreshing] = useState(false);

  const { data, error, loading, reload } = useLoad(async () => {
    await expireOverdue().catch(() => undefined);
    return listMyDonations(profile.id);
  }, profile.id);

  useRealtimeRefresh(reload);

  // Re-check expiry while the screen stays open.
  useEffect(() => {
    const t = setInterval(reload, 60_000);
    return () => clearInterval(t);
  }, [reload]);

  if (loading) return <Loading />;

  return (
    <Screen>
      <Title>My donations</Title>
      <ErrorText message={error} />
      <FlatList
        data={data ?? []}
        keyExtractor={(d) => d.id}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await reload();
          setRefreshing(false);
        }}
        contentContainerStyle={{ gap: 12, flexGrow: 1 }}
        ListEmptyComponent={
          <Empty title="No donations yet" hint="Use the Donate food tab to list surplus food." />
        }
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/donation/${item.id}`)}>
            <Text style={{ fontSize: 17, fontWeight: '600' }}>{item.title}</Text>
            <Body muted>
              {item.quantity} servings · pickup by {formatDateTime(item.pickup_deadline)}
            </Body>
            <StatusBadge status={item.status} />
          </Card>
        )}
      />
    </Screen>
  );
}
