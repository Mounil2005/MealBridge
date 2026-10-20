import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Body, Button, ErrorText, Field, Screen, Title } from './ui';
import { signOut, updateProfile } from '@/lib/api';
import { useAuth, useProfile } from '@/lib/auth';
import { getCurrentCoords } from '@/lib/location';

export default function ProfileScreen() {
  const profile = useProfile();
  const { setProfile } = useAuth();
  const isOrg = profile.role === 'org';

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [capacity, setCapacity] = useState(String(profile.capacity));
  const [radius, setRadius] = useState(String(profile.max_radius_km));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  async function save() {
    const capacityNum = Number(capacity);
    const radiusNum = Number(radius);
    if (!name.trim()) return setError('Name is required.');
    if (isOrg && (!Number.isInteger(capacityNum) || capacityNum <= 0)) {
      return setError('Capacity must be a whole number of servings above 0.');
    }
    if (isOrg && !(radiusNum > 0 && radiusNum <= 100)) {
      return setError('Travel radius must be between 1 and 100 km.');
    }

    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateProfile(profile.id, {
        name: name.trim(),
        phone: phone.trim() || null,
        ...(isOrg ? { capacity: capacityNum, max_radius_km: radiusNum } : {}),
      });
      setProfile(updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function useCurrentLocation() {
    setLocating(true);
    setError(null);
    setSaved(false);
    try {
      const { lat, lng } = await getCurrentCoords();
      setProfile(await updateProfile(profile.id, { lat, lng }));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get your location');
    } finally {
      setLocating(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
        <Title>Profile</Title>
        <Body muted>
          {isOrg
            ? profile.is_verified
              ? 'Verified organization'
              : 'Awaiting verification. You can browse once an admin verifies you.'
            : 'Donor'}
        </Body>
        <Field label={isOrg ? 'Organization name' : 'Name / business name'} value={name} onChangeText={setName} />
        <Field label="Phone (shared only with the matched party)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        {isOrg ? (
          <>
            <Field label="Capacity per pickup (servings)" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
            <Field label="Max travel radius (km)" value={radius} onChangeText={setRadius} keyboardType="decimal-pad" />
          </>
        ) : null}
        <Body muted>
          {profile.lat !== null && profile.lng !== null
            ? `Location saved (${profile.lat.toFixed(4)}, ${profile.lng.toFixed(4)})`
            : isOrg
              ? 'No location saved. Set it to see offers near you.'
              : 'No location saved.'}
        </Body>
        <Button label="Use my current location" variant="secondary" onPress={useCurrentLocation} loading={locating} />
        <ErrorText message={error} />
        {saved ? <Body>Saved.</Body> : null}
        <Button label="Save changes" onPress={save} loading={busy} />
        <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
      </ScrollView>
    </Screen>
  );
}
