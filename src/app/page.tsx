'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { 
  Upload, FileVideo, CheckCircle, AlertCircle, Euro, Type,
  CreditCard, ShieldCheck, Download, FileText, Eye, LogOut, User, Loader2
} from 'lucide-react';

// --- SUPABASE SETUP ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || '', supabaseKey || '');

type ViewState = 'dashboard' | 'upload' | 'processing' | 'share' | 'sales_view' | 'post_purchase';

export default function PressDropApp() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null); // Speichert den eingeloggten User
  const [authLoading, setAuthLoading] = useState(true);

  const [view, setView] = useState<ViewState>('dashboard');
  const [uploading, setUploading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Upload Daten
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('150');
  const [videoId, setVideoId] = useState(''); 
  const [videoUrl, setVideoUrl] = useState('');

  // --- 1. AUTH CHECK (Der Türsteher) ---
  useEffect(() => {
    const checkAuth = async () => {
      // Prüfen, ob eine Session existiert
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setAuthLoading(false);

      // Live-Listener für Login/Logout Änderungen
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });
      return () => subscription.unsubscribe();
    };
    
    checkAuth();
  }, []);

  // --- LOGOUT FUNKTION ---
  const handleLogout = async () => {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
  };

  // --- ZUGRIFFSPRÜFUNG ---
  // Solange wir prüfen: Ladebalken
  if (authLoading) {
      return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-8 h-8"/></div>;
  }

  // Wenn NICHT eingeloggt UND wir sind nicht im öffentlichen Verkaufs-Modus:
  // Zeige Landing Page / Redirect zum Login
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
                onClick={() => router.push('/login')}
                className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 transition-all hover:scale-105 flex items-center"
             >
                 <User className="w-5 h-5 mr-2" />
                 Reporter-Login
             </button>
             <p className="mt-8 text-sm text-slate-400">
                 Sind Sie Redakteur? Nutzen Sie den Link, den Sie erhalten haben.
             </p>
         </div>
     );
  }

  // --- UPLOAD LOGIK (Mit User ID Verknüpfung) ---
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

      // A) Upload (Datei)
      const { error: uploadError } = await supabase.storage
        .from('uploads').upload(fileName, file);
      if (uploadError) throw uploadError;

      // B) Datenbank Eintrag (JETZT MIT USER ID!)
      // Wir holen die User ID aus der Session
      const userId = session?.user?.id;

      if (!userId) throw new Error("Kein User gefunden. Bitte neu einloggen.");

      const { data: dbData, error: dbError } = await supabase
        .from('videos')
        .insert([{ 
            title: title, 
            price: Number(price), 
            filename: fileName,
            status: 'ready',
            user_id: userId // <--- WICHTIG: Hier verknüpfen wir den Upload mit dem User
        }])
        .select().single();

      if (dbError) throw dbError;

      setVideoId(dbData.id);
      setVideoUrl(`${supabaseUrl}/storage/v1/object/public/uploads/${fileName}`);
      setUploading(false);
      setView('share');

    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message);
      setView('upload');
      setUploading(false);
    }
  };

  // --- KAUF LOGIK ---
  const handleRealPurchase = async () => {
    setBuying(true);
    try {
        const { error } = await supabase
            .from('videos').update({ status: 'sold' }).eq('id', videoId);
        if (error) throw error;
        setBuying(false);
        setView('post_purchase');
    } catch (error: any) {
        alert(error.message);
        setBuying(false);
    }
  };

  // --- VIEWS (Reporter Dashboard mit Logout) ---
  const ReporterDashboard = () => (
    <div className="max-w-4xl mx-auto p-6 font-sans">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <FileVideo className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-bold text-slate-900">PressDrop</span>
        </div>
        
        {/* User Info & Logout */}
        <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500">Angemeldet als</p>
                <p className="font-bold text-slate-800 text-sm">{session?.user?.email}</p>
            </div>
            <button 
                onClick={handleLogout} 
                className="p-2 hover:bg-slate-200 rounded-full text-slate-600 transition-colors" 
                title="Ausloggen"
            >
                <LogOut className="w-5 h-5" />
            </button>
        </div>
      </header>

      <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-8 rounded-2xl shadow-lg mb-8">
        <h2 className="text-2xl font-bold mb-2">Willkommen zurück!</h2>
        <p className="text-blue-100 mb-6">Lade neues Material hoch. Es wird sicher in deinem Account gespeichert.</p>
        <button 
            onClick={startUpload} 
            className="bg-white text-blue-600 font-bold py-3 px-6 rounded-xl flex items-center shadow-md hover:bg-blue-50 hover:scale-105 transition-transform"
        >
          <Upload className="w-5 h-5 mr-2" /> Upload starten
        </button>
      </div>
    </div>
  );

  const UploadScreen = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Details eingeben</h2>
        {errorMessage && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center"><AlertCircle className="w-4 h-4 mr-2"/>{errorMessage}</div>}
        
        <div className="space-y-4 mb-6">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titel</label>
                <div className="relative">
                    <Type className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                    <input type="text" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="z.B. Unfall A1" className="w-full pl-10 p-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Preis (€)</label>
                <div className="relative">
                    <Euro className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                    <input type="number" value={price} onChange={(e)=>setPrice(e.target.value)} className="w-full pl-10 p-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
            </div>
        </div>
        
        <div className="relative border-2 border-dashed border-blue-200 rounded-2xl p-8 bg-blue-50/50 hover:bg-blue-50 transition-colors text-center cursor-pointer group">
          <input type="file" onChange={handleRealUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <p className="font-medium text-blue-600">Datei wählen & Hochladen</p>
        </div>
        <button onClick={()=>setView('dashboard')} className="w-full mt-4 text-slate-400 hover:text-slate-600">Abbrechen</button>
      </div>
    </div>
  );

  const ProcessingScreen = () => (
    <div className="min-h-screen flex flex-col items-center justify-center font-sans bg-slate-50">
        <Loader2 className="animate-spin w-12 h-12 text-blue-600 mb-4"/>
        <p className="text-slate-600 font-medium">Lade hoch und speichere...</p>
    </div>
  );

  const ShareScreen = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4"/>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Online!</h2>
        <p className="text-slate-500 mb-6">Dein Material ist sicher gespeichert.</p>
        <button onClick={()=>setView('sales_view')} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors">
            <Eye className="w-4 h-4 mr-2"/> Zur Redaktions-Ansicht
        </button>
        <button onClick={()=>setView('dashboard')} className="mt-4 text-slate-400 hover:text-slate-600 text-sm">Zurück zum Dashboard</button>
      </div>
    </div>
  );

  const SalesPage = () => (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
             <div className="bg-white border-b border-slate-100 p-4 flex justify-between items-center">
                 <span className="font-bold text-slate-800">PressDrop <span className="bg-slate-100 text-slate-500 px-1.5 rounded text-xs ml-1 font-normal">MARKETPLACE</span></span>
                 <button onClick={()=>setView('dashboard')} className="text-xs text-slate-400 hover:text-slate-600">Exit Preview</button>
            </div>
             <div className="bg-black aspect-video relative flex items-center justify-center">
                {videoUrl ? <video src={videoUrl} className="w-full h-full object-contain" controls /> : <div className="text-white">Lade Video...</div>}
             </div>
             <div className="p-8 flex flex-col md:flex-row justify-between items-start gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
                    <div className="flex items-center space-x-2 text-sm text-slate-500">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold text-xs">EXKLUSIV</span>
                        <span>• 4K Source</span>
                    </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 min-w-[280px] shadow-sm">
                    <p className="text-slate-500 text-sm mb-1">Preis</p>
                    <p className="text-3xl font-bold text-slate-900 mb-4">{price} €</p>
                    <button 
                        onClick={handleRealPurchase} 
                        disabled={buying} 
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center transition-colors"
                    >
                        {buying ? '...' : <><CreditCard className="w-4 h-4 mr-2"/> Lizenz Kaufen</>}
                    </button>
                </div>
             </div>
        </div>
    </div>
  );

  const PostPurchaseScreen = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl border-t-4 border-green-500">
        <Download className="w-16 h-16 text-green-600 mx-auto mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Kauf erfolgreich!</h2>
        <p className="text-slate-500 mb-6">Vielen Dank.</p>
        <a href={videoUrl} download className="flex items-center justify-center bg-slate-900 text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-800 mb-4 transition-colors">
            <Download className="w-4 h-4 mr-2"/> Original laden
        </a>
        <button onClick={()=>setView('dashboard')} className="block mt-4 w-full text-slate-400 hover:text-slate-600 text-sm">Zurück</button>
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