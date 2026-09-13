# PostHog Self-driving setup report

## Summary

PostHog Self-driving is configured for Sweatbuds. Session Replay was already enabled; Error Tracking and Support were enabled, and health, error, and support signal sources were added. Fresh scout configurations and Replay Vision scanners will begin producing findings in the [Self-driving inbox](https://us.posthog.com/project/606880/inbox) within about 30 minutes once recordings and events arrive.

## AI data processing

Approved by the setup wizard before this run.

## GitHub

GitHub is already connected through the PostHog GitHub App. GitHub Issues was not selected for Self-driving ingestion, so no GitHub Issues responder was enabled.

## Products enabled

| Product | Result | Notes |
|---|---|---|
| Session Replay | Already enabled; mobile capture verification pending | The Expo/React Native app initializes `posthog-react-native`, but no recordings were found during setup. Confirm a real device session arrives. |
| Error Tracking | Enabled | The app already sends explicit exceptions from key purchase, sharing, and workout paths. |
| Support (Conversations) | Enabled | Tickets will arrive only after an inbound email, inbox, or Slack channel is connected in PostHog. |

## Signal sources

| Source product | Source type | Action |
|---|---|---|
| `health_checks` | `health_issue` | Enabled (`01a09996-5485-7350-b200-ee1c242d7c85`) |
| `error_tracking` | `issue_created` | Enabled (`01a09996-549f-7b0b-9409-747156510e6b`) |
| `error_tracking` | `issue_reopened` | Enabled (`01a09996-5526-7bf3-a1d0-ac344520b5eb`) |
| `error_tracking` | `issue_spiking` | Enabled (`01a09996-552e-7d51-ac6d-b4f11b1e6f0d`) |
| `conversations` | `ticket` | Enabled (`01a09996-55ca-78a6-8da3-26885082c9af`) |
| `signals_scout` | `cross_source_issue` | On by default; no row is needed or was created. |
| `replay_vision` | scanner findings | Intentionally not a source row; the two scanners below self-authorize their inbox findings. |

## Connected tools

No external connected-tool responder was selected in this run. The tool-selection prompt was cancelled, so GitHub Issues, Linear, Jira, Sentry, Zendesk, and the extended catalog are recorded as not used for Self-driving ingestion.

## Scout troop

**Run budget:** 100 maximum runs/day; 0 used and 100 remaining when configured. PostHog announced: “Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.”

### Enabled (4)

| Scout | Why it is active |
|---|---|
| `signals-scout-general` | Cross-product patterns and uncovered surfaces. |
| `signals-scout-product-analytics` | The app has core onboarding, partner, and workout interactions. |
| `signals-scout-revenue-analytics` | RevenueCat subscription and purchase flows are present. |
| `signals-scout-health-checks` | Keeps PostHog instrumentation health actionable. |

### Disabled (23)

| Scout(s) | Reason |
|---|---|
| `signals-scout-ai-observability` | No LLM/AI telemetry evidence. |
| `signals-scout-anomaly-detection` | No established project dashboard/insight baseline was available. |
| `signals-scout-apm` | No tracing/APM evidence. |
| `signals-scout-conversations` | Support is newly enabled but no inbound channel is connected yet. |
| `signals-scout-csp-violations` | No CSP-reporting configuration evidence. |
| `signals-scout-customer-analytics` | This is a consumer partner app, not an account-analytics surface. |
| `signals-scout-data-pipelines`, `signals-scout-data-warehouse` | No pipeline or external warehouse source is configured. |
| `signals-scout-error-tracking` | Covered by the native Error Tracking sources. |
| `signals-scout-experiments`, `signals-scout-feature-flags` | No active experiment or feature-flag evidence. |
| `signals-scout-inbox-validation` | Fresh Self-driving setup has no shipped fixes to validate. |
| `signals-scout-insight-alerts` | No insight-alert surface was established. |
| `signals-scout-logs` | Logs product not in use. |
| `signals-scout-mcp-tool-calls`, `signals-scout-skills-store`, `signals-scout-tasks` | No evidence these PostHog agent surfaces are used by the product. |
| `signals-scout-observability-gaps` | Not prioritized ahead of the app’s active product, subscription, and health surfaces. |
| `signals-scout-replay-vision` | No pre-existing scanner history to analyze; it can be enabled later after observations accumulate. |
| `signals-scout-session-replay` | Covered by Replay Vision scanners. |
| `signals-scout-surveys` | No surveys exist. |
| `signals-scout-web-analytics`, `signals-scout-web-vitals` | The primary product is a React Native mobile app rather than a web-traffic surface. |

## Custom scouts

No custom scouts were created. Two candidates were proposed, but the explicit “None — keep the built-in troop” selection overrides the other selected options, so the built-in troop remains unchanged.

- **Workout logging health** was proposed to detect a sharp collapse in completed workout activity or a rise in workout-entry failures; it would complement, rather than duplicate, the active generic product-analytics scout.
- **Subscription entitlement handoffs** was proposed to watch the RevenueCat-to-profile entitlement path for delayed, failed, or divergent purchase processing; the active revenue scout only partially overlaps this RevenueCat-specific path.
- **Partner activation** was considered but ruled out: the repository supplies invite-sharing and code-validation events, but not a sufficiently clear instrumentation pair for a completed pairing outcome.

If a future custom scout becomes noisy, set its config’s `emit` value to `false` in PostHog to switch it to dry-run.

## Replay Vision scanners

A scanner is an LLM that watches individual session recordings on a schedule and pushes material defects to the inbox. It is the only setup component here that spends Replay Vision quota; each finding has half weight and needs independent corroboration before it is promoted into a report.

The project had no recordings during setup, so both scanners are armed for the first recordings. Their estimated monthly observation and credit costs are currently zero; each observation costs 5 credits. The organization had 2,500 Replay Vision credits remaining and was not exhausted.

| Status | Scanner | Watches | Query scope | Sampling rate | Estimated monthly cost |
|---|---|---|---|---:|---:|
| Created | [Sweatbuds paywall breakage](https://us.posthog.com/project/606880/replay-vision/01a0999e-3c95-7405-84e5-d093ba8efcd6) | Visible breakage during subscription onboarding: unavailable plans, failed purchases/restores, promo failures, and access that does not advance. | Sessions on `/onboarding/paywall` and its immediate paywall-route variants; this is the subscription completion flow. | 0.5 | 0 credits (0 observations) |
| Created | [Sweatbuds flow frustration](https://us.posthog.com/project/606880/replay-vision/01a0999e-3c56-7e21-9dfd-4309c459b1d7) | Visible struggle across sign-in, invitations, subscription selection/restores, photo capture, and workout logging. | `$rageclick` sessions only; deliberately not URL-scoped to keep it distinct from the breakage monitor. | 1.0 | 0 credits (0 observations) |

Rate scanner observations after they begin appearing: thumbs-up/down feedback becomes a configuration recommendation you can review on each scanner page.

## Follow-ups

- [ ] Connect an inbound Support channel (email, inbox, or Slack) in PostHog so the enabled Conversations responder can receive tickets.
- [ ] Exercise the app on a real device and confirm that a Session Replay recording arrives; both Replay Vision scanners begin working automatically once recordings exist.
- [ ] If custom domain monitoring is wanted later, re-propose the workout logging and RevenueCat entitlement handoff scouts after enough events establish a baseline.
- [ ] The MCP connection lacks `property_definition:read`, so event-schema validation for future custom scouts requires a re-authorized connection with that scope.

## What happens next

The scout coordinator picks up fresh configurations within about 30 minutes. Scout runs use the daily budget, findings cluster into reports in the [Self-driving inbox](https://us.posthog.com/project/606880/inbox), and immediately actionable reports can begin coding tasks.

## Repository changes

- Created `posthog-self-driving-report.md`.
- No application source files were modified; the existing `posthog-react-native` initialization and event instrumentation were preserved.
