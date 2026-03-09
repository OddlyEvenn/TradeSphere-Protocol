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

    /**
     * Importer Bank confirms the duty payment on-chain.
     * Calls DocumentVerification.confirmDutyPayment(blockchainId).
     */
    const handleConfirmDutyPayment = async (tradeId: string, blockchainId: number | null) => {
        if (!account) return toast.error("Connect wallet to confirm duty payment.");
        if (blockchainId === null || blockchainId === undefined) return toast.error("Trade has no blockchain ID.");

        setConfirmingId(tradeId);
        try {
            toast.info("Confirming duty payment on-chain...");
            const docContract = walletService.getDocumentVerification();
            const tx = await docContract.confirmDutyPayment(blockchainId);
            toast.info("Transaction sent. Waiting for confirmation...");
            await tx.wait();

            await api.patch(`/trades/${tradeId}/state`, {
                txHash: tx.hash,
                eventName: 'DUTY_PAYMENT_CONFIRMED'
            });
            toast.success("Duty payment confirmed on blockchain! Status → DUTY_PAID");
            fetchTrades();
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to confirm duty payment: " + (err.reason || err.message));
        } finally {
            setConfirmingId(null);
        }
    };

    const dutyPendingTrades = trades.filter(t => t.status === 'DUTY_PENDING' && t.dutyAmount);

    const stats = [
        { label: 'Pending LoCs', value: trades.filter(t => t.status === 'LOC_INITIATED').length.toString(), icon: ClipboardCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Locked Funds', value: `$${trades.filter(t => t.status === 'LOC_ISSUED' || t.status === 'LOC_UPLOADED' || t.status === 'FUNDS_LOCKED').reduce((acc, t) => acc + t.amount, 0).toLocaleString()}`, icon: Lock, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Duty Pending', value: dutyPendingTrades.length.toString(), icon: BadgePercent, color: 'text-rose-600', bg: 'bg-rose-50' },
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

            {/* ── Duty Payment Queue (NEW) ────────────────────────────────── */}
            {dutyPendingTrades.length > 0 && (
                <div className="space-y-6">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <DollarSign className="text-rose-600" size={22} />
                        Duty Payment Confirmation Queue
                    </h2>
                    <div className="space-y-4">
                        {dutyPendingTrades.map((trade) => (
                            <div key={trade.id} className="card-premium border-rose-100 bg-rose-50/10 group hover:border-rose-200 glass">
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="flex gap-5 items-center flex-1">
                                        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                                            <BadgePercent size={28} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-black text-slate-900">
                                                {trade.productName} — Trade #{trade.blockchainId !== null && trade.blockchainId !== undefined ? trade.blockchainId : trade.id.slice(0, 8)}
                                            </h3>
                                            <div className="flex gap-6 mt-1">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                    Trade Value: <span className="text-slate-600">${trade.amount.toLocaleString()}</span>
                                                </p>
                                                <p className="text-xs font-bold text-rose-500 uppercase tracking-widest">
                                                    Assessed Duty: <span className="text-rose-700 text-sm font-black">${trade.dutyAmount?.toLocaleString()}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                                            Awaiting Bank Confirmation
                                        </span>
                                        <button
                                            onClick={() => handleConfirmDutyPayment(trade.id, trade.blockchainId)}
                                            disabled={confirmingId === trade.id}
                                            className="btn-primary py-3 px-6 shadow-none text-xs bg-rose-600 hover:bg-rose-700 whitespace-nowrap"
                                        >
                                            {confirmingId === trade.id ? 'Processing...' : 'Confirm Duty Paid'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                                    <p className="text-3xl font-black text-white">${trades.reduce((acc, t) => acc + (['FUNDS_LOCKED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'DUTY_PENDING', 'DUTY_PAID', 'PAYMENT_AUTHORIZED'].includes(t.status) ? t.amount : 0), 0).toLocaleString()}</p>
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
