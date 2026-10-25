import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, Text } from 'react-native';

import { Body, Card, Chip, Empty, ErrorText, Loading, Screen, StatusBadge, Title, theme } from '@/components/ui';
import { useLoad } from '@/hooks/useLoad';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { listAllDonations } from '@/lib/api';
import { formatDateTime, STATUS_LABEL } from '@/lib/format';
import type { DonationStatus } from '@/types';

type Filter = DonationStatus | 'all';
const FILTERS: Filter[] = ['all', 'available', 'claimed', 'picked_up', 'expired', 'cancelled'];

export default function AllDonations() {
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const { data, error, loading, reload } = useLoad(listAllDonations, 'all-donations');

  useRealtimeRefresh(reload);

  const rows = useMemo(
    () => (data ?? []).filter((d) => filter === 'all' || d.status === filter),
    [data, filter],
  );

  if (loading) return <Loading />;

  return (
    <Screen>
      <Title>Donations</Title>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
        {FILTERS.map((f) => (
          <Chip key={f} label={f === 'all' ? 'All' : STATUS_LABEL[f]} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>
      <ErrorText message={error} />
      <FlatList
        data={rows}
        keyExtractor={(d) => d.id}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await reload();
          setRefreshing(false);
        }}
        contentContainerStyle={{ gap: 12, flexGrow: 1 }}
        ListEmptyComponent={<Empty title="No donations match" />}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/donation/${item.id}`)}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: theme.color.text }}>{item.title}</Text>
            <Body muted>
              {item.donor?.name ?? 'Unknown donor'} · {item.quantity} servings
            </Body>
            <Body muted>Posted {formatDateTime(item.created_at)}</Body>
            <StatusBadge status={item.status} />
          </Card>
        )}
      />
    </Screen>
  );
}
