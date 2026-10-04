# Regression checklist: onboarding, paying, pairing

Run before each App Store submission. Every item below maps to a bug that was
actually shipped or nearly shipped, so a failure here is a regression, not a
nitpick.

## Setup

- **Two phones**, A and B, both on the build under test. A TestFlight build is
  closest to production; a dev build is fine for everything except purchases.
- **Two Apple IDs** with App Store **sandbox** accounts (Settings → App Store →
  Sandbox Account). A sandbox ID that has never subscribed is needed for the
  free-trial cases; a reused one is needed for the "already used your trial"
  case.
- **Two Sweatbuds accounts** that are not paired. To reset: Settings → Delete
  Account on both, then sign up again.
- Know how to force-quit (swipe up from the app switcher) and how to toggle
  airplane mode quickly — several checks depend on both.

Legend: **[money]** = could take someone's money without unlocking.
**[lockout]** = could leave a paying user locked out. **[stuck]** = could look
like a crash.

---

## 1. Onboarding and sign-up

1. **Fresh install, full flow.** Delete the app, reinstall, and walk from
   Welcome to home without skipping. Expect: no screen where Continue does
   nothing, no blank screens, and content fits without scrolling on the
   smallest phone you support.
2. **Deny the photo prompt.** At the profile photo step, tap "Don't Allow".
   Expect: **Skip for now** still advances. (Regression: onboarding could not be
   completed at all.)
3. **Kill the app mid-onboarding.** Force-quit on the weekly goal step, reopen.
   Expect: it restarts at Welcome, and nothing is in a broken state.
4. **Sign in on a second device.** Sign in with the same Apple ID on phone B.
   Expect: straight to home, no onboarding, no "No account found" error.
5. **[stuck] Launch in airplane mode.** Force-quit, turn on airplane mode,
   launch. Expect: within ~8 seconds you reach home or the locked screen. You
   must NOT sit on the splash logo indefinitely, and you must NOT be bounced to
   the sign-in screen while already signed in. (Regression, twice.)
6. **Offline banner.** Still in airplane mode, confirm the offline banner shows
   and the app is navigable.
   **Known issue (iOS, tabled 2026-10-04):** after a cold launch in airplane
   mode the banner does not appear; it only shows once airplane mode is
   toggled with the app open. Expected to fail until fixed — see the TODO in
   `lib/connectivity.tsx`. Still check that the app is navigable.

## 2. Paying

7. **[money] Trial copy for a fresh sandbox ID.** Open the paywall on a sandbox
   account that has never subscribed. Expect: yearly shows the trial badge and
   "Try for FREE", and the timeline shows real dates, not "0 Day".
8. **[money] Trial copy for a reused sandbox ID.** Same screen on a sandbox
   account that already used its trial. Expect: no promise of a free trial;
   copy says you'll be charged today.
9. **[money] Buy yearly.** Complete the purchase. Expect: paywall-success, then
   the widget walkthrough, then home unlocked. You must NOT land on "Start Your
   Journey" after paying. (Regression.)
10. **[money] Buy with a weak connection.** Enable Low Data Mode, or toggle
    airplane mode on for ~2 seconds immediately after confirming the purchase.
    Expect: you still end up unlocked. (Regression: a failed refresh right
    after paying reported "not subscribed".)
11. **[stuck] The purchase button is never dead.** Open the paywall on a slow
    connection. Expect: the orange button is tappable within a few seconds, not
    permanently grey. (Regression.)
12. **Prices are real.** Confirm the prices match App Store Connect, and that
    you never see "$6.99"/"$4.16" on a non-US storefront.
13. **Swipe back after buying.** From paywall-success, try to swipe back.
    Expect: you cannot return to a paywall that still advertises a free trial
    you just used. (Regression.)
14. **Restore purchases.** On a reinstall of a paid account, tap Restore on the
    locked screen. Expect: unlocked. On an account with nothing to restore:
    "We couldn't find a subscription on this Apple ID", not a RevenueCat error
    string with emoji.
15. **Errors are human.** Force a failure (airplane mode, then tap the CTA).
    Expect: plain language, never "[RevenueCat] 🍎‼️ …".
16. **Promo code field.** Tap "Have a promo code?". Expect: the keyboard does
    not cover the field or the button, a wrong code's error disappears after a
    few seconds, and tapping the link again closes it.
17. **Cancel mid-purchase.** Start a purchase and cancel the Apple sheet.
    Expect: no error alert, button returns to normal.

## 3. Pairing

**A pays, then invites (the common case)**

18. On A (subscribed), share the invite code. On B, enter it during onboarding
    and finish sign-up. Expect on B: splash → terms screen → celebration →
    home. B must NOT see the paywall at any point, even for a flash.
    (Regression, twice.)
19. **[lockout] B launches offline.** Force-quit B, airplane mode, launch.
    Expect: B stays unlocked. (Regression: the covered partner saw
    "Subscribe".)
20. **A's side.** Expect: A gets exactly ONE notification ("joined your team"),
    not two, and A's home shows the partnership without a stuck skeleton.
21. **[stuck] Terms screen is resumable.** Repeat 18, but force-quit B on the
    signature pad. Reopen. Expect: back to the terms screen, then the
    celebration after signing. It must not skip both forever. (Regression.)
22. **No backwards toast.** During 18, watch B's screen. Expect: B never sees
    "🎉 A joined your team" — B joined A. (Regression.)

**Neither has paid**

23. On A (not subscribed), share the code. On B, enter it. Expect at the code
    screen: a note that nobody has subscribed yet, and the button reads
    "Continue anyway".
24. After B finishes sign-up, expect B's locked screen to read "Almost there"
    and explain that one of them needs a subscription. It must NOT tell B to go
    find a partner. (Regression.)
25. **[lockout] A subscribes afterwards.** With B's app backgrounded, subscribe
    on A. Then bring B to the foreground. Expect: B pairs within a second or
    two, with no force-quit needed. (Regression: they never connected.)
26. **No false failure alert.** After 25, background and foreground B again.
    Expect: no "Could not connect with partner" or "You're already paired"
    alert. (Regression.)

**Manual pairing from the Partner screen**

27. On B, go to Partner. Expect: the code B entered earlier is prefilled.
28. Pair from there. Expect: celebration, and no error alert on the next
    foreground. (Regression.)
29. **Offline code card.** On the Partner screen in airplane mode, expect:
    "Could not load your code" with **Tap to try again**, not a dead Share
    button. (Regression.)

**Unpairing**

30. Unpair on A. Expect: both sides drop to solo, and old photos stop being
    visible to the other.
31. On A, open Partner again. Expect: a NEW invite code appears.
32. Log a workout on A after unpairing. Expect: it appears on home. (Regression:
    it vanished.)
33. Settings → Weekly Wager on A after unpairing. Expect: it saves without a
    database error about an ended partnership. (Regression.)

## 4. After pairing (the week and the wager)

34. **Solo week counts.** As a subscribed, unpaired user, log a workout. Expect:
    the week card shows 1 of N, matching the success screen and the widget, not
    0. (Regression.)
35. **Right goal everywhere.** Set the goal to 5. Log a workout. Expect: the
    success screen says "1/5", not "1/3". (Regression.)
36. **Notification tap from cold start.** Force-quit B. Have A log a workout.
    Tap B's notification. Expect: A's workout opens, not a different one and not
    a blank screen that closes. (Regression.)
37. **Mark a wager done.** With an outstanding wager, tap "Mark one as done".
    Expect: the celebration screen, and a notification on the partner's phone.
38. **Offline history.** Airplane mode, open History. Expect: days with
    workouts still show as filled, tappable tiles, and you never see "No weeks
    yet" for an account that has history. (Regression.)
39. **Wager Balance.** Open it. Expect: a spinner first, never a flash of "All
    caught up!" before data loads, and offline shows an error with a retry, not
    "All caught up!". (Regression.)

## 5. Account lifecycle

40. **Sign out, sign in as the other account.** Expect: no data from the first
    account, and the gym reminder settings don't carry over.
41. **Delete account.** Expect: it completes, the partner is told the
    partnership ended, and signing up again starts clean.

---

## Known accepted behavior (not bugs, don't report these)

- The paywall has no Terms/Privacy links; they're on the account-creation and
  settings screens.
- The yearly plan shows its monthly equivalent rather than the annual charge.
- The trial timeline reads "0 Day - Reminder" on monthly or when no trial
  applies.
- The two screens before the paywall promise a free trial unconditionally.
- Unpairing sends no push; the person who taps Unpair sees "Your partnership
  has ended".
- Going back in onboarding loses previously entered answers.
- The rating prompt appears during onboarding, on the "small team" screen.
- A reviewer using the demo code cannot pair.
- Workouts logged before pairing stay in History only.
