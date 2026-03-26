import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import { walletService } from '../../services/WalletService';
import { Shield, FileText, CheckCircle2, AlertCircle, Search, Gavel, Activity, ShieldAlert } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import DisputePanel from '../../components/DisputePanel';

const getStatusColor = (status: string) => {
    if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700';
    if (['DOCS_VERIFIED', 'CUSTOMS_CLEARED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'DUTY_PAID', 'CLAIM_PAYOUT_APPROVED'].includes(status)) return 'bg-emerald-50 text-emerald-700';
    if (['GOODS_SHIPPED', 'CUSTOMS_UNDER_REVIEW', 'DOCS_SUBMITTED', 'LOC_UPLOADED', 'LOC_APPROVED', 'FUNDS_LOCKED', 'TRADE_INITIATED', 'OFFER_ACCEPTED'].includes(status)) return 'bg-blue-50 text-blue-700';
    if (status === 'DISPUTED' || status === 'TRADE_REVERTED_BY_CONSENSUS') return 'bg-rose-50 text-rose-700';
    return 'bg-amber-50 text-amber-700';
};

const InsuranceDashboard: React.FC = () => {
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
            // Insurance nodes see trades where they are assigned or trades in dispute
            // Backend should have filtered this, but safety check here
            setTrades(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load insurance portfolio.");
        } finally {
            setLoading(false);
        }
    };

    const stats = [
        { label: 'Active Policies', value: trades.length, icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Active Disputes', value: trades.filter(t => t.status === 'DISPUTED').length, icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-50' },
        { label: 'Settled Claims', value: trades.filter(t => t.status === 'CLAIM_PAYOUT_APPROVED').length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    return (
        <div className="space-y-10">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Insurance Underwriting</h1>
                    <p className="text-slate-500 font-medium mt-1">Manage risk, monitor disputes, and participate in consensus voting.</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <Activity className="text-blue-600" size={20} />
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Status</p>
                            <p className="text-sm font-black text-slate-900">Operational</p>
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

            {/* Portfolio Table */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm glass relative">
                <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
                    <h2 className="text-lg font-black text-slate-900">Policy Portfolio</h2>
                    <button onClick={fetchTrades} className="btn-secondary py-2 px-4 text-xs font-black uppercase tracking-widest shadow-none hover:bg-slate-50">
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
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Trade ID / Product</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Participants</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Value</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Protection</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {trades.map(trade => (
                                    <React.Fragment key={trade.id}>
                                        <tr className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-8 py-6">
                                                <p className="font-black text-slate-900 border-b border-transparent inline-block">
                                                    #{trade.blockchainId || trade.id.slice(0, 8)}
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{trade.productName || 'General Cargo'}</p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-bold text-slate-700">{trade.importer?.name?.split(' ')[0]}</p>
                                                    <div className="w-2 h-px bg-slate-200"></div>
                                                    <p className="text-xs font-bold text-slate-700">{trade.exporter?.name?.split(' ')[0]}</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <p className="font-black text-slate-900">${trade.amount?.toLocaleString()}</p>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(trade.status)}`}>
                                                    {trade.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-1.5 text-blue-600">
                                                    <Shield size={14} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
                                                </div>
                                            </td>
                                        </tr>
                                        {trade.status === 'DISPUTED' && (
                                            <tr className="bg-rose-50/30">
                                                <td colSpan={5} className="px-8 py-8 border-b border-rose-100">
                                                    <div className="flex gap-8 items-start">
                                                        <div className="flex-shrink-0 w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
                                                            <Gavel size={24} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <h3 className="text-sm font-black text-rose-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                Arbitration Required
                                                                <span className="px-2 py-0.5 bg-rose-600 text-[8px] text-white rounded-full">High Priority</span>
                                                            </h3>
                                                            <p className="text-xs font-medium text-rose-700 mb-6 max-w-2xl leading-relaxed">
                                                                A dispute has been raised regarding document discrepancies or SLA breaches. As the designated Insurance Node, your weighted vote is required to reach consensus.
                                                            </p>
                                                            <DisputePanel 
                                                                trade={trade} 
                                                                currentUserRole="INSURANCE" 
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
                        <h3 className="text-xl font-bold text-slate-900">No active policies</h3>
                        <p className="text-slate-400">You are not currently designated as an insurance node for any active trades.</p>
                    </div>
                )}
            </div>

            {/* Footer Banner */}
            <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white relative overflow-hidden shadow-xl shadow-blue-900/20">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="max-w-xl text-center md:text-left">
                        <h2 className="text-2xl font-black mb-4 uppercase tracking-tighter">Decentralized Reinsurance</h2>
                        <p className="text-slate-400 font-medium">Underwriting risk on the TradeSphere Protocol uses immutable shipment data. Smart contracts automatically calculate premium adjustments based on historical SLA performance.</p>
                    </div>
                    <div className="flex-shrink-0">
                        <div className="bg-blue-600/10 p-6 rounded-3xl border border-blue-500/20 backdrop-blur-sm">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 text-center">Node Authority</p>
                            <p className="text-xl font-black text-white text-center">WEIGHT: 1.0</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InsuranceDashboard;
