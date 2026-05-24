import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { buildTools, type VoyageContext } from '@/lib/chatTools/registry';
import type {
  TripSummary,
  WatchedRouteSummary,
  CalendarEventSummary,
  CalendarAccess,
  TravelerProfileSummary,
} from '@/lib/chatTools/types';
import {
  getGatewayModel,
  getNimBaseUrl,
  getNimModel,
  jsonError,
  tryGatewayKey,
  tryNimKey,
} from './_env';

const BASE_SYSTEM_PROMPT = `You are Voyage — a personal holiday concierge, not a generic booking tool.
Voice: warm, concise, quietly excited about travel. Use short sentences and Markdown (**bold**, lists) to make things scannable on mobile.

How you help:
- Finding good-value flights, weekend escapes, beach resets, and city breaks.
- Watching prices so the user doesn't have to refresh.
- Drafting loose itineraries, things to do, packing ideas.

Behaviour rules:
- Before reasoning about any "tomorrow / next week / this month" reference, call currentDateTime so you're grounded.
- When the user omits an origin, call userLocation to pick up their home airport before searchFlights.
- For flights, always call searchFlights — don't guess prices.
- For "watch", "track", "alert me", "let me know if it drops", call trackPrice. If you just ran searchFlights and have a price in hand, pass lastPrice and currency to trackPrice so the user can save it in one tap.
- When the user references a trip they already booked ("my LA flight", "open my Tokyo trip", "when does my next one leave"), call openTrip. Use the booking references in the context when you know them.
- For "what should I do in X" or "ideas for Y", call thingsToDo.
- For packing / weather questions, call weatherAt.
- For "do I need a visa / adapter / what currency", call countryInfo.
- For multi-day plans, call planItinerary.
- When the user says "add to calendar", "save to my calendar", or has just booked/planned something concrete — call addToCalendar with proper ISO start/end times. For flights, create one event per leg titled like "Flight: JFK → NRT (JL5)". For itinerary days, create one all-day event per day. Always include a sensible end time (flights: use arrival time; activities: +2h; all-day: same day).
- For "when am I free", "any gaps", "squeeze in a trip", "plan around my schedule" — call findCalendarGaps. Then feel free to chain into searchFlights for the gap you pick.
- For "public holiday", "bank holiday", "long weekend", "day off to extend" — call publicHolidays. If the user wants a long weekend, pass longWeekendsOnly: true; cross-reference with findCalendarGaps if you need to confirm they're free, and chain into searchFlights to propose an escape.
- You may call several tools in sequence — it's fine.
- Summarise offers by airline, price, stops, and depart time — never dump raw JSON.
- Keep each reply under ~5 short lines unless the user wants depth.
- Dates are ISO YYYY-MM-DD.
- When the user adds a passenger to a booking, default to their saved name + DOB + contact + passport — don't ask again unless they change traveler. The user is identified by "Traveler preferences" in the context below.
- When picking ancillaries (seat, bag, meal), default to the user's saved preferences unless they explicitly override.
- If the user mentions dietary needs ("I'm vegetarian"), confirm against their stored dietary codes — don't ask twice.
- For "find me a hotel", "somewhere to stay", "accommodation in X" — call searchStays, then reserveStay to take the user to the reservation flow.
- Before suggesting an activity or itinerary slot, call getTrip or listMySavedDestinations to see what the user already has — avoid duplicates.
- When the user wants to add something concrete to a specific trip day, call proposeAddToItinerary — it returns a deep-link the user can tap.
- When the user mentions changing profile fields ("I'm vegan now", "new passport", "Star Alliance Gold"), call updateMyProfile with the right section so the editor opens focused there.
- For "add my partner / travel buddy", call addCompanion.
- For currency conversion in casual questions ("is X a lot to spend in Tokyo"), call convertCurrency. The rates are cached, not live — say so.
- For distance / travel-time questions ("how far is my hotel from the airport"), call distanceBetween.
- For nearby lookups, call findNearby — it returns category suggestions, not live POI.`;

function buildContextSuffix(ctx: {
  travelerProfile?: TravelerProfileSummary;
  upcomingTrips?: TripSummary[];
  watchedRoutes?: WatchedRouteSummary[];
  calendarAccess?: CalendarAccess;
  calendarRange?: { start: string; end: string };
  calendarEvents?: CalendarEventSummary[];
  countryCode?: string;
}): string {
  const lines: string[] = [];
  if (ctx.travelerProfile) {
    const p = ctx.travelerProfile;
    lines.push('Traveler preferences:');
    const name = [p.givenName, p.familyName].filter(Boolean).join(' ');
    if (name) lines.push(`- Name: ${name} (default lead passenger)`);
    const ancillaries: string[] = [];
    if (p.preferredCabin) ancillaries.push(`${p.preferredCabin} preferred`);
    if (p.seatPreference) ancillaries.push(`${p.seatPreference} seat`);
    if (p.bagPreference) ancillaries.push(p.bagPreference);
    if (ancillaries.length) lines.push(`- Cabin: ${ancillaries.join(' · ')}`);
    if (p.dietary?.length) lines.push(`- Dietary: ${p.dietary.join(', ')} (AVML on flights)`);
    const docParts: string[] = [];
    if (p.hasPassport && p.passportCountry) docParts.push(p.passportCountry);
    if (p.knownTravellerNumber) docParts.push(`KTN ${p.knownTravellerNumber}`);
    if (docParts.length) lines.push(`- Passport: ${docParts.join(' · ')}`);
    if (p.frequentFlyers?.length) {
      const ffStr = p.frequentFlyers
        .map((ff) => `${ff.carrierName}${ff.tier ? ` (${ff.tier.charAt(0).toUpperCase() + ff.tier.slice(1)})` : ''}`)
        .join(', ');
      lines.push(`- Frequent flyer: ${ffStr}`);
    }
    const savedParts: string[] = [];
    if (p.savedActivityCount != null && p.savedActivityCount > 0)
      savedParts.push(`${p.savedActivityCount} saved activities`);
    if (p.savedStayCount != null && p.savedStayCount > 0)
      savedParts.push(`${p.savedStayCount} saved stays`);
    if (savedParts.length) lines.push(`- ${savedParts.join(' · ')}`);
  }
  if (ctx.upcomingTrips?.length) {
    lines.push('Known upcoming trips (use these for openTrip):');
    for (const t of ctx.upcomingTrips.slice(0, 6)) {
      const date = t.departingAt?.slice(0, 10);
      const flight = [t.carrierName, t.flightNumber].filter(Boolean).join(' ');
      lines.push(
        `- ${t.bookingReference} · ${t.origin}→${t.destination} · ${date ?? 'TBD'}${flight ? ` · ${flight}` : ''}`
      );
    }
  }
  if (ctx.watchedRoutes?.length) {
    lines.push('Routes the user is already watching:');
    for (const r of ctx.watchedRoutes.slice(0, 6)) {
      lines.push(
        `- ${r.origin}→${r.destination} · ${r.departureDate}${r.returnDate ? `–${r.returnDate}` : ''} · ${r.currency} ${Math.round(r.lastPrice)}`
      );
    }
  }
  if (ctx.calendarAccess === 'granted') {
    const n = ctx.calendarEvents?.length ?? 0;
    const r = ctx.calendarRange;
    lines.push(
      `Calendar access: granted · ${n} event${n === 1 ? '' : 's'} loaded${r ? ` (${r.start} → ${r.end})` : ''}. Use findCalendarGaps when gaps are relevant.`
    );
  } else if (ctx.calendarAccess === 'denied') {
    lines.push(
      'Calendar access: denied — findCalendarGaps will return an access-denied result; ask the user to enable it in Settings.'
    );
  }
  if (ctx.countryCode) {
    lines.push(`User country (for publicHolidays default): ${ctx.countryCode}`);
  }
  return lines.length ? `\n\nUser state:\n${lines.join('\n')}` : '';
}

type IncomingBody = {
  messages?: UIMessage[];
  userContext?: {
    homeAirport?: string;
    timezone?: string;
    coords?: { lat: number; lon: number };
    countryCode?: string;
    city?: string;
    locale?: string;
    travelerProfile?: TravelerProfileSummary;
    upcomingTrips?: TripSummary[];
    watchedRoutes?: WatchedRouteSummary[];
    calendarAccess?: CalendarAccess;
    calendarEvents?: CalendarEventSummary[];
    calendarRange?: { start: string; end: string };
  };
};

export async function POST(request: Request) {
  let body: IncomingBody;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }
  if (!Array.isArray(body.messages)) {
    return jsonError(400, 'messages[] required');
  }

  const ctx: VoyageContext = {
    now: new Date(),
    homeAirport: body.userContext?.homeAirport,
    timezone: body.userContext?.timezone,
    coords: body.userContext?.coords,
    countryCode: body.userContext?.countryCode,
    city: body.userContext?.city,
    locale: body.userContext?.locale,
    travelerProfile: body.userContext?.travelerProfile,
    upcomingTrips: body.userContext?.upcomingTrips,
    watchedRoutes: body.userContext?.watchedRoutes,
    calendarAccess: body.userContext?.calendarAccess,
    calendarEvents: body.userContext?.calendarEvents,
    calendarRange: body.userContext?.calendarRange,
  };

  const system = BASE_SYSTEM_PROMPT + buildContextSuffix(ctx);

  // 1. Preferred: Vercel AI Gateway (full tool calling).
  const gatewayKey = tryGatewayKey();
  if (gatewayKey) {
    process.env.AI_GATEWAY_API_KEY = gatewayKey;
    try {
      const result = streamText({
        model: getGatewayModel(),
        system,
        messages: convertToModelMessages(body.messages),
        tools: buildTools(ctx),
        stopWhen: stepCountIs(8),
      });
      return result.toUIMessageStreamResponse();
    } catch (e: any) {
      // Fall through to NIM / local on gateway runtime failure.
      console.warn('[chat] Gateway streamText failed, trying NIM fallback:', e?.message);
    }
  }

  // 2. Fallback: NVIDIA NIM via @ai-sdk/openai-compatible. NIM exposes
  //    an OpenAI-compatible chat-completions endpoint, so the same
  //    streamText + UIMessage + tool-calling pipeline works as the
  //    Gateway path. Reference:
  //    https://ai-sdk.dev/providers/openai-compatible-providers/nim
  const nimKey = tryNimKey();
  if (nimKey) {
    try {
      const nim = createOpenAICompatible({
        name: 'nim',
        baseURL: getNimBaseUrl(),
        headers: { Authorization: `Bearer ${nimKey}` },
      });
      const result = streamText({
        model: nim(getNimModel()),
        system,
        messages: convertToModelMessages(body.messages),
        tools: buildTools(ctx),
        stopWhen: stepCountIs(8),
      });
      return result.toUIMessageStreamResponse();
    } catch (e: any) {
      console.warn('[chat] NIM streamText failed, returning local-first stub:', e?.message);
    }
  }

  // 3. Final fallback: hard-coded local-first stub.
  if ((process.env.EXPO_PUBLIC_VOYAGE_LOCAL_FIRST ?? 'true') !== 'false') {
    return localFirstChatResponse();
  }
  return jsonError(500, 'No chat backend configured (set AI_GATEWAY_API_KEY or NVIDIA_NIM_API_KEY)');
}

function localFirstChatResponse() {
  const text =
    process.env.NODE_ENV !== 'production'
      ? "I'm running in local-first mode. Add either `AI_GATEWAY_API_KEY` (Vercel AI Gateway · full tool calling) or `NVIDIA_NIM_API_KEY` (free NIM inference, OpenAI-compatible — also full tool calling) to `.env` for live concierge responses."
      : "The concierge is taking a moment — I'll have an answer shortly. (Hint: check back later when prices refresh.)";
  const stream = createUIMessageStream({
    execute({ writer }) {
      const id = `local_${Date.now()}`;
      writer.write({ type: 'text-start', id });
      writer.write({ type: 'text-delta', id, delta: text });
      writer.write({ type: 'text-end', id });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
