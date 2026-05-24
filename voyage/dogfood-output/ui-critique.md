# Voyage UI Critique

Best-effort critique based on runtime screenshots from the iOS simulator. I did not run the source-based `/critique` pipeline because this pass was intentionally dogfood-style and runtime-only.

## Update After Fixes

The current branch is materially stronger than the screenshots captured in the initial critique. The major functional and brand inconsistencies from that first pass have been addressed:

- Search now renders productized fallback UI instead of leaking internal error/debug output.
- Assistant suggested prompts now complete the send flow and produce results.
- Notifications content is travel-specific instead of coming from a host/rental template.
- Key icon-only utility controls in Assistant and Profile are now labeled for accessibility.
- Tracked and Trips empty states carry more of the same editorial voice as Assistant and Profile.
- The tab navigator now survives a cold restart instead of crashing on a preserved-state assumption.

The critique below remains useful as a record of what was wrong in the earlier build, but it should not be read as the current state of the branch.

## Design Health Score

| # | Heuristic | Score | Key Issue |
| --- | --- | --- | --- |
| 1 | Visibility of System Status | 1 | Search and assistant actions fail without usable feedback |
| 2 | Match System / Real World | 1 | Notifications content belongs to a different product domain |
| 3 | User Control and Freedom | 2 | Back navigation is present, but recovery from broken states is weak |
| 4 | Consistency and Standards | 1 | Screen quality and product voice vary sharply by tab |
| 5 | Error Prevention | 1 | Raw internal errors reach the primary search surface |
| 6 | Recognition Rather Than Recall | 2 | Main tabs are labeled, but icon-only utility controls are not |
| 7 | Flexibility and Efficiency | 1 | Primary assistant path stalls; no efficient completion path |
| 8 | Aesthetic and Minimalist Design | 2 | Profile/Assistant are strong, but thinner tabs feel underdesigned |
| 9 | Error Recovery | 1 | Broken flows give no actionable next step |
| 10 | Help and Documentation | 2 | Settings exposes Help, but contextual help is absent where failure happens |
| **Total** |  | **14/40** | **Poor** |

## Anti-Patterns Verdict

This does **not** read as generic AI slop. The app has a point of view: serif editorial type, restrained palette, and a concierge-style tone. The problem is not blandness. The problem is **coherence**.

The best screens, especially `assistant-home.png` and `profile-home.png`, feel premium and on-brand for a modern travel companion. The weakest screens, especially `search-error.png`, `tracked-empty.png`, and `trips-empty.png`, feel like unfinished product scaffolding. That gap is large enough that the app feels stitched together.

## Overall Impression

There is a real brand here, and it is worth preserving. The app wants to be an elegant travel concierge. Right now, the product experience is being undermined by broken search, inert assistant interactions, and seeded content from the wrong domain. The biggest opportunity is to make the strongest visual language consistent across the entire core journey.

## What's Working

- The Assistant tab has the clearest brand voice. `assistant-home.png` uses typography, copy, and spacing in a way that feels differentiated and intentional.
- Profile is visually mature. `profile-home.png` and `profile-settings.png` show a more complete component system with good grouping and stronger hierarchy.
- Navigation labels are understandable at the tab level. A first-time user can generally infer what each top-level area should do.

## Priority Issues

### [P0] Search is visibly broken on arrival

**Why it matters**: Search is a core acquisition and retention path. If it fails on first exposure, users will not trust the rest of the app.

**Fix**: Replace the raw query/debug payload with a real state model: loading, empty, unavailable, and retry. Never surface internal query keys or `undefined` to users.

### [P1] The assistant’s primary prompt flow does not complete

**Why it matters**: Assistant is one of the app’s strongest brand expressions. If the most attractive entry point goes nowhere, it trains users not to trust CTA affordances.

**Fix**: Make suggested prompts either submit immediately or clearly become editable draft messages with visible send-state feedback.

### [P1] Product content integrity is broken in Notifications

**Why it matters**: Wrong-domain content is a trust failure, not just placeholder copy. It makes the product feel like a template rather than a real travel tool.

**Fix**: Replace all seeded property-rental strings with flight, fare-watch, itinerary, delay, gate, boarding, and booking events consistent with Voyage’s product model.

### [P1] Utility controls are not accessible or self-explanatory

**Why it matters**: Unlabeled icon actions harm VoiceOver users and also weaken confidence for first-timers who do not know what the controls do.

**Fix**: Add accessibility labels, enlarge target clarity, and consider pairing key icons with clearer visual affordances or text where appropriate.

### [P2] The brand weakens sharply outside Assistant/Profile

**Why it matters**: Users experience products as a whole, not tab-by-tab. If half the app feels premium and half feels placeholder, the brand promise collapses.

**Fix**: Rebuild Search, Tracked, and Trips with the same component richness, language quality, and empty-state craft seen in Profile and Assistant.

## Cognitive Load

Checklist result: **3 failures**, which is **moderate cognitive load**.

Observed failures:

- **Single focus**: Search and Assistant both present a primary action without trustworthy feedback when used.
- **Visual hierarchy**: Search is dominated by a raw error payload that hijacks the screen.
- **Progressive disclosure**: Assistant prompt selection changes state without explaining what happens next.

Observed strengths:

- Information is generally grouped well on Profile.
- Top-level navigation stays within working-memory limits.
- Empty states are visually simple, even if they need richer guidance.

## Persona Red Flags

### Jordan (first-timer)

- Search immediately shows a raw internal error instead of a reassuring empty or results state.
- Assistant’s send affordance does not explain whether the suggested prompt is already sent or still draft text.
- Notifications uses a different travel model altogether, which makes the product hard to understand.

### Sam (accessibility-dependent)

- Assistant top-right controls and send action are unlabeled in the accessibility tree.
- Profile utility controls are also unlabeled icon-only groups.
- Broken search state provides no structured recovery control beyond visually parsing an error block.

### Casey (distracted mobile user)

- The assistant flow asks for trust in a one-handed quick action, then gives no response.
- Search failure provides no retry or alternate path, increasing abandonment risk on mobile.
- Several meaningful actions live near the top of the screen while the bottom area is reserved for nav and an inert composer/send state.

## Screen-by-Screen Brand Notes

### `search-error.png`

Off-brand. Typography still hints at Voyage, but the raw payload completely breaks polish and trust.

### `tracked-empty.png`

Functional but generic. The empty state is clean, but it does not carry the same editorial personality as Assistant/Profile.

### `trips-empty.png`

Stronger than Tracked because of the headline, but still feels like a lighter system than the richer profile cards.

### `assistant-home.png`

Most on-brand top-level screen. Strongest expression of the concierge concept.

### `assistant-prompt-selected.png`

Visually elegant but behaviorally unclear. The empty expanse after prompt selection makes the screen feel unfinished.

### `profile-home.png`

Strong. Good structure, useful density, and consistent visual language.

### `profile-settings.png`

Also strong. This is the clearest example of a cohesive, premium component system.

### `notifications-screen.png`

Off-brand because of content, not composition. The structure is serviceable; the domain model is wrong.

### `settings-screen.png`

Clear and readable. Less distinctive than Assistant/Profile, but coherent.

## Fix List

1. Fix the Search tab data flow so the first-screen experience never exposes internal query/debug output.
2. Make assistant prompt chips submit successfully or clearly transition into a draft with visible send/loading states.
3. Add accessibility labels to all icon-only controls, especially Assistant send/menu/plus and Profile utility actions.
4. Replace wrong-domain seeded content in Notifications with flight/trip-specific copy and data.
5. Bring Tracked and Trips empty states up to the same brand/system quality level as Assistant and Profile.
6. Add recovery affordances on broken or empty core flows: retry, edit search, clear query, or ask assistant for help.
