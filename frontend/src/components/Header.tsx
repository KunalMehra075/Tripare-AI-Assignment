import React from 'react';
import { Hotel } from 'lucide-react';

interface HeaderProps {
  backendOnline?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ backendOnline = true }) => {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm">
            <Hotel className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-slate-900 tracking-tight">RateHop</span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Reliable Parallel Hotel Rate Comparator
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
            <span className={`inline-block w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="font-medium">{backendOnline ? 'Temporal Backend Ready' : 'Connecting...'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
