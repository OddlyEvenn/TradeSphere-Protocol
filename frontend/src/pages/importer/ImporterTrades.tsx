import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    Package,
    ArrowLeft,
    Search,
    Filter,
    Trash2
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface Trade {
    id: string;
    blockchainId: number | null;
    status: string;
    amount: number;
    createdAt: string;
    productName?: string;
}

const ImporterTrades: React.FC = () => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const navigate = useNavigate();
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

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this trade request? This action cannot be undone.")) return;

        setDeletingId(id);
        try {
            await api.delete(`/trades/${id}`);
            toast.success("Trade request deleted successfully");
            setTrades(trades.filter(t => t.id !== id));
        } catch (err: any) {
            console.error('Failed to delete trade', err);
            toast.error(err.response?.data?.message || "Failed to delete trade request");
        } finally {
            setDeletingId(null);
        }
    };

    const filteredTrades = trades.filter(trade => {
        const id = trade?.id || '';
        const name = trade?.productName || '';
        const search = searchTerm || '';
        return id.toLowerCase().includes(search.toLowerCase()) ||
            name.toLowerCase().includes(search.toLowerCase());
    });

    if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-indigo-600"></div></div>;

    return (
        <div className="space-y-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">All Trades</h1>
                    <p className="text-slate-500 font-medium mt-1">Manage all your active and past trade requests.</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/marketplace')}
                    className="btn-primary"
                >
                    New Request
                </button>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="relative max-w-md w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search trades by ID or product..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                        />
                    </div>
                </div>

                {filteredTrades.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                        {filteredTrades.map((trade) => (
                            <div
                                key={trade.id}
                                onClick={() => navigate(`/dashboard/trades/${trade.id}`)}
                                className="p-6 hover:bg-slate-50 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between group gap-4"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-slate-100/50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all flex-shrink-0">
                                        <Package size={32} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                            Trade #{trade.blockchainId || trade.id.slice(0, 8)}
                                            {trade.blockchainId && (
                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] rounded-md uppercase tracking-wider">On-chain</span>
                                            )}
                                        </h3>
                                        <p className="text-sm font-bold text-slate-500 mt-1">{trade.productName || 'Product Name Not Available'}</p>
                                        <p className="text-xs font-bold text-slate-400 mt-0.5">Created on {new Date(trade.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="text-left md:text-right flex flex-col items-end">
                                    <div className="flex items-center gap-4">
                                        <p className="text-2xl font-black text-slate-900">${trade.amount.toLocaleString()}</p>
                                        {(trade.status === 'CREATED' || trade.status === 'OPEN_FOR_OFFERS') && (
                                            <button
                                                onClick={(e) => handleDelete(e, trade.id)}
                                                disabled={deletingId === trade.id}
                                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Delete Trade Request"
                                            >
                                                {deletingId === trade.id ? (
                                                    <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <Trash2 size={20} />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${trade.status === 'CREATED' ? 'bg-amber-50 text-amber-600' :
                                        trade.status === 'PAYMENT_AUTHORIZED' ? 'bg-emerald-50 text-emerald-600' :
                                            'bg-indigo-50 text-indigo-700'
                                        }`}>
                                        {trade.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-20 text-center">
                        <Package className="mx-auto text-slate-300 mb-4" size={48} />
                        <h3 className="text-xl font-bold text-slate-900 mb-1">No Trades Found</h3>
                        <p className="text-slate-500 font-medium">You don't have any trade requests matching your criteria.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImporterTrades;
