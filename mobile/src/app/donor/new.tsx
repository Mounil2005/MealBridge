import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { Body, Button, Chip, ErrorText, Field, Screen, Title } from '@/components/ui';
import { createDonation } from '@/lib/api';
import { useProfile } from '@/lib/auth';
import { minutesFromNow } from '@/lib/format';
import { getCurrentCoords, type Coords } from '@/lib/location';

const PREPARED_OPTIONS = [
  { label: 'Just now', minutesAgo: 0 },
  { label: '30 min ago', minutesAgo: 30 },
  { label: '1 h ago', minutesAgo: 60 },
  { label: '2 h ago', minutesAgo: 120 },
];
const DEADLINE_OPTIONS = [
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '3 hours', minutes: 180 },
  { label: '4 hours', minutes: 240 },
];

export default function NewDonation() {
  const profile = useProfile();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [deadlineMinutes, setDeadlineMinutes] = useState(120);
  const [place, setPlace] = useState<Coords | null>(
    profile.lat !== null && profile.lng !== null ? { lat: profile.lat, lng: profile.lng, address: null } : null,
  );
  const [address, setAddress] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  async function locate() {
    setLocating(true);
    setError(null);
    try {
      const here = await getCurrentCoords();
      setPlace(here);
      if (here.address && !address) setAddress(here.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get your location');
    } finally {
      setLocating(false);
    }
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError('Photo access is needed to attach a picture.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function submit() {
    const qty = Number(quantity);
    if (!title.trim()) return setError('Give the food a short title.');
    if (!Number.isInteger(qty) || qty <= 0) return setError('Quantity must be a whole number of servings.');
    if (!place) return setError('Set the pickup location first.');

    setBusy(true);
    setError(null);
    try {
      await createDonation(
        profile.id,
        {
          title: title.trim(),
          description: description.trim() || null,
          quantity: qty,
          prepared_at: minutesFromNow(-minutesAgo),
          pickup_deadline: minutesFromNow(deadlineMinutes),
          address: address.trim() || null,
          lat: place.lat,
          lng: place.lng,
        },
        photoUri,
      );
      setTitle('');
      setDescription('');
      setQuantity('');
      setPhotoUri(null);
      router.navigate('/donor');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the donation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <Title>Donate food</Title>
          <Field label="What is it?" value={title} onChangeText={setTitle} placeholder="e.g. Veg biryani trays" maxLength={120} />
          <Field label="Details (allergens, packaging) - optional" value={description} onChangeText={setDescription} multiline maxLength={500} />
          <Field label="Servings" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />

          <Body muted>Prepared</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PREPARED_OPTIONS.map((o) => (
              <Chip key={o.label} label={o.label} selected={minutesAgo === o.minutesAgo} onPress={() => setMinutesAgo(o.minutesAgo)} />
            ))}
          </View>

          <Body muted>Must be picked up within</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DEADLINE_OPTIONS.map((o) => (
              <Chip key={o.label} label={o.label} selected={deadlineMinutes === o.minutes} onPress={() => setDeadlineMinutes(o.minutes)} />
            ))}
          </View>

          <Field label="Pickup address / instructions" value={address} onChangeText={setAddress} />
          <Body muted>
            {place ? `Location set (${place.lat.toFixed(4)}, ${place.lng.toFixed(4)})` : 'No location set yet'}
          </Body>
          <Button label="Use my current location" variant="secondary" onPress={locate} loading={locating} />

          {photoUri ? <Image source={{ uri: photoUri }} style={{ height: 180, borderRadius: 10 }} /> : null}
          <Button label={photoUri ? 'Change photo' : 'Add a photo'} variant="secondary" onPress={pickPhoto} />

          <ErrorText message={error} />
          <Button label="Post donation" onPress={submit} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
