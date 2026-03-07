import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    Globe,
    Truck,
    ShieldCheck,
    FileText,
    Search,
    Gavel,
    BadgePercent,
    AlertTriangle,
    CheckCircle,
    ArrowRight
} from 'lucide-react';

interface Trade {
    id: string;
    blockchainId: number | null;
    status: string;
    amount: number;
    createdAt: string;
}

const AuthorityDashboard: React.FC = () => {
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

    const getRoleConfig = () => {
        switch (user.role) {
            case 'CUSTOMS':
                return {
                    title: 'Customs Clearance Dashboard',
                    metricLabel: 'Awaiting Inspection',
                    metricValue: trades.length.toString(),
                    icon: Globe,
                    color: 'text-indigo-600',
                    bg: 'bg-indigo-50',
                    actionLabel: 'Inspect Shipment'
                };
            case 'SHIPPING':
                return {
                    title: 'Shipping Authority Terminal',
                    metricLabel: 'Active Cargo',
                    metricValue: trades.length.toString(),
                    icon: Truck,
                    color: 'text-amber-600',
                    bg: 'bg-amber-50',
                    actionLabel: 'Confirm Departure'
                };
            case 'INSURANCE':
                return {
                    title: 'Insurance Verification Portal',
                    metricLabel: 'Active Policies',
                    metricValue: trades.length.toString(),
                    icon: ShieldCheck,
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50',
                    actionLabel: 'Issue Certificate'
                };
            case 'TAX':
                return {
                    title: 'Tax Compliance Monitor',
                    metricLabel: 'Filings Audit',
                    metricValue: trades.length.toString(),
                    icon: BadgePercent,
                    color: 'text-rose-600',
                    bg: 'bg-rose-50',
                    actionLabel: 'Verify Tax'
                };
            case 'REGULATOR':
                return {
                    title: 'System Audit & Oversight',
                    metricLabel: 'Total Network Trades',
                    metricValue: trades.length.toString(),
                    icon: Gavel,
                    color: 'text-slate-900',
                    bg: 'bg-slate-100',
                    actionLabel: 'Run Audit'
                };
            default:
                return {
                    title: 'Authority Control',
                    metricLabel: 'Overview',
                    metricValue: '0',
                    icon: FileText,
                    color: 'text-slate-400',
                    bg: 'bg-slate-50',
                    actionLabel: 'Details'
                };
        }
    };

    const config = getRoleConfig();

    return (
        <div className="space-y-10">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">{config.title}</h1>
                    <p className="text-slate-500 font-medium mt-1">Operational oversight and semaphore approval management.</p>
                </div>
                <div className="flex gap-3">
                    <button className="btn-secondary px-4 py-3">
                        <Search size={20} />
                    </button>
                    <button className="btn-primary">
                        {config.actionLabel}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className={`w-14 h-14 ${config.bg} ${config.color} rounded-2xl flex items-center justify-center`}>
                        <config.icon size={28} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{config.metricLabel}</p>
                        <p className="text-2xl font-black text-slate-900">{config.metricValue}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                        <CheckCircle size={28} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Cleared</p>
                        <p className="text-2xl font-black text-slate-900">142</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                        <AlertTriangle size={28} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Flagged</p>
                        <p className="text-2xl font-black text-slate-900">3</p>
                    </div>
                </div>
                <div className="bg-slate-900 p-6 rounded-3xl text-white flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Network Health</p>
                        <p className="text-xl font-black">99.9% uptime</p>
                    </div>
                    <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => <div key={i} className="w-1.5 h-6 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: `${i * 200}ms` }}></div>)}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">Queue Management</h2>
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-indigo-600"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {trades.slice(0, 4).map((trade) => (
                            <div key={trade.id} className="card-premium group hover:border-indigo-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center font-bold">
                                        TRD
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 truncate max-w-[150px]">Trade #{trade.blockchainId !== null && trade.blockchainId !== undefined ? trade.blockchainId : trade.id.slice(0, 8)}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status: {trade.status}</p>
                                    </div>
                                </div>
                                <button className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">
                                    <ArrowRight size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuthorityDashboard;
