import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import TradeTimeline, { TradeEvent } from '../../components/TradeTimeline';
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
import { useToast } from '../../contexts/ToastContext';

const TradeDetails: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, account } = useOutletContext<{ user: any, account: string | null }>();
    const [trade, setTrade] = useState<any>(null);
    const [offers, setOffers] = useState<any[]>([]);
    const [events, setEvents] = useState<TradeEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [finalizing, setFinalizing] = useState(false);
    const [requestingLoC, setRequestingLoC] = useState(false);
    const [settlingPayment, setSettlingPayment] = useState(false);
    const [banks, setBanks] = useState<any[]>([]);
    const [selectedBankId, setSelectedBankId] = useState('');
    const toast = useToast();

    useEffect(() => {
        // Redirect exporters to their ShipmentDetails page
        if (user?.role === 'EXPORTER') {
            navigate(`/dashboard/shipments/${id}`, { replace: true });
            return;
        }
        fetchTradeData();
    }, [id, user]);

    const fetchTradeData = async () => {
        try {
            const [tradeRes, offersRes, banksRes, eventsRes] = await Promise.all([
                api.get(`/trades/${id}`),
                api.get(`/marketplace/trades/${id}/offers`),
                api.get('/users?role=IMPORTER_BANK'),
                api.get(`/trades/${id}/events`)
            ]);
            setTrade(tradeRes.data);
            setOffers(offersRes.data);
            setBanks(banksRes.data);
            setEvents(eventsRes.data);
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
            toast.success("Trade Finalized! The workflow has transitioned to the official trade state.");
            fetchTradeData(); // Refresh to show LoC request options
        } catch (err: any) {
            console.error('Finalization failed', err);
            toast.error("Failed to finalize trade: " + (err.response?.data?.message || err.message));
        } finally {
            setFinalizing(false);
        }
    };

    const handleCreateOnChain = async (bankWalletAddress: string) => {
        if (!trade) return;
        if (!account && !user?.walletAddress) {
            toast.error("Please connect your wallet or set a manual override in Settings!");
            throw new Error("No wallet connected");
        }

        setActionLoading('CREATE_ON_CHAIN');
        try {
            // Check if we are in Manual Wallet Override Mode
            if (!account && user?.walletAddress) {
                toast.info("Manual Wallet Mode: Simulating trade registry...");
                await new Promise(resolve => setTimeout(resolve, 2000));
                toast.success("Trade registered on-chain successfully!");
                const fakeId = Math.floor(Math.random() * 10000);
                await api.patch(`/trades/${trade.id}`, { blockchainId: fakeId });
                setTrade({ ...trade, blockchainId: fakeId });
                return;
            }

            if (!trade.exporter?.walletAddress) throw new Error("Exporter has no wallet linked.");
            if (!bankWalletAddress) throw new Error("Bank has no wallet linked.");

            const registry = walletService.getTradeRegistry();
            const amountInEth = (trade.amount / 2000).toFixed(4); // limit decimals to avoid parse errors

            const tx = await registry.createTrade(
                trade.exporter.walletAddress,
                bankWalletAddress,
                ethers.ZeroAddress, // advisingBank (optional for now)
                ethers.parseEther(amountInEth)
            );

            toast.info("Transaction sent, awaiting confirmation...");
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
            const blockchainId = Number(parsedEvent!.args.tradeId);

            await api.patch(`/trades/${trade.id}`, { blockchainId });
            setTrade({ ...trade, blockchainId });
            toast.success(`Trade registered on-chain with ID: ${blockchainId}`);

        } catch (err: any) {
            console.error("Failed to create on-chain", err);
            toast.error(err.reason || err.message || "Failed to create trade on-chain");
            throw err; // Re-throw so caller can handle it
        } finally {
            setActionLoading(null);
        }
    };

    const handleRequestLoC = async () => {
        if (!trade) return toast.error("Trade data not loaded.");
        if (!selectedBankId) return toast.error("Please select a bank first.");
        const selectedBank = banks.find(b => b.id === selectedBankId);
        if (!selectedBank?.walletAddress) return toast.error("Selected bank has no wallet address linked.");
        if (!trade?.exporter?.walletAddress) return toast.error("Exporter has no wallet address linked. They must connect their wallet first.");

        setRequestingLoC(true);
        try {
            // Check if we are in Manual Wallet Override Mode
            if (!account && user?.walletAddress) {
                let blockchainId = trade.blockchainId;
                if (blockchainId === null || blockchainId === undefined) {
                    toast.info("Creating trade on blockchain first...");
                    await handleCreateOnChain(selectedBank.walletAddress);
                    const updatedTradeRes = await api.get(`/trades/${id}`);
                    setTrade(updatedTradeRes.data);
                    blockchainId = updatedTradeRes.data.blockchainId;
                    if (blockchainId === null || blockchainId === undefined) {
                        throw new Error("Failed to simulate trade on blockchain.");
                    }
                }

                toast.info("Manual Wallet Mode: Simulating LoC request...");
                await new Promise(resolve => setTimeout(resolve, 2000));

                await api.patch(`/trades/${trade.id}`, {
                    status: 'LOC_INITIATED',
                    importerBankId: selectedBankId
                });
                setTrade({ ...trade, status: 'LOC_INITIATED', importerBankId: selectedBankId });
                toast.success("Letter of Credit Requested! The Importer's Bank will now upload the LoC.");
                return;
            }

            // Normal MetaMask Execution Path
            if (!account) {
                toast.error("Please connect your wallet first.");
                return;
            }

            // 1. Initial trade creation on blockchain if not already there
            let blockchainId = trade?.blockchainId;

            if (blockchainId === null || blockchainId === undefined) {
                toast.info("Creating trade on blockchain first...");
                await handleCreateOnChain(selectedBank.walletAddress); // Call the new function
                // Re-fetch trade data to get the updated blockchainId
                const updatedTradeRes = await api.get(`/trades/${id}`);
                setTrade(updatedTradeRes.data);
                blockchainId = updatedTradeRes.data.blockchainId;
                if (blockchainId === null || blockchainId === undefined) {
                    throw new Error("Failed to create trade on blockchain.");
                }
            }

            // 2. Request LoC via TradeRegistry
            toast.info("Requesting Letter of Credit on blockchain...");
            const registry = walletService.getTradeRegistry();

            const tx = await registry.requestLetterOfCredit(blockchainId);
            toast.info("LoC Request transaction sent. Waiting for confirmation...");
            await tx.wait();

            // 3. Update DB status and assign bank
            await api.patch(`/trades/${trade.id}`, {
                status: 'LOC_INITIATED',
                importerBankId: selectedBankId
            });

            toast.success("Bank selected! The Importer's Bank must now upload the LoC.");
            fetchTradeData();
        } catch (err: any) {
            console.error('LoC Request failed', err);
            const errorMsg = err?.reason || err?.message || (typeof err === 'string' ? err : "Unknown error");
            toast.error("Failed to process request: " + errorMsg);
        } finally {
            setRequestingLoC(false);
        }
    };

    const handleDutyPayment = async () => {
        if (!window.confirm(`Pay tax assessment of $${trade.dutyAmount}?`)) return;
        if (!trade || !trade.dutyAmount) return;

        if (!account && !user?.walletAddress) {
            toast.error("Please connect your wallet or set a manual override in Settings!");
            return;
        }

        setSettlingPayment(true);
        try {
            // Check if we are in Manual Wallet Override Mode
            if (!account && user?.walletAddress) {
                toast.info("Manual Wallet Mode: Simulating duty payment...");
                await new Promise(resolve => setTimeout(resolve, 2000));

                await api.patch(`/trades/${trade.id}/state`, {
                    status: 'DUTY_PAID',
                    eventName: 'DUTY_PAID'
                });
                setTrade({ ...trade, status: 'DUTY_PAID' });
                toast.success("Duty Paid successfully! Customs will now release goods.");
                return;
            }

            if (trade.blockchainId !== null && trade.blockchainId !== undefined) {
                const docContract = walletService.getDocumentVerification();
                const tx = await docContract.recordDutyPayment(trade.blockchainId);
                toast.info("Payment transaction sent. Waiting for confirmation...");
                await tx.wait();

                // Eager UI update
                await api.patch(`/trades/${trade.id}/state`, {
                    status: 'DUTY_PAID',
                    txHash: tx.hash,
                    eventName: 'DUTY_PAID'
                });
                toast.success("Duty Paid successfully! Customs will now release goods.");
                fetchTradeData();
            }
        } catch (err: any) {
            console.error('Duty payment failed', err);
            toast.error("Payment failed: " + (err.reason || err.message));
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
                    {(trade.status === 'CREATED' || trade.status === 'TRADE_INITIATED' || trade.status === 'OFFER_ACCEPTED' || trade.status === 'LOC_INITIATED' || trade.status === 'LOC_UPLOADED') && (
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
                                        disabled={trade.status !== 'CREATED' && trade.status !== 'TRADE_INITIATED' && trade.status !== 'OFFER_ACCEPTED'}
                                    >
                                        <option value="">Select a Bank...</option>
                                        {banks.map(bank => (
                                            <option key={bank.id} value={bank.id}>{bank.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {(trade.status === 'CREATED' || trade.status === 'TRADE_INITIATED' || trade.status === 'OFFER_ACCEPTED') && (
                                    <button
                                        onClick={handleRequestLoC}
                                        disabled={requestingLoC}
                                        className="btn-primary w-full py-4 shadow-indigo-100"
                                    >
                                        {requestingLoC ? 'Processing...' : 'Request Letter of Credit'}
                                        <ShieldCheck size={18} />
                                    </button>
                                )}

                                {trade.status === 'LOC_INITIATED' && (
                                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3 text-amber-700">
                                        <Clock size={20} className="flex-shrink-0" />
                                        <p className="text-xs font-bold uppercase tracking-tight">LoC Application Pending Importer Bank Upload</p>
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

                    {/* Phase 3 & 4: Settlement & Customs */}
                    {['DUTY_PENDING', 'DUTY_PAID', 'CUSTOMS_CLEARED', 'PAYMENT_AUTHORIZED'].includes(trade.status) && (
                        <div className="card-premium border-emerald-100 bg-emerald-50/20">
                            <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                                <CheckCircle2 className="text-emerald-600" />
                                Customs & Settlement
                            </h2>
                            {trade.status === 'DUTY_PENDING' && trade.dutyAmount ? (
                                <>
                                    <p className="text-sm font-medium text-slate-500 mb-6">Customs requires duty payment before clearance.</p>
                                    <div className="bg-white rounded-2xl p-4 mb-6 border border-emerald-100/50 space-y-3">
                                        <div className="flex justify-between items-center text-sm font-bold text-slate-600">
                                            <span>Base Trade Value</span>
                                            <span>${trade.amount?.toLocaleString()}</span>
                                        </div>
                                        <div className="border-t border-slate-100 pt-3 flex justify-between items-center font-black text-rose-600">
                                            <span>Assessed Customs Duty</span>
                                            <span>${trade.dutyAmount?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleDutyPayment}
                                        disabled={settlingPayment}
                                        className="btn-primary w-full py-4 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"
                                    >
                                        {settlingPayment ? 'Processing...' : `Pay $${trade.dutyAmount?.toLocaleString()} Duty`}
                                    </button>
                                </>
                            ) : (
                                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700">
                                    <Clock size={20} className="flex-shrink-0" />
                                    <p className="text-xs font-bold uppercase tracking-tight">Status: {trade.status.replace(/_/g, ' ')}</p>
                                </div>
                            )}
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

            {/* Timeline Section */}
            {(trade.status !== 'OPEN_FOR_OFFERS' && offers.length >= 0) && (
                <div className="mt-12">
                    <TradeTimeline events={events} />
                </div>
            )}
        </div>
    );
};

export default TradeDetails;
