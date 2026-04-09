import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    Package,
    CheckCircle,
    Clock,
    Shield,
    Plus,
    ArrowRight,
    ClipboardList,
    AlertCircle,
    TrendingUp,
    Briefcase
} from 'lucide-react';

interface Trade {
    id: string;
    blockchainId: number | null;
    status: string;
    amount: number;
    createdAt: string;
}

const ImporterDashboard: React.FC = () => {
    const { user } = useOutletContext<{ user: any }>();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchTrades();
    }, []);

    const fetchTrades = async () => {
        try {
            const res = await api.get('/trades');
            setTrades(res.data);
        } catch (err) {
            console.error('Failed to fetch trades', err);
        } finally {
            setLoading(false);
        }
    };

    const stats = [
        { label: 'Active Trades', value: trades.filter(t => t.status !== 'COMPLETED').length.toString(), icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Pending LoCs', value: trades.filter(t => ['LOC_INITIATED', 'LOC_UPLOADED'].includes(t.status)).length.toString(), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Clearing Customs', value: trades.filter(t => ['GOODS_SHIPPED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED'].includes(t.status)).length.toString(), icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
        { label: 'Completed', value: trades.filter(t => t.status === 'COMPLETED').length.toString(), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    return (
        <div className="space-y-12 animate-in lg:p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight lg:text-5xl">
                        Welcome back, <span className="text-blue-600">{user?.name?.split(' ')[0]}</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-2 text-lg">Your trade finance operations are running smoothly.</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/marketplace')}
                    className="btn-primary lg:px-8 lg:py-4 shadow-2xl shadow-blue-100/50"
                >
                    <Plus size={20} />
                    New Trade Request
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <div key={stat.label} className="bg-white/80 backdrop-blur-md p-7 rounded-[2rem] border border-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.02)] flex items-center gap-6 hover:translate-y-[-4px] transition-all duration-300">
                        <div className={`w-16 h-16 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center flex-shrink-0 ring-8 ring-transparent group-hover:ring-blue-50 transition-all`}>
                            <stat.icon size={30} />
                        </div>
                        <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">{stat.label}</p>
                            <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8 space-y-8">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Recent Trades</h2>
                        </div>
                        <button onClick={() => navigate('/dashboard/trades')} className="text-xs font-black text-blue-600 flex items-center gap-2 hover:gap-3 transition-all uppercase tracking-widest">
                            View All Trades <ArrowRight size={14} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-white/50 backdrop-blur-md rounded-[2.5rem] border border-white/60">
                            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Synchronizing Ledger...</p>
                        </div>
                    ) : trades.length > 0 ? (
                        <div className="grid gap-6">
                            {trades.slice(0, 4).map((trade) => (
                                <div
                                    key={trade.id}
                                    className="card-premium group cursor-pointer"
                                    onClick={() => navigate(`/dashboard/trades/${trade.id}`)}
                                >
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 bg-slate-50 rounded-[1.25rem] flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-6 transition-all duration-500">
                                                <Briefcase size={28} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 text-xl tracking-tight">Trade #{trade.blockchainId || trade.id.slice(0, 8)}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Clock size={12} className="text-slate-400" />
                                                    <p className="text-xs font-bold text-slate-400">Initiated {new Date(trade.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between w-full md:w-auto md:flex-col md:items-end gap-2">
                                            <p className="text-2xl font-black text-blue-600">${trade.amount.toLocaleString()}</p>
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] ${trade.status === 'TRADE_INITIATED' ? 'bg-amber-100 text-amber-700' :
                                                trade.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                                    ['PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'CUSTOMS_CLEARED'].includes(trade.status) ? 'bg-emerald-50 text-emerald-600' :
                                                        'bg-blue-50 text-blue-700'
                                                }`}>
                                                {trade.status.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white/60 backdrop-blur-md border border-white/60 rounded-[2.5rem] p-20 text-center shadow-sm">
                            <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                                <Package size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mb-2">Build Your Pipeline</h3>
                            <p className="text-slate-500 font-medium max-w-sm mx-auto mb-8">You haven't initiated any trades yet. Explore the marketplace to find new opportunities.</p>
                            <button
                                onClick={() => navigate('/dashboard/marketplace')}
                                className="btn-secondary mx-auto"
                            >
                                Go to Marketplace
                            </button>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-4 space-y-8">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Protocol Insights</h2>
                    </div>

                    <div className="card-premium space-y-8 relative overflow-hidden group">
                        <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700"></div>

                        <div className="relative">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100/50">
                                    <TrendingUp size={24} />
                                </div>
                                <h3 className="font-black text-slate-900 uppercase tracking-tight">Real-time Feed</h3>
                            </div>

                            <div className="space-y-6">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex gap-4 group/item">
                                        <div className="relative">
                                            <div className="w-10 h-10 bg-slate-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs z-10 relative group-hover/item:bg-blue-600 group-hover/item:text-white transition-all">
                                                0{i}
                                            </div>
                                            {i < 3 && <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-10 bg-slate-100"></div>}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-900 leading-tight">Latest Protocol Update</p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Securing transactions...</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/dashboard/marketplace')}
                            className="btn-primary w-full shadow-xl shadow-blue-100/50"
                        >
                            Explore Marketplace
                        </button>
                    </div>

                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group shadow-2xl shadow-slate-200">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                            <Shield size={120} />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight mb-2">TradeSphere Security</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">Your operations are secured by advanced smart contracts and document verification protocols.</p>
                        <div className="flex items-center gap-2 text-blue-400 font-black text-[10px] uppercase tracking-[0.2em]">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                            System Certified
                        </div>
                    </div>
                </div>
            </div>
        </div>

    );
};

export default ImporterDashboard;

