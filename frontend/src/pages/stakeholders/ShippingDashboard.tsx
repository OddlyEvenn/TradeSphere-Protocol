import React, { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import { walletService } from '../../services/WalletService';
import { Truck, MapPin, CheckCircle2, ShieldCheck, UploadCloud } from 'lucide-react';
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
            // Shipping sees trades that are FUNDS_LOCKED or GOODS_SHIPPED or later
            setTrades(res.data.filter((t: any) =>
                ['SHIPPING_ASSIGNED', 'FUNDS_LOCKED', 'GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'DUTY_PENDING', 'DUTY_PAID', 'PAYMENT_AUTHORIZED', 'COMPLETED'].includes(t.status)
            ));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadTarget) return;

        if (!account && !user?.walletAddress) {
            toast.error("Please connect your wallet first!");
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
            toast.success("BoL uploaded securely to IPFS!");

            // Manual Mode Override
            if (!account && user?.walletAddress) {
                toast.info("Manual Wallet Mode: Simulating BoL Issuance...");
                await new Promise(resolve => setTimeout(resolve, 2000));
                await api.patch(`/trades/${uploadTarget.id}/state`, {
                    status: 'GOODS_SHIPPED',
                    ipfsHash: ipfsHash,
                    eventName: 'GOODS_SHIPPED'
                });
                toast.success("Simulated BoL Issued!");
                fetchTrades();
                return;
            }

            // Normal Flow
            const contractDoc = walletService.getDocumentVerification();
            if (uploadTarget.blockchainId === null || uploadTarget.blockchainId === undefined) {
                throw new Error("This trade has no blockchain ID.");
            }

            toast.info("Sending transaction to blockchain...");
            const tx = await contractDoc.issueBillOfLading(uploadTarget.blockchainId, ipfsHash);
            await tx.wait();

            await api.patch(`/trades/${uploadTarget.id}/state`, {
                status: 'GOODS_SHIPPED',
                ipfsHash: ipfsHash,
                txHash: tx.hash,
                eventName: 'GOODS_SHIPPED'
            });

            toast.success("Bill of Lading officially issued on-chain!");
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
                <p className="text-slate-500 font-medium mt-1">Manage active sea and air freight shipments. Issue Bills of Lading.</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-t-indigo-600"></div></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {trades.map(trade => (
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
                            <div className="flex items-center gap-2 text-slate-400 mb-6">
                                <MapPin size={14} />
                                <span className="text-xs font-bold uppercase tracking-widest">To: {trade.destination}</span>
                            </div>
                            <div className="pt-6 border-t border-slate-50">
                                {['SHIPPING_ASSIGNED', 'FUNDS_LOCKED'].includes(trade.status) && (
                                    <button
                                        onClick={() => {
                                            setUploadTarget(trade);
                                            fileInputRef.current?.click();
                                        }}
                                        disabled={!!actionLoading}
                                        className="btn-primary w-full text-xs flex justify-center items-center gap-2"
                                    >
                                        {actionLoading === `${trade.id}-ISSUE_BOL` ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        ) : (
                                            <UploadCloud size={16} />
                                        )}
                                        Upload & Issue Bill of Lading
                                    </button>
                                )}
                                {!['SHIPPING_ASSIGNED', 'FUNDS_LOCKED'].includes(trade.status) && (
                                    <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-xs py-3 bg-emerald-50 rounded-xl">
                                        <ShieldCheck size={16} /> Bill of Lading Issued Active
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
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
