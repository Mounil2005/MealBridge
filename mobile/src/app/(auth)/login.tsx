import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { signIn } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
          <Title>MealBridge</Title>
          <Body muted>Rescue surplus food. Sign in to continue.</Body>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            onSubmitEditing={submit}
          />
          <ErrorText message={error} />
          <Button label="Sign in" onPress={submit} loading={busy} />
          <Link href="/signup">
            <Body>New to MealBridge? Create an account</Body>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
