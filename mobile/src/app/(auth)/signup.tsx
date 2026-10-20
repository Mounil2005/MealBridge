import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { Body, Button, Chip, ErrorText, Field, Screen, Title } from '@/components/ui';
import { signUp } from '@/lib/api';
import type { Role } from '@/types';

export default function Signup() {
  const [role, setRole] = useState<Role>('donor');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return setError('Enter your name or organization name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');

    setBusy(true);
    setError(null);
    try {
      const { needsEmailConfirmation } = await signUp({ email, password, name, role });
      if (needsEmailConfirmation) setNotice('Check your inbox to confirm your email, then sign in.');
      // Otherwise the auth listener signs the user in and the route guards navigate.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
          <Title>Create account</Title>
          <Body muted>I am a...</Body>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Donor (restaurant / event)" selected={role === 'donor'} onPress={() => setRole('donor')} />
            <Chip label="Organization" selected={role === 'org'} onPress={() => setRole('org')} />
          </View>
          {role === 'org' ? (
            <Body muted>Organizations are verified by an admin before they can claim food.</Body>
          ) : null}
          <Field
            label={role === 'org' ? 'Organization name' : 'Name / business name'}
            value={name}
            onChangeText={setName}
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <ErrorText message={error} />
          {notice ? <Body>{notice}</Body> : null}
          <Button label="Create account" onPress={submit} loading={busy} />
          <Link href="/login">
            <Body>Already have an account? Sign in</Body>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
