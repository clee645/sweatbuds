import { LogBox, Platform } from 'react-native';
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';

import { captureException } from './reporting';

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
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    // The SDK console.errors its own diagnostics (e.g. "[RevenueCat] 🍎‼️ …"
    // whenever the simulator can't reach the App Store), which LogBox turns
    // into a red toast over the paywall. Dev-only noise — the user-facing copy
    // comes from purchaseErrorMessage, and the logs still print in Metro.
    LogBox.ignoreLogs(['[RevenueCat]']);
  }
  Purchases.configure({ apiKey });
  configured = true;
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

export async function identifyRevenueCatUser(userId: string): Promise<CustomerInfo | null> {
  if (!configured) return null;
  trialEligibilityCache.clear();
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
  trialEligibilityCache.clear();
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

// Length of the product's free trial in days, or null if it has none. Read from
// the store product so the paywall can't drift from what's configured in App
// Store Connect / Play Console. Says nothing about whether THIS user can still
// get it — see checkTrialEligibility.
export function freeTrialDays(product: PurchasesStoreProduct): number | null {
  let unit: string;
  let count: number;
  if (Platform.OS === 'android') {
    const period = product.defaultOption?.freePhase?.billingPeriod;
    if (!period) return null;
    unit = period.unit;
    count = period.value;
  } else {
    const intro = product.introPrice;
    if (!intro || intro.price !== 0) return null;
    unit = intro.periodUnit;
    count = intro.periodNumberOfUnits * Math.max(intro.cycles, 1);
  }
  if (count <= 0) return null;

  switch (unit) {
    case 'DAY':
      return count;
    case 'WEEK':
      return count * 7;
    case 'MONTH':
    case 'YEAR': {
      const start = new Date();
      const end = new Date(start);
      if (unit === 'MONTH') end.setMonth(end.getMonth() + count);
      else end.setFullYear(end.getFullYear() + count);
      return Math.round((end.getTime() - start.getTime()) / 86_400_000);
    }
    default:
      return null;
  }
}

// productId -> can this customer start the product's free trial. Cleared when
// the RevenueCat user changes. Lets the paywall render the right CTA on first
// paint once the subscription provider has warmed it.
const trialEligibilityCache = new Map<string, boolean>();

export function peekTrialEligibility(productIds: string[]): Record<string, boolean> | null {
  const result: Record<string, boolean> = {};
  for (const id of productIds) {
    const cached = trialEligibilityCache.get(id);
    if (cached === undefined) return null;
    result[id] = cached;
  }
  return result;
}

// Whether the customer can still start each product's free trial. Apple gives
// one trial per Apple ID per subscription group; a resubscriber (or a reviewer
// retesting on a used sandbox account) is charged immediately, so the paywall
// must not promise "free" to them. Anything short of a definite ELIGIBLE —
// UNKNOWN, an error, no trial on the product — counts as not eligible, per
// RevenueCat's guidance to show regular pricing when unsure.
export async function checkTrialEligibility(
  products: PurchasesStoreProduct[],
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  const toCheck: string[] = [];
  for (const product of products) {
    const id = product.identifier;
    const cached = trialEligibilityCache.get(id);
    if (cached !== undefined) {
      result[id] = cached;
    } else if (freeTrialDays(product) === null) {
      result[id] = false;
    } else if (Platform.OS === 'android') {
      // RevenueCat always reports UNKNOWN on Android. Play only returns offers
      // the user qualifies for, so a free phase on the product means eligible.
      result[id] = true;
    } else {
      toCheck.push(id);
    }
  }

  if (toCheck.length > 0 && configured) {
    try {
      const statuses = await Purchases.checkTrialOrIntroductoryPriceEligibility(toCheck);
      for (const id of toCheck) {
        result[id] =
          statuses[id]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
      }
    } catch (err) {
      if (__DEV__) console.warn('[RevenueCat] trial eligibility check failed', err);
      // Not cached, so the next paywall visit retries.
      for (const id of toCheck) result[id] = false;
      return result;
    }
  } else if (toCheck.length > 0) {
    for (const id of toCheck) result[id] = false;
    return result;
  }

  for (const product of products) {
    trialEligibilityCache.set(product.identifier, result[product.identifier]);
  }
  return result;
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
    return { kind: 'error', message: purchaseErrorMessage(err, 'purchase') };
  }
}

export async function restorePurchases(): Promise<PurchaseOutcome> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { kind: 'success', customerInfo };
  } catch (err) {
    if (isUserCancelled(err)) return { kind: 'cancelled' };
    return { kind: 'error', message: purchaseErrorMessage(err, 'restore') };
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

// RevenueCat's error `message` is developer-facing: it can carry SDK log
// prefixes (e.g. "🍎‼️"), StoreKit jargon and config hints. Never show it to a
// customer — map the error code to plain copy, and send the raw error to
// Sentry so it's still debuggable.
export function purchaseErrorMessage(err: unknown, operation: 'purchase' | 'restore' | 'paywall' | 'customer_center'): string {
  const code = (err as { code?: string } | null)?.code;
  captureException(err, { operation: `revenuecat_${operation}`, rc_code: code ?? 'none' });

  switch (code) {
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
    case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
    case PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR:
      return "Couldn't reach the App Store. Check your connection and try again.";
    case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
      return "Purchases aren't allowed on this device. Check Screen Time or Family Sharing settings.";
    case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
      return "Your purchase is waiting for approval. Pro will unlock as soon as it goes through.";
    case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
      return 'You already have this subscription. Tap Restore Purchases to unlock it.';
    case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
    case PURCHASES_ERROR_CODE.RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR:
      return 'This Apple ID’s subscription is already linked to another Sweatbuds account.';
    case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
    case PURCHASES_ERROR_CODE.INELIGIBLE_ERROR:
      return "This plan isn't available right now. Please try again later.";
    case PURCHASES_ERROR_CODE.OPERATION_ALREADY_IN_PROGRESS_ERROR:
      return 'Still working on your last request. Give it a moment.';
    case PURCHASES_ERROR_CODE.MISSING_RECEIPT_FILE_ERROR:
    case PURCHASES_ERROR_CODE.INVALID_RECEIPT_ERROR:
      if (operation === 'restore') {
        return 'We couldn’t find a subscription on this Apple ID.';
      }
      break;
    case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
      return 'The App Store is having trouble right now. Please try again in a moment.';
  }

  if (operation === 'restore') return 'We couldn’t restore your purchases. Please try again.';
  if (operation === 'customer_center') {
    return 'We couldn’t open your subscription settings. You can also manage it in Settings → Apple ID → Subscriptions.';
  }
  return 'Something went wrong with your purchase. Please try again.';
}
