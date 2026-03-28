import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import { walletService } from '../../services/WalletService';
import { ShieldCheck, Search, CheckCircle2, AlertCircle, FileText, AlertTriangle, XOctagon, DollarSign } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const VISIBLE_STATUSES = [
    'GOODS_SHIPPED', 'CUSTOMS_FLAGGED', 'DUTY_PENDING', 'DUTY_PAID', 'ENTRY_REJECTED', 'VOTING_ACTIVE',
    'CUSTOMS_CLEARED', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED',
    'DISPUTE_RESOLVED_NO_REVERT', 'CLAIM_PAYOUT_APPROVED', 'COMPLETED'
];

const getStatusBadge = (status: string) => {
    const s = status;
    if (s === 'GOODS_SHIPPED') return 'bg-blue-50 text-blue-600';
    if (s === 'CUSTOMS_FLAGGED') return 'bg-amber-50 text-amber-600';
    if (s === 'ENTRY_REJECTED') return 'bg-rose-50 text-rose-600';
    if (s === 'VOTING_ACTIVE') return 'bg-purple-50 text-purple-600';
    if (s === 'CUSTOMS_CLEARED' || s === 'GOODS_RECEIVED' || s === 'COMPLETED') return 'bg-emerald-50 text-emerald-600';
    return 'bg-slate-50 text-slate-600';
};

const CustomsDashboard: React.FC = () => {
    const { user, account } = useOutletContext<{ user: any, account: string | null }>();
    const [trades, setTrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [taxInputs, setTaxInputs] = useState<Record<string, string>>({});
    const [showTaxInput, setShowTaxInput] = useState<string | null>(null);
    const toast = useToast();

    useEffect(() => { fetchTrades(); }, []);

    const fetchTrades = async () => {
        try {
            const res = await api.get('/trades');
            setTrades(res.data.filter((t: any) => VISIBLE_STATUSES.includes(t.status)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDocument = async (trade: any) => {
        try {
            if (trade.billOfLading?.ipfsHash) {
                const url = trade.billOfLading.ipfsHash.startsWith('http')
                    ? trade.billOfLading.ipfsHash
                    : `https://gateway.pinata.cloud/ipfs/${trade.billOfLading.ipfsHash}`;
                window.open(url, '_blank');
                return;
            }
            toast.error("Bill of Lading document not found.");
        } catch (err) {
            toast.error("Failed to retrieve document.");
        }
    };

    /**
     * Submit customs decision to DocumentVerification smart contract.
     * decision: 0 = Clear, 1 = Flag (with tax), 2 = Reject Entry
     */
    const handleCustomsDecision = async (trade: any, decision: number) => {
        if (!account) {
            toast.error("MetaMask wallet required. Please connect your wallet.");
            return;
        }
        if (trade.blockchainId === null || trade.blockchainId === undefined) {
            toast.error("This trade has no blockchain ID. Cannot submit customs decision.");
            return;
        }

        // For Flag (decision 1), require tax amount
        let taxAmount = 0;
        if (decision === 1) {
            const rawTax = taxInputs[trade.id];
            if (!rawTax || parseFloat(rawTax) <= 0) {
                toast.error("Please enter a valid tax amount before flagging.");
                return;
            }
            taxAmount = Math.round(parseFloat(rawTax) * 100); // Convert to wei-compatible integer
        }

        const labels = ['clearance', 'tax flag', 'entry rejection'];
        const actionKey = ['CLEAR', 'FLAG', 'REJECT'][decision];
        setActionLoading(`${trade.id}-${actionKey}`);

        try {
            // CRITICAL PRE-CHECK: Verify that the connected wallet matches the 
            // on-chain customsAuthority before sending the transaction.
            const registry = walletService.getTradeRegistry();
            const onChainTrade = await registry.getTrade(trade.blockchainId);
            const onChainCustoms = onChainTrade.customsAuthority;

            if (onChainCustoms === '0x0000000000000000000000000000000000000000') {
                toast.error(
                    "BLOCKCHAIN MISMATCH: This trade was registered on-chain with NO customs authority (0x0). " +
                    "The importer must re-create this trade on-chain with your wallet address assigned."
                );
                return;
            }

            if (onChainCustoms.toLowerCase() !== account.toLowerCase()) {
                toast.error(
                    `WALLET MISMATCH: The on-chain customs authority is ${onChainCustoms.slice(0, 10)}... ` +
                    `but your connected wallet is ${account.slice(0, 10)}... ` +
                    `The importer must re-register the trade with the correct customs wallet.`
                );
                return;
            }

            toast.info(`Submitting ${labels[decision]} to blockchain...`);
            const contractDoc = walletService.getDocumentVerification();
            const tx = await contractDoc.verifyAsCustoms(trade.blockchainId, decision, taxAmount, "");
            toast.info("Transaction submitted. Awaiting blockchain confirmation...");
            await tx.wait();

            await api.patch(`/trades/${trade.id}/state`, {
                txHash: tx.hash,
                eventName: 'CUSTOMS_DECISION'
            });

            toast.success(`Shipment ${labels[decision]} recorded on-chain!`);
            setShowTaxInput(null);
            setTimeout(fetchTrades, 3000);
        } catch (error: any) {
            console.error("Customs action failed:", error);
            toast.error(`Transaction failed: ${error.reason || error.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    /**
     * Customs/Tax records receipt and releases goods after importer pays duty.
     */
    const handleRecordReceiptAndRelease = async (trade: any) => {
        if (!account) return toast.error("Connect wallet to record receipt.");
        if (trade.blockchainId === null || trade.blockchainId === undefined) return toast.error("No blockchain ID.");

        setActionLoading(`${trade.id}-RELEASE`);
        try {
            const docContract = walletService.getDocumentVerification();

            // Step 1: Record tax receipt on-chain
            toast.info("Recording tax receipt on-chain...");
            const tx1 = await docContract.recordTaxReceipt(trade.blockchainId);
            toast.info("Receipt transaction sent. Waiting for confirmation...");
            await tx1.wait();

            await api.patch(`/trades/${trade.id}/state`, {
                txHash: tx1.hash,
                eventName: 'TAX_RECEIPT_RECORDED'
            });
            toast.success("Tax receipt recorded on-chain!");

            // Step 2: Release goods from duty
            toast.info("Releasing goods from duty on blockchain...");
            const tx2 = await docContract.releaseFromDuty(trade.blockchainId);
            toast.info("Release transaction sent. Waiting for confirmation...");
            await tx2.wait();

            await api.patch(`/trades/${trade.id}/state`, {
                txHash: tx2.hash,
                eventName: 'CUSTOMS_CLEARED'
            });
            toast.success("Goods officially released on-chain! Status: CUSTOMS_CLEARED");
            setTimeout(fetchTrades, 3000);
        } catch (err: any) {
            console.error(err);
            toast.error("Failed: " + (err.reason || err.message));
        } finally {
            setActionLoading(null);
        }
    };

    const renderActions = (trade: any) => {
        if (trade.status === 'GOODS_SHIPPED') {
            return (
                <div className="flex flex-col gap-2 items-end">
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleCustomsDecision(trade, 0)}
                            disabled={!!actionLoading}
                            className="btn-primary text-xs py-2 px-4 shadow-none bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"
                        >
                            {actionLoading === `${trade.id}-CLEAR` ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                            ) : <CheckCircle2 size={14} />}
                            Clear
                        </button>
                        <button
                            onClick={() => setShowTaxInput(showTaxInput === trade.id ? null : trade.id)}
                            disabled={!!actionLoading}
                            className="btn-primary text-xs py-2 px-4 shadow-none bg-amber-600 hover:bg-amber-700 flex items-center gap-1 disabled:opacity-50"
                        >
                            <DollarSign size={14} />
                            Flag for Tax
                        </button>
                        <button
                            onClick={() => handleCustomsDecision(trade, 2)}
                            disabled={!!actionLoading}
                            className="btn-primary text-xs py-2 px-4 shadow-none bg-rose-600 hover:bg-rose-700 flex items-center gap-1 disabled:opacity-50"
                        >
                            {actionLoading === `${trade.id}-REJECT` ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                            ) : <XOctagon size={14} />}
                            Reject Entry
                        </button>
                    </div>
                    {showTaxInput === trade.id && (
                        <div className="flex items-center gap-2 mt-1 animate-in">
                            <input
                                type="number"
                                placeholder="Tax Amount (ETH)"
                                value={taxInputs[trade.id] || ''}
                                onChange={(e) => setTaxInputs({ ...taxInputs, [trade.id]: e.target.value })}
                                className="input-premium text-xs py-2 px-3 w-40 border-amber-200 focus:ring-amber-500"
                                step="0.01"
                                min="0"
                            />
                            <button
                                onClick={() => handleCustomsDecision(trade, 1)}
                                disabled={!!actionLoading}
                                className="btn-primary text-xs py-2 px-4 shadow-none bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                            >
                                {actionLoading === `${trade.id}-FLAG` ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                                ) : 'Submit Flag'}
                            </button>
                        </div>
                    )}
                </div>
            );
        }
        if (trade.status === 'DUTY_PENDING' || trade.status === 'CUSTOMS_FLAGGED') {
            return (
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-amber-600 font-bold text-[10px] uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full border border-amber-100 italic">
                        <DollarSign size={12} /> Awaiting Importer Payment
                    </div>
                    {trade.dutyAmount && (
                        <p className="text-[10px] font-black text-slate-500 mt-1">
                            ASSESSED: <span className="text-slate-900">${trade.dutyAmount.toLocaleString()}</span>
                        </p>
                    )}
                </div>
            );
        }
        if (trade.status === 'DUTY_PAID') {
            return (
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1 text-emerald-600 font-bold text-[10px] uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        <CheckCircle2 size={12} /> Duty Payment Received
                    </div>
                    <button
                        onClick={() => handleRecordReceiptAndRelease(trade)}
                        disabled={actionLoading === `${trade.id}-RELEASE`}
                        className="btn-primary text-xs py-2 px-4 shadow-none bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"
                    >
                        {actionLoading === `${trade.id}-RELEASE` ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                        ) : <ShieldCheck size={14} />}
                        Record Receipt & Release
                    </button>
                </div>
            );
        }
        if (trade.status === 'ENTRY_REJECTED') {
            return (
                <div className="flex items-center justify-end gap-1 text-rose-600 font-bold text-xs uppercase bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
                    <XOctagon size={14} /> Entry Rejected — Dispute Pending
                </div>
            );
        }
        if (trade.status === 'VOTING_ACTIVE') {
            return (
                <div className="flex items-center justify-end gap-1 text-purple-600 font-bold text-xs uppercase bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
                    <AlertCircle size={14} /> 7-Node Voting Active
                </div>
            );
        }
        return (
            <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold text-xs uppercase">
                <CheckCircle2 size={14} /> {trade.status.replace(/_/g, ' ')}
            </div>
        );
    };

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Customs & Tax Authority</h1>
                <p className="text-slate-500 font-medium mt-1">Audit import documents and submit unified customs decisions on-chain.</p>
            </div>

            {!account && (
                <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
                    <p className="text-sm font-bold text-amber-800">
                        MetaMask not connected. You must connect your wallet to submit customs decisions.
                    </p>
                </div>
            )}

            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm glass">
                {loading ? (
                    <div className="flex justify-center py-20"><div className="w-14 h-14 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div></div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase">Product / Origin</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase text-center">Status</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase text-center">Documents</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {trades.map(trade => (
                                <tr key={trade.id}>
                                    <td className="px-8 py-6">
                                        <p className="font-black text-slate-900">{trade.productName}</p>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            {trade.blockchainId !== null && trade.blockchainId !== undefined ? `BC #${trade.blockchainId}` : `ID: ${trade.id.slice(0, 8)}`}
                                        </p>
                                        {(trade.blockchainId === null || trade.blockchainId === undefined) && (
                                            <p className="text-[10px] text-amber-600 font-bold mt-1">⚠ Not on-chain</p>
                                        )}
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusBadge(trade.status)}`}>
                                            <ShieldCheck size={12} />
                                            {trade.status.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <button
                                            onClick={() => handleViewDocument(trade)}
                                            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 hover:border-blue-100"
                                        >
                                            <FileText size={14} /> View BoL
                                        </button>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        {renderActions(trade)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {trades.length === 0 && !loading && (
                    <div className="p-20 text-center">
                        <Search className="mx-auto text-slate-200 mb-4" size={48} />
                        <h3 className="text-xl font-bold text-slate-900">Queue Empty</h3>
                        <p className="text-slate-400">No goods currently awaiting customs inspection.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomsDashboard;
