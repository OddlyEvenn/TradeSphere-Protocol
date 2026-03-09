import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import { walletService } from '../../services/WalletService';
import {
    ClipboardCheck,
    ShieldCheck,
    UploadCloud,
    FileText,
    AlertTriangle
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface Trade {
    id: string;
    blockchainId: number | null;
    status: string;
    amount: number;
    createdAt: string;
    productName?: string;
    importer?: { name: string };
    exporter?: { name: string };
    exporterBankId?: string | null;
    letterOfCredit?: { ipfsHash?: string; documentTxHash?: string };
}


const BankRequests: React.FC = () => {
    const { user, account } = useOutletContext<{ user: any, account: string | null }>();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTarget, setUploadTarget] = useState<Trade | null>(null);
    const toast = useToast();

    useEffect(() => {
        fetchTrades();
    }, []);

    const fetchTrades = async () => {
        try {
            const res = await api.get('/trades');
            setTrades(res.data);
        } catch (err) {
            console.error('Failed to fetch trades', err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * ARCHITECTURE: All bank actions MUST go through smart contracts.
     * The EventListenerService on the backend listens to blockchain events
     * and updates the database automatically. No DB-only updates allowed.
     */
    const requireWallet = (): boolean => {
        if (!account) {
            toast.error("MetaMask wallet required. Please connect your wallet to perform this action.");
            return false;
        }
        return true;
    };

    const requireBlockchainId = (trade: Trade): boolean => {
        if (trade.blockchainId === null || trade.blockchainId === undefined) {
            toast.error(
                "This trade has not been registered on-chain yet. " +
                "The importer must first create the trade on the blockchain before bank actions can be performed."
            );
            return false;
        }
        return true;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadTarget) return;

        if (!requireWallet()) return;
        if (!requireBlockchainId(uploadTarget)) return;

        setActionLoading(`${uploadTarget.id}-ISSUE_LOC`);
        try {
            toast.info("Uploading Letter of Credit to IPFS...");
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await api.post('/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const ipfsHash = uploadRes.data.ipfsHash;
            toast.success("Document secured on IPFS!");

            // ── Blockchain-first: submit on-chain tx → EventListenerService updates DB ──
            toast.info("Submitting Letter of Credit to blockchain...");
            const contractLoC = walletService.getLetterOfCredit();
            const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
            const tx = await contractLoC.uploadLocDocument(uploadTarget.blockchainId, expiry, ipfsHash);
            toast.info("Transaction submitted. Awaiting blockchain confirmation...");
            await tx.wait();

            // Record the txHash for audit trail — and manually sync status for speed
            await api.patch(`/trades/${uploadTarget.id}/state`, {
                txHash: tx.hash,
                ipfsHash,
                eventName: 'LOC_UPLOADED',
                status: 'LOC_UPLOADED'
            });

            toast.success("Letter of Credit published on-chain! Status updated.");
            // Poll after a short delay to let EventListenerService propagate
            setTimeout(fetchTrades, 2000);
        } catch (error: any) {
            console.error("LoC upload failed:", error);
            toast.error(`Error: ${error.reason || error.message}`);
        } finally {
            setActionLoading(null);
            setUploadTarget(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAction = async (trade: Trade, action: string) => {
        if (!requireWallet()) return;
        if (!requireBlockchainId(trade)) return;

        setActionLoading(`${trade.id}-${action}`);
        try {
            let tx: any;

            if (action === 'APPROVE_LOC') {
                // Exporter bank approves LoC on-chain
                toast.info("Approving Letter of Credit on blockchain...");
                const contract = walletService.getLetterOfCredit();
                tx = await contract.approveLoC(trade.blockchainId);

            } else if (action === 'LOCK_FUNDS') {
                // Importer bank locks funds in escrow
                toast.info("Locking funds in escrow on blockchain...");
                const contractLoC = walletService.getLetterOfCredit();
                tx = await contractLoC.lockFunds(trade.blockchainId);

            } else if (action === 'AUTHORIZE_PAYMENT') {
                // Importer bank authorizes payment release
                toast.info("Authorizing payment on blockchain...");
                const contract = walletService.getPaymentSettlement();
                tx = await contract.authorizePayment(trade.blockchainId);

            } else if (action === 'CONFIRM_SETTLEMENT') {
                // Exporter bank confirms final settlement
                toast.info("Confirming settlement on blockchain...");
                const contract = walletService.getPaymentSettlement();
                tx = await contract.confirmSettlement(trade.blockchainId);
            }

            if (tx) {
                toast.info("Transaction submitted. Awaiting blockchain confirmation...");
                await tx.wait();

                // Map action to status for immediate UI sync
                const statusMap: Record<string, string> = {
                    'APPROVE_LOC': 'LOC_APPROVED',
                    'LOCK_FUNDS': 'FUNDS_LOCKED',
                    'AUTHORIZE_PAYMENT': 'PAYMENT_AUTHORIZED',
                    'CONFIRM_SETTLEMENT': 'SETTLEMENT_CONFIRMED'
                };

                // Record txHash and manually advance status in DB (fast-sync)
                await api.patch(`/trades/${trade.id}/state`, {
                    txHash: tx.hash,
                    eventName: action,
                    status: statusMap[action]
                });

                toast.success("Transaction confirmed! Trade status updated.");
                setTimeout(fetchTrades, 2000);
            }
        } catch (error: any) {
            console.error(`Action ${action} failed:`, error);

            // Handle common revert reasons gracefully (detect if already processed)
            const errorMsg = error.reason || error.message || "";
            if (errorMsg.includes("already approved") || errorMsg.includes("already locked") || errorMsg.includes("Invalid status")) {
                toast.success("Action already recorded on-chain. Refreshing...");
                fetchTrades();
            } else {
                toast.error(`Transaction failed: ${error.reason || error.message}`);
            }
        } finally {
            setActionLoading(null);
        }
    };

    const getTargetStatuses = () => {
        if (user.role === 'IMPORTER_BANK') return ['LOC_INITIATED', 'LOC_APPROVED', 'CUSTOMS_CLEARED'];
        if (user.role === 'EXPORTER_BANK') return ['LOC_UPLOADED', 'PAYMENT_AUTHORIZED'];
        return [];
    };

    const getActionConfig = (trade: Trade) => {
        if (user.role === 'IMPORTER_BANK') {
            if (trade.status === 'LOC_INITIATED') return { label: 'Upload & Issue LoC', key: 'ISSUE_LOC', needsFile: true };
            if (trade.status === 'LOC_APPROVED') return { label: 'Lock Funds in Escrow', key: 'LOCK_FUNDS' };
            if (trade.status === 'CUSTOMS_CLEARED') return { label: 'Authorize Payment', key: 'AUTHORIZE_PAYMENT' };
        }
        if (user.role === 'EXPORTER_BANK') {
            if (trade.status === 'LOC_UPLOADED') return { label: 'Review & Approve LoC', key: 'APPROVE_LOC' };
            if (trade.status === 'PAYMENT_AUTHORIZED') return { label: 'Confirm Settlement', key: 'CONFIRM_SETTLEMENT' };
        }
        return { label: 'Processing', key: 'PROCESSING' };
    };

    const targetStatuses = getTargetStatuses();

    return (
        <div className="space-y-10">
            {/* Hidden file input for IPFS uploads */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg"
            />

            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Bank Operations Desk</h1>
                <p className="text-slate-500 font-medium mt-1">
                    All actions are submitted on-chain. Status updates automatically after blockchain confirmation.
                </p>
            </div>

            {/* Wallet Warning Banner */}
            {!account && (
                <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
                    <p className="text-sm font-bold text-amber-800">
                        MetaMask wallet not connected. You must connect your wallet to perform any bank actions.
                    </p>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-indigo-600"></div>
                </div>
            ) : (
                <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Trade info</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {trades.filter(t => targetStatuses.includes(t.status)).map((trade) => {
                                const config = getActionConfig(trade);
                                const isActionLoading = actionLoading === `${trade.id}-${config.key}`;
                                const missingBlockchainId = trade.blockchainId === null || trade.blockchainId === undefined;
                                const missingExporterBank = config.key === 'ISSUE_LOC' && !trade.exporterBankId;
                                const isDisabled = !!actionLoading || missingBlockchainId || missingExporterBank;

                                return (
                                    <tr key={trade.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
                                                    ID
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900">
                                                        #{trade.blockchainId !== null && trade.blockchainId !== undefined ? trade.blockchainId : trade.id.slice(0, 8)}
                                                    </p>
                                                    <p className="text-xs font-bold text-slate-400 tracking-tight">
                                                        {trade.productName || 'Trade Request'} — {trade.importer?.name || 'N/A'}
                                                    </p>
                                                    {missingBlockchainId && (
                                                        <p className="text-[10px] font-bold text-amber-600 mt-1">
                                                            ⚠ Awaiting on-chain registration
                                                        </p>
                                                    )}
                                                    {missingExporterBank && !missingBlockchainId && (
                                                        <p className="text-[10px] font-bold text-rose-600 mt-1">
                                                            ⚠ Awaiting Exporter Bank Nomination
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="font-black text-slate-900">${trade.amount.toLocaleString()}</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                {trade.status.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                {config.needsFile ? (
                                                    <button
                                                        onClick={() => {
                                                            setUploadTarget(trade);
                                                            fileInputRef.current?.click();
                                                        }}
                                                        disabled={isDisabled}
                                                        className="btn-primary py-2 px-4 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title={
                                                            missingBlockchainId
                                                                ? "Trade must be registered on-chain first"
                                                                : missingExporterBank
                                                                    ? "Exporter must nominate an advising bank first"
                                                                    : undefined
                                                        }
                                                    >
                                                        {isActionLoading ? (
                                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                        ) : (
                                                            <UploadCloud size={16} />
                                                        )}
                                                        {config.label}
                                                    </button>
                                                ) : (
                                                    <div className="flex gap-2 justify-end">
                                                        {config.key === 'APPROVE_LOC' && trade.letterOfCredit?.ipfsHash && (
                                                            <a
                                                                href={trade.letterOfCredit.ipfsHash.startsWith('http') ? trade.letterOfCredit.ipfsHash : `https://gateway.pinata.cloud/ipfs/${trade.letterOfCredit.ipfsHash}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="btn-secondary py-2 px-4 flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors rounded-xl font-bold"
                                                            >
                                                                <FileText size={16} />
                                                                View LoC
                                                            </a>
                                                        )}
                                                        <button
                                                            onClick={() => handleAction(trade, config.key)}
                                                            disabled={isDisabled}
                                                            className="btn-primary py-2 px-4 shadow-none flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title={missingBlockchainId ? "Trade must be registered on-chain first" : undefined}
                                                        >
                                                            {isActionLoading ? (
                                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                            ) : (
                                                                <ShieldCheck size={16} />
                                                            )}
                                                            {config.label}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {trades.filter(t => targetStatuses.includes(t.status)).length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <ClipboardCheck className="mx-auto text-slate-200 mb-4" size={48} />
                                        <h3 className="text-xl font-bold text-slate-900 mb-1">Queue Empty</h3>
                                        <p className="text-slate-400 font-medium">No pending trade actions require your attention.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>

                    </table>
                </div>
            )}
        </div>
    );
};

export default BankRequests;
