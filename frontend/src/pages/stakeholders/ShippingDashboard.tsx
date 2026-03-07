import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import { walletService } from '../../services/WalletService';
import { Truck, MapPin, ShieldCheck, UploadCloud, AlertTriangle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const ShippingDashboard: React.FC = () => {
    const { user, account } = useOutletContext<{ user: any, account: string | null }>();
    const [trades, setTrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTarget, setUploadTarget] = useState<any | null>(null);
    const toast = useToast();

    useEffect(() => {
        fetchTrades();
    }, []);

    const fetchTrades = async () => {
        try {
            const res = await api.get('/trades');
            setTrades(res.data.filter((t: any) =>
                ['SHIPPING_ASSIGNED', 'FUNDS_LOCKED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'DUTY_PENDING', 'DUTY_PAID', 'PAYMENT_AUTHORIZED', 'COMPLETED'].includes(t.status)
            ));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * ARCHITECTURE: BOL issuance MUST go through the DocumentVerification smart contract.
     * The EventListenerService on the backend listens to the BillOfLadingIssued event
     * and updates the database status to GOODS_SHIPPED automatically.
     * No DB-only fallback is allowed.
     */
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadTarget) return;

        if (!account) {
            toast.error("MetaMask wallet required. Please connect your wallet to issue a Bill of Lading.");
            return;
        }

        if (uploadTarget.blockchainId === null || uploadTarget.blockchainId === undefined) {
            toast.error(
                "This trade has not been registered on-chain. " +
                "The importer must complete blockchain trade registration before a Bill of Lading can be issued on-chain."
            );
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setActionLoading(`${uploadTarget.id}-ISSUE_BOL`);
        try {
            toast.info("Uploading Bill of Lading to IPFS...");
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await api.post('/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const ipfsHash = uploadRes.data.ipfsHash;
            toast.success("Bill of Lading secured on IPFS!");

            // ── Blockchain-first: issueBillOfLading on-chain → EventListenerService updates DB ──
            toast.info("Issuing Bill of Lading on blockchain via DocumentVerification contract...");
            const contractDoc = walletService.getDocumentVerification();
            const tx = await contractDoc.issueBillOfLading(uploadTarget.blockchainId, ipfsHash);
            toast.info("Transaction submitted. Awaiting blockchain confirmation...");
            await tx.wait();

            // Record txHash for audit trail only — EventListenerService handles status update
            await api.patch(`/trades/${uploadTarget.id}/state`, {
                txHash: tx.hash,
                ipfsHash,
                eventName: 'GOODS_SHIPPED'
            });

            toast.success("Bill of Lading issued on-chain! Trade status will update automatically.");
            setTimeout(fetchTrades, 3000);
        } catch (error: any) {
            console.error("BoL issuance failed:", error);
            toast.error(`Error: ${error.reason || error.message}`);
        } finally {
            setActionLoading(null);
            setUploadTarget(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-10">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg"
            />

            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Logistics Terminal</h1>
                <p className="text-slate-500 font-medium mt-1">Issue Bills of Lading on-chain. Status updates automatically after blockchain confirmation.</p>
            </div>

            {/* Wallet Warning Banner */}
            {!account && (
                <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
                    <p className="text-sm font-bold text-amber-800">
                        MetaMask not connected. You must connect your wallet to issue Bills of Lading.
                    </p>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-t-indigo-600"></div></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {trades.map(trade => {
                        const canAct = ['SHIPPING_ASSIGNED', 'FUNDS_LOCKED'].includes(trade.status);
                        const missingBlockchainId = trade.blockchainId === null || trade.blockchainId === undefined;
                        return (
                            <div key={trade.id} className="card-premium">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                        <Truck size={24} />
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${trade.status === 'FUNDS_LOCKED' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {trade.status.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                <h3 className="font-black text-lg text-slate-900 mb-2">{trade.productName}</h3>
                                <div className="flex items-center gap-2 text-slate-400 mb-1">
                                    <MapPin size={14} />
                                    <span className="text-xs font-bold uppercase tracking-widest">To: {trade.destination}</span>
                                </div>
                                <p className="text-[10px] font-bold text-indigo-600 mb-2">
                                    {trade.blockchainId !== null && trade.blockchainId !== undefined ? `Tracking: BC #${trade.blockchainId}` : `ID: ${trade.id.slice(0, 8)}`}
                                </p>
                                {missingBlockchainId && (
                                    <p className="text-[10px] text-amber-600 font-bold mb-4">⚠ Not registered on-chain — cannot issue BoL</p>
                                )}
                                <div className="pt-6 border-t border-slate-50">
                                    {canAct ? (
                                        <button
                                            onClick={() => {
                                                setUploadTarget(trade);
                                                fileInputRef.current?.click();
                                            }}
                                            disabled={!!actionLoading || missingBlockchainId}
                                            className="btn-primary w-full text-xs flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title={missingBlockchainId ? "Trade must be registered on-chain first" : "Issue Bill of Lading on blockchain"}
                                        >
                                            {actionLoading === `${trade.id}-ISSUE_BOL` ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                            ) : (
                                                <UploadCloud size={16} />
                                            )}
                                            Upload & Issue Bill of Lading
                                        </button>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-xs py-3 bg-emerald-50 rounded-xl">
                                            <ShieldCheck size={16} /> Bill of Lading Issued
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {trades.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
                            <Truck className="mx-auto text-slate-300 mb-4" size={48} />
                            <h3 className="text-xl font-bold text-slate-900">No Pending Shipments</h3>
                            <p className="text-slate-400">Shipments awaiting dispatch will appear here once banks lock funds.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ShippingDashboard;
