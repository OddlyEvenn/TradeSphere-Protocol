import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    Landmark,
    ClipboardCheck,
    Lock,
    CheckCircle,
    Clock,
    ArrowRight,
    TrendingUp,
    ShieldCheck,
    AlertCircle
} from 'lucide-react';

interface Trade {
    id: string;
    blockchainId: number | null;
    status: string;
    amount: number;
    createdAt: string;
}

const ImporterBankDashboard: React.FC = () => {
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
        { label: 'Pending LoCs', value: trades.filter(t => t.status === 'LOC_REQUESTED').length.toString(), icon: ClipboardCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Locked Funds', value: `$${trades.filter(t => t.status === 'LOC_ISSUED').reduce((acc, t) => acc + t.amount, 0).toLocaleString()}`, icon: Lock, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Verified Docs', value: trades.filter(t => t.status === 'DOCS_VERIFIED').length.toString(), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Settlements', value: trades.filter(t => t.status === 'PAYMENT_AUTHORIZED').length.toString(), icon: Clock, color: 'text-rose-600', bg: 'bg-rose-50' },
    ];

    return (
        <div className="space-y-10">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Bank Control Center</h1>
                    <p className="text-slate-500 font-medium mt-1">Review credit applications, issue Letters of Credit, and authorize settlements.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/dashboard/requests')}
                        className="btn-primary"
                    >
                        <ClipboardCheck size={20} />
                        Review Requests
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
                        <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
                            <stat.icon size={28} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                            <p className="text-xl font-black text-slate-900 leading-none">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">High Priority Approvals</h2>
                        <button onClick={() => navigate('/dashboard/requests')} className="text-sm font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                            View Queue <ArrowRight size={14} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {trades.filter(t => t.status === 'LOC_REQUESTED').slice(0, 3).map((trade) => (
                                <div key={trade.id} className="card-premium group hover:border-indigo-100">
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-5 items-center">
                                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                                <AlertCircle size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900">LoC Application #{trade.id.slice(0, 8)}</h3>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Amount: ${trade.amount.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate('/dashboard/requests')}
                                            className="px-4 py-2 bg-indigo-600 text-white font-black text-xs rounded-xl hover:bg-slate-900 transition-all uppercase tracking-widest"
                                        >
                                            Review
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {trades.filter(t => t.status === 'LOC_REQUESTED').length === 0 && (
                                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center text-slate-400 font-medium">
                                    No pending LoC requests in queue.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">Compliance Metrics</h2>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                            <ShieldCheck className="text-emerald-500" size={32} />
                            <div>
                                <p className="text-3xl font-black text-slate-900">99.2%</p>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">AML Compliance</p>
                            </div>
                        </div>
                        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                            <TrendingUp className="text-indigo-600" size={32} />
                            <div>
                                <p className="text-3xl font-black text-slate-900">12.4k</p>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Tx Volume</p>
                            </div>
                        </div>
                        <div className="bg-slate-900 col-span-2 p-8 rounded-[2rem] text-white shadow-xl shadow-slate-100">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                                    <Landmark size={20} />
                                </div>
                                <h3 className="text-lg font-black tracking-tight">System Liquidity</h3>
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available Reserve</p>
                                    <p className="text-2xl font-black">$2.45M</p>
                                </div>
                                <button className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-all">Details</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImporterBankDashboard;
