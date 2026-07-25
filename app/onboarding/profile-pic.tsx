import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { setPendingPhotoUri } from '@/lib/onboarding';
import { colors, radii, spacing, typography } from '@/lib/theme';

// Onboarding setup screen — pick a profile photo.
export default function ProfilePicScreen() {
  const router = useRouter();
  const { flow } = useLocalSearchParams<{ flow?: string }>();
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo access to choose a profile picture.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleContinue = async () => {
    if (!photoUri) return;
    await setPendingPhotoUri(photoUri);
    // Invitees (flow=join) skip the initiator's plan/wager/commitment setup —
    // those terms belong to their partner. Straight to account creation; they
    // review & sign the shared terms after pairing (join-confirm).
    router.push(flow === 'join' ? '/onboarding/save-progress' : '/onboarding/sign-commitment');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.72} />

      <View style={styles.content}>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Add a profile pic</Text>
          <Text style={styles.subtitle}>
            Only your partner will see it so make it silly
          </Text>
        </View>

        <View style={styles.imageWrap}>
          <Pressable onPress={pickPhoto} style={styles.imageBox}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.image} contentFit="cover" />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="camera" size={40} color={colors.textMuted} />
                <Text style={styles.placeholderText}>Tap to add a photo</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <OnboardingButton label="Continue" disabled={!photoUri} onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  content: {
    flex: 1,
  },
  textWrap: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.display,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  imageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBox: {
    width: 248,
    height: 248,
    borderRadius: radii.xl,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  placeholderText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 14,
  },
  footer: {
    paddingBottom: spacing.lg,
  },
});
