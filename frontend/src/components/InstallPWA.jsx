import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

// Hook — use anywhere to get install state + trigger
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    const installed = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  return { canInstall: !!prompt, install };
}

// Compact navbar button
export function InstallButton({ dark }) {
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <button
      onClick={install}
      title="Install StayLite app"
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
        dark
          ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-800/60'
          : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
      }`}
    >
      <Download className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Install App</span>
    </button>
  );
}
