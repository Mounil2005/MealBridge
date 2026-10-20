import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';

/** Sends the user to the right area for their sign-in state and role. */
export default function Index() {
  const { session, profile } = useAuth();
  if (!session || !profile) return <Redirect href="/login" />;
  return <Redirect href={profile.role === 'org' ? '/org' : '/donor'} />;
}
