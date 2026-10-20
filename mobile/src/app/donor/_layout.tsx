import { Tabs } from 'expo-router';

export default function DonorLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'My donations' }} />
      <Tabs.Screen name="new" options={{ title: 'Donate food' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
