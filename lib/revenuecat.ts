import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

export const PRO_ENTITLEMENT_ID = 'Sweatbuds Pro';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

let configured = false;

export function configureRevenueCat(): void {
  if (configured) return;
  const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
  if (!apiKey) {
    if (__DEV__) console.warn('[RevenueCat] no API key for', Platform.OS);
    return;
  }
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
  configured = true;
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

export async function identifyRevenueCatUser(userId: string): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    return customerInfo;
  } catch (err) {
    if (__DEV__) console.warn('[RevenueCat] logIn failed', err);
    return null;
  }
}

export async function resetRevenueCatUser(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    if (__DEV__) console.warn('[RevenueCat] logOut failed', err);
  }
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (err) {
    // Offline or RC hiccup. Returning null keeps the subscription provider
    // resolvable — an unhandled rejection here used to leave `loading` true
    // forever and strand the app on the splash screen.
    if (__DEV__) console.warn('[RevenueCat] getOfferings failed', err);
    return null;
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    if (__DEV__) console.warn('[RevenueCat] getCustomerInfo failed', err);
    return null;
  }
}

// The SDK caches CustomerInfo locally for several minutes, and it has no way to
// know about a change made behind its back — specifically the promotional
// entitlement that redeem-promo-code grants over RevenueCat's REST API. Without
// dropping the cache first, the getCustomerInfo() right after a redemption
// returns the pre-grant snapshot, the access gate reads "not Pro", and the user
// sits on the locked home until a cold start. Call this before re-fetching
// whenever the server may have changed entitlements underneath us.
export async function invalidateCustomerInfoCache(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.invalidateCustomerInfoCache();
  } catch (err) {
    if (__DEV__) console.warn('[RevenueCat] invalidateCustomerInfoCache failed', err);
  }
}

export type PurchaseOutcome =
  | { kind: 'success'; customerInfo: CustomerInfo }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { kind: 'success', customerInfo };
  } catch (err) {
    if (isUserCancelled(err)) return { kind: 'cancelled' };
    return { kind: 'error', message: errorMessage(err) };
  }
}

export async function restorePurchases(): Promise<PurchaseOutcome> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { kind: 'success', customerInfo };
  } catch (err) {
    return { kind: 'error', message: errorMessage(err) };
  }
}

export function hasProEntitlement(info: CustomerInfo | null | undefined): boolean {
  if (!info) return false;
  return !!info.entitlements.active[PRO_ENTITLEMENT_ID];
}

function isUserCancelled(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { userCancelled?: boolean; code?: string };
  return e.userCancelled === true || e.code === '1';
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Something went wrong. Please try again.';
}
