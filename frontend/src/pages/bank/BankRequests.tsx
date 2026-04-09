import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ethers } from 'ethers';
import api from '../../services/api';
import { walletService, PROTOCOL_USD_TO_ETH_RATE } from '../../services/WalletService';
import {
    ClipboardCheck,
    ShieldCheck,
    UploadCloud,
    FileText,
    AlertTriangle,
    Landmark,
    ArrowUpRight,
    Search,
    DollarSign
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

            toast.info("Submitting Letter of Credit to blockchain...");
            const contractLoC = walletService.getLetterOfCredit();
            const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
            const tx = await contractLoC.uploadLocDocument(uploadTarget.blockchainId, expiry, ipfsHash);
            toast.info("Transaction submitted. Awaiting blockchain confirmation...");
            await tx.wait();

            await api.patch(`/trades/${uploadTarget.id}/state`, {
                txHash: tx.hash,
                ipfsHash,
                eventName: 'LOC_UPLOADED',
                status: 'LOC_UPLOADED'
            });

            toast.success("Letter of Credit published on-chain! Status updated.");
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
                toast.info("Approving Letter of Credit on blockchain...");
                const contract = walletService.getLetterOfCredit();
                tx = await contract.approveLoC(trade.blockchainId);
            } else if (action === 'LOCK_FUNDS') {
                toast.info("Depositing escrow funds to blockchain vault...");
                const contract = walletService.getPaymentSettlement();
                // ARCHITECTURE: Convert USD amount to ETH (using scaled protocol rate)
                // This must match the amount registered on-chain in TradeRegistry
                const amountInEth = (trade.amount / PROTOCOL_USD_TO_ETH_RATE).toFixed(8);
                const valueInWei = ethers.parseEther(amountInEth);
                
                tx = await contract.depositEscrow(trade.blockchainId, { value: valueInWei });

            } else if (action === 'AUTHORIZE_PAYMENT') {
                toast.info("Authorizing payment on blockchain...");
                const contract = walletService.getPaymentSettlement();
                tx = await contract.authorizePayment(trade.blockchainId);
            } else if (action === 'CONFIRM_SETTLEMENT') {
                toast.info("Confirming settlement on blockchain...");
                const contract = walletService.getPaymentSettlement();
                tx = await contract.confirmSettlement(trade.blockchainId);
            } else if (action === 'CLAIM_REFUND') {
                toast.info("Claiming escrow refund for trade...");
                const contract = walletService.getPaymentSettlement();
                tx = await contract.refundImporter(trade.blockchainId);
            }

            if (tx) {
                toast.info("Transaction submitted. Awaiting blockchain confirmation...");
                await tx.wait();

                const statusMap: Record<string, string> = {
                    'APPROVE_LOC': 'LOC_APPROVED',
                    'LOCK_FUNDS': 'FUNDS_LOCKED',
                    'AUTHORIZE_PAYMENT': 'PAYMENT_AUTHORIZED',
                    'CONFIRM_SETTLEMENT': 'SETTLEMENT_CONFIRMED',
                    'CLAIM_REFUND': 'TRADE_REVERTED_BY_CONSENSUS'
                };

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
            const errorMsg = error.reason || error.message || "";
            if (errorMsg.includes("already approved") || errorMsg.includes("already locked") || errorMsg.includes("Invalid status") || errorMsg.includes("Already refunded")) {
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
        if (user.role === 'IMPORTER_BANK') return ['LOC_INITIATED', 'LOC_APPROVED', 'CUSTOMS_CLEARED', 'TRADE_REVERTED_BY_CONSENSUS'];
        if (user.role === 'EXPORTER_BANK') return ['LOC_UPLOADED', 'PAYMENT_AUTHORIZED'];
        return [];
    };

    const getActionConfig = (trade: Trade) => {
        if (user.role === 'IMPORTER_BANK') {
            if (trade.status === 'LOC_INITIATED') return { label: 'Issue LoC', key: 'ISSUE_LOC', icon: UploadCloud, needsFile: true };
            if (trade.status === 'LOC_APPROVED') return { label: 'Lock Funds', key: 'LOCK_FUNDS', icon: ShieldCheck };
            if (trade.status === 'CUSTOMS_CLEARED') return { label: 'Authorize', key: 'AUTHORIZE_PAYMENT', icon: ClipboardCheck };
            if (trade.status === 'TRADE_REVERTED_BY_CONSENSUS') return { label: 'Claim Refund', key: 'CLAIM_REFUND', icon: DollarSign };
        }
        if (user.role === 'EXPORTER_BANK') {
            if (trade.status === 'LOC_UPLOADED') return { label: 'Approve LoC', key: 'APPROVE_LOC', icon: ShieldCheck };
            if (trade.status === 'PAYMENT_AUTHORIZED') return { label: 'Confirm Settlement', key: 'CONFIRM_SETTLEMENT', icon: ClipboardCheck };
        }
        return { label: 'Process', key: 'PROCESSING', icon: Search };
    };

    const targetStatuses = getTargetStatuses();
    const filteredTrades = trades.filter(t => {
        if (!targetStatuses.includes(t.status)) return false;
        
        // Hide if already refunded
        if (t.status === 'TRADE_REVERTED_BY_CONSENSUS') {
            const hasRefundEvent = (t as any).events?.some((e: any) => e.event === 'FUNDS_REFUNDED' || e.event === 'CLAIM_REFUND');
            if (hasRefundEvent) return false;
        }
        return true;
    });

    return (
        <div className="space-y-12 animate-in lg:p-4">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg"
            />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight lg:text-5xl">Bank Operations</h1>
                    <p className="text-slate-500 font-medium mt-2 text-lg">
                        Manage trade assets and secure on-chain settlements.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 text-right">Queue Size</p>
                        <p className="text-xl font-black text-blue-600">{filteredTrades.length} Tasks Pending</p>
                    </div>
                    <div className="w-16 h-16 bg-white/60 backdrop-blur-md rounded-[1.5rem] border border-white/60 shadow-sm flex items-center justify-center">
                        <Landmark size={30} className="text-blue-600" />
                    </div>
                </div>
            </div>

            {!account && (
                <div className="flex items-center gap-5 p-7 bg-rose-50 border border-rose-100 rounded-[2.5rem] shadow-sm animate-pulse">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-rose-600 shadow-sm">
                        <AlertTriangle size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-black text-rose-900 uppercase tracking-tight">Security Alert: Wallet Connection Missing</p>
                        <p className="text-xs font-bold text-rose-700/70 mt-0.5 max-w-lg">Protocol authentication requires a cryptographic signature. Please connect MetaMask to authorize these settlements.</p>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white/50 backdrop-blur-md rounded-[3rem] border border-white/60 shadow-sm glass">
                    <div className="w-14 h-14 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6"></div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Refreshing Ledger...</p>
                </div>
            ) : (
                <div className="bg-white/60 backdrop-blur-md border border-white/60 rounded-[3rem] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.02)] glass">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[1000px]">
                            <thead className="bg-white/40 border-b border-white/60">
                                <tr>
                                    <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Trade Instrument</th>
                                    <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Asset Value</th>
                                    <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Protocol Status</th>
                                    <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Authorization</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/60">
                                {filteredTrades.map((trade) => {
                                    const config = getActionConfig(trade);
                                    const isActionLoading = actionLoading === `${trade.id}-${config.key}`;
                                    const missingBlockchainId = trade.blockchainId === null || trade.blockchainId === undefined;
                                    const missingExporterBank = config.key === 'ISSUE_LOC' && !trade.exporterBankId;
                                    const isDisabled = !!actionLoading || missingBlockchainId || missingExporterBank;

                                    return (
                                        <tr key={trade.id} className="hover:bg-blue-50/20 transition-colors group">
                                            <td className="px-10 py-10">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-16 h-16 bg-slate-50 rounded-[1.25rem] flex items-center justify-center group-hover:bg-blue-600 transition-all duration-500">
                                                        <FileText size={28} className="text-slate-400 group-hover:text-white" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-black text-slate-900 text-xl leading-tight tracking-tight">
                                                                #{trade.blockchainId ?? trade.id.slice(0, 8)}
                                                            </p>
                                                            <ArrowUpRight size={14} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                                                        </div>
                                                        <p className="text-[13px] font-bold text-slate-400 mt-1 uppercase tracking-tight">
                                                            {trade.importer?.name || 'N/A Account'}
                                                        </p>
                                                        {missingBlockchainId && (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 bg-amber-50 text-[10px] font-black text-amber-700 uppercase tracking-widest rounded-full border border-amber-100">
                                                                <AlertTriangle size={10} /> Pending Registration
                                                            </span>
                                                        )}
                                                        {missingExporterBank && !missingBlockchainId && (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 bg-rose-50 text-[10px] font-black text-rose-700 uppercase tracking-widest rounded-full border border-rose-100">
                                                                <AlertTriangle size={10} /> Advising Bank Required
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-10">
                                                <p className="font-black text-slate-900 text-2xl tracking-tight">${trade.amount.toLocaleString()}</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">SDR Asset Class</p>
                                            </td>
                                            <td className="px-10 py-10">
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className="px-5 py-2 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border border-blue-100/50 shadow-sm">
                                                        {trade.status.replace(/_/g, ' ')}
                                                    </span>
                                                    <p className="text-[10px] font-black text-slate-400 ml-1 mt-1 uppercase tracking-wider opacity-60">Verified On-Chain</p>
                                                </div>
                                            </td>
                                            <td className="px-10 py-10 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    {config.key === 'APPROVE_LOC' && trade.letterOfCredit?.ipfsHash && (
                                                        <a
                                                            href={trade.letterOfCredit.ipfsHash.startsWith('http') ? trade.letterOfCredit.ipfsHash : `https://gateway.pinata.cloud/ipfs/${trade.letterOfCredit.ipfsHash}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="btn-secondary h-14 w-14 !p-0 flex items-center justify-center hover:bg-white hover:border-blue-200 hover:text-blue-600 transition-all shadow-sm"
                                                            title="View IPFS Document"
                                                        >
                                                            <ArrowUpRight size={22} />
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={() => config.needsFile ? (setUploadTarget(trade), fileInputRef.current?.click()) : handleAction(trade, config.key)}
                                                        disabled={isDisabled}
                                                        className={`btn-primary h-14 min-w-[180px] !px-8 ${isDisabled ? 'grayscale opacity-50 cursor-not-allowed' : 'shadow-xl shadow-blue-100'}`}
                                                        title={
                                                            missingBlockchainId
                                                                ? "Trade must be registered on-chain first"
                                                                : missingExporterBank
                                                                    ? "Exporter must nominate an advising bank first"
                                                                    : undefined
                                                        }
                                                    >
                                                        {isActionLoading ? (
                                                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                        ) : (
                                                            <div className="flex items-center gap-3">
                                                                <config.icon size={20} />
                                                                <span className="whitespace-nowrap uppercase tracking-[0.15em] text-[11px] font-black">{config.label}</span>
                                                            </div>
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredTrades.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-40 text-center bg-blue-50/10">
                                            <div className="w-24 h-24 bg-white/60 backdrop-blur-md border border-white/60 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-sm glass">
                                                <ClipboardCheck className="text-slate-300" size={48} />
                                            </div>
                                            <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Queue Empty</h3>
                                            <p className="text-slate-500 font-medium max-w-sm mx-auto">All cryptographic authorizations are complete. New settlement requests will appear as they materialize on-chain.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
};

export default BankRequests;

