import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import {
    ArrowLeft,
    Send,
    FileText,
    DollarSign,
    Clipboard,
    ShieldCheck,
    Truck,
    Info,
    CheckCircle2
} from 'lucide-react';

const SubmitOffer: React.FC = () => {
    const { tradeId } = useParams();
    const navigate = useNavigate();
    const { user } = useOutletContext<{ user: any }>();

    const [trade, setTrade] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        amount: '',
        message: '',
        validUntil: '',
        deliveryTerms: 'CIF' // Cost, Insurance, and Freight
    });

    useEffect(() => {
        fetchTradeDetails();
    }, [tradeId]);

    const fetchTradeDetails = async () => {
        try {
            const res = await api.get(`/trades/${tradeId}`);
            setTrade(res.data);
        } catch (err) {
            console.error('Failed to fetch trade details', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tradeId) return;

        setSubmitting(true);
        try {
            await api.post('/marketplace/offers', {
                tradeId,
                amount: parseFloat(formData.amount),
                message: formData.message,
                status: 'PENDING'
            });
            alert("✅ Offer submitted successfully! The Importer will review and finalize the trade.");
            navigate('/dashboard/discovery');
        } catch (err: any) {
            console.error('Submission failed', err);
            alert("❌ Failed to submit offer: " + (err.response?.data?.message || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-t-indigo-600"></div></div>;

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Submit Formal Offer</h1>
                    <p className="text-slate-500 font-medium mt-1">Provide pricing and terms for: <span className="text-indigo-600 font-bold">{trade?.productName}</span></p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Right Column: Request Summary */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="card-premium bg-slate-900 text-white">
                        <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                            <Clipboard size={18} className="text-indigo-400" />
                            Request Summary
                        </h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Importer</p>
                                <p className="font-bold">{trade?.importer?.name}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Quantity</p>
                                <p className="font-bold">{trade?.quantity}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Destination</p>
                                <p className="font-bold flex items-center gap-2">
                                    <Truck size={14} className="text-indigo-400" />
                                    {trade?.destination}
                                </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Insurance Required</p>
                                <p className="font-bold text-emerald-400">{trade?.insuranceRequired ? 'Yes' : 'No'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-premium border-amber-100 bg-amber-50/30">
                        <h4 className="font-black text-amber-900 flex items-center gap-2 mb-2 uppercase text-xs tracking-widest">
                            <Info size={16} />
                            Stakeholder Flow
                        </h4>
                        <p className="text-xs text-amber-800 font-medium leading-relaxed">
                            Once you submit, the <strong>Importer</strong> will finalize their choice. Acceptance triggers the on-chain trade setup where Banks will issue the <strong>Letter of Credit (LoC)</strong>.
                        </p>
                    </div>
                </div>

                {/* Left Column: Form */}
                <form onSubmit={handleSubmit} className="lg:col-span-2 card-premium space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Your Quote (Total USD)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input
                                    type="number"
                                    required
                                    className="input-premium pl-12"
                                    placeholder="e.g. 115000"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Delivery Terms (Incoterms)</label>
                            <select
                                className="input-premium cursor-pointer"
                                value={formData.deliveryTerms}
                                onChange={e => setFormData({ ...formData, deliveryTerms: e.target.value })}
                            >
                                <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                                <option value="FOB">FOB (Free on Board)</option>
                                <option value="EXW">EXW (Ex Works)</option>
                                <option value="DDP">DDP (Delivered Duty Paid)</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Terms & Conditions / Message</label>
                        <textarea
                            rows={6}
                            className="input-premium py-4"
                            placeholder="Detail your shipping capabilities, product quality specifications, and any extra terms..."
                            value={formData.message}
                            onChange={e => setFormData({ ...formData, message: e.target.value })}
                        ></textarea>
                    </div>

                    <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100/50 space-y-4">
                        <h4 className="font-black text-indigo-900 text-sm italic">Next Steps after Finalization:</h4>
                        <ul className="space-y-3">
                            {[
                                "Importer Accepts your offer",
                                "Importer's Bank issues Digital Letter of Credit",
                                "Exporter signs and processes shipment",
                                "Digital B/L verified by Customs & Shipping stakeholders"
                            ].map((step, i) => (
                                <li key={i} className="flex items-center gap-3 text-xs font-bold text-indigo-700">
                                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">{i + 1}</div>
                                    {step}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex items-center justify-end gap-4 pt-4">
                        <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={submitting} className="btn-primary">
                            {submitting ? 'Submitting...' : 'Submit Formal Offer'}
                            <Send size={18} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SubmitOffer;
