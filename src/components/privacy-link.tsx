import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { T } from '@/components/ui';
import { colors } from '@/lib/theme';

/** A quiet link to the privacy policy, for the bottom of a screen. */
export function PrivacyLink() {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push('/privacy' as never)}
      style={{ minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
      <T size={14} color={colors.muted} center style={{ textDecorationLine: 'underline' }}>
        Privacy policy
      </T>
    </Pressable>
  );
}
