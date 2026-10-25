import { useState } from 'react';
import { Alert, FlatList, Text } from 'react-native';

import { Body, Button, Card, Empty, ErrorText, Loading, Screen, Title, theme } from '@/components/ui';
import { useLoad } from '@/hooks/useLoad';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { listOrganizations, setOrgVerified } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Profile } from '@/types';

export default function Approvals() {
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useLoad(listOrganizations, 'orgs');

  useRealtimeRefresh(reload, ['profiles']);

  async function change(org: Profile, verified: boolean) {
    setBusyId(org.id);
    setActionError(null);
    try {
      await setOrgVerified(org.id, verified);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update the organization');
    } finally {
      setBusyId(null);
    }
  }

  function revoke(org: Profile) {
    Alert.alert(
      `Revoke ${org.name}?`,
      'They will no longer see or claim food offers. Claims already in progress are not affected.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: () => change(org, false) },
      ],
    );
  }

  if (loading) return <Loading />;

  const pending = (data ?? []).filter((o) => !o.is_verified).length;

  return (
    <Screen>
      <Title>Organizations</Title>
      <Body muted>{pending} awaiting approval</Body>
      <ErrorText message={actionError ?? error} />
      <FlatList
        data={data ?? []}
        keyExtractor={(o) => o.id}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await reload();
          setRefreshing(false);
        }}
        contentContainerStyle={{ gap: 12, flexGrow: 1 }}
        ListEmptyComponent={<Empty title="No organizations yet" hint="New organization signups appear here." />}
        renderItem={({ item: org }) => (
          <Card>
            <Text style={{ fontSize: 17, fontWeight: '600', color: theme.color.text }}>{org.name}</Text>
            <Body muted>{org.address ?? 'No address given'}</Body>
            <Body muted>
              Capacity {org.capacity} servings · radius {org.max_radius_km} km
            </Body>
            {org.phone ? <Body muted>{org.phone}</Body> : null}
            <Body muted>Joined {formatDateTime(org.created_at)}</Body>
            {org.is_verified ? (
              <Button
                label="Revoke approval"
                variant="secondary"
                disabled={busyId === org.id}
                onPress={() => revoke(org)}
              />
            ) : (
              <Button label="Approve" loading={busyId === org.id} onPress={() => change(org, true)} />
            )}
          </Card>
        )}
      />
    </Screen>
  );
}
