import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import { walletService } from '../../services/WalletService';
import {
    ClipboardCheck,
    ShieldCheck,
    CheckCircle,
    XCircle,
    UploadCloud,
    FileText
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

    // Returns true if the on-chain trade exists (importer is not the zero address)
    const checkOnChainValid = async (blockchainId: number): Promise<boolean> => {
        try {
            const registry = walletService.getTradeRegistry();
            const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
            const onChainTrade = await registry.getTrade(blockchainId);
            return onChainTrade.importer.toLowerCase() !== ZERO_ADDRESS;
        } catch {
            return false;
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadTarget) return;

        if (!account && !user?.walletAddress) {
            toast.error("Please connect your wallet first!");
            return;
        }

        setActionLoading(`${uploadTarget.id}-ISSUE_LOC`);
        try {
            toast.info("Uploading document to IPFS...");
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await api.post('/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const ipfsHash = uploadRes.data.ipfsHash;
            toast.success("Document uploaded securely to IPFS!");

            // Manual Mode Override
            if (!account && user?.walletAddress) {
                toast.info("Manual Wallet Mode: Simulating LoC Issuance...");
                await new Promise(resolve => setTimeout(resolve, 2000));
                await api.patch(`/trades/${uploadTarget.id}/state`, {
                    status: 'LOC_UPLOADED',
                    ipfsHash: ipfsHash,
                    eventName: 'LOC_UPLOADED'
                });
                toast.success("Simulated LoC Issued!");
                fetchTrades();
                return;
            }

            if (uploadTarget.blockchainId === null || uploadTarget.blockchainId === undefined) {
                throw new Error("This trade has no blockchain ID.");
            }

            // Check if on-chain trade is valid before sending blockchain tx
            const onChainValid = await checkOnChainValid(uploadTarget.blockchainId);
            if (!onChainValid) {
                console.warn(`On-chain trade ${uploadTarget.blockchainId} is invalid — DB-only update.`);
                toast.info("No valid on-chain record — updating database only.");
                await api.patch(`/trades/${uploadTarget.id}/state`, {
                    status: 'LOC_UPLOADED',
                    ipfsHash: ipfsHash,
                    eventName: 'LOC_UPLOADED'
                });
                toast.success("LoC document recorded!");
                fetchTrades();
                return;
            }

            toast.info("Sending transaction to blockchain...");
            const contractLoC = walletService.getLetterOfCredit();
            // expiry = 30 days from now in unix seconds
            const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
            const tx = await contractLoC.uploadLocDocument(uploadTarget.blockchainId, expiry, ipfsHash);
            await tx.wait();

            await api.patch(`/trades/${uploadTarget.id}/state`, {
                status: 'LOC_UPLOADED',
                ipfsHash: ipfsHash,
                txHash: tx.hash,
                eventName: 'LOC_UPLOADED'
            });

            toast.success("Letter of Credit officially active on-chain!");
            fetchTrades();
        } catch (error: any) {
            console.error("Upload/Issue failed:", error);
            toast.error(`Error: ${error.reason || error.message}`);
        } finally {
            setActionLoading(null);
            setUploadTarget(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAction = async (trade: Trade, action: string) => {
        if (!account && !user?.walletAddress) {
            toast.error("Please connect your wallet or set a manual override in Settings!");
            return;
        }

        setActionLoading(`${trade.id}-${action}`);
        try {
            // Manual Mode Check
            if (!account && user?.walletAddress) {
                toast.info(`Manual Wallet Mode: Simulating ${action}...`);
                await new Promise(resolve => setTimeout(resolve, 2000));

                let nextStatus = '';
                if (action === 'APPROVE_LOC') nextStatus = 'LOC_APPROVED';
                if (action === 'LOCK_FUNDS') nextStatus = 'FUNDS_LOCKED';
                if (action === 'AUTHORIZE_PAYMENT') nextStatus = 'PAYMENT_AUTHORIZED';
                if (action === 'CONFIRM_SETTLEMENT') nextStatus = 'COMPLETED';

                await api.patch(`/trades/${trade.id}/state`, { status: nextStatus, eventName: nextStatus });
                toast.success("Transaction simulated successfully!");
                fetchTrades();
                return;
            }

            if (trade.blockchainId === null || trade.blockchainId === undefined) {
                throw new Error("Trade missing blockchain ID.");
            }

            // Check if on-chain trade is valid before sending any blockchain transaction
            const onChainValid = await checkOnChainValid(trade.blockchainId);
            if (!onChainValid) {
                console.warn(`On-chain trade ${trade.blockchainId} is invalid — DB-only update.`);
                toast.info("No valid on-chain record — updating database only.");

                let nextStatus = '';
                if (action === 'APPROVE_LOC') nextStatus = 'LOC_APPROVED';
                if (action === 'LOCK_FUNDS') nextStatus = 'FUNDS_LOCKED';
                if (action === 'AUTHORIZE_PAYMENT') nextStatus = 'PAYMENT_AUTHORIZED';
                if (action === 'CONFIRM_SETTLEMENT') nextStatus = 'COMPLETED';

                if (nextStatus) {
                    await api.patch(`/trades/${trade.id}/state`, { status: nextStatus, eventName: nextStatus });
                    toast.success("Status updated successfully!");
                    fetchTrades();
                }
                return;
            }

            let tx;
            if (action === 'APPROVE_LOC') {
                const contract = walletService.getLetterOfCredit();
                tx = await contract.approveLoC(trade.blockchainId);
            } else if (action === 'LOCK_FUNDS') {
                const contract = walletService.getLetterOfCredit();
                tx = await contract.lockFunds(trade.blockchainId, { value: trade.amount });
            } else if (action === 'AUTHORIZE_PAYMENT') {
                const contract = walletService.getPaymentSettlement();
                tx = await contract.authorizePayment(trade.blockchainId);
            } else if (action === 'CONFIRM_SETTLEMENT') {
                const contract = walletService.getPaymentSettlement();
                tx = await contract.confirmSettlement(trade.blockchainId);
            }

            if (tx) {
                toast.info("Transaction sent. Waiting for confirmation...");
                await tx.wait();
                toast.success("Transaction confirmed successfully!");
                setTimeout(fetchTrades, 2000);
            }
        } catch (error: any) {
            console.error(`Action ${action} failed:`, error);
            toast.error(`Error: ${error.reason || error.message}`);
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
            if (trade.status === 'LOC_APPROVED') return { label: 'Lock Funds', key: 'LOCK_FUNDS' };
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
                    Manage Letter of Credit issuance, review, funding, and final settlement authorizations.
                </p>
            </div>

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

                                return (
                                    <tr key={trade.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
                                                    ID
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900">#{trade.blockchainId || trade.id.slice(0, 8)}</p>
                                                    <p className="text-xs font-bold text-slate-400 tracking-tight">{trade.productName || 'Trade Request'} — {trade.importer?.name || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="font-black text-slate-900">${trade.amount.toLocaleString()}</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                {trade.status.replace('_', ' ')}
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
                                                        disabled={!!actionLoading}
                                                        className="btn-primary py-2 px-4 flex items-center gap-2"
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
                                                            disabled={!!actionLoading}
                                                            className="btn-primary py-2 px-4 shadow-none flex items-center gap-2"
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
