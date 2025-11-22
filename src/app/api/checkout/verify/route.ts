import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-11-17.clover',
});

// Wir brauchen hier einen Supabase Client mit Admin-Rechten (Service Role),
// um den Status zu ändern, auch wenn kein User eingeloggt ist (Server-zu-Server).
// Da wir keine Service Role in .env haben (aus Sicherheitsgründen beim MVP),
// nutzen wir den Anon-Key. Das funktioniert, solange die RLS Policies "Update" erlauben.
// Für einen echten Prod-Build würdest du hier den SERVICE_ROLE_KEY nutzen.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  const { sessionId } = await request.json();

  try {
    // 1. Frage Stripe: Wie ist der Status dieser Session?
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const videoId = session.metadata?.videoId;

      if (!videoId) throw new Error('Keine Video ID in der Zahlung gefunden');

      // 2. Update Datenbank: Status auf 'sold' setzen
      const { error } = await supabase
        .from('videos')
        .update({ status: 'sold' })
        .eq('id', videoId);

      if (error) throw error;

      return NextResponse.json({ success: true, videoId });
    } else {
      return NextResponse.json({ success: false, error: 'Nicht bezahlt' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}