import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { base64ToBytes } from './storage';
import { supabase } from './supabase';

const BUCKET = 'avatars';

// Each save writes a fresh timestamped file rather than overwriting avatar.jpg.
// Supabase storage's `upsert: true` takes a different code path (PUT) that
// fails RLS on this project even with permissive policies; POST + a unique
// filename works the same as the workout-images uploads.
export async function uploadAvatar(localUri: string, userId: string): Promise<string> {
  const resized = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 512, height: 512 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );

  const base64 = await FileSystem.readAsStringAsync(resized.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToBytes(base64);

  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
