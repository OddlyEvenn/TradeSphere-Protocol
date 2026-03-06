import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import {
    ArrowLeft,
    Send,
    Package,
    MapPin,
    DollarSign,
    Calendar,
    ShieldCheck,
    Info
} from 'lucide-react';

const CreateTradeRequest: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const toast = useToast();
    const [formData, setFormData] = useState({
        productName: '',
        quantity: '',
        destination: '',
        priceRange: '',
        shippingDeadline: '',
        insuranceRequired: true,
        additionalConditions: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/trades', {
                ...formData,
                amount: parseFloat(formData.priceRange.split('-')[1] || formData.priceRange) || 0,
                status: 'OPEN_FOR_OFFERS'
            });
            toast.success("Trade Request Published to Marketplace Successfully!");
            navigate('/dashboard/trades');
        } catch (err) {
            console.error('Failed to create trade request', err);
            toast.error("Failed to publish trade request.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Create Trade Request</h1>
                    <p className="text-slate-500 font-medium mt-1">Publish your requirements to the exporter marketplace.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="card-premium space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Product / Goods</label>
                        <div className="relative">
                            <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="text"
                                required
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold transition-all"
                                placeholder="e.g. 500 MT Raw Copper"
                                value={formData.productName}
                                onChange={e => setFormData({ ...formData, productName: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                        <div className="relative">
                            <Info className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="text"
                                required
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold transition-all"
                                placeholder="e.g. 500 Metric Tons"
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Destination Country</label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="text"
                                required
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold transition-all"
                                placeholder="e.g. Singapore"
                                value={formData.destination}
                                onChange={e => setFormData({ ...formData, destination: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Expected Price Range (USD)</label>
                        <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="text"
                                required
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold transition-all"
                                placeholder="e.g. 100000 - 120000"
                                value={formData.priceRange}
                                onChange={e => setFormData({ ...formData, priceRange: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Shipping Deadline</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="date"
                                required
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold transition-all"
                                value={formData.shippingDeadline}
                                onChange={e => setFormData({ ...formData, shippingDeadline: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 h-full pt-6">
                        <div
                            onClick={() => setFormData({ ...formData, insuranceRequired: !formData.insuranceRequired })}
                            className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-all ${formData.insuranceRequired ? 'bg-indigo-600' : 'bg-slate-200'}`}
                        >
                            <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all ${formData.insuranceRequired ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <ShieldCheck className={formData.insuranceRequired ? 'text-indigo-600' : 'text-slate-300'} size={20} />
                            <span className="text-sm font-bold text-slate-700">Insurance Required</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Additional Conditions</label>
                    <textarea
                        rows={4}
                        className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-3xl py-4 px-6 text-slate-900 font-bold transition-all resize-none"
                        placeholder="Specify any specific compliance or document requirements..."
                        value={formData.additionalConditions}
                        onChange={e => setFormData({ ...formData, additionalConditions: e.target.value })}
                    ></textarea>
                </div>

                <div className="flex items-center justify-end gap-4 pt-4">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                    >
                        {loading ? 'Publishing...' : 'Publish to Marketplace'}
                        <Send size={18} />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateTradeRequest;
