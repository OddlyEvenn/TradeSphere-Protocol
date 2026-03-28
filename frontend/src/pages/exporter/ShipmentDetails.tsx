import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import DisputePanel from '../../components/DisputePanel';
import api from '../../services/api';
import {
    ArrowLeft,
    Truck,
    FileText,
    Landmark,
    CheckCircle2,
    Clock,
    ShieldCheck,
    Upload,
    Eye,
    Shield,
    ChevronRight,
    Package,
    AlertCircle,
    Globe,
    DollarSign
} from 'lucide-react';
import { walletService } from '../../services/WalletService';
import { useToast } from '../../contexts/ToastContext';

const ShipmentDetails: React.FC = () => {
    const { user } = useOutletContext<any>() || {};
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

    /**
     * ARCHITECTURE: Bank nomination calls TradeRegistry.assignAdvisingBank() on-chain.
     * No DB-only fallback. MetaMask required.
     */
    const handleNominateBank = async () => {
        if (!selectedBankId) return toast.error("Please select a bank first.");
        if (!account) {
            toast.error("MetaMask wallet required to nominate a bank on the blockchain.");
            return;
        }

        setProcessing(true);
        try {
            const selectedBank = banks.find(b => b.id === selectedBankId);
            if (!selectedBank?.walletAddress) {
                toast.error("Selected bank does not have a linked wallet address.");
                setProcessing(false);
                return;
            }

            if (trade.blockchainId === null || trade.blockchainId === undefined) {
                toast.error("This trade is not yet registered on the blockchain. The importer must complete on-chain registration first.");
                setProcessing(false);
                return;
            }

            const registry = walletService.getTradeRegistry();
            const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
            const onChainTrade = await registry.getTrade(trade.blockchainId);

            if (onChainTrade.exporter.toLowerCase() === ZERO_ADDRESS) {
                toast.error("On-chain trade record is invalid (zero-address exporter). Cannot nominate bank.");
                setProcessing(false);
                return;
            }

            const currentWallet = account.toLowerCase();
            if (onChainTrade.exporter.toLowerCase() !== currentWallet) {
                toast.error(
                    `Wallet mismatch! On-chain exporter is ${onChainTrade.exporter.slice(0, 6)}…${onChainTrade.exporter.slice(-4)}, ` +
                    `but you are connected as ${currentWallet.slice(0, 6)}…${currentWallet.slice(-4)}. ` +
                    `Please switch to the correct MetaMask account.`
                );
                setProcessing(false);
                return;
            }

            toast.info("Registering Exporter Bank on the blockchain...");
            const tx = await registry.assignAdvisingBank(trade.blockchainId, selectedBank.walletAddress);
            await tx.wait();

            // Persist bank assignment to DB
            await api.patch(`/trades/${id}`, { exporterBankId: selectedBankId });
            toast.success("Exporter Bank Nominated! They will now review the Letter of Credit.");
            fetchData();
        } catch (err) {
            console.error('Failed to nominate bank', err);
            toast.error("Failed to nominate bank.");
        } finally {
            setProcessing(false);
        }
    };

    // Carrier nomination is now handled by the Importer on-chain in TradeDetails.tsx
    // as per TradeRegistry.sol (onlyImporter modifier).

    const handleViewDocument = (ipfsHash: string) => {
        if (!ipfsHash) return;
        const url = ipfsHash.startsWith('http')
            ? ipfsHash
            : `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        window.open(url, '_blank');
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
                    <p className="text-slate-500 font-medium mt-1">Status: <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-black uppercase tracking-widest">{trade?.status.replace(/_/g, ' ')}</span></p>
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
                                { label: 'Offer Accepted', done: ['OFFER_ACCEPTED', 'TRADE_INITIATED', 'LOC_INITIATED', 'LOC_UPLOADED', 'LOC_APPROVED', 'LOC_ISSUED', 'FUNDS_LOCKED', 'SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                { label: 'Bank Nominated', done: !!trade.exporterBankId },
                                { label: 'LoC Approved', done: ['LOC_APPROVED', 'FUNDS_LOCKED', 'SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                { label: 'Funds Locked', done: ['FUNDS_LOCKED', 'SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                { label: 'Carrier Assigned', done: ['SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                { label: 'Goods Shipped', done: ['GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                { label: 'Customs Decision', done: ['CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                { label: 'Customs Cleared', done: ['CUSTOMS_CLEARED', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                { label: 'Goods Received', done: ['GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                { label: 'Payment Authorized', done: ['PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                { label: 'Settlement Confirmed', done: ['SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                { label: 'Completed', done: trade.status === 'COMPLETED' },
                            ].map((s, i, arr) => (
                                <div key={i} className="flex gap-4 relative">
                                    {i !== arr.length - 1 && (
                                        <div className={`absolute left-[11px] top-6 w-0.5 h-6 ${s.done ? 'bg-emerald-500' : 'bg-slate-100'}`}></div>
                                    )}
                                    <div className={`w-6 h-6 rounded-full flex flex-shrink-0 items-center justify-center z-10 ${s.done ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                                        {s.done ? <CheckCircle2 size={14} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                    </div>
                                    <p className={`text-xs font-black uppercase tracking-wider ${s.done ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-8">
                    {/* Bank Selection — show whenever bank not yet assigned */}
                    {!trade.exporterBankId && ['LOC_INITIATED', 'LOC_UPLOADED', 'LOC_APPROVED', 'FUNDS_LOCKED'].includes(trade.status) && (
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

                    {trade.exporterBankId && ['LOC_INITIATED', 'LOC_UPLOADED', 'LOC_APPROVED'].includes(trade.status) && (
                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3 text-indigo-700">
                            <CheckCircle2 size={20} className="flex-shrink-0" />
                            <p className="text-xs font-bold uppercase tracking-tight">Advising Bank Nominated — Awaiting LoC Approval</p>
                        </div>
                    )}

                    {/* Shipping Action — handled by shipping company, show status to exporter */}
                    {trade.status === 'SHIPPING_ASSIGNED' && (
                        <div className="card-premium border-amber-100 bg-amber-50/10">
                            <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                                <Truck className="text-amber-600" size={24} />
                                Awaiting Shipment
                            </h2>
                            <p className="text-slate-500 text-sm">
                                The shipping carrier has been notified. They will upload the Bill of Lading and confirm dispatch from their dashboard.
                            </p>
                        </div>
                    )}

                    {trade.status === 'GOODS_SHIPPED' && (
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700">
                            <Truck size={20} className="flex-shrink-0" />
                            <p className="text-xs font-bold uppercase tracking-tight">Goods Shipped — Bill of Lading Issued by Carrier</p>
                        </div>
                    )}

                    {/* Document View */}
                    {['GOODS_SHIPPED', 'CUSTOMS_FLAGGED', 'CUSTOMS_CLEARED', 'GOODS_RECEIVED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'PAYMENT_AUTHORIZED', 'COMPLETED'].includes(trade.status) && (
                        <div className="card-premium">
                            <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                <FileText className="text-indigo-600" />
                                Export Documents
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {trade.billOfLading?.ipfsHash ? (
                                    <button
                                        onClick={() => handleViewDocument(trade.billOfLading.ipfsHash)}
                                        className="p-6 border-2 border-indigo-100 bg-indigo-50/30 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-indigo-50 transition-all group"
                                    >
                                        <FileText className="text-indigo-600 mb-2 group-hover:scale-110 transition-transform" size={32} />
                                        <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Bill of Lading</p>
                                        <p className="text-[10px] text-indigo-500 mt-1 font-bold">Issued on IPFS</p>
                                    </button>
                                ) : (
                                    <div className="p-6 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-center">
                                        <Upload className="text-slate-300 mb-2" size={32} />
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Bill of Lading</p>
                                        <p className="text-[10px] text-slate-300 mt-1 uppercase font-bold tracking-tighter">Awaiting Carrier Upload</p>
                                    </div>
                                )}

                                {trade.letterOfCredit?.ipfsHash ? (
                                    <button
                                        onClick={() => handleViewDocument(trade.letterOfCredit.ipfsHash)}
                                        className="p-6 border-2 border-indigo-100 bg-indigo-50/30 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-indigo-50 transition-all group"
                                    >
                                        <FileText className="text-indigo-600 mb-2 group-hover:scale-110 transition-transform" size={32} />
                                        <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Letter of Credit</p>
                                        <p className="text-[10px] text-indigo-500 mt-1 font-bold">Secured on IPFS</p>
                                    </button>
                                ) : (
                                    <div className="p-6 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-center">
                                        <Upload className="text-slate-300 mb-2" size={32} />
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Letter of Credit</p>
                                        <p className="text-[10px] text-slate-300 mt-1 uppercase font-bold tracking-tighter">Awaiting Bank Issue</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Add Dispute Panel at the very bottom right column */}
                    {trade && user && (
                        <DisputePanel 
                            trade={trade} 
                            currentUserRole={user.role} 
                            currentUserWallet={account || ""} 
                            onUpdate={fetchData} 
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShipmentDetails;
