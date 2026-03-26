import React, { useState } from 'react';
import api from '../services/api';
import { X } from 'lucide-react';

interface CreateTradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTradeCreated: () => void;
}

const CreateTradeModal: React.FC<CreateTradeModalProps> = ({ isOpen, onClose, onTradeCreated }) => {
    const [exporterId, setExporterId] = useState('');
    const [importerBankId, setImporterBankId] = useState('');
    const [exporterBankId, setExporterBankId] = useState('');
    const [amount, setAmount] = useState('');
    const [shippingDeadline, setShippingDeadline] = useState('72'); // Default 72 hours
    const [clearanceDeadline, setClearanceDeadline] = useState('48'); // Default 48 hours
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/trades', {
                exporterId,
                amount,
                importerBankId,
                exporterBankId,
                shippingDeadline: parseInt(shippingDeadline),
                clearanceDeadline: parseInt(clearanceDeadline)
            });
            onTradeCreated();
            onClose();
        } catch (err) {
            console.error('Failed to create trade', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-[0_30px_100px_rgba(0,0,0,0.1)] relative animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">New Transaction</h2>
                        <p className="text-slate-500 font-medium">Initiate decentralized trade ledger</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-primary-800 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="group">
                        <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Destination Entity (Exporter ID)</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white transition-all"
                            placeholder="Exporter User ID"
                            value={exporterId}
                            onChange={(e) => setExporterId(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Importer Bank ID</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white transition-all"
                                placeholder="Bank ID"
                                value={importerBankId}
                                onChange={(e) => setImporterBankId(e.target.value)}
                            />
                        </div>
                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Exporter Bank ID</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white transition-all"
                                placeholder="Bank ID"
                                value={exporterBankId}
                                onChange={(e) => setExporterBankId(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="group">
                        <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Settlement Amount (USD)</label>
                        <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                            <input
                                type="number"
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-10 pr-5 text-slate-900 font-black text-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white transition-all"
                                placeholder="50,000"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Shipping SLA (Hours)</label>
                            <input
                                type="number"
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                                placeholder="72"
                                value={shippingDeadline}
                                onChange={(e) => setShippingDeadline(e.target.value)}
                            />
                        </div>
                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Clearance SLA (Hours)</label>
                            <input
                                type="number"
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                placeholder="48"
                                value={clearanceDeadline}
                                onChange={(e) => setClearanceDeadline(e.target.value)}
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary-800 hover:bg-primary-900 disabled:bg-slate-300 text-white font-black py-5 px-6 rounded-2xl transition-all shadow-xl hover:shadow-primary-100 active:scale-[0.98] mt-4"
                    >
                        {loading ? 'Hasing to Blockchain...' : 'Execute Transaction'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateTradeModal;
