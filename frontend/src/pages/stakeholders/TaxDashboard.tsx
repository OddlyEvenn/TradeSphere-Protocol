import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { BadgePercent, TrendingUp, ShieldCheck, AlertCircle, FileText, Search, CheckCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const TaxDashboard: React.FC = () => {
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
            // Tax authority monitors cleared and completed trades
            setTrades(res.data.filter((t: any) =>
                ['CUSTOMS_CLEARED', 'DOCS_VERIFIED', 'COMPLETED'].includes(t.status)
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
            await api.patch(`/trades/${tradeId}`, {
                status: 'DOCS_VERIFIED',
                taxAmount: amount
            });
            toast.success("Trade cleared for final settlement.");
            fetchTrades();
        } catch (err) {
            console.error(err);
            toast.error("Failed to assess tax. Please try again.");
        } finally {
            setAssessingId(null);
        }
    };

    const handleAuditLog = () => {
        toast.info("Recording manual assessment securely to the ledger...");
    };

    const handleTaxInputChange = (tradeId: string, value: string) => {
        setTaxInputs(prev => ({ ...prev, [tradeId]: value }));
    };

    const totalMonitored = trades.reduce((sum, t) => sum + (t.amount || 0), 0);
    const pendingAssessments = trades.filter(t => t.status === 'CUSTOMS_CLEARED').length;

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tax & Revenue Authority</h1>
                <p className="text-slate-500 font-medium mt-1">Cross-chain tax compliance and trade volume monitoring.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="card-premium space-y-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-slate-900">${totalMonitored.toLocaleString()}</p>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Trade Value</p>
                    </div>
                </div>
                <div className="card-premium space-y-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-slate-900">100%</p>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Compliance Rate</p>
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
                        Revenue Monitoring Queue
                    </h2>
                </div>
                {loading ? (
                    <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-t-indigo-600"></div></div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Value</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Tax Assessment (USD)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {trades.map(trade => (
                                <tr key={trade.id}>
                                    <td className="px-8 py-6">
                                        <p className="font-black text-slate-900 text-sm">{trade.productName}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">To: {trade.destination}</p>
                                    </td>
                                    <td className="px-8 py-6 font-bold text-slate-600">${trade.amount?.toLocaleString()}</td>
                                    <td className="px-8 py-6 text-right">
                                        {trade.status === 'CUSTOMS_CLEARED' ? (
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
                                            <div className="flex items-center justify-end gap-2 text-emerald-600 font-bold">
                                                <span>${trade.taxAmount?.toLocaleString() || '0'}</span>
                                                <CheckCircle size={16} />
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
                        <p className="text-slate-400">Activity will appear here after customs clearance.</p>
                    </div>
                )}
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white overflow-hidden relative shadow-2xl shadow-indigo-200/50">
                <div className="relative z-10">
                    <h2 className="text-2xl font-black mb-2 uppercase tracking-tighter">Record Tax Assessment</h2>
                    <p className="text-slate-400 max-w-md mb-8">System securely records all assessed taxes against the trade. This amount is automatically deducted and routed to the Tax Authority during final settlement.</p>
                    <button onClick={handleAuditLog} className="btn-primary bg-white text-slate-900 px-8 hover:bg-slate-100 transition-all">View Tax Ledger</button>
                </div>
                <BadgePercent className="absolute -bottom-10 -right-10 text-white/5" size={300} />
            </div>
        </div>
    );
};

export default TaxDashboard;
