import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import TradeTimeline, { TradeEvent } from '../../components/TradeTimeline';
import DisputePanel from '../../components/DisputePanel';
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
    Landmark,
    FileText,
    Eye,
    Shield
} from 'lucide-react';
import { walletService, PROTOCOL_USD_TO_ETH_RATE } from '../../services/WalletService';
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
    const [carriers, setCarriers] = useState<any[]>([]);
    const [selectedCarrierId, setSelectedCarrierId] = useState('');
    const [nominatingCarrier, setNominatingCarrier] = useState(false);
    const [customsAuthorities, setCustomsAuthorities] = useState<any[]>([]);
    const toast = useToast();

    /**
     * Ensures MetaMask is connected before blockchain actions.
     * If account from layout context is null, tries to auto-connect.
     * Returns the connected wallet address or null if failed.
     */
    const ensureWalletConnected = async (): Promise<string | null> => {
        if (account) return account;
        // Try auto-connecting MetaMask
        const connected = await walletService.connect();
        if (connected) return connected;
        toast.error("MetaMask wallet required. Please connect your wallet to proceed.");
        return null;
    };

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
            const [tradeRes, offersRes, banksRes, carriersRes, eventsRes, customsRes] = await Promise.all([
                api.get(`/trades/${id}`),
                api.get(`/marketplace/trades/${id}/offers`),
                api.get('/users?role=IMPORTER_BANK'),
                api.get('/users?role=SHIPPING'),
                api.get(`/trades/${id}/events`),
                api.get('/users?role=CUSTOMS')
            ]);
            setTrade(tradeRes.data);
            setOffers(offersRes.data);
            setBanks(banksRes.data);
            setCarriers(carriersRes.data);
            setEvents(eventsRes.data);
            setCustomsAuthorities(customsRes.data);

            if (tradeRes.data.importerBankId) setSelectedBankId(tradeRes.data.importerBankId);
            if (tradeRes.data.shippingId) setSelectedCarrierId(tradeRes.data.shippingId);
        } catch (err) {
            console.error('Failed to fetch trade data', err);
        } finally {
            setLoading(false);
        }
    };

    const waitForStatusUpdate = async (expectedStatus: string, maxAttempts = 15) => {
        let attempts = 0;
        while (attempts < maxAttempts) {
            try {
                const res = await api.get(`/trades/${id}`);
                const currentStatus = res.data.status;
                if (currentStatus === expectedStatus || currentStatus === 'COMPLETED') {
                    setTrade(res.data);
                    const eventsRes = await api.get(`/trades/${id}/events`);
                    setEvents(eventsRes.data);
                    return true;
                }
            } catch (err) {
                console.error('Polling failed', err);
            }
            await new Promise(r => setTimeout(r, 2000));
            attempts++;
        }
        await fetchTradeData();
        return false;
    };

    const handleAcceptOffer = async (offerId: string) => {
        if (!window.confirm("Are you sure you want to finalize this trade with this offer?")) return;

        setFinalizing(true);
        try {
            await api.post(`/marketplace/offers/${offerId}/accept`);
            toast.success("Trade Finalized! The workflow has transitioned to the official trade state.");
            await waitForStatusUpdate('OFFER_ACCEPTED');
        } catch (err: any) {
            console.error('Registration failed', err);

            // SMART CONTRACT ERROR HANDLING
            if (err.message.includes("Only Custom & Tax Authority")) {
                toast.error("Blockchain Error: The assigned Customs node is not authorized on the network. They MUST sync their wallet or be added to the whitelist.");
            } else {
                toast.error("Failed to register trade on blockchain: " + (err.response?.data?.message || err.message));
            }
            return null;
        } finally {
            setFinalizing(false);
        }
    };

    /**
     * ARCHITECTURE: Creates the trade on-chain via TradeRegistry.createTrade().
     * The EventListenerService listens to TradeCreated and syncs the blockchainId to DB.
     * No fake IDs. No Manual Mode. MetaMask required.
     */
    const handleCreateOnChain = async (bankWalletAddress: string) => {
        if (!trade) return;
        const walletAddr = await ensureWalletConnected();
        if (!walletAddr) throw new Error("No wallet connected");
        if (!trade.exporter?.walletAddress) throw new Error("Exporter has no wallet linked.");
        if (!bankWalletAddress) throw new Error("Bank has no wallet linked.");

        setActionLoading('CREATE_ON_CHAIN');
        try {
            const registry = walletService.getTradeRegistry();
            const amountInEth = (trade.amount / PROTOCOL_USD_TO_ETH_RATE).toFixed(8);


            toast.info("Registering trade on the blockchain...");
            // ARCHITECTURE: Use ZeroAddress for any node that hasn't synced yet.
            // This prevents UI blocking during the LoC request flow.
            const exporterWallet = trade.exporter?.walletAddress ? ethers.getAddress(trade.exporter.walletAddress) : ethers.ZeroAddress;
            // CRITICAL: Always fetch the latest node wallets from API right now,
            // because nodes may have synced their wallet after this page loaded.
            let finalCustomsWallet = ethers.ZeroAddress;
            let inspectorWallet = ethers.ZeroAddress;
            let insuranceWallet = ethers.ZeroAddress;

            try {
                const [cRes, iRes, insRes] = await Promise.all([
                    api.get('/users?role=CUSTOMS'),
                    api.get('/users?role=INSPECTOR'),
                    api.get('/users?role=INSURANCE')
                ]);

                const syncedCustoms = cRes.data.find((c: any) => c.walletAddress && c.walletAddress !== ethers.ZeroAddress);
                const syncedInspector = iRes.data.find((i: any) => i.walletAddress && i.walletAddress !== ethers.ZeroAddress);
                const syncedInsurance = insRes.data.find((ins: any) => ins.walletAddress && ins.walletAddress !== ethers.ZeroAddress);

                finalCustomsWallet = trade.customs?.walletAddress ? ethers.getAddress(trade.customs.walletAddress) : (syncedCustoms ? ethers.getAddress(syncedCustoms.walletAddress) : ethers.ZeroAddress);
                inspectorWallet = trade.inspector?.walletAddress ? ethers.getAddress(trade.inspector.walletAddress) : (syncedInspector ? ethers.getAddress(syncedInspector.walletAddress) : ethers.ZeroAddress);
                insuranceWallet = trade.insurance?.walletAddress ? ethers.getAddress(trade.insurance.walletAddress) : (syncedInsurance ? ethers.getAddress(syncedInsurance.walletAddress) : ethers.ZeroAddress);

            } catch (e) {
                console.warn("Could not fetch fresh nodes, falling back to trade data", e);
                finalCustomsWallet = trade.customs?.walletAddress ? ethers.getAddress(trade.customs.walletAddress) : ethers.ZeroAddress;
                inspectorWallet = trade.inspector?.walletAddress ? ethers.getAddress(trade.inspector.walletAddress) : ethers.ZeroAddress;
                insuranceWallet = trade.insurance?.walletAddress ? ethers.getAddress(trade.insurance.walletAddress) : ethers.ZeroAddress;
            }

            // Convert deadlines (assumed hours from now or standard timestamp format)
            // If they are not set, pass 0
            const shippingDeadline = trade.shippingDeadline ? Math.floor(new Date(trade.shippingDeadline).getTime() / 1000) : 0;
            const clearanceDeadline = trade.clearanceDeadline ? Math.floor(new Date(trade.clearanceDeadline).getTime() / 1000) : 0;

            const tx = await registry.createTrade(
                exporterWallet,
                bankWalletAddress,
                ethers.ZeroAddress, // Exporter Bank (Optional in this flow)
                inspectorWallet,
                finalCustomsWallet,
                insuranceWallet,
                Math.floor(Number(amountInEth) * 1e18).toString(), // Wei
                shippingDeadline,
                clearanceDeadline
            );

            toast.info("Transaction sent — awaiting confirmation...");
            const receipt = await tx.wait();

            // Extract the blockchainId from the TradeCreated event
            const event = receipt.logs.find((log: any) => {
                try {
                    const parsed = registry.interface.parseLog(log);
                    return parsed?.name === 'TradeCreated';
                } catch (e) { return false; }
            });

            if (!event) throw new Error("TradeCreated event not found in transaction logs.");
            const parsedEvent = registry.interface.parseLog(event);
            const blockchainId = Number(parsedEvent!.args.tradeId);

            // Manual push as backup to event listener (idempotent)
            try {
                const patchData: any = { blockchainId };
                // Also try to assign the customs user in DB if not already assigned
                if (!trade.customs) {
                    try {
                        const cRes = await api.get('/users?role=CUSTOMS');
                        const firstCustoms = cRes.data[0];
                        if (firstCustoms) patchData.customsOfficerId = firstCustoms.id;
                    } catch (_) { /* non-critical */ }
                }
                await api.patch(`/trades/${trade.id}`, patchData);
            } catch (e) {
                console.warn("Manual blockchainId/customs push failed", e);
            }

            toast.success(`Trade registered on-chain! (ID: ${blockchainId})`);
            return blockchainId;

        } catch (err: any) {
            console.error("Failed to create on-chain", err);
            toast.error(err.reason || err.message || "Failed to create trade on-chain");
            return null;
        } finally {
            setActionLoading(null);
        }
    };

    /**
     * ARCHITECTURE: LoC request is a REQUIRED ON-CHAIN action.
     *
     * According to Phase 2 Blockchain Architecture:
     *   1. Importer creates trade on-chain (createTrade) — if not done.
     *   2. Importer requests LoC on-chain (requestLetterOfCredit) — Transitions to LOC_INITIATED.
     *   3. Importer selects bank in DB — Tracks the relationship.
     *   4. Bank uploads LoC (uploadLocDocument) — Transitions to LOC_UPLOADED.
     */
    const handleRequestLoC = async () => {
        if (!trade) return toast.error("Trade data not loaded.");
        if (!selectedBankId) return toast.error("Please select a bank first.");
        const walletAddr = await ensureWalletConnected();
        if (!walletAddr) return;

        const selectedBank = banks.find(b => b.id === selectedBankId);
        if (!selectedBank?.walletAddress) return toast.error("Selected bank has no wallet address linked.");
        if (!trade?.exporter?.walletAddress) return toast.error("Exporter has no wallet address linked. They must connect their wallet first.");

        setRequestingLoC(true);
        try {
            // Step 1: Register trade on-chain if not already done
            let blockchainId = trade?.blockchainId;
            if (blockchainId === null || blockchainId === undefined) {
                const newId = await handleCreateOnChain(selectedBank.walletAddress);
                if (newId === null || newId === undefined) {
                    throw new Error("Trade was not registered on blockchain. Cannot proceed.");
                }
                blockchainId = newId;
            }

            // Step 2: Request LoC via TradeRegistry.requestLetterOfCredit(tradeId)
            toast.info("Requesting Letter of Credit on blockchain...");
            const registry = walletService.getTradeRegistry();
            const tx = await registry.requestLetterOfCredit(blockchainId);
            toast.info("LoC Request submitted. Awaiting confirmation...");
            await tx.wait();

            // Step 3: Assign bank in DB (Manual Sync)
            await api.patch(`/trades/${trade.id}`, {
                importerBankId: selectedBankId
            });

            // Step 4: Wait for status update
            toast.info("Waiting for status update...");
            await waitForStatusUpdate('LOC_INITIATED');
            toast.success("Letter of Credit requested on-chain! Syncing UI...");
        } catch (err: any) {
            console.error('LoC Request failed', err);
            toast.error("Failed to request LoC: " + (err?.reason || err?.message || "Unknown error"));
        } finally {
            setRequestingLoC(false);
        }
    };

    /**
     * ARCHITECTURE: Carrier nomination is a REQUIRED ON-CHAIN action.
     * Only the Importer can nominate the carrier on-chain according to TradeRegistry.sol.
     */
    const handleNominateCarrier = async () => {
        if (trade?.blockchainId === null || trade?.blockchainId === undefined) return toast.error("Trade must be registered on-chain first.");
        if (!selectedCarrierId) return toast.error("Please select a shipping carrier first.");
        const walletAddr = await ensureWalletConnected();
        if (!walletAddr) return;

        const carrier = carriers.find(c => c.id === selectedCarrierId);
        if (!carrier?.walletAddress) return toast.error("Selected carrier has no wallet address linked.");

        setNominatingCarrier(true);
        try {
            toast.info("Assigning shipping carrier on blockchain...");
            const registry = walletService.getTradeRegistry();
            const tx = await registry.assignShippingCompany(trade.blockchainId, carrier.walletAddress);
            toast.info("Carrier assignment submitted. Awaiting confirmation...");
            await tx.wait();

            // Persist to DB via EventListener auto-sync
            toast.info("Waiting for status update...");
            await waitForStatusUpdate('SHIPPING_ASSIGNED');
            toast.success("Shipping Carrier Nominated on-chain! Refreshing data...");
        } catch (err: any) {
            console.error('Carrier nomination failed', err);
            toast.error("Failed to nominate carrier: " + (err?.reason || err?.message || "Unknown error"));
        } finally {
            setNominatingCarrier(false);
        }
    };

    const handleCheckSLABreach = async () => {
        if (!trade?.blockchainId) return;
        const walletAddr = await ensureWalletConnected();
        if (!walletAddr) return;

        setActionLoading('CHECK_SLA');
        try {
            toast.info("Checking SLA deadlines on-chain...");
            const registry = walletService.getTradeRegistry();
            const tx = await registry.triggerSLABreachRevert(trade.blockchainId);
            await tx.wait();
            toast.success("SLA Check complete! If a breach occurred, the trade has been reverted.");
            await fetchTradeData();
        } catch (err: any) {
            console.error('SLA Check failed', err);
            toast.error("SLA breach not met or error: " + (err.reason || err.message));
        } finally {
            setActionLoading(null);
        }
    };

    const handleViewDocument = (ipfsHash: string) => {
        if (!ipfsHash) return;
        const url = ipfsHash.startsWith('http')
            ? ipfsHash
            : `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        window.open(url, '_blank');
    };

    // Duty payment recording is now handled by the Tax Authority on-chain in TaxDashboard.tsx
    // according to Step 11/40 of Blockchain_Architecture_Phases.md.

    if (loading) return <div className="flex justify-center py-20"><div className="w-14 h-14 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div></div>;
    if (!trade) return (
        <div className="max-w-6xl mx-auto space-y-10 lg:p-4">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-3 bg-white/60 backdrop-blur-md border border-white/60 rounded-2xl text-slate-400 hover:text-blue-600 transition-all shadow-sm">
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
        <div className="max-w-6xl mx-auto space-y-10 lg:p-4 animate-in">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-3 bg-white/60 backdrop-blur-md border border-white/60 rounded-2xl text-slate-400 hover:text-blue-600 transition-all shadow-sm">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Trade Management</h1>
                    <p className="text-slate-500 font-medium mt-1">Status: <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100/50">{trade?.status.replace(/_/g, ' ')}</span></p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left: Trade Details */}
                <div className="lg:col-span-1 space-y-8">
                    <div className="card-premium h-fit">
                        <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                            <Package className="text-blue-600" />
                            Request Details
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Product</p>
                                <p className="text-lg font-black text-slate-900">{trade?.productName || trade?.product}</p>
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
                                <p className="text-sm font-medium text-slate-500 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                                    {trade?.additionalConditions || "No specific conditions provided."}
                                </p>
                            </div>

                            {/* Enterprise SLA Section */}
                            {(trade?.shippingDeadline || trade?.clearanceDeadline) && (
                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Service Level Agreements (SLAs)</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        {trade.shippingDeadline && (
                                            <div className="bg-amber-50/60 px-4 py-5 rounded-2xl border border-amber-100 w-[180px]">

                                                <p className="text-[9px] font-extrabold text-amber-600 uppercase tracking-[0.2em] mb-2">
                                                    Max Shipping Time
                                                </p>

                                                <p className="font-bold text-amber-900 text-lg leading-tight break-words">
                                                    {trade.shippingDeadline}
                                                </p>

                                                <p className="font-bold text-amber-900 text-sm mt-1">
                                                    Hrs
                                                </p>

                                                <p className="text-[9px] text-amber-500 mt-2 leading-tight">
                                                    From Lock Funds
                                                </p>

                                            </div>
                                        )}
                                        {trade.clearanceDeadline && (
                                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Max Clearance Time</p>
                                                <p className="font-bold text-blue-900">{trade.clearanceDeadline} Hrs</p>
                                                <p className="text-[10px] text-blue-500 mt-1">From Arrival</p>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleCheckSLABreach}
                                        disabled={actionLoading === 'CHECK_SLA'}
                                        className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest rounded-xl transition-all"
                                    >
                                        {actionLoading === 'CHECK_SLA' ? 'Checking...' : 'Check SLA Breach'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Phase 2: Financing & LoC / Phase 3: Settlement */}
                    {(trade.status === 'CREATED' || trade.status === 'TRADE_INITIATED' || trade.status === 'OFFER_ACCEPTED' || trade.status === 'LOC_INITIATED' || trade.status === 'LOC_UPLOADED') && (
                        <div className="card-premium border-blue-100 bg-blue-50/20">
                            <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                <Landmark className="text-blue-600" />
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
                                        className="btn-primary w-full py-4 shadow-blue-100/50"
                                    >
                                        {requestingLoC ? 'Processing...' : 'Request Letter of Credit'}
                                        <ShieldCheck size={18} />
                                    </button>
                                )}

                                {trade.status === 'LOC_INITIATED' && (
                                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3 text-amber-700">
                                        <Clock size={20} className="flex-shrink-0" />
                                        <p className="text-[10px] font-black uppercase tracking-tight">LoC Application Pending Importer Bank Upload</p>
                                    </div>
                                )}

                                {trade.status === 'LOC_ISSUED' && (
                                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700">
                                        <CheckCircle2 size={20} className="flex-shrink-0" />
                                        <p className="text-[10px] font-black uppercase tracking-tight">Letter of Credit Issued & Secured</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 6: Shipping Nomination (Importer Only) */}
                    {(trade.status === 'FUNDS_LOCKED' || trade.status === 'SHIPPING_ASSIGNED') && (
                        <div className="card-premium border-blue-100 bg-blue-50/20">
                            <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                <Package className="text-blue-600" />
                                Logistics Setup
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Shipping Carrier</label>
                                    <select
                                        className="input-premium py-3 text-sm"
                                        value={selectedCarrierId}
                                        onChange={(e) => setSelectedCarrierId(e.target.value)}
                                        disabled={trade.status !== 'FUNDS_LOCKED'}
                                    >
                                        <option value="">Select a Carrier...</option>
                                        {carriers.map(carrier => (
                                            <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {trade.status === 'FUNDS_LOCKED' && (
                                    <button
                                        onClick={handleNominateCarrier}
                                        disabled={nominatingCarrier}
                                        className="btn-primary w-full py-4 shadow-blue-100/50"
                                    >
                                        {nominatingCarrier ? 'Processing...' : 'Assign Carrier on Blockchain'}
                                        <Package size={18} />
                                    </button>
                                )}

                                {trade.status === 'SHIPPING_ASSIGNED' && (
                                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700">
                                        <CheckCircle2 size={20} className="flex-shrink-0" />
                                        <p className="text-[10px] font-black uppercase tracking-tight">Carrier Assigned On-Chain</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    {/* Phase 3 & 4: Settlement & Customs */}
                    {['CUSTOMS_FLAGGED', 'GOODS_RECEIVED', 'CUSTOMS_CLEARED', 'PAYMENT_AUTHORIZED', 'ENTRY_REJECTED', 'VOTING_ACTIVE'].includes(trade.status) && (
                        <div className="card-premium border-emerald-100 bg-emerald-50/20">
                            <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                                <CheckCircle2 className="text-emerald-600" />
                                Customs & Settlement
                            </h2>
                            {trade.status === 'CUSTOMS_FLAGGED' && trade.customs?.taxAmount ? (
                                <>
                                    <p className="text-sm font-medium text-slate-500 mb-6">Customs flagged this trade for tax. Payment is required before clearance.</p>
                                    <div className="bg-white rounded-2xl p-4 mb-6 border border-emerald-100/50 space-y-3">
                                        <div className="flex justify-between items-center text-sm font-bold text-slate-600">
                                            <span>Base Trade Value</span>
                                            <span>${trade.amount?.toLocaleString()}</span>
                                        </div>
                                        <div className="border-t border-slate-100 pt-3 flex justify-between items-center font-black text-rose-600">
                                            <span>Assessed Tax Amount</span>
                                            <span>${trade.customs?.taxAmount?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-2xl p-4 mb-6 border border-emerald-100/50 space-y-3 font-black text-center">
                                        <p className="text-amber-600 uppercase text-[10px] tracking-widest">Protocol Action: Pay the assessed tax amount to proceed</p>
                                    </div>
                                </>
                            ) : trade.status === 'ENTRY_REJECTED' ? (
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700">
                                    <XCircle size={20} className="flex-shrink-0" />
                                    <p className="text-[10px] font-black uppercase tracking-tight">Entry Rejected — Dispute voting will be activated.</p>
                                </div>
                            ) : trade.status === 'VOTING_ACTIVE' ? (
                                <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl flex items-center gap-3 text-purple-700">
                                    <Clock size={20} className="flex-shrink-0" />
                                    <p className="text-[10px] font-black uppercase tracking-tight">7-Node Voting Active — Awaiting consensus resolution.</p>
                                </div>
                            ) : (
                                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700">
                                    <Clock size={20} className="flex-shrink-0" />
                                    <p className="text-[10px] font-black uppercase tracking-tight">Status: {trade.status.replace(/_/g, ' ')}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Full Trade Lifecycle Stepper */}
                    {trade.status !== 'OPEN_FOR_OFFERS' && (
                        <div className="card-premium bg-white/60 backdrop-blur-md border border-white/60">
                            <h2 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-2">
                                <Clock className="text-blue-600" />
                                Trade Lifecycle
                            </h2>
                            <div className="space-y-4">
                                {[
                                    { label: 'Offer Accepted', done: ['OFFER_ACCEPTED', 'TRADE_INITIATED', 'LOC_INITIATED', 'LOC_UPLOADED', 'LOC_APPROVED', 'FUNDS_LOCKED', 'SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED', 'DISPUTE_RESOLVED_NO_REVERT', 'CLAIM_PAYOUT_APPROVED', 'TRADE_REVERTED_BY_CONSENSUS'].includes(trade.status) },
                                    { label: 'Trade Initiated', done: ['TRADE_INITIATED', 'LOC_INITIATED', 'LOC_UPLOADED', 'LOC_APPROVED', 'FUNDS_LOCKED', 'SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                    { label: 'LoC Requested', done: ['LOC_INITIATED', 'LOC_UPLOADED', 'LOC_APPROVED', 'FUNDS_LOCKED', 'SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                    { label: 'LoC Uploaded', done: ['LOC_UPLOADED', 'LOC_APPROVED', 'FUNDS_LOCKED', 'SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                    { label: 'LoC Approved', done: ['LOC_APPROVED', 'FUNDS_LOCKED', 'SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                    { label: 'Funds Locked', done: ['FUNDS_LOCKED', 'SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                    { label: 'Carrier Assigned', done: ['SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                    { label: 'Goods Shipped', done: ['GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                    { label: 'Customs Cleared', done: ['CUSTOMS_CLEARED', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                    { label: 'Goods Received', done: ['GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                    { label: 'Payment Authorized', done: ['PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                    { label: 'Settlement Confirmed', done: ['SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status) },
                                    { label: 'Completed', done: trade.status === 'COMPLETED' }
                                ].map((s, i, arr) => (
                                    <div key={i} className="flex gap-4 relative">
                                        {i !== arr.length - 1 && (
                                            <div className={`absolute left-3 top-6 w-0.5 h-6 ${s.done ? 'bg-emerald-500' : 'bg-slate-100'}`}></div>
                                        )}
                                        <div className={`w-6 h-6 rounded-full flex flex-shrink-0 items-center justify-center z-10 ${s.done ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                                            {s.done ? <CheckCircle2 size={14} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                        </div>
                                        <p className={`text-[11px] font-black uppercase tracking-wider ${s.done ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</p>
                                    </div>
                                ))}
                            </div>
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
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Protocol settlement finalized.</p>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                <div className="lg:col-span-2 space-y-10">
                    {/* Protocol Documents Section */}
                    {['LOC_UPLOADED', 'LOC_APPROVED', 'LOC_ISSUED', 'FUNDS_LOCKED', 'SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_FLAGGED', 'CUSTOMS_CLEARED', 'GOODS_RECEIVED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'PAYMENT_AUTHORIZED', 'COMPLETED'].includes(trade.status) && (
                        <div className="card-premium space-y-6">
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Shield className="text-blue-600" />
                                Digital Trade Vault
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {trade.letterOfCredit?.ipfsHash ? (
                                    <div className="p-6 border-2 border-blue-100 bg-blue-50/20 rounded-3xl flex flex-col items-center justify-between text-center">
                                        <div className="mb-4">
                                            <ShieldCheck className="text-blue-600 mx-auto" size={32} />
                                            <p className="text-xs font-black text-slate-900 uppercase tracking-widest mt-2">Letter of Credit</p>
                                            <p className="text-[10px] text-blue-500 font-bold italic tracking-tighter">On-Chain Verified</p>
                                        </div>
                                        <button
                                            onClick={() => handleViewDocument(trade.letterOfCredit.ipfsHash)}
                                            className="btn-secondary w-full py-3 text-[10px] font-black uppercase tracking-widest"
                                        >
                                            <Eye size={14} /> View Document
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-6 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-center">
                                        <Clock className="text-slate-200 mb-2" size={32} />
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Letter of Credit</p>
                                        <p className="text-[10px] text-slate-300 mt-1 uppercase">Pending Issuance</p>
                                    </div>
                                )}

                                {trade.billOfLading?.ipfsHash ? (
                                    <div className="p-6 border-2 border-emerald-100 bg-emerald-50/20 rounded-3xl flex flex-col items-center justify-between text-center">
                                        <div className="mb-4">
                                            <FileText className="text-emerald-600 mx-auto" size={32} />
                                            <p className="text-xs font-black text-slate-900 uppercase tracking-widest mt-2">Bill of Lading</p>
                                            <p className="text-[10px] text-emerald-500 font-bold italic tracking-tighter">Secured on IPFS</p>
                                        </div>
                                        <button
                                            onClick={() => handleViewDocument(trade.billOfLading.ipfsHash)}
                                            className="btn-secondary w-full py-3 text-[10px] font-black uppercase tracking-widest !bg-emerald-50 !text-emerald-700 !border-emerald-100"
                                        >
                                            <Eye size={14} /> View Document
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-6 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-center">
                                        <Clock className="text-slate-200 mb-2" size={32} />
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Bill of Lading</p>
                                        <p className="text-[10px] text-slate-300 mt-1 uppercase">Awaiting Cargo</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center justify-between mt-10">
                        Offers Received
                        <span className="text-xs bg-slate-900 text-white px-3 py-1 rounded-full">{offers.length}</span>
                    </h2>

                    {offers.length > 0 ? (
                        <div className="space-y-4">
                            {offers.map((offer) => (
                                <div key={offer.id} className="card-premium group border-slate-50 hover:border-blue-100 transition-all">
                                    <div className="flex flex-col md:flex-row justify-between gap-6">
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Exporter</p>
                                                    <p className="font-black text-slate-900 text-xl truncate">{offer.exporter?.name}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quote</p>
                                                    <p className="text-3xl font-black text-emerald-600">${offer.amount.toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <p className="text-sm font-medium text-slate-600 bg-blue-50/20 p-5 rounded-2xl italic border border-blue-100/30">
                                                "{offer.message || 'No additional terms provided'}"
                                            </p>
                                        </div>
                                        <div className="flex md:flex-col justify-end gap-3 min-w-[160px]">
                                            <button
                                                onClick={() => handleAcceptOffer(offer.id)}
                                                disabled={finalizing || trade.status !== 'OPEN_FOR_OFFERS'}
                                                className="btn-primary py-4 w-full text-[11px] font-black uppercase tracking-widest shadow-blue-100 disabled:opacity-50"
                                            >
                                                <CheckCircle2 size={16} />
                                                Accept Offer
                                            </button>
                                            <button className="btn-secondary py-4 w-full text-[11px] font-black uppercase tracking-widest">
                                                Review Profile
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white/40 backdrop-blur-md border-2 border-dashed border-slate-100 rounded-[3rem] py-32 text-center">
                            <Clock className="mx-auto text-slate-200 mb-6" size={64} />
                            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Waiting for Market Bids</h3>
                            <p className="text-slate-400 font-medium max-w-sm mx-auto">Verified global exporters will see your request on the discovery page. You will be notified of new bids.</p>
                        </div>
                    )}
                    {/* Timeline Section */}
                    {offers.length === 0 && trade.status === 'OPEN_FOR_OFFERS' && (
                        <div className="mt-12 opacity-50 pointer-events-none grayscale transition-all duration-500 hover:grayscale-0 hover:opacity-100">
                            <TradeTimeline events={[]} />
                        </div>
                    )}
                    {trade.status !== 'OPEN_FOR_OFFERS' && (
                        <div className="mt-12">
                            <TradeTimeline events={events} />
                        </div>
                    )}

                    {/* Add Dispute Panel at the very bottom right column */}
                    {trade && user && (
                        <DisputePanel
                            trade={trade}
                            currentUserRole={user.role}
                            currentUserWallet={account || ""}
                            onUpdate={fetchTradeData}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default TradeDetails;
