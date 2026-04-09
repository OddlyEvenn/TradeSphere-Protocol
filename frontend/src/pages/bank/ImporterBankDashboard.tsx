import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { walletService } from '../../services/WalletService';
import { useToast } from '../../contexts/ToastContext';
import {
    Landmark,
    ClipboardCheck,
    Lock,
    CheckCircle,
    Clock,
    ArrowRight,
    TrendingUp,
    ShieldCheck,
    AlertCircle,
    BadgePercent,
    DollarSign
} from 'lucide-react';

interface Trade {
    id: string;
    blockchainId: number | null;
    status: string;
    amount: number;
    dutyAmount: number | null;
    productName: string;
    createdAt: string;
}

const ImporterBankDashboard: React.FC = () => {
    const { user, account } = useOutletContext<{ user: any, account: string | null }>();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const navigate = useNavigate();
    const toast = useToast();

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


    const taxPendingTrades = trades.filter(t => t.status === 'CUSTOMS_FLAGGED');

    const stats = [
        { label: 'Pending LoCs', value: trades.filter(t => t.status === 'LOC_INITIATED').length.toString(), icon: ClipboardCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Locked Funds', value: `$${trades.filter(t => ['LOC_UPLOADED', 'LOC_APPROVED', 'FUNDS_LOCKED', 'SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED'].includes(t.status)).reduce((acc, t) => acc + t.amount, 0).toLocaleString()}`, icon: Lock, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Tax Flagged', value: taxPendingTrades.length.toString(), icon: BadgePercent, color: 'text-rose-600', bg: 'bg-rose-50' },
        { label: 'Settlements', value: trades.filter(t => t.status === 'PAYMENT_AUTHORIZED').length.toString(), icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    return (
        <div className="space-y-10">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Bank Control Center</h1>
                    <p className="text-slate-500 font-medium mt-1">Review credit applications, issue Letters of Credit, confirm duty payments, and authorize settlements.</p>
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
                    <div key={stat.label} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 glass">
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
                        <button onClick={() => navigate('/dashboard/requests')} className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:underline">
                            View Queue <ArrowRight size={14} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {trades.filter(t => t.status === 'LOC_INITIATED').slice(0, 3).map((trade) => (
                                <div key={trade.id} className="card-premium group hover:border-blue-100 glass">
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-5 items-center">
                                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                                <AlertCircle size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900">LoC Application #{trade.blockchainId !== null && trade.blockchainId !== undefined ? trade.blockchainId : trade.id.slice(0, 8)}</h3>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Amount: ${trade.amount.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate('/dashboard/requests')}
                                            className="px-4 py-2 bg-blue-600 text-white font-black text-xs rounded-xl hover:bg-slate-900 transition-all uppercase tracking-widest"
                                        >
                                            Review
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {trades.filter(t => t.status === 'LOC_INITIATED').length === 0 && (
                                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center text-slate-400 font-medium">
                                    No pending LoC requests in queue.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">Compliance Monitor</h2>
                    <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white overflow-hidden relative shadow-2xl shadow-blue-200/20">
                        <div className="relative z-10">
                            <h3 className="text-xl font-black mb-1 uppercase tracking-tighter">Liquid Capital Reserve</h3>
                            <p className="text-slate-400 text-sm mb-8 italic">"Total funds currently held in smart contract escrows for active trade letters of credit."</p>

                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Escrow Balance</p>
                                    <p className="text-3xl font-black text-white">${trades.reduce((acc, t) => acc + (['FUNDS_LOCKED', 'SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED'].includes(t.status) ? t.amount : 0), 0).toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Approval Velocity</p>
                                    <p className="text-3xl font-black text-emerald-400">98%</p>
                                </div>
                            </div>
                        </div>
                        <ShieldCheck className="absolute -bottom-10 -right-10 text-white/5" size={240} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImporterBankDashboard;
