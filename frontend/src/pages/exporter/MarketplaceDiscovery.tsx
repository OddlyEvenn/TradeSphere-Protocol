import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    Globe,
    Search,
    MapPin,
    DollarSign,
    Clock,
    ShieldCheck,
    Package,
    ArrowRight,
    Filter
} from 'lucide-react';

interface TradeRequest {
    id: string;
    product: string;
    quantity: string;
    destination: string;
    amount: number;
    createdAt: string;
}

const MarketplaceDiscovery: React.FC = () => {
    const { user, account } = useOutletContext<{ user: any, account: string | null }>();
    const [requests, setRequests] = useState<TradeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            // Fetch trades with OPEN_FOR_OFFERS status
            const res = await api.get('/trades');
            setRequests(res.data.filter((t: any) => t.status === 'OPEN_FOR_OFFERS'));
        } catch (err) {
            console.error('Failed to fetch trade requests', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight text-white/0 bg-clip-text bg-gradient-to-r from-indigo-600 to-accent">Trade Discovery</h1>
                    <p className="text-slate-500 font-medium mt-1">Exclusive marketplace for exporters to discover and bid on global trade requests.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Filter by product..."
                            className="w-full bg-white border border-slate-100 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-100 transition-all"
                        />
                    </div>
                    <button className="btn-secondary px-4 py-3">
                        <Filter size={20} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-indigo-600"></div>
                </div>
            ) : requests.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {requests.map((req) => (
                        <div key={req.id} className="card-premium flex flex-col group hover:scale-[1.02] transition-transform">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <Globe size={28} />
                                </div>
                                <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    Verified Importer
                                </span>
                            </div>

                            <div className="flex-1 space-y-4">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 leading-tight">{req.product}</h3>
                                    <div className="flex items-center gap-2 text-slate-400 mt-1">
                                        <MapPin size={14} />
                                        <span className="text-xs font-bold uppercase tracking-wider">{req.destination}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quantity</p>
                                        <p className="text-sm font-black text-slate-700">{req.quantity || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Budget</p>
                                        <p className="text-sm font-black text-emerald-600">~${req.amount.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={12} />
                                        Expires in 5 days
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <ShieldCheck size={12} />
                                        LoC Protected
                                    </div>
                                </div>
                            </div>

                            <button className="w-full mt-8 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
                                Submit Offer <ArrowRight size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white border border-slate-100 rounded-[2.5rem] py-32 text-center shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                        <Package size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-1">No Open Requests</h3>
                    <p className="text-slate-400 font-medium">Global trade requests will appear here once published by importers.</p>
                </div>
            )}
        </div>
    );
};

export default MarketplaceDiscovery;
