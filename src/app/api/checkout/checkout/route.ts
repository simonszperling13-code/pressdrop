import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: Request) {
  try {
    // --- DETEKTIV START: Wir prüfen den Schlüssel BEVOR es knallt ---
    const secretKey = process.env.STRIPE_SECRET_KEY;

    console.log("\n🚨 --- STRIPE KEY CHECK --- 🚨");
    
    if (!secretKey) {
        console.error("❌ FEHLER: Variable STRIPE_SECRET_KEY ist leer oder nicht gefunden!");
        throw new Error("Stripe Key fehlt in .env.local");
    }

    // Zeige die ersten und letzten 4 Zeichen zur Prüfung (sicher)
    const visibleKey = `${secretKey.substring(0, 8)}...${secretKey.substring(secretKey.length - 4)}`;
    console.log(`ℹ️  Gelesener Key: ${visibleKey}`);
    console.log(`ℹ️  Länge des Keys: ${secretKey.length} Zeichen`);
    
    const startsWithSk = secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_');
    console.log(`ℹ️  Fängt an mit 'sk_test_'? -> ${startsWithSk ? "✅ JA" : "❌ NEIN (Falscher Key-Typ?)"}`);

    const hasWhitespace = secretKey !== secretKey.trim();
    console.log(`ℹ️  Hat Leerzeichen am Anfang/Ende? -> ${hasWhitespace ? "❌ JA (FEHLER!)" : "✅ NEIN"}`);

    // Prüft auf Anführungszeichen, die oft versehentlich mitkopiert werden
    const hasQuotes = secretKey.includes('"') || secretKey.includes("'");
    console.log(`ℹ️  Enthält Anführungszeichen? -> ${hasQuotes ? "❌ JA (FEHLER!)" : "✅ NEIN"}`);

    if (hasWhitespace) {
        console.error("⚠️  LÖSUNG: Lösche die Leerzeichen am Anfang oder Ende der Zeile in .env.local!");
    }
    if (hasQuotes) {
        console.error("⚠️  LÖSUNG: Entferne die Anführungszeichen um den Key in .env.local!");
    }
    
    console.log("🚨 --- CHECK ENDE --- 🚨\n");
    // --- DETEKTIV ENDE ---

    // Jetzt initialisieren wir Stripe (erst hier, mit dem geprüften Key)
    // Wir nutzen .trim() als Sicherheitsnetz, falls du das Leerzeichen noch nicht gelöscht hast
    const stripe = new Stripe(secretKey.trim(), {
      apiVersion: '2025-11-17.clover' as any, 
    });

    // Daten aus dem Frontend holen
    const { videoId, title, price } = await request.json();

    // Session erstellen
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
            unit_amount: price * 100, 
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${request.headers.get('origin')}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin')}?canceled=true`,
      metadata: { videoId },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });

  } catch (err: any) {
    console.error('💥 Stripe Fehler im Detail:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}