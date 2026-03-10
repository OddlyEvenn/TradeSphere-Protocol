import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { History, Activity, ExternalLink, Calendar } from 'lucide-react';

const HistoryPage: React.FC = () => {
    const [trades, setTrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrades();
    }, []);

    const fetchTrades = async () => {
        try {
            const res = await api.get('/trades');
            // Filter only trades that have had some action (not just created)
            setTrades(res.data.filter((t: any) => t.status !== 'CREATED' && t.status !== 'OPEN_FOR_OFFERS'));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-t-indigo-600"></div></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-10">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Activity Log</h1>
                <p className="text-slate-500 font-medium mt-1">Timeline of all historical actions and completed trades.</p>
            </div>

            <div className="relative border-l-2 border-slate-100 ml-6 pl-8 space-y-12 py-4">
                {trades.length === 0 ? (
                    <div className="text-center py-10">
                        <History className="mx-auto text-slate-200 mb-4" size={48} />
                        <p className="text-slate-500 font-bold">No historical activity yet.</p>
                    </div>
                ) : (
                    trades.map((trade) => (
                        <div key={trade.id} className="relative">
                            <div className="absolute -left-[45px] top-1 w-10 h-10 bg-white border-2 border-indigo-100 rounded-full flex flex-shrink-0 items-center justify-center text-indigo-600 shadow-sm">
                                <Activity size={18} />
                            </div>
                            <div className="card-premium mb-0 relative group">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-black text-lg text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer">
                                        Trade {trade.productName}
                                    </h3>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Calendar size={12} />
                                        {new Date(trade.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-slate-600 mb-4">
                                    Reached status: <span className="font-bold text-slate-900">{trade.status.replace(/_/g, ' ')}</span>
                                </p>
                                <div className="flex items-center gap-4 text-xs font-bold text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p>Amount: <span className="text-slate-900">${trade.amount.toLocaleString()}</span></p>
                                    <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                                    <p>Tx Hash: <span className="font-mono text-indigo-500 cursor-pointer hover:underline">{(trade.blockchainId !== null && trade.blockchainId !== undefined) ? trade.blockchainId : 'Off-chain'}</span> <ExternalLink size={10} className="inline ml-0.5 mb-0.5" /></p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default HistoryPage;
