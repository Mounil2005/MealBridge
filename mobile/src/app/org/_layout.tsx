import { Tabs } from 'expo-router';

export default function OrgLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Nearby offers' }} />
      <Tabs.Screen name="pickups" options={{ title: 'My pickups' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
