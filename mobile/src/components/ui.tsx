import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { STATUS_LABEL } from '@/lib/format';
import type { DonationStatus } from '@/types';

// Single place to restyle the app later.
export const theme = {
  color: {
    bg: '#ffffff',
    surface: '#f4f5f7',
    text: '#111827',
    muted: '#6b7280',
    border: '#d1d5db',
    primary: '#16a34a',
    primaryText: '#ffffff',
    danger: '#dc2626',
    warn: '#d97706',
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: 10,
};

const STATUS_COLOR: Record<DonationStatus, string> = {
  available: '#16a34a',
  claimed: '#2563eb',
  picked_up: '#6b7280',
  expired: '#d97706',
  cancelled: '#dc2626',
};

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={[styles.screenInner, style]}>{children}</View>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: theme.color.muted }]}>{children}</Text>;
}

export function ErrorText({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={[styles.button, buttonStyles[variant], inactive && { opacity: 0.5 }]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? theme.color.text : '#fff'} />
      ) : (
        <Text style={[styles.buttonLabel, variant === 'secondary' && { color: theme.color.text }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: theme.space.xs }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.color.muted}
        {...input}
        style={[styles.input, error ? { borderColor: theme.color.danger } : null, input.style]}
      />
      <ErrorText message={error} />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipLabel, selected && { color: theme.color.primaryText }]}>{label}</Text>
    </Pressable>
  );
}

export function StatusBadge({ status }: { status: DonationStatus }) {
  return (
    <View style={[styles.badge, { backgroundColor: STATUS_COLOR[status] }]}>
      <Text style={styles.badgeLabel}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const content = <View style={styles.card}>{children}</View>;
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.color.primary} />
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={[styles.body, { color: theme.color.muted, textAlign: 'center' }]}>{hint}</Text> : null}
    </View>
  );
}

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: theme.color.primary },
  secondary: { backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border },
  danger: { backgroundColor: theme.color.danger },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  screenInner: { flex: 1, padding: theme.space.lg, gap: theme.space.md },
  title: { fontSize: 24, fontWeight: '700', color: theme.color.text },
  body: { fontSize: 15, color: theme.color.text },
  error: { color: theme.color.danger, fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', color: theme.color.muted },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.md,
    fontSize: 16,
    color: theme.color.text,
  },
  button: {
    minHeight: 48,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  buttonLabel: { color: theme.color.primaryText, fontSize: 16, fontWeight: '600' },
  chip: {
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  chipSelected: { backgroundColor: theme.color.primary, borderColor: theme.color.primary },
  chipLabel: { fontSize: 14, color: theme.color.text },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius,
    padding: theme.space.lg,
    gap: theme.space.xs,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.sm, padding: theme.space.xl },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: theme.color.text },
});
