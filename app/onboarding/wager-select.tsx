import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreateWagerSheet } from '@/components/onboarding/CreateWagerSheet';
import { OnboardingButton } from '@/components/onboarding/OnboardingButton';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { setPendingWager } from '@/lib/onboarding';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Wager = { emoji: string; label: string; quantity: number; display: string };

const PRESETS: { key: string; wager: Wager }[] = [
  { key: 'dinner', wager: { emoji: '🍽️', label: 'Dinner', quantity: 1, display: '1 Dinner' } },
  {
    key: 'romantic',
    wager: { emoji: '💋', label: 'Romantic Favor', quantity: 1, display: '1 Romantic Favor' },
  },
  { key: 'cash', wager: { emoji: '💵', label: '$10', quantity: 1, display: '$10' } },
  { key: 'massage', wager: { emoji: '💆', label: 'Massage', quantity: 1, display: '1 Massage' } },
];

const CUSTOM_KEY = 'custom';

// Onboarding setup screen — pick the weekly wager (a preset or a custom one).
export default function WagerSelectScreen() {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState('dinner');
  const [customWager, setCustomWager] = useState<Wager | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const selectedWager: Wager =
    selectedKey === CUSTOM_KEY && customWager
      ? customWager
      : (PRESETS.find((p) => p.key === selectedKey) ?? PRESETS[0]).wager;

  const handleSheetDone = (quantity: number, text: string) => {
    setCustomWager({
      emoji: '🎁',
      label: text,
      quantity,
      display: `${quantity} ${text}`,
    });
    setSelectedKey(CUSTOM_KEY);
    setSheetVisible(false);
  };

  const handleContinue = async () => {
    const { emoji, label, quantity } = selectedWager;
    await setPendingWager({ emoji, label, quantity });
    router.push('/onboarding/name');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader progress={0.57} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Wager if you don&apos;t meet your weekly goal?</Text>
        <Text style={styles.subtitle}>If you miss your weekly goal you&apos;ll owe this.</Text>

        <View style={styles.grid}>
          {PRESETS.map(({ key, wager }) => {
            const selected = key === selectedKey;
            return (
              <Pressable
                key={key}
                onPress={() => setSelectedKey(key)}
                style={[styles.card, selected && styles.cardSelected]}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardEmoji}>{wager.emoji}</Text>
                  {selected ? (
                    <Pressable
                      style={styles.pencil}
                      hitSlop={8}
                      onPress={() => setSheetVisible(true)}
                    >
                      <Ionicons name="pencil" size={14} color={colors.text} />
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.cardBottom}>
                  <Text
                    style={[styles.cardLabel, selected && styles.cardLabelSelected]}
                    numberOfLines={2}
                  >
                    {wager.display}
                  </Text>
                  {selected ? (
                    <View style={styles.check}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Create Your Own — opens the slide-up sheet. */}
        <Pressable
          onPress={() => setSheetVisible(true)}
          style={[
            styles.createCard,
            selectedKey === CUSTOM_KEY && styles.createCardSelected,
          ]}
        >
          <View style={styles.createIcon}>
            {customWager ? (
              <Text style={styles.createIconEmoji}>{customWager.emoji}</Text>
            ) : (
              <Ionicons name="add" size={26} color={colors.textMuted} />
            )}
          </View>
          <View style={styles.createText}>
            <Text style={styles.createTitle}>
              {customWager ? customWager.display : 'Create Your Own'}
            </Text>
            <Text style={styles.createSubtitle}>
              {customWager ? 'Tap to edit' : 'e.g. massage, dessert, movie pick'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingButton label="Continue" variant="accent" onPress={handleContinue} />
        <Text style={styles.changeLater}>You can change this later</Text>
      </View>

      <CreateWagerSheet
        visible={sheetVisible}
        initialQuantity={selectedKey === CUSTOM_KEY && customWager ? customWager.quantity : 1}
        initialText={selectedKey === CUSTOM_KEY && customWager ? customWager.label : ''}
        onClose={() => setSheetVisible(false)}
        onDone={handleSheetDone}
      />
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
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
    marginTop: spacing.xxl,
  },
  card: {
    width: '48%',
    height: 150,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    backgroundColor: colors.card,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardEmoji: {
    fontSize: 38,
  },
  pencil: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBottom: {
    gap: spacing.sm,
  },
  cardLabel: {
    ...typography.bodyStrong,
    fontSize: 18,
    color: colors.textMuted,
  },
  cardLabelSelected: {
    color: colors.text,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  createCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  createIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createIconEmoji: {
    fontSize: 26,
  },
  createText: {
    flex: 1,
    gap: 2,
  },
  createTitle: {
    ...typography.bodyStrong,
    fontSize: 18,
  },
  createSubtitle: {
    ...typography.caption,
    color: colors.textDim,
    fontSize: 13,
  },
  footer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  changeLater: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    fontSize: 13,
  },
});
