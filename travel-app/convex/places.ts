import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { ensureProfile, ensureProfileQuery, personaArgs } from './users';

export const mySavedPlaces = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const profile = await ensureProfileQuery(ctx, personaKey);
    if (!profile) return [];
    const rows = await ctx.db
      .query('savedPlaces')
      .withIndex('by_user', (q) => q.eq('userId', profile._id))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});

export const savePlace = mutation({
  args: {
    ...personaArgs,
    name: v.string(),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    note: v.optional(v.string()),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, { personaKey, name, city, country, note, emoji }) => {
    if (!name.trim()) throw new Error('Place needs a name.');
    const profile = await ensureProfile(ctx, personaKey);
    const id = await ctx.db.insert('savedPlaces', {
      userId: profile._id,
      name: name.trim(),
      city: city?.trim() || undefined,
      country: country?.trim() || undefined,
      note: note?.trim() || undefined,
      emoji,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const deletePlace = mutation({
  args: { ...personaArgs, id: v.id('savedPlaces') },
  handler: async (ctx, { personaKey, id }) => {
    const profile = await ensureProfile(ctx, personaKey);
    const place = await ctx.db.get(id);
    if (!place || place.userId !== profile._id) return null;
    await ctx.db.delete(id);
    return null;
  },
});
