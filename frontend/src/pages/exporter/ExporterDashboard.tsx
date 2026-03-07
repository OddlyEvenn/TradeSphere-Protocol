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
    Search
} from 'lucide-react';

interface Trade {
    id: string;
    blockchainId: number | null;
    status: string;
    amount: number;
    createdAt: string;
}

const ExporterDashboard: React.FC = () => {
    const { user, account } = useOutletContext<{ user: any, account: string | null }>();
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
        { label: 'Active Shipments', value: trades.filter(t => t.status === 'GOODS_SHIPPED').length.toString(), icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Pending Docs', value: trades.filter(t => t.status === 'LOC_ISSUED').length.toString(), icon: FileCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Verified', value: trades.filter(t => t.status === 'DOCS_VERIFIED').length.toString(), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Payments Awaiting', value: trades.filter(t => t.status === 'PAYMENT_AUTHORIZED').length.toString(), icon: Clock, color: 'text-slate-600', bg: 'bg-slate-50' },
    ];

    return (
        <div className="space-y-10">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Exporter Terminal</h1>
                    <p className="text-slate-500 font-medium mt-1">Track incoming credits, manage shipments, and submit documents.</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/discovery')}
                    className="btn-primary"
                >
                    <Search size={20} />
                    Discover Opportunities
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
                <div className={`${isFullView ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-6`}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">{isFullView ? 'All Shipments' : 'Active Portfolio'}</h2>
                        {!isFullView && (
                            <button onClick={() => navigate('/dashboard/shipments')} className="text-sm font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                                View All <ArrowRight size={14} />
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {trades.filter(t => t.status !== 'OPEN_FOR_OFFERS').slice(0, isFullView ? undefined : 3).map((trade) => (
                                <div key={trade.id} className="card-premium group cursor-pointer hover:border-indigo-100" onClick={() => navigate(`/dashboard/shipments/${trade.id}`)}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-5">
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                <Truck size={28} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 text-lg">Trade #{trade.blockchainId !== null && trade.blockchainId !== undefined ? trade.blockchainId : trade.id.slice(0, 8)}</h3>
                                                <p className="text-sm font-bold text-slate-400">Value: ${trade.amount.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${trade.status === 'LOC_ISSUED' ? 'bg-amber-50 text-amber-600' :
                                                trade.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' :
                                                    'bg-indigo-50 text-indigo-700'
                                                }`}>
                                                {trade.status}
                                            </span>
                                            <p className="text-xs font-bold text-slate-400 mt-2 italic">Awaiting document submission</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {trades.filter(t => t.status !== 'OPEN_FOR_OFFERS').length === 0 && (
                                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-16 text-center">
                                    <TrendingUp className="mx-auto text-slate-300 mb-4" size={48} />
                                    <h3 className="text-xl font-bold text-slate-900 mb-1">No Active Trades</h3>
                                    <p className="text-slate-500 font-medium">Explore the marketplace to find new trade opportunities.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {!isFullView && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">Trade Opportunities</h2>
                        <div className="bg-indigo-600 rounded-[2rem] p-8 shadow-xl shadow-indigo-100 text-white space-y-6">
                            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                                <Globe className="text-indigo-100" size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black tracking-tight">Marketplace Insights</h3>
                                <p className="text-indigo-100 text-sm mt-1 font-medium italic opacity-80">Discover high-value trade requests from verified global importers.</p>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                                    <span>Active Requests</span>
                                    <span>{trades.length}</span>
                                </div>
                                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-200" style={{ width: trades.length > 0 ? '60%' : '0%' }}></div>
                                </div>
                            </div>
                            <button
                                onClick={() => navigate('/dashboard/discovery')}
                                className="w-full py-4 bg-white text-indigo-600 font-black rounded-2xl hover:bg-indigo-50 transition-all text-sm"
                            >
                                Explore Open Trades
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExporterDashboard;
