import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { usePartnership, type PartnershipUpdateFields } from '@/lib/partnership';
import { colors, radii, spacing, typography } from '@/lib/theme';
import {
  formatWager,
  isPreset,
  PRESET_WAGERS,
  wagersEqual,
  type WagerRule,
} from '@/lib/wagers';

import { CreateWagerModal } from './CreateWagerModal';

type Props = {
  visible: boolean;
  initialDays: number;
  initialWager: WagerRule;
  onClose: () => void;
};

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export function EditRulesModal({ visible, initialDays, initialWager, onClose }: Props) {
  const { update } = usePartnership();
  const [days, setDays] = useState(initialDays);
  const [wager, setWager] = useState<WagerRule>(initialWager);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setDays(initialDays);
      setWager(initialWager);
    }
  }, [visible, initialDays, initialWager]);

  const customWager = !isPreset(wager) ? wager : null;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const fields: PartnershipUpdateFields = {};
      if (days !== initialDays) fields.weekly_target = days;
      if (!wagersEqual(wager, initialWager)) {
        fields.wager_quantity = wager.quantity;
        fields.wager_text = wager.text;
        fields.wager_emoji = wager.emoji;
      }
      if (Object.keys(fields).length > 0) {
        await update(fields);
      }
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Try again.';
      Alert.alert('Could not save rules', message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = (created: WagerRule) => {
    setWager(created);
    setCreateOpen(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.bottomWrap} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Edit Rules</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>Weekly workout goal</Text>
          <View style={styles.daysWrap}>
            <View style={styles.daysRow}>
              {DAY_OPTIONS.map((n) => {
                const selected = n === days;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setDays(n)}
                    style={[styles.dayChip, selected && styles.dayChipSelected]}
                  >
                    <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.daysCaption}>days</Text>
          </View>

          <Text style={[styles.sectionLabel, styles.wagerLabel]}>Wager for missed workout</Text>
          <View style={styles.chipsWrap}>
            {PRESET_WAGERS.map((p) => {
              const selected = wagersEqual(p, wager);
              return (
                <Pressable
                  key={`${p.quantity}-${p.text}-${p.emoji}`}
                  onPress={() => setWager(p)}
                  style={[styles.wagerChip, selected && styles.wagerChipSelected]}
                >
                  <Text style={[styles.wagerChipText, selected && styles.wagerChipTextSelected]}>
                    {formatWager(p)}
                  </Text>
                </Pressable>
              );
            })}
            {customWager ? (
              <Pressable
                onPress={() => setWager(customWager)}
                style={[styles.wagerChip, styles.wagerChipSelected]}
              >
                <Text style={[styles.wagerChipText, styles.wagerChipTextSelected]}>
                  {formatWager(customWager)}
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setCreateOpen(true)} style={styles.createChip}>
              <Text style={styles.createChipText}>Create your own</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={save}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveBtn,
              (pressed || saving) && styles.saveBtnPressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={'#000000'} />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>

      <CreateWagerModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  bottomWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.cardElevated,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textDim,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { ...typography.title, fontSize: 22 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
  },
  wagerLabel: {
    marginTop: spacing.xl,
  },
  daysWrap: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.xs,
  },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayChipSelected: {
    borderColor: colors.accent,
  },
  dayText: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.textMuted,
  },
  dayTextSelected: {
    color: colors.accent,
  },
  daysCaption: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  wagerChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  wagerChipSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  wagerChipText: {
    ...typography.body,
    fontSize: 14,
  },
  wagerChipTextSelected: {
    color: colors.accent,
  },
  createChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    flexBasis: '100%',
    alignItems: 'center',
  },
  createChipText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
  },
  saveBtn: {
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnPressed: { opacity: 0.85 },
  saveText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
});
