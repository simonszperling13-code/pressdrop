import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    // Wir erstellen einen kurzzeitigen Supabase Client für den Austausch
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Wir tauschen den Code aus der E-Mail gegen eine echte Session
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Danach leiten wir den User auf die Startseite (Dashboard) zurück
  return NextResponse.redirect(requestUrl.origin);
}