import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    Landmark,
    FileCheck,
    ShieldCheck,
    CheckCircle,
    Clock,
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

const ExporterBankDashboard: React.FC = () => {
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
        { label: 'Received LoCs', value: trades.filter(t => t.status === 'LOC_ISSUED').length.toString(), icon: FileCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Pending Verification', value: trades.filter(t => t.status === 'DOCS_SUBMITTED').length.toString(), icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Verified Trades', value: trades.filter(t => t.status === 'DOCS_VERIFIED').length.toString(), icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Payment Alerts', value: trades.filter(t => t.status === 'PAYMENT_AUTHORIZED').length.toString(), icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
    ];

    return (
        <div className="space-y-10">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Export Finance Control</h1>
                    <p className="text-slate-500 font-medium mt-1">Verify shipping documents, manage export credits, and track incoming settlements.</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/requests')}
                    className="btn-primary"
                >
                    <FileCheck size={20} />
                    Verify Documents
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
                            <p className="text-xl font-black text-slate-900 leading-none">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">Verification Queue</h2>
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {trades.filter(t => t.status === 'DOCS_SUBMITTED').slice(0, 3).map((trade) => (
                                <div key={trade.id} className="card-premium group hover:border-indigo-100">
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-5 items-center">
                                            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-black">
                                                DOC
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900">Documents Submitted #{trade.blockchainId !== null && trade.blockchainId !== undefined ? trade.blockchainId : trade.id.slice(0, 8)}</h3>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Awaiting Verification • ${trade.amount.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <button className="px-4 py-2 bg-indigo-600 text-white font-black text-xs rounded-xl hover:bg-slate-900 transition-all uppercase tracking-widest">
                                            Audit
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {trades.filter(t => t.status === 'DOCS_SUBMITTED').length === 0 && (
                                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center text-slate-400 font-medium">
                                    No documents awaiting verification.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-slate-900 rounded-[2rem] p-8 space-y-6 text-white overflow-hidden relative">
                    <div className="relative z-10">
                        <h2 className="text-lg font-black uppercase tracking-tight mb-2">Verification Insights</h2>
                        <p className="text-slate-400 text-sm font-medium italic opacity-80 leading-relaxed mb-6">"Every verified document triggers a cryptographically signed proof on the blockchain, ensuring immutable records for all global stakeholders."</p>
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Verification Speed</span>
                                <span className="text-xs font-black text-emerald-400">INSTANT</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="w-full h-full bg-indigo-500"></div>
                            </div>
                        </div>
                    </div>
                    <FileCheck className="absolute -bottom-10 -right-10 text-white/5" size={200} />
                </div>
            </div>
        </div>
    );
};

export default ExporterBankDashboard;
