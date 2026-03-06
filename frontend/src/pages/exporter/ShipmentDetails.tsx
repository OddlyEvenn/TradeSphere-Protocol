import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    ArrowLeft,
    Truck,
    FileText,
    Landmark,
    CheckCircle2,
    Clock,
    ShieldCheck,
    Upload
} from 'lucide-react';
import { walletService } from '../../services/WalletService';
import { useToast } from '../../contexts/ToastContext';

const ShipmentDetails: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [trade, setTrade] = useState<any>(null);
    const [banks, setBanks] = useState<any[]>([]);
    const [carriers, setCarriers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBankId, setSelectedBankId] = useState('');
    const [selectedCarrierId, setSelectedCarrierId] = useState('');
    const [processing, setProcessing] = useState(false);
    const [account, setAccount] = useState<string | null>(null);
    const toast = useToast();

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const [tradeRes, banksRes, carriersRes] = await Promise.all([
                api.get(`/trades/${id}`),
                api.get('/users?role=EXPORTER_BANK'),
                api.get('/users?role=SHIPPING')
            ]);
            setTrade(tradeRes.data);
            setBanks(banksRes.data);
            setCarriers(carriersRes.data);
            if (tradeRes.data.exporterBankId) setSelectedBankId(tradeRes.data.exporterBankId);
            if (tradeRes.data.shippingId) setSelectedCarrierId(tradeRes.data.shippingId);

            const acc = await walletService.connect();
            setAccount(acc);
        } catch (err) {
            console.error('Failed to fetch shipment data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleNominateBank = async () => {
        if (!selectedBankId) return toast.error("Please select a bank first.");
        setProcessing(true);
        try {
            await api.patch(`/trades/${id}`, {
                exporterBankId: selectedBankId,
                status: 'EXPORTER_BANK_NOMINATED'
            });
            toast.success("Exporter Bank Nominated! They will now review the Letter of Credit.");
            fetchData();
        } catch (err) {
            console.error('Failed to nominate bank', err);
            toast.error("Failed to nominate bank.");
        } finally {
            setProcessing(false);
        }
    };

    const handleNominateCarrier = async () => {
        if (!selectedCarrierId) return toast.error("Please select a shipping carrier first.");
        setProcessing(true);
        try {
            await api.patch(`/trades/${id}`, {
                shippingId: selectedCarrierId,
                status: 'SHIPPING_NOMINATED'
            });
            toast.success("Shipping Carrier Nominated! You can now proceed to ship the goods.");
            fetchData();
        } catch (err) {
            console.error('Failed to nominate carrier', err);
            toast.error("Failed to nominate carrier.");
        } finally {
            setProcessing(false);
        }
    };

    const handleMarkAsShipped = async () => {
        setProcessing(true);
        try {
            await api.patch(`/trades/${id}`, { status: 'GOODS_SHIPPED' });
            toast.success("Goods marked as SHIPPED! Documents are now ready for verification.");
            fetchData();
        } catch (err) {
            console.error('Failed to ship goods', err);
            toast.error("Failed to update shipping status.");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-t-indigo-600"></div></div>;

    return (
        <div className="max-w-6xl mx-auto space-y-10">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Shipment Management</h1>
                    <p className="text-slate-500 font-medium mt-1">Status: <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-black uppercase tracking-widest">{trade?.status}</span></p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1 space-y-8">
                    <div className="card-premium">
                        <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                            <Clock className="text-indigo-600" />
                            Timeline
                        </h2>
                        <div className="space-y-6">
                            {[
                                { status: 'LOC_ISSUED', label: 'LoC Issued', done: ['LOC_ISSUED', 'EXPORTER_BANK_NOMINATED', 'LOC_VERIFIED', 'SHIPPING_NOMINATED', 'GOODS_SHIPPED', 'DOCS_SUBMITTED', 'DOCS_VERIFIED', 'COMPLETED'].includes(trade.status) },
                                { status: 'EXPORTER_BANK_NOMINATED', label: 'Bank Nominated', done: ['EXPORTER_BANK_NOMINATED', 'LOC_VERIFIED', 'SHIPPING_NOMINATED', 'GOODS_SHIPPED', 'DOCS_SUBMITTED', 'DOCS_VERIFIED', 'COMPLETED'].includes(trade.status) },
                                { status: 'LOC_VERIFIED', label: 'LoC Verified by Bank', done: ['LOC_VERIFIED', 'SHIPPING_NOMINATED', 'GOODS_SHIPPED', 'DOCS_SUBMITTED', 'DOCS_VERIFIED', 'COMPLETED'].includes(trade.status) },
                                { status: 'SHIPPING_NOMINATED', label: 'Carrier Assigned', done: ['SHIPPING_NOMINATED', 'GOODS_SHIPPED', 'DOCS_SUBMITTED', 'DOCS_VERIFIED', 'COMPLETED'].includes(trade.status) },
                                { status: 'GOODS_SHIPPED', label: 'Goods Shipped', done: ['GOODS_SHIPPED', 'DOCS_SUBMITTED', 'DOCS_VERIFIED', 'COMPLETED'].includes(trade.status) },
                                { status: 'DOCS_VERIFIED', label: 'Documents Cleared', done: ['DOCS_VERIFIED', 'COMPLETED'].includes(trade.status) },
                            ].map((s, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${s.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        {s.done ? <CheckCircle2 size={14} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                    </div>
                                    <p className={`text-sm font-bold ${s.done ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-8">
                    {/* Bank Selection */}
                    {trade.status === 'LOC_ISSUED' && (
                        <div className="card-premium border-indigo-100 bg-indigo-50/10">
                            <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                                <Landmark className="text-indigo-600" size={24} />
                                Select Your Advising Bank
                            </h2>
                            <p className="text-slate-500 text-sm mb-6">You must select a bank to verify the Letters of Credit and handle your payments.</p>
                            <div className="flex gap-4">
                                <select
                                    className="input-premium flex-1"
                                    value={selectedBankId}
                                    onChange={(e) => setSelectedBankId(e.target.value)}
                                >
                                    <option value="">Choose a bank...</option>
                                    {banks.map(bank => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
                                </select>
                                <button
                                    onClick={handleNominateBank}
                                    disabled={processing}
                                    className="btn-primary px-8"
                                >
                                    {processing ? '...' : 'Nominate'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Shipping Nomination */}
                    {trade.status === 'LOC_VERIFIED' && (
                        <div className="card-premium border-indigo-100 bg-indigo-50/10">
                            <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                                <Truck className="text-indigo-600" size={24} />
                                Nominate Shipping Carrier
                            </h2>
                            <p className="text-slate-500 text-sm mb-6">Select the logistics provider responsible for transporting your goods.</p>
                            <div className="flex gap-4">
                                <select
                                    className="input-premium flex-1"
                                    value={selectedCarrierId}
                                    onChange={(e) => setSelectedCarrierId(e.target.value)}
                                >
                                    <option value="">Choose a carrier...</option>
                                    {carriers.map(carrier => <option key={carrier.id} value={carrier.id}>{carrier.name}</option>)}
                                </select>
                                <button
                                    onClick={handleNominateCarrier}
                                    disabled={processing}
                                    className="btn-primary px-8"
                                >
                                    {processing ? '...' : 'Nominate Carrier'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Shipping Action */}
                    {(trade.status === 'SHIPPING_NOMINATED' || trade.status === 'GOODS_SHIPPED') && (
                        <div className="card-premium border-emerald-100 bg-emerald-50/10">
                            <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                                <Truck className="text-emerald-600" size={24} />
                                {trade.status === 'GOODS_SHIPPED' ? 'Shipment in Transit' : 'Initiate Shipment'}
                            </h2>
                            <p className="text-slate-500 text-sm mb-6">
                                {trade.status === 'GOODS_SHIPPED'
                                    ? 'The goods have been marked as shipped. Shipping carrier will now verify the load.'
                                    : 'Once goods are loaded, mark this trade as shipped to trigger document verification.'}
                            </p>
                            <button
                                onClick={handleMarkAsShipped}
                                disabled={processing || trade.status === 'GOODS_SHIPPED'}
                                className="btn-primary bg-emerald-600 hover:bg-emerald-700 w-full py-4 text-white disabled:opacity-50"
                            >
                                <Truck size={18} />
                                {processing ? 'Updating...' : trade.status === 'GOODS_SHIPPED' ? 'Goods Shipped' : 'Confirm Goods Shipped'}
                            </button>
                        </div>
                    )}

                    {/* Document View */}
                    {['GOODS_SHIPPED', 'DOCS_VERIFIED', 'PAYMENT_AUTHORIZED'].includes(trade.status) && (
                        <div className="card-premium">
                            <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                <FileText className="text-indigo-600" />
                                Export Documents
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-center">
                                    <Upload className="text-slate-300 mb-2" size={32} />
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Bill of Lading</p>
                                    <p className="text-[10px] text-slate-300 mt-1">Pending Sync</p>
                                </div>
                                <div className="p-6 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-center">
                                    <Upload className="text-slate-300 mb-2" size={32} />
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Commercial Invoice</p>
                                    <p className="text-[10px] text-slate-300 mt-1">Pending Sync</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShipmentDetails;
