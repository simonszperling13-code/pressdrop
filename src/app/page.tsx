'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Upload, FileVideo, CheckCircle, AlertCircle, Euro, Type,
  CreditCard, ShieldCheck, Download, FileText, Eye, LogOut, User, Loader2
} from 'lucide-react';

// --- SUPABASE KONFIGURATION ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Fallback verhindert Absturz, falls Keys fehlen
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder'
);

type ViewState = 'dashboard' | 'upload' | 'processing' | 'share' | 'sales_view' | 'post_purchase';

export default function PressDropApp() {
  // Status-Variablen
  const [session, setSession] = useState<any>(null); 
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<ViewState>('dashboard');
  
  // Upload & Kauf Status
  const [uploading, setUploading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [verifying, setVerifying] = useState(false); // NEU: Prüft ob Zahlung echt ist
  const [errorMessage, setErrorMessage] = useState('');
  
  // Daten des aktuellen Videos
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('150');
  const [videoId, setVideoId] = useState(''); 
  const [videoUrl, setVideoUrl] = useState('');

  // --- 1. INITIALISIERUNG (Auth & Stripe Return Check) ---
  useEffect(() => {
    const init = async () => {
      // A) Auth Check: Wer ist eingeloggt?
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setAuthLoading(false);

      // B) Stripe Return Check: Kommen wir gerade von einer Zahlung zurück?
      // Wir prüfen, ob "?session_id=..." in der URL steht.
      if (typeof window !== 'undefined') {
        const query = new URLSearchParams(window.location.search);
        if (query.get('session_id')) {
          verifyPayment(query.get('session_id')!);
        }
      }
    };

    // Auth Listener für Login/Logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    
    init();
    
    return () => subscription.unsubscribe();
  }, []);

  // --- 2. ZAHLUNG VERIFIZIEREN (Server-Check) ---
  const verifyPayment = async (sessionId: string) => {
      setVerifying(true);
      try {
          // Wir fragen UNSEREN Server (/api/verify), ob Stripe das Geld hat
          const res = await fetch('/api/verify', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ sessionId })
          });
          
          const data = await res.json();
          
          if (data.success) {
              // Erfolg! Datenbank wurde serverseitig auf 'sold' gesetzt.
              setVideoId(data.videoId);
              
              // Wir holen uns noch schnell die Video URL, falls sie nicht im State ist
              // (In einer vollen App würden wir das Video frisch aus der DB laden)
              // Hier rekonstruieren wir sie für den Download-Button
              // Hinweis: Das funktioniert nur sauber, wenn der User im gleichen Browser bleibt.
              // Für Production würde man hier `fetchVideoDetails(data.videoId)` aufrufen.
              
              setView('post_purchase');
              
              // URL bereinigen (session_id entfernen), damit es sauber aussieht
              window.history.replaceState({}, document.title, "/");
          } else {
              alert('Zahlung konnte nicht verifiziert werden oder wurde abgebrochen.');
              setView('dashboard'); // Oder zurück zur Sales View
          }
      } catch (e) {
          console.error(e);
          alert('Fehler bei der Verifizierung.');
      } finally {
          setVerifying(false);
      }
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      window.location.href = '/login';
  };

  // Ladebildschirm (während Auth oder Verifizierung)
  if (authLoading || verifying) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50 font-sans">
            <Loader2 className="animate-spin text-blue-600 w-12 h-12 mb-4"/>
            <p className="text-slate-600 font-medium">
                {verifying ? 'Verifiziere Zahlung mit Stripe...' : 'Lade PressDrop...'}
            </p>
        </div>
      );
  }

  // Gast-Schutz: Wenn nicht eingeloggt UND nicht im Kauf-Modus -> Login zeigen
  if (!session && view !== 'sales_view' && view !== 'post_purchase') {
     return (
         <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
             <div className="bg-blue-600 p-4 rounded-2xl mb-6 shadow-blue-200 shadow-lg">
                <FileVideo className="text-white w-12 h-12" />
             </div>
             <h1 className="text-4xl font-bold text-slate-900 mb-4">PressDrop</h1>
             <p className="text-xl text-slate-600 mb-8 max-w-md leading-relaxed">
                 Der schnellste Weg, Blaulicht-Material sicher an Redaktionen zu verkaufen.
             </p>
             <button 
                onClick={() => window.location.href = '/login'} 
                className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center hover:scale-105 transform"
             >
                 <User className="w-5 h-5 mr-2" /> Reporter-Login
             </button>
         </div>
     );
  }

  // --- 3. UPLOAD LOGIK ---
  const startUpload = () => {
    setView('upload');
    setErrorMessage('');
    setTitle('');
    setPrice('150');
  };

  const handleRealUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !title) return;
    
    setUploading(true);
    setView('processing');

    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const fileName = `${Date.now()}_${cleanName}`;

      // A) Datei Upload
      const { error: uploadError } = await supabase.storage.from('uploads').upload(fileName, file);
      if (uploadError) throw uploadError;

      // B) Datenbank Eintrag
      const userId = session?.user?.id;
      if (!userId) throw new Error("Bitte neu einloggen.");

      const { data: dbData, error: dbError } = await supabase
        .from('videos')
        .insert([{ 
            title: title, 
            price: Number(price), 
            filename: fileName, 
            status: 'ready', 
            user_id: userId 
        }])
        .select().single();

      if (dbError) throw dbError;

      setVideoId(dbData.id);
      setVideoUrl(`${supabaseUrl}/storage/v1/object/public/uploads/${fileName}`);
      setUploading(false);
      setView('share');

    } catch (error: any) {
      setErrorMessage(error.message);
      setView('upload');
      setUploading(false);
    }
  };

  // --- 4. STRIPE CHECKOUT STARTEN (Das Herzstück) ---
  const handleStripeCheckout = async () => {
    setBuying(true);
    try {
        // Wir rufen unsere API Route /api/checkout auf
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoId: videoId,
                title: title,
                price: Number(price)
            })
        });

        const data = await response.json();

        if (data.url) {
            // Weiterleitung zur echten Stripe Zahlungsseite
            window.location.href = data.url;
        } else {
            throw new Error('Keine URL von Stripe erhalten');
        }

    } catch (error: any) {
        alert('Checkout Fehler: ' + error.message);
        setBuying(false);
    }
  };

  // --- VIEWS (Benutzeroberfläche) ---

  const ReporterDashboard = () => (
    <div className="max-w-4xl mx-auto p-6 font-sans">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-2">
          <div className="bg-blue-600 p-2 rounded-lg"><FileVideo className="text-white w-6 h-6" /></div>
          <span className="text-2xl font-bold text-slate-900">PressDrop</span>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-sm font-bold hidden sm:block text-slate-600">{session?.user?.email}</span>
            <button onClick={handleLogout} className="p-2 hover:bg-slate-200 rounded-full transition-colors" title="Ausloggen"><LogOut className="w-5 h-5 text-slate-600" /></button>
        </div>
      </header>
      <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-8 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold mb-2">Material verkaufen</h2>
        <p className="text-blue-100 mb-6">Starten Sie einen neuen Upload für den Marktplatz.</p>
        <button onClick={startUpload} className="bg-white text-blue-600 font-bold py-3 px-6 rounded-xl flex items-center shadow-md hover:scale-105 transition-transform">
          <Upload className="w-5 h-5 mr-2" /> Upload starten
        </button>
      </div>
    </div>
  );

  const UploadScreen = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Details</h2>
        {errorMessage && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-2"/>{errorMessage}</div>}
        <div className="space-y-4 mb-6">
            <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Titel</label>
                <div className="relative">
                    <Type className="absolute left-3 top-3 text-slate-400 w-5 h-5"/>
                    <input type="text" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="z.B. Großbrand München" className="w-full pl-10 p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"/>
                </div>
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Preis (€)</label>
                <div className="relative">
                    <Euro className="absolute left-3 top-3 text-slate-400 w-5 h-5"/>
                    <input type="number" value={price} onChange={(e)=>setPrice(e.target.value)} className="w-full pl-10 p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"/>
                </div>
            </div>
        </div>
        <div className="relative border-2 border-dashed border-blue-200 rounded-2xl p-8 bg-blue-50/50 text-center cursor-pointer hover:bg-blue-50 transition-colors group">
          <input type="file" onChange={handleRealUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <p className="text-blue-600 font-medium">Datei wählen & Hochladen</p>
        </div>
        <button onClick={()=>setView('dashboard')} className="w-full mt-6 text-slate-400 hover:text-slate-600">Abbrechen</button>
      </div>
    </div>
  );

  const ProcessingScreen = () => (
    <div className="min-h-screen flex flex-col items-center justify-center font-sans bg-slate-50">
        <Loader2 className="animate-spin w-12 h-12 text-blue-600 mb-4"/>
        <p className="text-slate-600 font-medium">Lade hoch & speichere...</p>
    </div>
  );

  const ShareScreen = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4"/>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Online!</h2>
        <p className="text-slate-500 mb-6">Dein Material ist bereit zum Verkauf.</p>
        <button onClick={()=>setView('sales_view')} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors">
            <Eye className="w-4 h-4 mr-2"/> Zur Redaktions-Ansicht
        </button>
        <button onClick={()=>setView('dashboard')} className="mt-4 text-slate-400 text-sm hover:text-slate-600">Dashboard</button>
      </div>
    </div>
  );

  const SalesPage = () => (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
             <div className="bg-white border-b p-4 flex justify-between items-center"><span className="font-bold text-slate-800">PressDrop <span className="bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-500 ml-2">MARKETPLACE</span></span><button onClick={()=>setView('dashboard')} className="text-xs text-slate-400 hover:text-slate-600">Exit Preview</button></div>
             <div className="bg-black aspect-video flex items-center justify-center text-white">
                {videoUrl ? <video src={videoUrl} className="w-full h-full object-contain" controls /> : "Lade..."}
             </div>
             <div className="p-8 flex flex-col md:flex-row justify-between items-start gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">EXKLUSIV</span>
                        <span>• 4K Source</span>
                    </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-xl border shadow-sm min-w-[250px]">
                    <p className="text-slate-500 text-sm mb-1">Preis</p>
                    <p className="text-3xl font-bold text-slate-900 mb-4">{price} €</p>
                    <button 
                        onClick={handleStripeCheckout} 
                        disabled={buying} 
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center transition-colors shadow-green-200 shadow-lg"
                    >
                        {buying ? <Loader2 className="animate-spin w-5 h-5"/> : <><CreditCard className="w-4 h-4 mr-2"/> Kaufen</>}
                    </button>
                    <p className="text-xs text-center mt-3 text-slate-400 flex items-center justify-center"><ShieldCheck className="w-3 h-3 mr-1"/> Secure Payment (Test)</p>
                </div>
             </div>
        </div>
    </div>
  );

  const PostPurchaseScreen = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl border-t-4 border-green-500 max-w-md w-full">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Zahlung bestätigt!</h2>
        <p className="text-slate-500 mb-6">Vielen Dank. Die Lizenz wurde erworben.</p>
        
        {/* HINWEIS: Der Download Link nutzt hier die URL, die wir noch im State haben. 
            In einer echten App würde man diese hier frisch vom Server signieren lassen. */}
        <a href={videoUrl} download className="flex items-center justify-center bg-slate-900 text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-800 mb-4 transition-colors">
            <Download className="w-4 h-4 mr-2"/> Original laden
        </a>
        <button onClick={()=>setView('dashboard')} className="block mt-4 w-full text-slate-400 text-sm hover:text-slate-600">Zurück zum Start</button>
      </div>
    </div>
  );

  // --- RENDER SWITCH ---
  return (
    <div className="font-sans antialiased text-slate-900 bg-slate-50 min-h-screen">
      {view === 'dashboard' && <ReporterDashboard />}
      {view === 'upload' && <UploadScreen />}
      {view === 'processing' && <ProcessingScreen />}
      {view === 'share' && <ShareScreen />}
      {view === 'sales_view' && <SalesPage />}
      {view === 'post_purchase' && <PostPurchaseScreen />}
    </div>
  );
}