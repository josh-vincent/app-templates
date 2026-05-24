import { z } from 'zod';
import { createOrder } from '@/lib/duffel';
import { jsonError } from '../_env';

const passengerSchema = z.object({
  id: z.string(),
  type: z.enum(['adult', 'child', 'infant_without_seat']),
  title: z.string(),
  given_name: z.string(),
  family_name: z.string(),
  born_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email: z.string().email(),
  phone_number: z.string(),
  gender: z.enum(['m', 'f']),
});

const schema = z.object({
  offerId: z.string(),
  amount: z.string(),
  currency: z.string(),
  passengers: z.array(passengerSchema).min(1),
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
    const order = await createOrder(parsed.data);
    return Response.json({ order });
  } catch (e: any) {
    return jsonError(500, e?.message ?? 'Order creation failed');
  }
}
