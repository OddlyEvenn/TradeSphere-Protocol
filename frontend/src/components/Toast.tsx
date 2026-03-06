import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastProps {
    message: string;
    type: 'success' | 'error' | 'info';
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const icons = {
        success: <CheckCircle2 className="text-emerald-500" size={20} />,
        error: <AlertCircle className="text-rose-500" size={20} />,
        info: <Info className="text-indigo-500" size={20} />
    };

    const backgrounds = {
        success: 'bg-emerald-50 border-emerald-100',
        error: 'bg-rose-50 border-rose-100',
        info: 'bg-indigo-50 border-indigo-100'
    };

    return (
        <div
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-xl w-80 transition-all duration-300 transform ${isVisible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-4 opacity-0 scale-95'
                } ${backgrounds[type]}`}
        >
            <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
            <div className="flex-1">
                <p className="text-sm font-bold text-slate-800 leading-snug">{message}</p>
            </div>
            <button
                onClick={() => {
                    setIsVisible(false);
                    setTimeout(onClose, 300); // wait for exit animation
                }}
                className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close notification"
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default Toast;
