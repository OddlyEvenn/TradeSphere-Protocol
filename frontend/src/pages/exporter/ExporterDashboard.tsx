import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import {
    Truck,
    Globe,
    FileCheck,
    Clock,
    CheckCircle,
    ArrowRight,
    TrendingUp,
    Search,
    Zap,
    Briefcase
} from 'lucide-react';

interface Trade {
    id: string;
    blockchainId: number | null;
    status: string;
    amount: number;
    createdAt: string;
}

const ExporterDashboard: React.FC = () => {
    const { user } = useOutletContext<{ user: any }>();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();
    const isFullView = location.pathname === '/dashboard/shipments';

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
        { label: 'Active Shipments', value: trades.filter(t => t.status === 'GOODS_SHIPPED').length.toString(), icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Pending LoCs', value: trades.filter(t => ['LOC_INITIATED', 'LOC_UPLOADED'].includes(t.status)).length.toString(), icon: FileCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'LoC Approved', value: trades.filter(t => ['LOC_APPROVED', 'FUNDS_LOCKED', 'SHIPPING_ASSIGNED'].includes(t.status)).length.toString(), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Payments Awaiting', value: trades.filter(t => ['PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED'].includes(t.status)).length.toString(), icon: Clock, color: 'text-slate-600', bg: 'bg-slate-50' },
    ];

    return (
        <div className="space-y-12 animate-in lg:p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight lg:text-5xl">
                        Exporter <span className="text-blue-600">Terminal</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-2 text-lg">Manage global logistics and document verification.</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/discovery')}
                    className="btn-primary w-full lg:w-auto lg:px-8 lg:py-4 shadow-2xl shadow-blue-100/50"
                >
                    <Search size={20} />
                    Discover Opportunities
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white/80 backdrop-blur-md p-7 rounded-[2.5rem] border border-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.02)] flex items-center gap-6 hover:translate-y-[-4px] transition-all duration-300">
                        <div className={`w-16 h-16 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:ring-8 ring-blue-50/50 transition-all`}>
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
                <div className={`${isFullView ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-8`}>
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                                {isFullView ? 'Comprehensive Shipment Ledger' : 'Active Portfolio'}
                            </h2>
                        </div>
                        {!isFullView && (
                            <button onClick={() => navigate('/dashboard/shipments')} className="text-xs font-black text-blue-600 flex items-center gap-2 hover:gap-3 transition-all uppercase tracking-widest">
                                View Full Portfolio <ArrowRight size={14} />
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-white/50 backdrop-blur-md rounded-[2.5rem] border border-white/60">
                            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Synchronizing Shipments...</p>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {trades.filter(t => t.status !== 'OPEN_FOR_OFFERS').slice(0, isFullView ? undefined : 4).map((trade) => (
                                <div key={trade.id} className="card-premium group cursor-pointer" onClick={() => navigate(`/dashboard/shipments/${trade.id}`)}>
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 flex-shrink-0 bg-slate-50 rounded-[1.25rem] flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-6 transition-all duration-500">
                                                <Truck size={28} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 text-xl tracking-tight">Trade #{trade.blockchainId !== null && trade.blockchainId !== undefined ? trade.blockchainId : trade.id.slice(0, 8)}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Clock size={12} className="text-slate-400" />
                                                    <p className="text-xs font-bold text-slate-400">Value: ${trade.amount.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between w-full md:w-auto md:flex-col md:items-end gap-2">
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] ${['LOC_INITIATED', 'LOC_UPLOADED'].includes(trade.status) ? 'bg-amber-100 text-amber-700' :
                                                trade.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                                    ['LOC_APPROVED', 'FUNDS_LOCKED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'CUSTOMS_CLEARED'].includes(trade.status) ? 'bg-emerald-50 text-emerald-600' :
                                                        'bg-blue-100 text-blue-700'
                                                }`}>
                                                {trade.status.replace(/_/g, ' ')}
                                            </span>
                                            <p className="text-[10px] font-bold text-slate-400 italic uppercase tracking-widest">
                                                {['LOC_INITIATED'].includes(trade.status) ? 'Action Required: Upload Docs' : 
                                                 ['PAYMENT_AUTHORIZED'].includes(trade.status) ? 'Action Required: Confirm Settlement' :
                                                 'Awaiting Next Step'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {trades.filter(t => t.status !== 'OPEN_FOR_OFFERS').length === 0 && (
                                <div className="bg-white/60 backdrop-blur-md border border-white/60 rounded-[2.5rem] p-20 text-center shadow-sm">
                                    <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                                        <Briefcase size={40} />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">No Active Pipeline</h3>
                                    <p className="text-slate-500 font-medium max-w-sm mx-auto mb-8">Secure new trade opportunities by bidding on open market requests.</p>
                                    <button
                                        onClick={() => navigate('/dashboard/discovery')}
                                        className="btn-secondary mx-auto"
                                    >
                                        Explore Marketplace
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {!isFullView && (
                    <div className="lg:col-span-4 space-y-8">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Opportunities</h2>
                        </div>

                        <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden group shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                                <Globe size={180} />
                            </div>

                            <div className="relative z-10 space-y-8">
                                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md w-16 h-16 flex items-center justify-center">
                                    <Zap className="text-blue-400" size={32} />
                                </div>

                                <div>
                                    <h3 className="text-2xl font-black tracking-tight leading-tight">Marketplace Intelligence</h3>
                                    <p className="text-slate-400 text-sm mt-3 leading-relaxed font-medium">
                                        Identify high-margin global trade requests verified on the blockchain.
                                    </p>
                                </div>

                                <div className="space-y-4 pt-6 border-t border-white/10">
                                    <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-[0.2em]">
                                        <span className="text-slate-500">Live Trade Stream</span>
                                        <span className="text-blue-400">{trades.length} Active</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000"
                                            style={{ width: trades.length > 0 ? '75%' : '0%' }}
                                        ></div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => navigate('/dashboard/discovery')}
                                    className="btn-primary w-full shadow-none hover:bg-white hover:text-slate-900 transition-colors uppercase tracking-[0.2em] text-[10px]"
                                >
                                    Access Global Hub
                                </button>
                            </div>
                        </div>

                        <div className="card-premium p-10 !bg-blue-50/20 border-dashed border-blue-200/50">
                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-3">Protocol Directive</h4>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                Ensure all shipping documents are cryptographically signed before on-chain submission to prevent settlement delays.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>

    );
};

export default ExporterDashboard;

