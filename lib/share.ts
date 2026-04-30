import * as MediaLibrary from 'expo-media-library';
import { Alert, Linking, Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { RefObject } from 'react';
import type { View } from 'react-native';

export async function captureShareCard(
  ref: RefObject<View | null>,
): Promise<string> {
  const uri = await captureRef(ref as RefObject<View>, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

export async function saveToPhotos(fileUri: string): Promise<boolean> {
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (perm.status !== 'granted') {
    Alert.alert(
      'Photos access needed',
      'Enable Photos access in Settings to save Sweatcams to your library.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ],
    );
    return false;
  }
  await MediaLibrary.saveToLibraryAsync(fileUri);
  return true;
}

export async function shareViaSystem(fileUri: string): Promise<void> {
  await Share.share({ url: fileUri });
}

export async function shareToInstagramStory(fileUri: string): Promise<void> {
  const canOpen = await Linking.canOpenURL('instagram-stories://share');
  if (!canOpen) {
    Alert.alert('Instagram not installed', 'Install Instagram to share to your story.');
    return;
  }

  // Instagram Stories reads the background image from the photo library when
  // opened via this URL scheme. Save first so the user's most recent photo is
  // the rendered Sweatcam, which Instagram will offer as the story background.
  const saved = await saveToPhotos(fileUri);
  if (!saved) return;

  await Linking.openURL('instagram-stories://share?source_application=com.sweatbuds.app');
}
