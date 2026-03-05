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
    AlertCircle
} from 'lucide-react';

interface Trade {
    id: string;
    blockchainId: number | null;
    status: string;
    amount: number;
    createdAt: string;
}

const ImporterDashboard: React.FC = () => {
    const { user, account } = useOutletContext<{ user: any, account: string | null }>();
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
        { label: 'Active Trades', value: trades.filter(t => t.status !== 'COMPLETED').length.toString(), icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Pending LoCs', value: trades.filter(t => t.status === 'LOC_REQUESTED').length.toString(), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Payments Pending', value: trades.filter(t => t.status === 'DOCS_VERIFIED').length.toString(), icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
        { label: 'Completed', value: trades.filter(t => t.status === 'COMPLETED').length.toString(), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    return (
        <div className="space-y-10">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Importer Dashboard</h1>
                    <p className="text-slate-500 font-medium mt-1">Manage your active trade lifecycle and Letter of Credit requests.</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/marketplace')}
                    className="btn-primary"
                >
                    <Plus size={20} />
                    New Trade Request
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
                        <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
                            <stat.icon size={28} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                            <p className="text-2xl font-black text-slate-900 leading-none">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">Active Trades</h2>
                        <button onClick={() => navigate('/dashboard/trades')} className="text-sm font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                            View All <ArrowRight size={14} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-indigo-600"></div>
                        </div>
                    ) : trades.length > 0 ? (
                        <div className="space-y-4">
                            {trades.slice(0, 3).map((trade) => (
                                <div key={trade.id} className="card-premium group cursor-pointer hover:border-indigo-100" onClick={() => navigate(`/dashboard/trades/${trade.id}`)}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-5">
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                <Package size={28} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 text-lg">Trade #{trade.blockchainId || trade.id.slice(0, 8)}</h3>
                                                <p className="text-sm font-bold text-slate-400">Created {new Date(trade.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-slate-900">${trade.amount.toLocaleString()}</p>
                                            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${trade.status === 'CREATED' ? 'bg-amber-50 text-amber-600' :
                                                trade.status === 'PAYMENT_AUTHORIZED' ? 'bg-emerald-50 text-emerald-600' :
                                                    'bg-indigo-50 text-indigo-700'
                                                }`}>
                                                {trade.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-16 text-center">
                            <Package className="mx-auto text-slate-300 mb-4" size={48} />
                            <h3 className="text-xl font-bold text-slate-900 mb-1">No Active Trades</h3>
                            <p className="text-slate-500 font-medium">Start by publishing a trade request on the marketplace.</p>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">Marketplace Activity</h2>
                    <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm space-y-6 text-center">
                        <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto">
                            <ClipboardList size={32} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">Real-time Activity Feed</p>
                            <p className="text-xs text-slate-400 mt-1">Notifications and offers for your trade requests will appear here in real-time.</p>
                        </div>
                        <button onClick={() => navigate('/dashboard/marketplace')} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all text-sm flex items-center justify-center gap-2">
                            Marketplace <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImporterDashboard;
