# Breakdown template

Copy this structure for each breakdown. Replace everything in square brackets. Delete any section that genuinely doesn't apply, but keep "Check yourself" and "Explain it back" every time.

---

```markdown
# [Short title of what was done]

> [YYYY-MM-DD] · [Task the developer asked for, in one line]

## In short
[2-3 plain sentences: what this change does and why it was needed.]

## What changed
- `[path/to/file]`: [what changed here and what it now does]
- `[path/to/other-file]`: [what changed here]

## How it works
1. [First thing that happens when this code runs]
2. [Next step]
3. [Next step, through to the result]

## Why it's built this way
- **[Decision]:** [why this approach]. Considered [alternative], but [reason it wasn't used].
- **[Decision]:** [why].

## The concept worth knowing: [concept name]
**Simply put:** [explain it as if to a beginner, ideally with an everyday analogy]

**More precisely:** [the accurate technical explanation, and where it shows up in this code]

## Watch out for
- [Edge case or risk, and what happens]
- [Assumption made, or anything not yet tested]
- [What to test: a specific case worth trying]

## Check yourself
1. [A "why" or "what if" question about this change]
   <details><summary>Answer</summary>[Answer, referring to the real code]</details>

2. [Question]
   <details><summary>Answer</summary>[Answer]</details>

3. [Question]
   <details><summary>Answer</summary>[Answer]</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

---
*Made with Edirae Learn · edirae.com*
```

---

## A short example

```markdown
# Retry failed payment webhooks

> 2026-10-10 · "Make sure we don't lose Stripe webhooks when our server is down"

## In short
Incoming payment webhooks are now saved to the database before they're processed. If processing fails, a background job retries them up to 5 times with growing delays, so a temporary outage no longer loses payments.

## What changed
- `src/webhooks/stripe.ts`: saves each event to `webhook_events` first, then processes it, and returns 200 to Stripe straight away.
- `src/jobs/retryWebhooks.ts`: new job that runs every minute and retries failed events.
- `db/migrations/0042_webhook_events.sql`: new table with `status`, `attempts` and `next_attempt_at`.

## How it works
1. Stripe sends an event. We store it with status `pending` and reply 200.
2. We try to process it. On success it becomes `done`.
3. On failure we increase `attempts` and set `next_attempt_at` further in the future: 1, 2, 4, 8, 16 minutes.
4. The job picks up events whose `next_attempt_at` has passed. After 5 failures, the event is marked `failed` for manual review.

## Why it's built this way
- **Store first, then process:** Stripe only waits a few seconds for a reply. Saving first means we can reply quickly and do the slow work afterwards.
- **Exponential backoff:** waiting longer after each failure avoids hammering a service that's already struggling. A fixed 1-minute retry was considered but would retry too aggressively during a long outage.

## The concept worth knowing: idempotency
**Simply put:** pressing a lift button five times still calls the lift once. An idempotent operation gives the same result no matter how many times it runs.

**More precisely:** Stripe can send the same event more than once. We check the event's `id` against `webhook_events` before processing, so a payment is never recorded twice.

## Watch out for
- Events marked `failed` need someone to look at them. Nothing alerts you yet.
- The retry job assumes one server instance. With several, two could pick up the same event.
- Test: send the same event twice and confirm only one payment is recorded.

## Check yourself
1. Why do we reply 200 to Stripe before processing the event?
   <details><summary>Answer</summary>Stripe times out quickly and retries if it doesn't get a fast reply. Replying immediately, after the event is safely stored, avoids timeouts and duplicate deliveries.</details>

2. What would happen if we removed the check on the event `id`?
   <details><summary>Answer</summary>Duplicate deliveries from Stripe would be processed twice, for example recording the same payment twice.</details>

3. Why do the delays grow instead of staying at 1 minute?
   <details><summary>Answer</summary>If a dependency is down for a while, growing delays reduce load on it and give it time to recover, while still retrying quickly for short blips.</details>

## Explain it back
Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread.

---
*Made with Edirae Learn · edirae.com*
```
