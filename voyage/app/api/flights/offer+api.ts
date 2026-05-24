import { getOfferById } from '@/lib/duffel';
import { jsonError } from '../_env';

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }
  const id = body?.id;
  if (!id || typeof id !== 'string') return jsonError(400, 'Missing offer id');
  try {
    const offer = await getOfferById(id);
    return Response.json({ offer });
  } catch (e: any) {
    return jsonError(500, e?.message ?? 'Failed to fetch offer');
  }
}
