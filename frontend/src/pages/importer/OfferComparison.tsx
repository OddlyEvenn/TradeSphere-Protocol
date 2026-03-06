import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import {
    ArrowLeft,
    CheckCircle2,
    XCircle,
    DollarSign,
    Clock,
    FileText,
    User,
    Package,
    MapPin,
    Award,
    Truck,
    Loader2
} from 'lucide-react';

interface Offer {
    id: string;
    exporterId: string;
    amount: number;
    shippingTimeline: string;
    termsAndConditions: string;
    deliveryTerms: string;
    message: string | null;
    validUntil: string | null;
    status: string;
    createdAt: string;
    exporter: {
        id: string;
        name: string;
        email: string;
        organizationName?: string;
        country?: string;
    };
}

interface Trade {
    id: string;
    productName: string;
    quantity: string;
    destination: string;
    amount: number;
    priceRange: string | null;
    qualityStandards: string | null;
    shippingDeadline: string | null;
    status: string;
    _count?: { offers: number };
}

const OfferComparison: React.FC = () => {
    const { tradeId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { user } = useOutletContext<{ user: any }>();

    const [trade, setTrade] = useState<Trade | null>(null);
    const [offers, setOffers] = useState<Offer[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [tradeId]);

    const fetchData = async () => {
        try {
            const [tradeRes, offersRes] = await Promise.all([
                api.get(`/trades/${tradeId}`),
                api.get(`/marketplace/trades/${tradeId}/offers`)
            ]);
            setTrade(tradeRes.data);
            setOffers(offersRes.data);
        } catch (err) {
            console.error('Failed to fetch data', err);
            toast.error('Failed to load offers');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (offerId: string) => {
        if (!window.confirm("Are you sure you want to accept this offer? All other pending offers will be automatically declined.")) return;

        setActionLoading(offerId);
        try {
            await api.post(`/marketplace/offers/${offerId}/accept`);
            toast.success("Offer accepted! Trade is now in OFFER_ACCEPTED state.");
            // Refresh data
            await fetchData();
        } catch (err: any) {
            console.error('Failed to accept offer', err);
            toast.error("Failed to accept offer: " + (err.response?.data?.message || err.message));
        } finally {
            setActionLoading(null);
        }
    };

    const handleDecline = async (offerId: string) => {
        if (!window.confirm("Are you sure you want to decline this offer?")) return;

        setActionLoading(offerId);
        try {
            await api.post(`/marketplace/offers/${offerId}/decline`);
            toast.success("Offer declined.");
            await fetchData();
        } catch (err: any) {
            console.error('Failed to decline offer', err);
            toast.error("Failed to decline offer: " + (err.response?.data?.message || err.message));
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACCEPTED':
                return <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">Accepted</span>;
            case 'DECLINED':
                return <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest">Declined</span>;
            default:
                return <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest">Pending</span>;
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-indigo-600"></div></div>;

    const pendingOffers = offers.filter(o => o.status === 'PENDING');
    const decidedOffers = offers.filter(o => o.status !== 'PENDING');
    const isTradeOpen = trade?.status === 'OPEN_FOR_OFFERS';

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/dashboard/trades')}
                    className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Compare Offers</h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Review and compare exporter proposals for <span className="text-indigo-600 font-bold">{trade?.productName}</span>
                    </p>
                </div>
            </div>

            {/* Trade Summary Bar */}
            <div className="card-premium bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</p>
                        <p className="font-bold flex items-center gap-2"><Package size={14} className="text-indigo-400" />{trade?.productName}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</p>
                        <p className="font-bold">{trade?.quantity}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</p>
                        <p className="font-bold flex items-center gap-2"><MapPin size={14} className="text-indigo-400" />{trade?.destination}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Budget Range</p>
                        <p className="font-bold text-emerald-400">{trade?.priceRange ? `$${trade.priceRange}` : `~$${trade?.amount?.toLocaleString()}`}</p>
                    </div>
                    {trade?.qualityStandards && (
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quality Req.</p>
                            <p className="font-bold text-amber-400 text-sm flex items-center gap-1"><Award size={14} />{trade.qualityStandards}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Offer Count Summary */}
            <div className="flex gap-4">
                <div className="px-5 py-3 bg-amber-50 rounded-2xl border border-amber-100">
                    <span className="text-2xl font-black text-amber-600">{pendingOffers.length}</span>
                    <span className="text-xs font-bold text-amber-700 ml-2">Pending</span>
                </div>
                <div className="px-5 py-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <span className="text-2xl font-black text-emerald-600">{offers.filter(o => o.status === 'ACCEPTED').length}</span>
                    <span className="text-xs font-bold text-emerald-700 ml-2">Accepted</span>
                </div>
                <div className="px-5 py-3 bg-rose-50 rounded-2xl border border-rose-100">
                    <span className="text-2xl font-black text-rose-600">{offers.filter(o => o.status === 'DECLINED').length}</span>
                    <span className="text-xs font-bold text-rose-700 ml-2">Declined</span>
                </div>
            </div>

            {/* Offers */}
            {offers.length === 0 ? (
                <div className="card-premium text-center py-20">
                    <Package className="mx-auto text-slate-300 mb-4" size={48} />
                    <h3 className="text-xl font-bold text-slate-900 mb-1">No Offers Yet</h3>
                    <p className="text-slate-500 font-medium">Exporters haven't submitted offers for this trade request yet.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Pending Offers - Comparison Cards */}
                    {pendingOffers.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Pending Offers — Compare & Decide</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {pendingOffers.map((offer) => (
                                    <div key={offer.id} className="card-premium border-2 border-transparent hover:border-indigo-100 transition-all">
                                        {/* Exporter Header */}
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                                    <User size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-slate-900">{offer.exporter.name}</h3>
                                                    <p className="text-xs text-slate-400 font-bold">
                                                        {offer.exporter.organizationName || offer.exporter.email}
                                                        {offer.exporter.country && ` • ${offer.exporter.country}`}
                                                    </p>
                                                </div>
                                            </div>
                                            {getStatusBadge(offer.status)}
                                        </div>

                                        {/* Comparison Data */}
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><DollarSign size={10} />Price Quotation</p>
                                                    <p className="text-2xl font-black text-emerald-600">${offer.amount.toLocaleString()}</p>
                                                </div>
                                                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Clock size={10} />Shipping Timeline</p>
                                                    <p className="text-sm font-black text-indigo-700">{offer.shippingTimeline}</p>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Truck size={10} />Delivery Terms</p>
                                                <p className="text-sm font-bold text-slate-700">{offer.deliveryTerms}</p>
                                            </div>

                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><FileText size={10} />Terms & Conditions</p>
                                                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{offer.termsAndConditions}</p>
                                            </div>

                                            {offer.message && (
                                                <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Note from Exporter</p>
                                                    <p className="text-xs text-slate-600 italic">{offer.message}</p>
                                                </div>
                                            )}

                                            <p className="text-[10px] text-slate-400 font-bold">Submitted: {new Date(offer.createdAt).toLocaleString()}</p>
                                        </div>

                                        {/* Action Buttons */}
                                        {isTradeOpen && (
                                            <div className="flex gap-3 mt-6 pt-6 border-t border-slate-100">
                                                <button
                                                    onClick={() => handleAccept(offer.id)}
                                                    disabled={actionLoading === offer.id}
                                                    className="flex-1 py-3.5 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50"
                                                >
                                                    {actionLoading === offer.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                                    Accept Offer
                                                </button>
                                                <button
                                                    onClick={() => handleDecline(offer.id)}
                                                    disabled={actionLoading === offer.id}
                                                    className="flex-1 py-3.5 bg-white text-rose-600 font-black rounded-2xl border-2 border-rose-100 hover:bg-rose-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    <XCircle size={18} />
                                                    Decline
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Decided Offers */}
                    {decidedOffers.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-black text-slate-500 uppercase tracking-wider">Decided Offers</h2>
                            <div className="space-y-3">
                                {decidedOffers.map((offer) => (
                                    <div key={offer.id} className={`card-premium py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${offer.status === 'ACCEPTED' ? 'border-emerald-200 bg-emerald-50/30' : 'opacity-60'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${offer.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-900">{offer.exporter.name}</h4>
                                                <p className="text-xs text-slate-400 font-bold">{offer.exporter.organizationName || offer.exporter.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-lg font-black text-slate-900">${offer.amount.toLocaleString()}</p>
                                                <p className="text-xs text-slate-400 font-bold">{offer.shippingTimeline}</p>
                                            </div>
                                            {getStatusBadge(offer.status)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default OfferComparison;
