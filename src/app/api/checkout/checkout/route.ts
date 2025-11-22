import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover', // Oder die aktuellste Version, die VS Code vorschlägt
});

export async function POST(request: Request) {
  try {
    const { videoId, title, price } = await request.json();

    // Wir erstellen eine "Kassenzettel" Session bei Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: title,
              description: `Exklusive Lizenz für Video ID: ${videoId}`,
            },
            unit_amount: price * 100, // Stripe rechnet in Cent! (150€ = 15000 Cent)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Wohin soll der User nach der Zahlung?
      // Wir hängen die Session ID an, um sie später zu prüfen
      success_url: `${request.headers.get('origin')}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin')}?canceled=true`,
      metadata: {
        videoId: videoId, // Wir merken uns hier, welches Video gekauft wurde
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}