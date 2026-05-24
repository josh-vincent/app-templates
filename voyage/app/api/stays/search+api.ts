import { searchStays as serverSearchStays } from '@/lib/duffelStays';

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const { city, checkIn, checkOut, guests, rooms } = body ?? {};
  if (!city || !checkIn || !checkOut) {
    return new Response(JSON.stringify({ error: 'city/checkIn/checkOut required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  try {
    const offers = await serverSearchStays({
      city,
      checkIn,
      checkOut,
      guests: Number(guests) || 1,
      rooms: Number(rooms) || 1,
    });
    return new Response(JSON.stringify({ offers }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'search failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
