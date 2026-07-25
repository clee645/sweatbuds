import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type WidgetSource = 'self' | 'partner';

export type SetLatestPostInput = {
  selfieUri: string;
  environmentUri: string;
  caption: string | null;
  partnerName: string;
  loggedAt: string;
  streak: number;
  source: WidgetSource;
};

type NativeBridge = {
  setLatestPost(input: SetLatestPostInput): Promise<void>;
  setEmptyState(state: 'noPartner' | 'noLogs', partnerName: string | null): Promise<void>;
  clear(): Promise<void>;
};

const native: NativeBridge | null =
  Platform.OS === 'ios' ? requireOptionalNativeModule<NativeBridge>('SweatbudsWidgetBridge') : null;

export const isAvailable = native != null;

export async function setLatestPost(input: SetLatestPostInput): Promise<void> {
  if (!native) return;
  await native.setLatestPost(input);
}

export async function setEmptyState(
  state: 'noPartner' | 'noLogs',
  partnerName: string | null = null,
): Promise<void> {
  if (!native) return;
  await native.setEmptyState(state, partnerName);
}

export async function clear(): Promise<void> {
  if (!native) return;
  await native.clear();
}
