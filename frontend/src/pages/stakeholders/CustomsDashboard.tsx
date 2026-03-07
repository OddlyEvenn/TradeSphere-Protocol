import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import { walletService } from '../../services/WalletService';
import { ShieldCheck, Search, CheckCircle2, AlertCircle, FileText, AlertTriangle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const CustomsDashboard: React.FC = () => {
    const { user, account } = useOutletContext<{ user: any, account: string | null }>();
    const [trades, setTrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const toast = useToast();

    useEffect(() => {
        fetchTrades();
    }, []);

    const fetchTrades = async () => {
        try {
            const res = await api.get('/trades');
            setTrades(res.data.filter((t: any) =>
                ['GOODS_SHIPPED', 'DUTY_PENDING', 'CUSTOMS_CLEARED', 'DUTY_PAID', 'PAYMENT_AUTHORIZED', 'COMPLETED'].includes(t.status)
            ));
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
            const res = await api.get(`/documents/${trade.id}/BOL`);
            if (res.data.url) {
                window.open(res.data.url, '_blank');
            } else {
                toast.error("Document not found on IPFS.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to retrieve document.");
        }
    };

    /**
     * ARCHITECTURE: Customs decisions MUST be submitted to the DocumentVerification smart contract.
     * The CustomsDecision event is caught by EventListenerService which updates the DB status.
     * No Manual Mode. No DB-only fallback.
     */
    const handleCustomsDecision = async (trade: any, cleared: boolean) => {
        if (!account) {
            toast.error("MetaMask wallet required. Please connect your wallet to submit a customs decision.");
            return;
        }

        if (trade.blockchainId === null || trade.blockchainId === undefined) {
            toast.error(
                "This trade has no blockchain ID. " +
                "A valid on-chain trade record is required before customs can submit a decision."
            );
            return;
        }

        const actionKey = cleared ? 'CLEAR' : 'FLAG';
        setActionLoading(`${trade.id}-${actionKey}`);

        try {
            // ── Blockchain-first: verifyAsCustoms on-chain → EventListenerService updates DB ──
            toast.info(`Submitting ${cleared ? 'clearance' : 'duty flag'} to blockchain...`);
            const contractDoc = walletService.getDocumentVerification();
            const tx = await contractDoc.verifyAsCustoms(trade.blockchainId, cleared, "");
            toast.info("Transaction submitted. Awaiting blockchain confirmation...");
            await tx.wait();

            // Record txHash for audit trail — EventListenerService handles DB status
            await api.patch(`/trades/${trade.id}/state`, {
                txHash: tx.hash,
                eventName: cleared ? 'CUSTOMS_CLEARED' : 'DUTY_PENDING'
            });

            toast.success(`Shipment officially ${cleared ? 'cleared' : 'flagged for duty'} on-chain! Status updates automatically.`);
            setTimeout(fetchTrades, 3000);
        } catch (error: any) {
            console.error("Customs action failed:", error);
            toast.error(`Transaction failed: ${error.reason || error.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Customs & Inspection</h1>
                <p className="text-slate-500 font-medium mt-1">Audit import documents and submit clearance decisions on-chain.</p>
            </div>

            {/* Wallet Warning Banner */}
            {!account && (
                <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
                    <p className="text-sm font-bold text-amber-800">
                        MetaMask not connected. You must connect your wallet to submit customs decisions.
                    </p>
                </div>
            )}

            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-t-indigo-600"></div></div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase">Product / origin</th>
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
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${trade.status === 'GOODS_SHIPPED' ? 'bg-indigo-50 text-indigo-600' : trade.status === 'DUTY_PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                            <ShieldCheck size={12} />
                                            {trade.status.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <button
                                            onClick={() => handleViewDocument(trade)}
                                            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 hover:border-indigo-100"
                                        >
                                            <FileText size={14} /> View BoL
                                        </button>
                                    </td>
                                    <td className="px-8 py-6 text-right flex justify-end gap-2">
                                        {trade.status === 'GOODS_SHIPPED' ? (
                                            <>
                                                <button
                                                    onClick={() => handleCustomsDecision(trade, true)}
                                                    disabled={!!actionLoading}
                                                    className="btn-primary text-xs py-2 px-4 shadow-none bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    {actionLoading === `${trade.id}-CLEAR` ? (
                                                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                                                    ) : <CheckCircle2 size={14} />}
                                                    Clear
                                                </button>
                                                <button
                                                    onClick={() => handleCustomsDecision(trade, false)}
                                                    disabled={!!actionLoading}
                                                    className="btn-primary text-xs py-2 px-4 shadow-none bg-amber-600 hover:bg-amber-700 flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    {actionLoading === `${trade.id}-FLAG` ? (
                                                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                                                    ) : <AlertCircle size={14} />}
                                                    Flag for Tax
                                                </button>
                                            </>
                                        ) : trade.status === 'DUTY_PENDING' ? (
                                            <div className="flex items-center justify-end gap-1 text-amber-600 font-bold text-xs uppercase">
                                                <AlertCircle size={14} /> Pending Tax Payment
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold text-xs uppercase">
                                                <CheckCircle2 size={14} /> Cleared
                                            </div>
                                        )}
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
