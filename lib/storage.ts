import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from './supabase';

const BUCKET = 'workout-images';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
// Refresh a bit before the token actually expires so a request mid-render still hits a valid URL.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const isHttpUrl = (s: string) => /^https?:\/\//i.test(s);

// Cache signed URLs by path so the same storage path resolves to the same URL across calls.
// Without this, every render that triggers a fetch produces a freshly-tokenized URL, which
// makes expo-image treat the source as new and re-run its fade-in transition.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function getCached(path: string, now: number): string | null {
  const entry = signedUrlCache.get(path);
  if (entry && entry.expiresAt - REFRESH_MARGIN_MS > now) return entry.url;
  return null;
}

function setCached(path: string, url: string, now: number) {
  signedUrlCache.set(path, { url, expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000 });
}

export async function getSignedUrl(path: string): Promise<string> {
  if (isHttpUrl(path)) return path;
  const now = Date.now();
  const cached = getCached(path, now);
  if (cached) return cached;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw error ?? new Error('Failed to create signed URL');
  setCached(path, data.signedUrl, now);
  return data.signedUrl;
}

// Synchronous cache lookup so consumers can prime initial state before the async fetch resolves.
export function getCachedSignedUrls(paths: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const now = Date.now();
  for (const p of paths) {
    if (isHttpUrl(p)) {
      result[p] = p;
      continue;
    }
    const cached = getCached(p, now);
    if (cached) result[p] = cached;
  }
  return result;
}

export async function getSignedUrls(paths: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const missing: string[] = [];
  const now = Date.now();

  for (const p of paths) {
    if (isHttpUrl(p)) {
      result[p] = p;
      continue;
    }
    const cached = getCached(p, now);
    if (cached) {
      result[p] = cached;
    } else {
      missing.push(p);
    }
  }

  if (missing.length === 0) return result;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw error ?? new Error('Failed to create signed URLs');

  for (const item of data) {
    if (item.path && item.signedUrl) {
      result[item.path] = item.signedUrl;
      setCached(item.path, item.signedUrl, now);
    }
  }
  return result;
}

export async function uploadWorkoutImage(
  localUri: string,
  userId: string,
  workoutId: string,
  kind: 'selfie' | 'environment',
): Promise<string> {
  const resized = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1080 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );

  const base64 = await FileSystem.readAsStringAsync(resized.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToBytes(base64);

  const path = `${userId}/${workoutId}/${kind}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    // Overwrite rather than collide: createWorkout reuses the same workoutId
    // when the caller retries, so a retry after a partial failure has to be
    // able to re-put an object that already landed.
    upsert: true,
  });
  if (error) throw error;

  return path;
}

// Best-effort removal of workout storage objects. Used both by deleteWorkout
// and by createWorkout's rollback, so a failed log leaves nothing behind.
// Resolves false (rather than throwing) when the remove fails — callers are
// either already unwinding a different error or have deleted the DB row, and
// neither should be masked by a cleanup failure.
export async function deleteWorkoutImages(paths: string[]): Promise<boolean> {
  const targets = paths.filter((p) => p && !isHttpUrl(p));
  if (targets.length === 0) return true;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove(targets);
    // Drop any cached signed URLs so a recycled path can't resolve to a stale
    // token for an object that no longer exists.
    for (const p of targets) signedUrlCache.delete(p);
    if (error) {
      if (__DEV__) console.warn('[storage] failed to remove objects', targets, error);
      return false;
    }
    return true;
  } catch (err) {
    if (__DEV__) console.warn('[storage] failed to remove objects', targets, err);
    return false;
  }
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = global.atob ? global.atob(base64) : decodeBase64Polyfill(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decodeBase64Polyfill(input: string): string {
  const cleaned = input.replace(/=+$/, '');
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const idx = ALPHA.indexOf(cleaned[i]);
    if (idx < 0) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}
