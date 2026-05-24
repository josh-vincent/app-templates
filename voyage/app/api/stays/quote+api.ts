import { getStayById } from '@/lib/duffelStays';

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
  const { id } = body ?? {};
  if (!id || typeof id !== 'string') {
    return new Response(JSON.stringify({ error: 'id (string) required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  try {
    const offer = await getStayById(id);
    if (!offer) {
      return new Response(JSON.stringify({ error: 'stay not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ offer }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'quote failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
