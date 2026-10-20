# Product and implementation

Parola has two learning objects: vocabulary and grammatical structures. The learner produces the target language from an English or Spanish cue. A new card is learned by attempting it, revealing a concise explanation, and recalling it again. There is no separate lesson completion gate.

## State

`parola-state-v1` in localStorage contains versioned settings, a review record per card, daily unique-card activity, and personal cards. A failed read preserves the original storage and offers a recovery download. A failed write warns the learner to export. Cross-tab changes close the stale session and reload current state. JSON imports validate types, bounds, IDs, dates, counters and supported languages; imports require a confirmation before replacing current progress.

Daily goals count unique cards across languages. The first review snapshots that day's goal, so changing the future goal does not rewrite history. Review counts and accuracy remain language-specific. Each day in a streak must meet its snapshotted goal. A streak is retained during the current incomplete day if yesterday was completed.

## Scheduling

Mixed sessions take up to ten due/new cards, alternating vocabulary and grammar where possible within each due/new group. Due cards are prioritized. Missed cards repeat once during the session and are scheduled ten minutes later. First successful ordinary recalls schedule one day; subsequent ordinary recalls schedule three days, then 2.5 times the previous interval. Hard and easy ratings adjust the spacing. Intervals are capped at 365 days.

Extra practice is an explicit choice when no cards are due/new. A correct early review preserves the existing due date and learning stage; a miss still resets spacing. Three successful recalls and an interval of at least 21 days qualify for the “Growing roots” statistic. This is an app heuristic, not a standardized proficiency measure.

## Delivery

Vercel serves only `public/`. There is no server, database, paid integration, tracker, or API secret. Native modules keep the app small and deployable without installation. A restrictive CSP requires same-origin external scripts/styles. Content is escaped before HTML rendering; personal backup files remain on the learner's device.

The service worker precaches the app and collection, then refreshes same-origin app files from the network with cached fallbacks. Cache versions must be incremented with asset changes. Background web push is not implemented. Daily alerts while the app is closed are delegated to a recurring local-time calendar event with an alarm. Browser reminders run only while the app is open and permission is granted.

## Course maintenance

Keep published card IDs stable. Existing curriculum IDs are derived from row order within each language and kind, so append rows without reordering. English and Spanish are both authored sources, not runtime translations. European Portuguese is the chosen Portuguese variant. Custom cards require cues in both sources; an optional personal note is reused in both views.
