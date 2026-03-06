import React from 'react';
import { Wallet, Bell, Search, LogOut, User } from 'lucide-react';
import { walletService } from '../../services/WalletService';

interface TopNavProps {
    user: any;
    account: string | null;
    onConnect: () => void;
}

const TopNav: React.FC<TopNavProps> = ({ user, account, onConnect }) => {
    const handleLogout = () => {
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    return (
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-50">
            <div className="flex items-center gap-4 flex-1">
                <div className="relative w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Search trades, documents, tx hash..."
                        className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                </div>
            </div>

            <div className="flex items-center gap-6">
                <button className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all relative">
                    <Bell size={20} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                <div className="h-8 w-[1px] bg-slate-100"></div>

                <button
                    onClick={onConnect}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${account || user?.walletAddress
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100'
                        }`}
                >
                    <Wallet size={18} />
                    {(account || user?.walletAddress) ? `${(account || user?.walletAddress).slice(0, 6)}...${(account || user?.walletAddress).slice(-4)}` : 'Connect Wallet'}
                </button>

                <div className="flex items-center gap-3 pl-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-black text-slate-900 leading-none">{user?.name || 'User'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user?.role?.replace('_', ' ')}</p>
                    </div>
                    <div className="relative group">
                        <button className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 hover:bg-indigo-600 hover:text-white transition-all">
                            <User size={20} />
                        </button>
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            >
                                <LogOut size={16} />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default TopNav;
