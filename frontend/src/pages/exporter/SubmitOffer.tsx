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
    CheckCircle2,
    Clock,
    Award
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const SubmitOffer: React.FC = () => {
    const { tradeId } = useParams();
    const navigate = useNavigate();
    const { user } = useOutletContext<{ user: any }>();

    const [trade, setTrade] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const toast = useToast();

    const [formData, setFormData] = useState({
        amount: '',
        shippingTimeline: '',
        termsAndConditions: '',
        deliveryTerms: 'CIF',
        message: ''
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

        if (!formData.shippingTimeline.trim()) {
            toast.error("Please provide a shipping timeline.");
            return;
        }
        if (!formData.termsAndConditions.trim()) {
            toast.error("Please provide your terms and conditions.");
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/marketplace/offers', {
                tradeId,
                amount: parseFloat(formData.amount),
                shippingTimeline: formData.shippingTimeline,
                termsAndConditions: formData.termsAndConditions,
                deliveryTerms: formData.deliveryTerms,
                message: formData.message || null,
                status: 'PENDING'
            });
            toast.success("Offer submitted successfully! The Importer will review and finalize the trade.");
            navigate('/dashboard/discovery');
        } catch (err: any) {
            console.error('Submission failed', err);
            toast.error("Failed to submit offer: " + (err.response?.data?.message || err.message));
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
                            {trade?.qualityStandards && (
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quality Standards</p>
                                    <p className="font-bold text-amber-400 text-sm">{trade.qualityStandards}</p>
                                </div>
                            )}
                            {trade?.priceRange && (
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Budget Range</p>
                                    <p className="font-bold text-emerald-400">${trade.priceRange}</p>
                                </div>
                            )}
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
                        {/* Price Quotation */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Price Quotation (USD)</label>
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

                        {/* Delivery Terms (Incoterms) */}
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

                    {/* Shipping Timeline */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Shipping Timeline</label>
                        <div className="relative">
                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="text"
                                required
                                className="input-premium pl-12"
                                placeholder="e.g. 12–15 business days from LoC issuance"
                                value={formData.shippingTimeline}
                                onChange={e => setFormData({ ...formData, shippingTimeline: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Terms & Conditions */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Terms & Conditions</label>
                        <div className="relative">
                            <FileText className="absolute left-4 top-4 text-slate-300" size={18} />
                            <textarea
                                rows={5}
                                required
                                className="input-premium py-4 pl-12"
                                placeholder="Detail payment terms, warranty, penalties for delays, quality guarantees, inspection rights..."
                                value={formData.termsAndConditions}
                                onChange={e => setFormData({ ...formData, termsAndConditions: e.target.value })}
                            ></textarea>
                        </div>
                    </div>

                    {/* Additional Message (Optional) */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Additional Message <span className="text-slate-300">(Optional)</span></label>
                        <textarea
                            rows={3}
                            className="input-premium py-4"
                            placeholder="Any extra notes for the importer..."
                            value={formData.message}
                            onChange={e => setFormData({ ...formData, message: e.target.value })}
                        ></textarea>
                    </div>

                    <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100/50 space-y-4">
                        <h4 className="font-black text-indigo-900 text-sm italic">Next Steps after Finalization:</h4>
                        <ul className="space-y-3">
                            {[
                                "Importer compares & accepts your offer",
                                "Both parties confirm → Trade Initiated on blockchain",
                                "Importer's Bank issues Digital Letter of Credit",
                                "Exporter ships goods & Bill of Lading is verified"
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
