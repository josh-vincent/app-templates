import { z } from 'zod';
import { searchOffers } from '@/lib/duffel';
import { jsonError } from '../_env';

const schema = z.object({
  origin: z.string().length(3),
  destination: z.string().length(3),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  adults: z.number().int().min(1).max(9).default(1),
  children: z.number().int().min(0).max(9).optional(),
  infants: z.number().int().min(0).max(9).optional(),
  cabin: z.enum(['economy', 'premium_economy', 'business', 'first']).default('economy'),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues.map((i) => i.message).join('; '));
  }
  try {
    const offers = await searchOffers(parsed.data);
    return Response.json({ offers: Array.isArray(offers) ? offers : [] });
  } catch (e: any) {
    return jsonError(500, e?.message ?? 'Flight search failed');
  }
}
