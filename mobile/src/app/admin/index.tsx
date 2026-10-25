import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { Body, Button, Card, ErrorText, Loading, Screen, Title, theme } from '@/components/ui';
import { useLoad } from '@/hooks/useLoad';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { getAdminStats } from '@/lib/api';
import { STATUS_LABEL } from '@/lib/format';
import type { DonationStatus } from '@/types';

const STATUS_ORDER: DonationStatus[] = ['available', 'claimed', 'picked_up', 'expired', 'cancelled'];

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1 }}>
      <Card>
        <Text style={{ fontSize: 28, fontWeight: '700', color: theme.color.text }}>{value}</Text>
        <Body muted>{label}</Body>
      </Card>
    </View>
  );
}

export default function AdminOverview() {
  const [refreshing, setRefreshing] = useState(false);
  const { data, error, loading, reload } = useLoad(getAdminStats, 'stats');

  useRealtimeRefresh(reload, ['donations', 'claims', 'profiles']);

  if (loading) return <Loading />;

  // Share of listed food that was actually collected: the headline impact number.
  const rescueRate =
    data && data.servings_listed > 0
      ? `${Math.round((data.servings_rescued / data.servings_listed) * 100)}%`
      : '-';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}
          />
        }
      >
        <Title>Overview</Title>
        <ErrorText message={error} />
        {data ? (
          <>
            {data.orgs_pending > 0 ? (
              <Card>
                <Body>
                  {data.orgs_pending} organization{data.orgs_pending === 1 ? '' : 's'} waiting for approval
                </Body>
                <Button label="Review now" onPress={() => router.navigate('/admin/approvals')} />
              </Card>
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Stat label="Servings rescued" value={data.servings_rescued} />
              <Stat label="Rescue rate" value={rescueRate} />
              <Stat label="Donors" value={data.donors} />
              <Stat label="Organizations" value={data.orgs} />
              <Stat label="Verified orgs" value={data.orgs_verified} />
              <Stat label="Total donations" value={data.donations} />
            </View>

            <Body muted>Donations by status</Body>
            <Card>
              {STATUS_ORDER.map((status) => (
                <View key={status} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Body>{STATUS_LABEL[status]}</Body>
                  <Body>{data.by_status[status] ?? 0}</Body>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
