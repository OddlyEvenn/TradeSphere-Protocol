import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import { walletService } from '../../services/WalletService';
import { BadgePercent, TrendingUp, ShieldCheck, AlertCircle, FileText, Search, CheckCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const TaxDashboard: React.FC = () => {
    const { user, account } = useOutletContext<{ user: any, account: string | null }>();
    const [trades, setTrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [taxInputs, setTaxInputs] = useState<Record<string, string>>({});
    const [assessingId, setAssessingId] = useState<string | null>(null);
    const toast = useToast();

    useEffect(() => {
        fetchTrades();
    }, []);

    const fetchTrades = async () => {
        try {
            const res = await api.get('/trades');
            // Tax authority monitors trades flagged by Customs or already paid
            setTrades(res.data.filter((t: any) =>
                ['DUTY_PENDING', 'DUTY_PAID', 'PAYMENT_AUTHORIZED', 'COMPLETED'].includes(t.status)
            ));
        } catch (err) {
            console.error(err);
            toast.error("Failed to fetch trades.");
        } finally {
            setLoading(false);
        }
    };

    const handleAssessDuty = async (tradeId: string) => {
        const amount = parseFloat(taxInputs[tradeId]);
        if (isNaN(amount) || amount <= 0) {
            return toast.error("Please enter a valid tax amount greater than 0.");
        }

        setAssessingId(tradeId);
        try {
            // We just update the tax amount and log the event. The status remains DUTY_PENDING
            // until the importer actually pays it via their dashboard.
            await api.patch(`/trades/${tradeId}/state`, {
                taxAmount: amount,
                eventName: 'DUTY_ASSESSED'
            });
            toast.success("Duty Assessed! The Importer has been notified to pay.");
            fetchTrades();
        } catch (err) {
            console.error(err);
            toast.error("Failed to assess tax. Please try again.");
        } finally {
            setAssessingId(null);
        }
    };

    const handleReleaseGoods = async (tradeId: string, blockchainId: number | null) => {
        setAssessingId(tradeId);
        try {
            if (!account && user?.walletAddress) {
                toast.info("Manual Wallet Mode: Simulating Tax Release...");
                await new Promise(resolve => setTimeout(resolve, 2000));
                await api.patch(`/trades/${tradeId}/state`, {
                    status: 'CUSTOMS_CLEARED',
                    eventName: 'GOODS_RELEASED_FROM_DUTY'
                });
                toast.success("Goods officially released to Customs!");
                fetchTrades();
                return;
            }

            if (blockchainId !== null && blockchainId !== undefined) {
                const docContract = walletService.getDocumentVerification();
                const tx = await docContract.releaseFromDuty(blockchainId);
                toast.info("Transaction sent. Waiting for confirmation...");
                await tx.wait();

                await api.patch(`/trades/${tradeId}/state`, {
                    status: 'CUSTOMS_CLEARED',
                    txHash: tx.hash,
                    eventName: 'GOODS_RELEASED_FROM_DUTY'
                });
                toast.success("Goods officially released on-chain!");
                fetchTrades();
            }
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to release goods: " + (err.reason || err.message));
        } finally {
            setAssessingId(null);
        }
    };

    const handleAuditLog = () => {
        toast.info("Opening secure tax ledger...");
    };

    const handleTaxInputChange = (tradeId: string, value: string) => {
        setTaxInputs(prev => ({ ...prev, [tradeId]: value }));
    };

    const totalMonitored = trades.reduce((sum, t) => sum + (t.amount || 0), 0);
    const pendingAssessments = trades.filter(t => t.status === 'DUTY_PENDING' && !t.dutyAmount).length;

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tax & Revenue Authority</h1>
                <p className="text-slate-500 font-medium mt-1">Cross-chain tax compliance, duty assessment, and revenue monitoring.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="card-premium space-y-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-slate-900">${totalMonitored.toLocaleString()}</p>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Monitored Trade Value</p>
                    </div>
                </div>
                <div className="card-premium space-y-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-slate-900">100%</p>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Compliance Engine</p>
                    </div>
                </div>
                <div className="card-premium space-y-4 border-rose-100 bg-rose-50/10">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-slate-900">{pendingAssessments}</p>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pending Assessments</p>
                    </div>
                </div>
            </div>

            <div className="card-premium !p-0 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <FileText className="text-indigo-600" />
                        Customs Revenue Queue
                    </h2>
                </div>
                {loading ? (
                    <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-t-indigo-600"></div></div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product & ID</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Value</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Duty Assessment (USD)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {trades.map(trade => (
                                <tr key={trade.id}>
                                    <td className="px-8 py-6">
                                        <p className="font-black text-slate-900 text-sm">{trade.productName}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">ID: #{trade.blockchainId || trade.id.slice(0, 8)}</p>
                                    </td>
                                    <td className="px-8 py-6 font-bold text-slate-600">${trade.amount?.toLocaleString()}</td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${trade.status === 'DUTY_PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                            {trade.status === 'DUTY_PENDING' ? (trade.dutyAmount ? 'WAITING FOR PAYMENT' : 'NEEDS ASSESSMENT') : trade.status.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        {trade.status === 'DUTY_PAID' ? (
                                            <div className="flex items-center justify-end gap-3">
                                                <div className="text-emerald-600 font-bold flex items-center gap-1 text-xs">
                                                    <CheckCircle size={14} /> Paid
                                                </div>
                                                <button
                                                    onClick={() => handleReleaseGoods(trade.id, trade.blockchainId)}
                                                    disabled={assessingId === trade.id}
                                                    className="btn-primary py-2 px-4 shadow-none text-xs bg-emerald-600 hover:bg-emerald-700"
                                                >
                                                    {assessingId === trade.id ? 'Processing...' : 'Release Goods'}
                                                </button>
                                            </div>
                                        ) : trade.status === 'DUTY_PENDING' && !trade.dutyAmount ? (
                                            <div className="flex items-center justify-end gap-3">
                                                <div className="relative w-32">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                    <input
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={taxInputs[trade.id] || ''}
                                                        onChange={(e) => handleTaxInputChange(trade.id, e.target.value)}
                                                        className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleAssessDuty(trade.id)}
                                                    disabled={assessingId === trade.id}
                                                    className="btn-primary py-2.5 px-6 shadow-none text-xs whitespace-nowrap"
                                                >
                                                    {assessingId === trade.id ? 'Saving...' : 'Assess Duty'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-2 font-bold text-slate-900">
                                                <span>${trade.dutyAmount?.toLocaleString() || '0'}</span>
                                                {trade.status !== 'DUTY_PENDING' && <CheckCircle className="text-emerald-500" size={16} />}
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
                        <h3 className="text-xl font-bold text-slate-900">No Pending Assessments</h3>
                        <p className="text-slate-400">Activity will appear here after customs flags goods for import duties.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaxDashboard;
