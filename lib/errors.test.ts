import { describe, expect, it } from 'vitest';

import { OFFLINE_MESSAGE, isNetworkError, toUserMessage } from './errors';

describe('toUserMessage', () => {
  it('maps a React Native fetch failure to the offline copy', () => {
    expect(toUserMessage(new Error('Network request failed'))).toBe(OFFLINE_MESSAGE);
  });

  // The shape supabase-js throws for a transport failure: the raw JS stack
  // (build paths and all) rides along in `details`. Regression guard for the
  // alert that leaked "/Users/expo/workingdir/build/ios/..." to a user.
  it('maps a PostgrestError-shaped transport failure to the offline copy', () => {
    const postgrestError = {
      message: 'TypeError: Network request failed',
      details:
        'TypeError: Network request failed\n    at anonymous (/Users/expo/workingdir/build/ios/build/Build/Intermediates.noindex/main.jsbundle:32732:33)',
      hint: '',
      code: '',
    };
    expect(isNetworkError(postgrestError)).toBe(true);
    expect(toUserMessage(postgrestError)).toBe(OFFLINE_MESSAGE);
  });

  it('keeps real error copy for non-network failures', () => {
    expect(toUserMessage(new Error('Not signed in'))).toBe('Not signed in');
  });

  it('falls back when there is nothing worth showing', () => {
    expect(toUserMessage(undefined, 'Please try again.')).toBe('Please try again.');
  });
});
