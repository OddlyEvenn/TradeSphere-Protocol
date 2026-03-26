import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import { walletService } from '../../services/WalletService';
import { ClipboardCheck, FileSearch, Gavel, Activity, Search, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import DisputePanel from '../../components/DisputePanel';

const getStatusColor = (status: string) => {
    if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700';
    if (['DOCS_VERIFIED', 'CUSTOMS_CLEARED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED'].includes(status)) return 'bg-emerald-50 text-emerald-700';
    if (['GOODS_SHIPPED', 'CUSTOMS_UNDER_REVIEW', 'DOCS_SUBMITTED'].includes(status)) return 'bg-blue-50 text-blue-700';
    if (status === 'DISPUTED') return 'bg-rose-50 text-rose-700';
    return 'bg-amber-50 text-amber-700';
};

const InspectorDashboard: React.FC = () => {
    const { user, account: initialAccount } = useOutletContext<{ user: any, account: string | null }>();
    const [trades, setTrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [account, setAccount] = useState<string | null>(initialAccount);
    const toast = useToast();

    useEffect(() => {
        fetchTrades();
        if (!account) {
            walletService.connect().then(acc => setAccount(acc));
        }
    }, []);

    const fetchTrades = async () => {
        try {
            setLoading(true);
            const res = await api.get('/trades');
            setTrades(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load audit pipeline.");
        } finally {
            setLoading(false);
        }
    };

    const stats = [
        { label: 'Pending Audits', value: trades.filter(t => t.status === 'GOODS_SHIPPED').length, icon: FileSearch, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Active Disputes', value: trades.filter(t => t.status === 'DISPUTED').length, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
        { label: 'Weight Score', value: '+2.0', icon: Gavel, color: 'text-primary-600', bg: 'bg-primary-50' },
    ];

    return (
        <div className="space-y-10">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Inspector & Audit Node</h1>
                    <p className="text-slate-500 font-medium mt-1">Verify physical compliance and participate in decentralized arbitration.</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <Activity className="text-emerald-500" size={20} />
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Oracle Health</p>
                            <p className="text-sm font-black text-slate-900">Synchronized</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="card-premium flex items-center gap-6 p-8">
                        <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center shadow-inner`}>
                            <stat.icon size={28} />
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                            <p className="text-3xl font-black text-slate-900 leading-none">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Audit Pipeline */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm glass">
                <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
                    <h2 className="text-lg font-black text-slate-900">Audit Pipeline</h2>
                    <button onClick={fetchTrades} className="btn-secondary py-2 px-4 text-xs font-black uppercase tracking-widest shadow-none">
                        Refresh Ledger
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-14 h-14 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                    </div>
                ) : trades.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Trade Identifier</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Parties</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Value</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Audit Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {trades.map(trade => (
                                    <React.Fragment key={trade.id}>
                                        <tr className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-8 py-6">
                                                <p className="font-black text-slate-900">#{trade.blockchainId || trade.id.slice(0, 8)}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{trade.productName || 'General Cargo'}</p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-700">{trade.importer?.name?.split(' ')[0]}</span>
                                                    <div className="w-2 h-px bg-slate-200"></div>
                                                    <span className="text-xs font-bold text-slate-700">{trade.exporter?.name?.split(' ')[0]}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center font-black text-slate-900">
                                                ${trade.amount?.toLocaleString()}
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(trade.status)}`}>
                                                    {trade.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                {trade.status === 'GOODS_SHIPPED' ? (
                                                    <div className="flex items-center justify-end gap-1.5 text-blue-600">
                                                        <FileSearch size={14} />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Verification Needed</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-1.5 text-slate-400">
                                                        <ShieldCheck size={14} />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Audited</span>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                        {(trade.status === 'DISPUTED' || trade.status === 'GOODS_SHIPPED') && (
                                            <tr className="bg-slate-50/30">
                                                <td colSpan={5} className="px-8 py-8 border-b border-slate-100">
                                                    <div className="flex gap-8 items-start">
                                                        <div className={`flex-shrink-0 w-12 h-12 ${trade.status === 'DISPUTED' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'} rounded-full flex items-center justify-center`}>
                                                            {trade.status === 'DISPUTED' ? <Gavel size={24} /> : <ClipboardCheck size={24} />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <h3 className={`text-sm font-black ${trade.status === 'DISPUTED' ? 'text-rose-900' : 'text-blue-900'} uppercase tracking-widest mb-2 flex items-center gap-2`}>
                                                                {trade.status === 'DISPUTED' ? 'Consensus Arbitration Required' : 'Inspection & Dispute Authority'}
                                                                {trade.status === 'DISPUTED' && <span className="px-2 py-0.5 bg-rose-600 text-[8px] text-white rounded-full">Weight: 2.0</span>}
                                                            </h3>
                                                            <p className="text-xs font-medium text-slate-500 mb-6 max-w-2xl leading-relaxed">
                                                                {trade.status === 'DISPUTED' 
                                                                    ? "A dispute has been raised. Your independent audit vote carries a weight of 2 points. Review evidence hash on-chain before casting."
                                                                    : "As the designated inspector, you can raise an on-chain dispute if goods do not meet quality standards or SLA breaches are detected."}
                                                            </p>
                                                            <DisputePanel 
                                                                trade={trade} 
                                                                currentUserRole="INSPECTOR" 
                                                                currentUserWallet={account || ""} 
                                                                onUpdate={fetchTrades} 
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-20 text-center">
                        <Search className="mx-auto text-slate-200 mb-4" size={48} />
                        <h3 className="text-xl font-bold text-slate-900">No audits pending</h3>
                        <p className="text-slate-400 font-medium">Historical audit logs are available in the Archive tab.</p>
                    </div>
                )}
            </div>

            {/* Footer Notice */}
            <div className="bg-primary-900 rounded-[2.5rem] p-12 text-white relative overflow-hidden shadow-xl shadow-primary-900/20">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="max-w-xl text-center md:text-left">
                        <h2 className="text-2xl font-black mb-4 uppercase tracking-tighter">Independent Verification Authority</h2>
                        <p className="text-indigo-200 font-medium italic">"Decentralized trade finance relies on physical world oracles. Your role as an Inspector Node ensures the bridge between digital smart contracts and real-world asset quality."</p>
                    </div>
                    <div className="flex-shrink-0">
                        <div className="bg-white/10 p-6 rounded-3xl border border-white/20 backdrop-blur-md">
                            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 text-center">Network Privilege</p>
                            <p className="text-xl font-black text-white text-center tracking-tight">HIGH-TRUST NODE</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InspectorDashboard;
