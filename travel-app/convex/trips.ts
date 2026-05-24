import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { ensureProfile, ensureProfileQuery, personaArgs } from './users';

// Helpers --------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function daysBetween(startMs: number, endMs: number): number {
  // Inclusive day count (a one-day trip starts and ends on the same day).
  const d = Math.max(0, Math.floor((endMs - startMs) / MS_PER_DAY));
  return d + 1;
}

// Queries --------------------------------------------------------------

export const myTrips = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const profile = await ensureProfileQuery(ctx, personaKey);
    if (!profile) return [];
    const rows = await ctx.db
      .query('trips')
      .withIndex('by_user_starts', (q) => q.eq('userId', profile._id))
      .collect();
    // Sort: upcoming/current first by startsAt asc, then past by startsAt desc.
    const now = Date.now();
    const upcoming = rows
      .filter((r) => r.endsAt >= now)
      .sort((a, b) => a.startsAt - b.startsAt);
    const past = rows
      .filter((r) => r.endsAt < now)
      .sort((a, b) => b.startsAt - a.startsAt);
    return [...upcoming, ...past];
  },
});

export const tripDetail = query({
  args: { ...personaArgs, id: v.id('trips') },
  handler: async (ctx, { personaKey, id }) => {
    const profile = await ensureProfileQuery(ctx, personaKey);
    if (!profile) return null;
    const trip = await ctx.db.get(id);
    if (!trip || trip.userId !== profile._id) return null;
    const days = await ctx.db
      .query('tripDays')
      .withIndex('by_trip_day', (q) => q.eq('tripId', id))
      .collect();
    days.sort((a, b) => a.dayIndex - b.dayIndex);
    return { trip, days };
  },
});

// Mutations ------------------------------------------------------------

export const createTrip = mutation({
  args: {
    ...personaArgs,
    title: v.string(),
    destination: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    travelerCount: v.number(),
    coverEmoji: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { personaKey, title, destination, startsAt, endsAt, travelerCount, coverEmoji, notes }
  ) => {
    if (!title.trim()) throw new Error('Trip needs a title.');
    if (!destination.trim()) throw new Error('Trip needs a destination.');
    if (endsAt < startsAt) throw new Error('End date must be on or after the start date.');
    if (travelerCount < 1) throw new Error('Need at least one traveler.');

    const profile = await ensureProfile(ctx, personaKey);
    const tripId = await ctx.db.insert('trips', {
      userId: profile._id,
      title: title.trim(),
      destination: destination.trim(),
      startsAt,
      endsAt,
      travelerCount,
      coverEmoji,
      notes,
      createdAt: Date.now(),
    });

    // Seed a blank day per calendar day in range.
    const count = daysBetween(startsAt, endsAt);
    for (let i = 0; i < count; i++) {
      const dayMs = startsAt + i * MS_PER_DAY;
      await ctx.db.insert('tripDays', {
        tripId,
        userId: profile._id,
        dayIndex: i,
        date: isoDate(dayMs),
        activities: [],
      });
    }
    return tripId;
  },
});

export const addActivity = mutation({
  args: {
    ...personaArgs,
    tripId: v.id('trips'),
    dayIndex: v.number(),
    label: v.string(),
    time: v.optional(v.string()),
    location: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { personaKey, tripId, dayIndex, label, time, location, icon }
  ) => {
    if (!label.trim()) throw new Error('Activity needs a label.');
    const profile = await ensureProfile(ctx, personaKey);
    const trip = await ctx.db.get(tripId);
    if (!trip || trip.userId !== profile._id) throw new Error('Trip not found.');
    const day = await ctx.db
      .query('tripDays')
      .withIndex('by_trip_day', (q) =>
        q.eq('tripId', tripId).eq('dayIndex', dayIndex)
      )
      .first();
    if (!day) throw new Error('Day not found.');
    await ctx.db.patch(day._id, {
      activities: [
        ...day.activities,
        { label: label.trim(), time, location, icon },
      ],
    });
    return null;
  },
});

export const deleteTrip = mutation({
  args: { ...personaArgs, id: v.id('trips') },
  handler: async (ctx, { personaKey, id }) => {
    const profile = await ensureProfile(ctx, personaKey);
    const trip = await ctx.db.get(id);
    if (!trip || trip.userId !== profile._id) return null;
    const days = await ctx.db
      .query('tripDays')
      .withIndex('by_trip', (q) => q.eq('tripId', id))
      .collect();
    for (const d of days) await ctx.db.delete(d._id);
    await ctx.db.delete(id);
    return null;
  },
});
