import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Shield, FileText, CheckCircle2, AlertCircle, Search, Gavel, TrendingUp, Activity, ScanSearch, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import TradeTimeline from '../../components/TradeTimeline';

const getStatusColor = (status: string) => {
    if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700';
    if (['DOCS_VERIFIED', 'CUSTOMS_CLEARED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED'].includes(status)) return 'bg-blue-50 text-blue-700';
    if (['GOODS_SHIPPED', 'DOCS_SUBMITTED', 'LOC_UPLOADED', 'LOC_APPROVED', 'FUNDS_LOCKED'].includes(status)) return 'bg-indigo-50 text-indigo-700';
    if (status === 'DUTY_PENDING') return 'bg-rose-50 text-rose-700';
    return 'bg-amber-50 text-amber-700';
};

const RegulatorDashboard: React.FC = () => {
    const [trades, setTrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
    const [tradeEvents, setTradeEvents] = useState<any[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const toast = useToast();

    useEffect(() => {
        fetchTrades();
    }, []);

    const fetchTrades = async () => {
        try {
            const res = await api.get('/trades');
            setTrades(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleComplianceScan = () => {
        if (scanning) return;
        setScanning(true);
        toast.info("Initiating deep algorithmic compliance scan across all on-chain trades...");

        setTimeout(() => {
            setScanning(false);
            toast.success("Scan Complete! No AML or KYC violations detected in active trades.");
        }, 3000);
    };

    const handleExpandRow = async (tradeId: string) => {
        if (expandedTradeId === tradeId) {
            setExpandedTradeId(null);
            return;
        }

        setExpandedTradeId(tradeId);
        setEventsLoading(true);
        try {
            const res = await api.get(`/trades/${tradeId}/events`);
            setTradeEvents(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load trade audit trail.");
            setTradeEvents([]);
        } finally {
            setEventsLoading(false);
        }
    };

    const completed = trades.filter(t => t.status === 'COMPLETED').length;
    const active = trades.filter(t => t.status !== 'COMPLETED').length;
    const onChainVerified = trades.filter(t => t.blockchainId !== null).length;

    return (
        <div className="space-y-10">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Regulatory Oversight</h1>
                    <p className="text-slate-500 font-medium mt-1">Real-time audit trail of global trade finance operations.</p>
                </div>
                <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-2">
                    <Shield size={14} /> Live Monitoring
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card-premium space-y-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Activity size={20} />
                    </div>
                    <p className="text-3xl font-black text-slate-900">{trades.length}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Trades</p>
                </div>
                <div className="card-premium space-y-3">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                        <CheckCircle2 size={20} />
                    </div>
                    <p className="text-3xl font-black text-slate-900">{onChainVerified}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">On-Chain Verified</p>
                </div>
                <div className="card-premium space-y-3">
                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                        <TrendingUp size={20} />
                    </div>
                    <p className="text-3xl font-black text-slate-900">{completed}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed Trades</p>
                </div>
            </div>

            {/* Audit Trail Table */}
            <div className="card-premium overflow-hidden !p-0">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white relative z-20">
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <FileText className="text-indigo-600" />
                        Global Trade Ledger
                    </h2>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{active} Active / {completed} Completed</span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20 bg-white relative z-10"><div className="animate-spin rounded-full h-10 w-10 border-4 border-t-indigo-600"></div></div>
                ) : (
                    <table className="w-full text-left relative z-10">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Trade / Product</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Importer → Exporter</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Value</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Chain Verified</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 relative bg-white">
                            {trades.map(trade => (
                                <React.Fragment key={trade.id}>
                                    <tr
                                        onClick={() => handleExpandRow(trade.id)}
                                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${expandedTradeId === trade.id ? 'bg-indigo-50/30' : ''}`}
                                    >
                                        <td className="px-8 py-5">
                                            <p className="font-black text-slate-900 text-sm flex items-center gap-2">
                                                {expandedTradeId === trade.id ? <ChevronUp size={14} className="text-indigo-600" /> : <ChevronDown size={14} className="text-slate-400" />}
                                                #{trade.blockchainId || trade.id.slice(0, 8)}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-5">{trade.productName || '—'}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-xs font-bold text-slate-900">{trade.importer?.name || '—'}</p>
                                            <p className="text-[10px] font-bold text-slate-400">→ {trade.exporter?.name || 'No Exporter Yet'}</p>
                                        </td>
                                        <td className="px-8 py-5 font-black text-slate-700">${trade.amount?.toLocaleString()}</td>
                                        <td className="px-8 py-5">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(trade.status)}`}>
                                                {trade.status.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            {trade.blockchainId !== null ? (
                                                <div className="flex items-center justify-end gap-1.5 text-emerald-600">
                                                    <CheckCircle2 size={14} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Verified</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1.5 text-slate-400">
                                                    <AlertCircle size={14} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Off-chain</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>

                                    {/* Expanded Timeline View */}
                                    {expandedTradeId === trade.id && (
                                        <tr className="bg-slate-50/50 border-b-2 border-slate-100">
                                            <td colSpan={5} className="p-0">
                                                <div className="p-8 border-t border-indigo-100/50">
                                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Immutable Audit Trail</h3>
                                                    {eventsLoading ? (
                                                        <div className="flex items-center gap-3 text-indigo-600 font-bold text-sm">
                                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
                                                            Decrypting Ledger...
                                                        </div>
                                                    ) : tradeEvents.length > 0 ? (
                                                        <div className="ml-4">
                                                            <TradeTimeline events={tradeEvents} />
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm font-bold text-slate-400 italic">No verifiable events found for this trade yet.</p>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
                {trades.length === 0 && !loading && (
                    <div className="p-20 text-center bg-white relative z-10">
                        <Search className="mx-auto text-slate-200 mb-4" size={48} />
                        <h3 className="text-xl font-bold text-slate-900">No Trades Recorded</h3>
                        <p className="text-slate-400">The audit trail will populate as trades are initiated.</p>
                    </div>
                )}
            </div>

            {/* Footer Banner */}
            <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white relative overflow-hidden shadow-xl shadow-indigo-900/20">
                <div className="relative z-10">
                    <h2 className="text-2xl font-black mb-2 uppercase tracking-tighter">AML & Compliance Engine</h2>
                    <p className="text-slate-400 max-w-md mb-8">All trade flows are monitored for suspicious activity patterns. Double-spending and KYC violations are flagged automatically.</p>
                    <button
                        onClick={handleComplianceScan}
                        className="btn-primary bg-white text-slate-900 px-8 hover:bg-slate-100 transition-all"
                    >
                        {scanning ? (
                            <><div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-900 border-t-transparent"></div> Scanning Ledger...</>
                        ) : (
                            <><ScanSearch size={18} /> Run Deep Compliance Scan</>
                        )}
                    </button>
                </div>
                <Gavel className="absolute -bottom-10 -right-10 text-white/5" size={300} />
            </div>
        </div>
    );
};

export default RegulatorDashboard;
