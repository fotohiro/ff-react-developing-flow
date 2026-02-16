# Winback Email Flow — Abandoned Developing Checkout

**Klaviyo Trigger:** "Started Developing" metric, person has NOT triggered "Completed Checkout"

**CTA Link Format:**
`https://lab.fotofoto.io/?cid={{ event.cid }}&email={{ person|lookup:'email' }}&discount=CODE`

> Domain: `lab.fotofoto.io`
> Omit `&discount=CODE` for Email 1 (no discount).

---

## Email 1 — The Nudge

**Timing:** 2 hours after "Started Developing"
**Discount:** None

**Subject:** your photos are still in the camera
**Preview text:** It takes about 2 minutes to finish.

### Body

Hey {{ person.first_name|default:"there" }},

You started developing your FOTOFOTO film but didn't quite finish.

Your photos are still sitting inside the camera, waiting to be brought to life. The good news — it only takes about 2 minutes to complete your order.

**[Pick up where you left off →](https://lab.fotofoto.io/?cid={{ event.cid }}&email={{ person|lookup:'email' }})**

Talk soon,
FOTOFOTO

---

## Email 2 — The Incentive

**Timing:** 24 hours after "Started Developing"
**Discount:** 15% off — code `WINBACK15`

**Subject:** 15% off to develop your film
**Preview text:** A little nudge and a discount to bring your photos to life.

### Body

Hey {{ person.first_name|default:"there" }},

Your FOTOFOTO camera still has undeveloped photos inside — and we don't want you to miss out on those memories.

Here's **15% off developing** to make it easy. Just click below and the discount applies automatically.

| | Was | Now |
|---|---|---|
| Digital Scans | $9.99 | **$8.49** |
| Prints + Scans | $16.99 | **$14.44** |

**[Develop my photos — 15% off →](https://lab.fotofoto.io/?cid={{ event.cid }}&email={{ person|lookup:'email' }}&discount=WINBACK15)**

Or enter code **WINBACK15** at checkout.

FOTOFOTO

---

## Email 3 — The Escalation

**Timing:** 72 hours (Day 3) after "Started Developing"
**Discount:** 25% off — code `WINBACK25`

**Subject:** don't let your photos go undeveloped
**Preview text:** 25% off — your memories won't wait forever.

### Body

Hey {{ person.first_name|default:"there" }},

It's been a few days since you started developing your film. Your photos are still inside the camera — and undeveloped film doesn't last forever.

We bumped your discount to **25% off** because we really want you to see those photos.

| | Was | Now |
|---|---|---|
| Digital Scans | $9.99 | **$7.49** |
| Prints + Scans | $16.99 | **$12.74** |

**[Develop my photos — 25% off →](https://lab.fotofoto.io/?cid={{ event.cid }}&email={{ person|lookup:'email' }}&discount=WINBACK25)**

Or enter code **WINBACK25** at checkout.

FOTOFOTO

---

## Email 4 — The Final Push

**Timing:** 120–168 hours (Day 5–7) after "Started Developing"
**Discount:** 30% off — code `WINBACK30`

**Subject:** last chance: 30% off developing your film
**Preview text:** This is the biggest discount we'll send. Your photos are worth it.

### Body

Hey {{ person.first_name|default:"there" }},

This is our last nudge — and our biggest discount.

Your FOTOFOTO camera has photos inside that only exist in that one place. Once the camera is gone or the film degrades, those moments are lost.

**30% off developing — our best offer.**

| | Was | Now |
|---|---|---|
| Digital Scans | $9.99 | **$6.99** |
| Prints + Scans | $16.99 | **$11.89** |

**[Develop my photos — 30% off →](https://lab.fotofoto.io/?cid={{ event.cid }}&email={{ person|lookup:'email' }}&discount=WINBACK30)**

Or enter code **WINBACK30** at checkout.

We hope you'll develop your photos. They deserve to be seen.

FOTOFOTO

---

## Shopify Discount Codes to Create

| Code | Type | Value | Usage Limit | Notes |
|------|------|-------|-------------|-------|
| WINBACK15 | Percentage | 15% | No limit | Apply to developing products only |
| WINBACK25 | Percentage | 25% | No limit | Apply to developing products only |
| WINBACK30 | Percentage | 30% | No limit | Apply to developing products only |

Consider setting a rolling expiration (e.g. 30 days) so codes don't live forever.

## Klaviyo Flow Notes

- **Trigger metric:** "Started Developing"
- **Exit condition:** "Completed Checkout" metric fires at any point
- **Smart Sending:** Enable to prevent over-emailing (recommended: 16-hour quiet period)
- **Conditional split before each email:** Has person triggered "Completed Checkout" since flow entry? If yes, exit.
- **Skip profiles who have already received this flow** in the past 30 days to avoid repeat sends for customers who start the flow multiple times.
