'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Upload, 
  FileVideo, 
  CheckCircle, 
  Lock, 
  AlertCircle,
  Euro,
  Type,
  CreditCard,
  ShieldCheck,
  Play,
  Download,
  FileText,
  Eye
} from 'lucide-react';

// --- SUPABASE SETUP ---
// Wir initialisieren Supabase direkt hier, um Import-Fehler zu vermeiden
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Fallback: Verhindert weißen Bildschirm, falls Keys fehlen
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder-key'
);

// --- TYPEN ---
type ViewState = 'dashboard' | 'upload' | 'processing' | 'share' | 'sales_view' | 'post_purchase';

export default function PressDropApp() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [uploading, setUploading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Daten des aktuellen Videos
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('150');
  const [videoId, setVideoId] = useState(''); 
  const [videoUrl, setVideoUrl] = useState('');

  // Reset Funktion für "Neuer Upload"
  const startUpload = () => {
    setView('upload');
    setErrorMessage('');
    setTitle('');
    setPrice('150');
  };

  // --- 1. UPLOAD LOGIK (REPORTER) ---
  const handleRealUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) return;
    if (!title) {
        setErrorMessage("Bitte gib zuerst einen Titel ein!");
        return;
    }
    
    if (!supabaseUrl || !supabaseKey) {
        setErrorMessage("Fehler: .env.local Variablen fehlen.");
        return;
    }

    setUploading(true);
    setView('processing');

    try {
      // Dateinamen säubern
      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const fileName = `${Date.now()}_${cleanName}`;

      // A) Datei hochladen
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // B) Datenbank Eintrag
      const { data: dbData, error: dbError } = await supabase
        .from('videos')
        .insert([{ 
            title: title, 
            price: Number(price), 
            filename: fileName,
            status: 'ready' 
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      // C) URLs speichern
      setVideoId(dbData.id);
      setVideoUrl(`${supabaseUrl}/storage/v1/object/public/uploads/${fileName}`);
      
      setUploading(false);
      setView('share');

    } catch (error: any) {
      console.error('Fehler:', error);
      setErrorMessage(error.message || "Upload Fehler");
      setView('upload');
      setUploading(false);
    }
  };

  // --- 2. KAUF LOGIK (REDAKTEUR) ---
  const handleRealPurchase = async () => {
    setBuying(true);
    
    try {
        // Update Status in DB
        const { error } = await supabase
            .from('videos')
            .update({ status: 'sold' }) 
            .eq('id', videoId);        

        if (error) throw error;

        setBuying(false);
        setView('post_purchase');

    } catch (error: any) {
        alert('Kauf Fehler: ' + error.message);
        setBuying(false);
    }
  };

  // --- VIEWS (Design) ---

  const ReporterDashboard = () => (
    <div className="max-w-4xl mx-auto p-6 font-sans">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <FileVideo className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-bold text-slate-900">PressDrop</span>
        </div>
      </header>
      <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-8 rounded-2xl shadow-lg mb-8">
        <h2 className="text-2xl font-bold mb-2">Neuen Einsatz verkaufen</h2>
        <p className="text-blue-100 mb-6">Lade dein Material hoch und biete es Redaktionen an.</p>
        <button onClick={startUpload} className="bg-white text-blue-600 font-bold py-3 px-6 rounded-xl flex items-center shadow-md hover:bg-blue-50 transition-transform hover:scale-105">
          <Upload className="w-5 h-5 mr-2" /> Upload starten
        </button>
      </div>
    </div>
  );

  const UploadScreen = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Details eingeben</h2>
        
        {errorMessage && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0"/> {errorMessage}
          </div>
        )}
        
        <div className="space-y-4 mb-6">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titel</label>
                <div className="relative">
                    <Type className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Großbrand Berlin" className="w-full pl-10 p-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Preis (€)</label>
                <div className="relative">
                    <Euro className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                    <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full pl-10 p-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
            </div>
        </div>

        <div className="relative border-2 border-dashed border-blue-200 rounded-2xl p-8 bg-blue-50/50 hover:bg-blue-50 transition-colors text-center cursor-pointer group">
          <input type="file" onChange={handleRealUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <p className="font-medium text-blue-600">Datei wählen & Hochladen</p>
        </div>
        <button onClick={() => setView('dashboard')} className="w-full mt-6 text-slate-400 text-sm hover:text-slate-600">Abbrechen</button>
      </div>
    </div>
  );

  const ProcessingScreen = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-6"></div>
        <h3 className="font-bold text-slate-800 text-lg mb-2">Verarbeite Daten...</h3>
        <p className="text-slate-500 text-sm">Upload zu Supabase...</p>
      </div>
    </div>
  );

  const ShareScreen = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Online!</h2>
        <p className="text-slate-500 mb-6">Bereit zum Verkauf.</p>
        
        <div className="bg-slate-50 p-3 rounded mb-6 text-xs font-mono break-all text-slate-600 text-left">
            <p><strong>ID:</strong> {videoId}</p>
        </div>

        <button onClick={() => setView('sales_view')} className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 flex items-center justify-center transition-colors">
            <Eye className="w-4 h-4 mr-2"/> Zur Redaktions-Ansicht
        </button>
        <button onClick={() => setView('dashboard')} className="mt-4 text-sm text-slate-400 hover:text-slate-600">Neuer Upload</button>
      </div>
    </div>
  );

  const SalesPage = () => (
    <div className="min-h-screen bg-gray-100 font-sans p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-white border-b border-slate-100 p-4 flex justify-between items-center">
                 <span className="font-bold text-slate-800">PressDrop <span className="bg-slate-100 text-slate-500 px-1.5 rounded text-xs ml-1 font-normal">MARKETPLACE</span></span>
                 <button onClick={() => setView('dashboard')} className="text-xs text-slate-400 hover:text-slate-600">Exit Preview</button>
            </div>

            <div className="bg-black aspect-video relative flex items-center justify-center group">
                {videoUrl ? (
                    <video src={videoUrl} className="w-full h-full object-contain" controls />
                ) : (
                    <div className="text-white">Video lädt...</div>
                )}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-20 text-white text-5xl font-bold rotate-[-12deg] select-none">
                    PRESSDROP PREVIEW
                </div>
            </div>
            
            <div className="p-8 flex flex-col md:flex-row justify-between items-start gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
                    <div className="flex items-center space-x-2 text-sm text-slate-500 mb-4">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold text-xs">EXKLUSIV</span>
                        <span>• 4K Source</span>
                    </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 min-w-[280px] shadow-sm">
                    <p className="text-slate-500 text-sm mb-1">Preis</p>
                    <p className="text-3xl font-bold text-slate-900 mb-6">{price} €</p>
                    <button 
                        onClick={handleRealPurchase}
                        disabled={buying}
                        className={`w-full text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                            buying ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                        }`}
                    >
                        {buying ? 'Verarbeite...' : <><CreditCard className="w-5 h-5 mr-2"/> Lizenz Kaufen</>}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );

  const PostPurchaseScreen = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8 text-center border-t-4 border-green-500">
        <Download className="w-16 h-16 text-green-600 mx-auto mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Kauf erfolgreich!</h2>
        <p className="text-slate-500 mb-8">Vielen Dank.</p>
        
        <a href={videoUrl} download className="flex items-center justify-center bg-slate-900 text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-800 mb-4 transition-colors">
            <FileVideo className="w-5 h-5 mr-2"/>
            Originaldatei laden
        </a>
        <button onClick={() => setView('dashboard')} className="text-slate-400 text-sm hover:text-slate-600">Zurück zum Dashboard</button>
      </div>
    </div>
  );
  
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