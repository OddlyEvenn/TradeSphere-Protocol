import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    ArrowLeft,
    Package,
    MapPin,
    DollarSign,
    Clock,
    ShieldCheck,
    CheckCircle2,
    XCircle,
    MoreHorizontal,
    Landmark
} from 'lucide-react';
import { walletService } from '../../services/WalletService';

const TradeDetails: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [trade, setTrade] = useState<any>(null);
    const [offers, setOffers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [finalizing, setFinalizing] = useState(false);
    const [requestingLoC, setRequestingLoC] = useState(false);
    const [settlingPayment, setSettlingPayment] = useState(false);
    const [banks, setBanks] = useState<any[]>([]);
    const [selectedBankId, setSelectedBankId] = useState('');

    useEffect(() => {
        fetchTradeData();
    }, [id]);

    const fetchTradeData = async () => {
        try {
            const [tradeRes, offersRes, banksRes] = await Promise.all([
                api.get(`/trades/${id}`),
                api.get(`/marketplace/trades/${id}/offers`),
                api.get('/users?role=IMPORTER_BANK')
            ]);
            setTrade(tradeRes.data);
            setOffers(offersRes.data);
            setBanks(banksRes.data);
            if (tradeRes.data.importerBankId) setSelectedBankId(tradeRes.data.importerBankId);
        } catch (err) {
            console.error('Failed to fetch trade data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptOffer = async (offerId: string) => {
        if (!window.confirm("Are you sure you want to finalize this trade with this offer?")) return;

        setFinalizing(true);
        try {
            await api.post(`/marketplace/offers/${offerId}/accept`);
            alert("✅ Trade Finalized! The workflow has transitioned to the official trade state.");
            fetchTradeData(); // Refresh to show LoC request options
        } catch (err: any) {
            console.error('Finalization failed', err);
            alert("❌ Failed to finalize trade: " + (err.response?.data?.message || err.message));
        } finally {
            setFinalizing(false);
        }
    };

    const handleRequestLoC = async () => {
        if (!selectedBankId) return alert("Please select a bank first.");
        const selectedBank = banks.find(b => b.id === selectedBankId);
        if (!selectedBank?.walletAddress) return alert("Selected bank has no wallet address linked.");
        if (!trade.exporter?.walletAddress) return alert("Exporter has no wallet address linked. They must connect their wallet first.");

        setRequestingLoC(true);
        try {
            // 1. Initial trade creation on blockchain if not already there
            let blockchainId = trade.blockchainId;

            if (blockchainId === null || blockchainId === undefined) {
                alert("⏳ Creating trade on blockchain first...");
                const registry = walletService.getTradeRegistry();
                const amountWei = ethers.parseEther(trade.amount.toString());

                const exporterAddr = trade.exporter?.walletAddress;
                const bankAddr = selectedBank?.walletAddress;

                if (!exporterAddr || !bankAddr) {
                    throw new Error("Missing required wallet addresses (Exporter or Bank).");
                }

                const tx = await registry.createTrade(
                    exporterAddr,
                    bankAddr, // Issuing Bank
                    bankAddr, // Advising Bank (Simplified)
                    amountWei
                );

                const receipt = await tx.wait();
                // Find TradeCreated event to get the ID
                const event = receipt.logs.find((log: any) => {
                    try {
                        const parsed = registry.interface.parseLog(log);
                        return parsed?.name === 'TradeCreated';
                    } catch (e) { return false; }
                });

                if (!event) throw new Error("TradeCreated event not found in transaction logs.");
                const parsedEvent = registry.interface.parseLog(event);
                blockchainId = Number(parsedEvent!.args.tradeId);

                // Update DB immediately with blockchainId
                await api.patch(`/trades/${trade.id}`, { blockchainId });
                console.log("On-chain trade created with ID:", blockchainId);
            }

            // 2. Request LoC via WalletService
            alert("⏳ Requesting Letter of Credit on blockchain...");
            const locContract = walletService.getLetterOfCredit();
            // Set 30 day expiry
            const expiry = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

            const tx = await locContract.requestLoC(blockchainId, expiry);
            alert("⏳ LoC Request transaction sent. Waiting for confirmation...");
            await tx.wait();

            // 3. Update DB status and assign bank
            await api.patch(`/trades/${trade.id}`, {
                status: 'LOC_REQUESTED',
                importerBankId: selectedBankId
            });

            alert("✅ Letter of Credit Requested! The Importer's Bank will now review the application.");
            fetchTradeData();
        } catch (err: any) {
            console.error('LoC Request failed', err);
            alert("❌ Failed to process request: " + (err.reason || err.message));
        } finally {
            setRequestingLoC(false);
        }
    };

    const handleSettlement = async () => {
        if (!window.confirm("Release payment to Exporter? This action is irreversible.")) return;
        setSettlingPayment(true);
        try {
            if (trade.blockchainId !== null && trade.blockchainId !== undefined) {
                const settlement = walletService.getPaymentSettlement();
                const tx = await settlement.settlePayment(trade.blockchainId);
                alert("⏳ Settlement transaction sent. Waiting for confirmation...");
                await tx.wait();
            }
            await api.patch(`/trades/${trade.id}`, { status: 'COMPLETED' });
            alert("✅ Payment Released! Trade is now COMPLETED.");
            fetchTradeData();
        } catch (err: any) {
            console.error('Payment settlement failed', err);
            alert("❌ Settlement failed: " + (err.reason || err.message));
        } finally {
            setSettlingPayment(false);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-t-indigo-600"></div></div>;
    if (!trade) return (
        <div className="max-w-6xl mx-auto space-y-10">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Trade Not Found</h1>
                    <p className="text-slate-500 font-medium mt-1">The trade you are looking for might not exist or failed to load.</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-10">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Trade Management</h1>
                    <p className="text-slate-500 font-medium mt-1">Status: <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black uppercase tracking-widest">{trade?.status}</span></p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left: Trade Details */}
                <div className="lg:col-span-1 space-y-8">
                    <div className="card-premium h-fit">
                        <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                            <Package className="text-indigo-600" />
                            Request Details
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Product</p>
                                <p className="text-lg font-black text-slate-900">{trade?.productName}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quantity</p>
                                    <p className="font-bold text-slate-700">{trade?.quantity}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Destination</p>
                                    <p className="font-bold text-slate-700">{trade?.destination}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Additional Conditions</p>
                                <p className="text-sm font-medium text-slate-500 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    {trade?.additionalConditions || "No specific conditions provided."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Phase 2: Financing & LoC / Phase 3: Settlement */}
                    {(trade.status === 'CREATED' || trade.status === 'LOC_REQUESTED' || trade.status === 'LOC_ISSUED') && (
                        <div className="card-premium border-indigo-100 bg-indigo-50/20">
                            <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                <Landmark className="text-indigo-600" />
                                Financing & LoC
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Importer's Bank</label>
                                    <select
                                        className="input-premium py-3 text-sm"
                                        value={selectedBankId}
                                        onChange={(e) => setSelectedBankId(e.target.value)}
                                        disabled={trade.status !== 'CREATED'}
                                    >
                                        <option value="">Select a Bank...</option>
                                        {banks.map(bank => (
                                            <option key={bank.id} value={bank.id}>{bank.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {trade.status === 'CREATED' && (
                                    <button
                                        onClick={handleRequestLoC}
                                        disabled={requestingLoC}
                                        className="btn-primary w-full py-4 shadow-indigo-100"
                                    >
                                        {requestingLoC ? 'Processing...' : 'Request Letter of Credit'}
                                        <ShieldCheck size={18} />
                                    </button>
                                )}

                                {trade.status === 'LOC_REQUESTED' && (
                                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3 text-amber-700">
                                        <Clock size={20} className="flex-shrink-0" />
                                        <p className="text-xs font-bold uppercase tracking-tight">LoC Application Pending Bank Approval</p>
                                    </div>
                                )}

                                {trade.status === 'LOC_ISSUED' && (
                                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700">
                                        <CheckCircle2 size={20} className="flex-shrink-0" />
                                        <p className="text-xs font-bold uppercase tracking-tight">Letter of Credit Issued & Secured</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Phase 4: Payment Settlement */}
                    {trade.status === 'DOCS_VERIFIED' && (
                        <div className="card-premium border-emerald-100 bg-emerald-50/20">
                            <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                                <CheckCircle2 className="text-emerald-600" />
                                Documents Verified
                            </h2>
                            <p className="text-sm font-medium text-slate-500 mb-6">All shipping documents have been verified by the Exporter's Bank. You can now release the payment to complete the trade.</p>
                            <button
                                onClick={handleSettlement}
                                disabled={settlingPayment}
                                className="btn-primary w-full py-4 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"
                            >
                                {settlingPayment ? 'Processing...' : '🔐 Release Payment & Complete Trade'}
                            </button>
                        </div>
                    )}

                    {/* Trade Completed */}
                    {trade.status === 'COMPLETED' && (
                        <div className="card-premium border-emerald-200 bg-emerald-50">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <h3 className="font-black text-emerald-800">Trade Completed</h3>
                                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Payment has been released to the Exporter.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Offers Received */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
                        Offers Received
                        <span className="text-xs bg-slate-900 text-white px-3 py-1 rounded-full">{offers.length}</span>
                    </h2>

                    {offers.length > 0 ? (
                        <div className="space-y-4">
                            {offers.map((offer) => (
                                <div key={offer.id} className="card-premium group border-slate-50 hover:border-indigo-100 transition-all">
                                    <div className="flex flex-col md:flex-row justify-between gap-6">
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Exporter</p>
                                                    <p className="font-black text-slate-900 text-lg">{offer.exporter?.name}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quote</p>
                                                    <p className="text-2xl font-black text-emerald-600">${offer.amount.toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <p className="text-sm font-medium text-slate-600 bg-indigo-50/30 p-4 rounded-2xl italic">
                                                "{offer.message || 'No message provided'}"
                                            </p>
                                        </div>
                                        <div className="flex md:flex-col justify-end gap-3 min-w-[140px]">
                                            <button
                                                onClick={() => handleAcceptOffer(offer.id)}
                                                disabled={finalizing || trade.status !== 'OPEN_FOR_OFFERS'}
                                                className="btn-primary py-3 w-full text-xs shadow-indigo-100 disabled:opacity-50"
                                            >
                                                <CheckCircle2 size={16} />
                                                Accept
                                            </button>
                                            <button className="btn-secondary py-3 w-full text-xs">
                                                Details
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white border-2 border-dashed border-slate-100 rounded-[2.5rem] py-20 text-center">
                            <Clock className="mx-auto text-slate-200 mb-4" size={48} />
                            <h3 className="text-xl font-bold text-slate-900 mb-1">Waiting for Offers</h3>
                            <p className="text-slate-400 font-medium">Exporters will see your request on the discovery page.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TradeDetails;
