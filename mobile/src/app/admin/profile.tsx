import { Body, Button, Screen, Title } from '@/components/ui';
import { signOut } from '@/lib/api';
import { useProfile } from '@/lib/auth';

export default function AdminAccount() {
  const profile = useProfile();
  return (
    <Screen>
      <Title>Account</Title>
      <Body>{profile.name}</Body>
      <Body muted>Administrator</Body>
      <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
    </Screen>
  );
}
