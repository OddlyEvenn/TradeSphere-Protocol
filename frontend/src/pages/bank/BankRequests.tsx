import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import { walletService } from '../../services/WalletService';
import {
    ClipboardCheck,
    Landmark,
    Activity,
    ArrowRight,
    ShieldCheck,
    CheckCircle,
    XCircle,
    Clock
} from 'lucide-react';

interface Trade {
    id: string;
    blockchainId: number | null;
    status: string;
    amount: number;
    createdAt: string;
}

const BankRequests: React.FC = () => {
    const { user, account } = useOutletContext<{ user: any, account: string | null }>();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

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

    const handleAction = async (trade: Trade, action: string) => {
        if (!account) {
            alert("Please connect your wallet first!");
            return;
        }

        setActionLoading(`${trade.id}-${action}`);
        try {
            const contractLoC = walletService.getLetterOfCredit();
            const contractDoc = walletService.getDocumentVerification();

            let tx;
            if (action === 'ISSUE_LOC') {
                tx = await contractLoC.issueLoC(trade.blockchainId);
            } else if (action === 'VERIFY_DOCS') {
                tx = await contractDoc.verifyAsBank(trade.blockchainId);
            }

            if (tx) {
                console.log("Transaction sent:", tx.hash);
                await tx.wait();
                console.log("Transaction confirmed!");
                setTimeout(fetchTrades, 2000);
            }
        } catch (error: any) {
            console.error(`Action ${action} failed:`, error);
            alert(`Error: ${error.reason || error.message || "Execution reverted"}`);
        } finally {
            setActionLoading(null);
        }
    };

    const targetStatus = user.role === 'IMPORTER_BANK' ? 'LOC_REQUESTED' : 'DOCS_SUBMITTED';
    const actionLabel = user.role === 'IMPORTER_BANK' ? 'Issue LoC' : 'Verify Docs';
    const actionKey = user.role === 'IMPORTER_BANK' ? 'ISSUE_LOC' : 'VERIFY_DOCS';

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Trade Requests Queue</h1>
                <p className="text-slate-500 font-medium mt-1">
                    {user.role === 'IMPORTER_BANK'
                        ? 'Review and approve credit applications for Letter of Credit issuance.'
                        : 'Audit and verify shipping documents for payment release.'}
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
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Trade ID / Client</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Created</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {trades.filter(t => t.status === targetStatus).map((trade) => (
                                <tr key={trade.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
                                                ID
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900">#{trade.blockchainId || trade.id.slice(0, 8)}</p>
                                                <p className="text-xs font-bold text-slate-400 tracking-tight">Main Corp Ltd.</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <p className="font-black text-slate-900">${trade.amount.toLocaleString()}</p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <p className="text-sm font-bold text-slate-500">{new Date(trade.createdAt).toLocaleDateString()}</p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                            {trade.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleAction(trade, actionKey)}
                                                disabled={!!actionLoading}
                                                className="btn-primary py-2 px-4 text-xs shadow-none"
                                            >
                                                {actionLoading === `${trade.id}-${actionKey}` ? (
                                                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                                                ) : (
                                                    <ShieldCheck size={14} />
                                                )}
                                                {actionLabel}
                                            </button>
                                            <button className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                                <XCircle size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {trades.filter(t => t.status === targetStatus).length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <ClipboardCheck className="mx-auto text-slate-200 mb-4" size={48} />
                                        <h3 className="text-xl font-bold text-slate-900 mb-1">Queue Empty</h3>
                                        <p className="text-slate-400 font-medium">No pending trade requests currently in your jurisdiction.</p>
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
