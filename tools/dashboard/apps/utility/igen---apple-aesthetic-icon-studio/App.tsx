
import React, { useState, useCallback, useRef } from 'react';
import { AppState, GeneratedImage, Preset } from './types';
import { PRESETS } from './constants';
import { generateIcon, editIcon } from './services/geminiService';
import Button from './components/Button';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppState>('idle');
  const [prompt, setPrompt] = useState('');
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim()) return;

    setStatus('generating');
    setError(null);
    try {
      const imageUrl = await generateIcon(prompt);
      const newImg: GeneratedImage = {
        id: Date.now().toString(),
        url: imageUrl,
        prompt: prompt,
        timestamp: Date.now()
      };
      setCurrentImage(newImg);
      setHistory(prev => [newImg, ...prev]);
      setPrompt('');
      setStatus('idle');
    } catch (err) {
      console.error(err);
      setError('Failed to generate icon. Please try again.');
      setStatus('error');
    }
  };

  const handleEdit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!currentImage || !prompt.trim()) return;

    setStatus('editing');
    setError(null);
    try {
      const imageUrl = await editIcon(currentImage.url, prompt);
      const updatedImg: GeneratedImage = {
        id: Date.now().toString(),
        url: imageUrl,
        prompt: `${currentImage.prompt} (Edit: ${prompt})`,
        timestamp: Date.now()
      };
      setCurrentImage(updatedImg);
      setHistory(prev => [updatedImg, ...prev]);
      setPrompt('');
      setStatus('idle');
    } catch (err) {
      console.error(err);
      setError('Failed to edit icon. Please try again.');
      setStatus('error');
    }
  };

  const handlePresetClick = (preset: Preset) => {
    setPrompt(preset.prompt);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const uploadImg: GeneratedImage = {
          id: Date.now().toString(),
          url: base64,
          prompt: 'Uploaded Image',
          timestamp: Date.now()
        };
        setCurrentImage(uploadImg);
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadImage = () => {
    if (!currentImage) return;
    const link = document.createElement('a');
    link.href = currentImage.url;
    link.download = `igen-icon-${currentImage.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col items-center pb-20">
      {/* Header */}
      <header className="w-full h-16 apple-blur fixed top-0 z-50 flex items-center justify-between px-6 border-b border-black/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.1 2.48-1.34.03-1.77-.79-3.29-.79-1.53 0-1.99.77-3.29.82-1.31.05-2.32-1.32-3.15-2.52-1.7-2.43-2.99-6.85-1.26-9.85 1.15-2 3.19-3.26 5-3.26 1.34 0 2.59.92 3.42.92.82 0 2.37-1.11 3.96-.95 1.13.05 3.3.46 4.86 2.75-.12.07-2.9 1.68-2.87 5.03.03 4.04 3.51 5.43 3.55 5.45-.04.13-.55 1.91-1.83 3.82zM15.48 2c.74-.9 1.23-2.15 1.1-3.41-1.07.05-2.38.72-3.15 1.61-.69.79-1.3 2.07-1.12 3.3 1.2.09 2.42-.6 3.17-1.5z"/></svg>
          </div>
          <span className="font-semibold text-lg tracking-tight">iGen Studio</span>
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
            Upload Base
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept="image/*"
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="mt-24 max-w-6xl w-full px-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Controls */}
        <div className="lg:col-span-5 space-y-6">
          <section className="glass-card p-6 rounded-3xl space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Studio Tools</h2>
            <p className="text-sm text-gray-500">Create or edit your Apple-style icon with high precision.</p>
            
            <form onSubmit={currentImage ? handleEdit : handleGenerate} className="space-y-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={currentImage ? "e.g., Add a retro chrome filter..." : "Describe your icon (e.g., A minimalist camera icon with glassmorphism)..."}
                className="w-full h-32 p-4 bg-gray-50 border border-black/5 rounded-2xl resize-none focus:ring-2 focus:ring-[#0071e3] focus:border-transparent transition-all outline-none text-sm"
              />
              
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  className="flex-1"
                  isLoading={status === 'generating' || status === 'editing'}
                >
                  {currentImage ? 'Apply Edit' : 'Generate Icon'}
                </Button>
                {currentImage && (
                  <Button 
                    variant="secondary" 
                    onClick={() => {setCurrentImage(null); setPrompt('');}}
                    disabled={status === 'editing'}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </form>

            {error && (
              <div className="p-3 bg-red-50 text-red-500 text-xs rounded-xl border border-red-100">
                {error}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Presets</h3>
            <div className="grid grid-cols-2 gap-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset)}
                  className="flex items-center gap-3 p-3 bg-white border border-black/5 rounded-2xl hover:border-[#0071e3] transition-colors text-left"
                >
                  <span className="text-xl">{preset.icon}</span>
                  <span className="text-sm font-medium">{preset.name}</span>
                </button>
              ))}
            </div>
          </section>

          {history.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">History</h3>
              <div className="grid grid-cols-4 gap-2">
                {history.slice(0, 8).map((img) => (
                  <button 
                    key={img.id}
                    onClick={() => setCurrentImage(img)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${currentImage?.id === img.id ? 'border-[#0071e3]' : 'border-transparent'}`}
                  >
                    <img src={img.url} className="w-full h-full object-cover" alt="History" />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Side: Preview */}
        <div className="lg:col-span-7">
          <div className="glass-card rounded-[40px] p-12 flex flex-col items-center justify-center min-h-[500px] sticky top-24">
            {currentImage ? (
              <div className="space-y-8 w-full flex flex-col items-center">
                <div className="relative group">
                  <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-[50px] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-[60px] overflow-hidden shadow-2xl bg-white border border-black/5">
                    <img src={currentImage.url} alt="Generated Icon" className="w-full h-full object-contain" />
                  </div>
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">Ready for Export</h3>
                  <p className="text-sm text-gray-500 max-w-sm px-4">Generated with high-fidelity detail and Apple aesthetic guidelines.</p>
                </div>

                <div className="flex gap-3">
                  <Button variant="primary" onClick={downloadImage}>
                    Download PNG
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => {
                      navigator.clipboard.writeText(currentImage.url);
                      alert('Base64 copied to clipboard');
                    }}
                  >
                    Copy Base64
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-6">
                <div className="w-32 h-32 bg-gray-50 rounded-[40px] flex items-center justify-center mx-auto border border-dashed border-gray-300">
                  <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold tracking-tight gradient-text">Start Creating</h3>
                  <p className="text-gray-400 max-w-xs mx-auto text-sm leading-relaxed">
                    Type a prompt on the left or choose a preset to generate a high-quality Apple style icon.
                  </p>
                </div>
              </div>
            )}

            {(status === 'generating' || status === 'editing') && (
              <div className="absolute inset-0 apple-blur rounded-[40px] flex flex-col items-center justify-center z-10 space-y-4">
                <div className="w-16 h-16 relative">
                   <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                   <div className="absolute inset-0 border-4 border-[#0071e3] rounded-full border-t-transparent animate-spin"></div>
                </div>
                <div className="text-center">
                   <p className="font-semibold">{status === 'generating' ? 'Designing Icon...' : 'Refining Details...'}</p>
                   <p className="text-xs text-gray-500">Gemini 2.5 Flash Image is processing your request</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Background decoration */}
      <div className="fixed -bottom-64 -right-64 w-96 h-96 bg-blue-400/10 rounded-full blur-[120px] -z-10"></div>
      <div className="fixed top-1/2 -left-32 w-80 h-80 bg-purple-400/10 rounded-full blur-[100px] -z-10"></div>
    </div>
  );
};

export default App;
