import React, { useState } from 'react';
import {
    Bell,
    Wallet,
    Menu,
    Check
} from 'lucide-react';

interface Notification {
    id: number;
    title: string;
    time: string;
    read: boolean;
}

interface TopNavProps {
    user: any;
    account: string | null;
    onConnect: () => void;
    onMenuClick: () => void;
    isSidebarCollapsed: boolean;
}

const TopNav: React.FC<TopNavProps> = ({ user, account, onConnect, onMenuClick }) => {
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([
        { id: 1, title: 'New Trade Offer Received', time: '2 minutes ago', read: false },
        { id: 2, title: 'Document Verified by Bank', time: '1 hour ago', read: false },
    ]);

    const hasUnread = notifications.some(n => !n.read);

    const markAllRead = () => {
        setNotifications([]);
        setShowNotifications(false);
    };

    return (
        <header className="h-20 bg-white/60 backdrop-blur-xl border-b border-white/40 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-40 transition-all duration-500">

            <div className="flex items-center gap-6">
                {/* Mobile Menu Toggle */}
                <button
                    onClick={onMenuClick}
                    className="p-2 lg:hidden text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 rounded-xl transition-all active:scale-95"
                >
                    <Menu size={24} />
                </button>
            </div>

            <div className="flex items-center gap-4 lg:gap-8">
                {/* Wallet Connection */}
                <button
                    onClick={onConnect}
                    className={`hidden sm:flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 active:scale-95 ${account
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        : 'bg-blue-600 text-white shadow-lg shadow-blue-100/50'
                        }`}
                >
                    <Wallet size={16} />
                    {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Secure Wallet'}
                </button>

                {/* Notifications */}
                <div className="relative">
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={`p-3 rounded-2xl transition-all active:scale-90 relative group ${showNotifications ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-blue-50/50'}`}
                    >
                        <Bell size={20} className="group-hover:rotate-12 transition-transform" />
                        {hasUnread && (
                            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 mt-4 w-80 bg-white/90 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] shadow-2xl p-7 animate-in z-50 overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Protocol Updates</h3>
                                {hasUnread && (
                                    <button
                                        onClick={markAllRead}
                                        className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                                    >
                                        <Check size={10} /> Mark all read
                                    </button>
                                )}
                            </div>
                            <div className="space-y-3">
                                {notifications.map((n) => (
                                    <div key={n.id} className={`flex gap-4 p-4 rounded-3xl transition-all cursor-pointer group ${n.read ? 'opacity-60 grayscale' : 'bg-blue-50/50 hover:bg-blue-50'}`}>
                                        <div className={`w-10 h-10 ${n.read ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-600'} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                            <Bell size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-slate-900 leading-tight mb-1">{n.title}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{n.time}</p>
                                        </div>
                                    </div>
                                ))}
                                {notifications.length === 0 && (
                                    <div className="py-8 text-center">
                                        <p className="text-xs font-bold text-slate-400 italic">Clear skies. No new updates.</p>
                                    </div>
                                )}
                            </div>
                            <button className="w-full mt-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-blue-600 border-t border-slate-50 transition-colors">
                                Archive Management
                            </button>
                        </div>
                    )}
                </div>

                {/* Profile (Non-Dropdown) */}
                <div className="flex items-center gap-3 py-1 pr-4 pl-1 rounded-2xl bg-white/40 border border-white/60 shadow-sm transition-all grayscale hover:grayscale-0">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg">
                        {user.name?.charAt(0) || 'U'}
                    </div>
                    <div className="hidden lg:flex flex-col items-start">
                        <p className="text-[11px] font-black text-slate-900 leading-none truncate uppercase tracking-tight">{user.name || 'User Profile'}</p>
                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.15em] mt-1">{user.role?.replace('_', ' ')}</p>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default TopNav;


