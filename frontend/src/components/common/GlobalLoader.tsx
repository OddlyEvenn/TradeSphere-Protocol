import React, { useState, useEffect } from 'react';
import { useLoading } from '../../contexts/LoadingContext';
import { ShieldCheck } from 'lucide-react';

const GlobalLoader: React.FC = () => {
    const { isLoading } = useLoading();
    const [render, setRender] = useState(isLoading);

    useEffect(() => {
        if (isLoading) {
            setRender(true);
        } else {
            const timer = setTimeout(() => setRender(false), 500);
            return () => clearTimeout(timer);
        }
    }, [isLoading]);

    if (!render) return null;

    return (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50/80 backdrop-blur-sm transition-opacity duration-500 ${isLoading ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex flex-col items-center gap-6">
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <ShieldCheck className="text-indigo-600 animate-pulse" size={40} />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <p className="text-xl font-black text-slate-900 tracking-tight">TradeSphere</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Securing Protocol...</p>
                </div>
            </div>
        </div>
    );
};

export default GlobalLoader;
