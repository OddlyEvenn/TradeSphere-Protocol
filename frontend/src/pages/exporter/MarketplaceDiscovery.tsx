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
    Filter,
    Award,
    Calendar,
    Briefcase,
    Zap
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface TradeRequest {
    id: string;
    product?: string;
    productName?: string;
    quantity: string;
    destination: string;
    amount: number;
    qualityStandards?: string;
    shippingDeadline?: string;
    insuranceRequired?: boolean;
    createdAt: string;
    _count?: { offers: number };
}

const MarketplaceDiscovery: React.FC = () => {
    const { user } = useOutletContext<{ user: any }>();
    const [requests, setRequests] = useState<TradeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const toast = useToast();

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const res = await api.get('/trades/marketplace');
            setRequests(res.data);
        } catch (err) {
            console.error('Failed to fetch trade requests', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredRequests = requests.filter(req => {
        const name = (req.productName || req.product || '').toLowerCase();
        const dest = (req.destination || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return name.includes(search) || dest.includes(search);
    });

    return (
        <div className="space-y-12 animate-in lg:p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight lg:text-5xl">Trade Discovery</h1>
                    <p className="text-slate-500 font-medium mt-2 text-lg max-w-2xl">
                        Identify and bid on high-value trade requests from verified global importers.
                    </p>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-80 group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Filter product or destination..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-premium pl-14"
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white/60 backdrop-blur-md rounded-[3rem] border border-white/60 shadow-sm">
                    <div className="w-14 h-14 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6"></div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Scanning Global Ledger...</p>
                </div>
            ) : filteredRequests.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredRequests.map((req) => (
                        <div key={req.id} className="card-premium group flex flex-col h-full hover:translate-y-[-8px]">
                            <div className="flex justify-between items-start mb-8">
                                <div className="p-4 bg-blue-50 text-blue-600 rounded-[1.25rem] group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-6 transition-all duration-500">
                                    <Globe size={32} />
                                </div>
                                <div className="flex flex-col items-end gap-2 text-right">
                                    <span className="px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border border-emerald-100/50">
                                        Verified Asset
                                    </span>
                                    {(req._count?.offers || 0) > 0 && (
                                        <span className="px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border border-blue-100/50">
                                            {req._count?.offers} {req._count?.offers === 1 ? 'Bid' : 'Bids'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 space-y-6">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 leading-tight tracking-tight group-hover:text-blue-600 transition-colors">
                                        {req.productName || (req as any).product}
                                    </h3>
                                    <div className="flex items-center gap-2 text-slate-400 mt-2 font-black text-[11px] uppercase tracking-wider">
                                        <MapPin size={14} className="text-blue-600" />
                                        <span>{req.destination}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 py-6 border-y border-white/60">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Quantity</p>
                                        <div className="flex items-center gap-2">
                                            <Package size={14} className="text-slate-300" />
                                            <p className="text-sm font-black text-slate-700">{req.quantity || 'Bulk Order'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">SDR Budget</p>
                                        <p className="text-xl font-black text-blue-600">${req.amount.toLocaleString()}</p>
                                    </div>
                                </div>

                                {req.qualityStandards && (
                                    <div className="flex items-start gap-3 p-4 bg-white/40 rounded-2xl border border-white/60 group-hover:bg-white/60 transition-all duration-300">
                                        <div className="text-blue-600 mt-0.5">
                                            <Award size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Compliance Standards</p>
                                            <p className="text-xs font-bold text-slate-700 leading-relaxed mt-1.5">{req.qualityStandards}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-slate-300" />
                                        <span>
                                            {req.shippingDeadline
                                                ? `By ${new Date(req.shippingDeadline).toLocaleDateString()}`
                                                : 'No Deadline'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={14} className="text-emerald-500" />
                                        <span>{req.insuranceRequired ? 'Protected' : 'Standard'}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate(`/dashboard/discovery/submit-offer/${req.id}`)}
                                className="btn-primary w-full mt-10 shadow-xl shadow-blue-100/50"
                            >
                                <Zap size={18} />
                                Submit Trade Bid
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white/60 backdrop-blur-md border border-white/60 rounded-[3rem] py-40 text-center shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-600/10"></div>
                    <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-slate-200">
                        <Search size={48} />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Market Intelligence Empty</h3>
                    <p className="text-slate-500 font-medium max-w-md mx-auto">New global trade requests are synchronized from the blockchain in real-time. Check back shortly for new opportunities.</p>
                </div>
            )}

        </div>
    );
};

export default MarketplaceDiscovery;

