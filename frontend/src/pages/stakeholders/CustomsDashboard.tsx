import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { ShieldCheck, Search, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const CustomsDashboard: React.FC = () => {
    const [trades, setTrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
        fetchTrades();
    }, []);

    const fetchTrades = async () => {
        try {
            const res = await api.get('/trades');
            // Customs can see goods once shipped or after docs are submitted
            setTrades(res.data.filter((t: any) =>
                ['GOODS_SHIPPED', 'DOCS_SUBMITTED', 'CUSTOMS_CLEARED', 'DOCS_VERIFIED'].includes(t.status)
            ));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleClearShipment = async (tradeId: string) => {
        try {
            await api.patch(`/trades/${tradeId}`, { status: 'CUSTOMS_CLEARED' });
            toast.success("Shipment Cleared by Customs!");
            fetchTrades();
        } catch (err) {
            console.error('Failed to clear shipment', err);
            toast.error("Failed to clear shipment");
        }
    };

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Customs & Inspection</h1>
                <p className="text-slate-500 font-medium mt-1">Audit import documents and clear shipments for entry.</p>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase">Product / origin</th>
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase text-center">Status</th>
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {trades.map(trade => (
                            <tr key={trade.id}>
                                <td className="px-8 py-6">
                                    <p className="font-black text-slate-900">{trade.productName}</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{trade.destination}</p>
                                </td>
                                <td className="px-8 py-6 text-center">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${['CUSTOMS_CLEARED', 'DOCS_VERIFIED'].includes(trade.status) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        <ShieldCheck size={12} />
                                        {trade.status.replace(/_/g, ' ')}
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    {['GOODS_SHIPPED', 'DOCS_SUBMITTED'].includes(trade.status) ? (
                                        <button
                                            onClick={() => handleClearShipment(trade.id)}
                                            className="btn-primary text-[10px] py-2 px-4 shadow-none"
                                        >
                                            Inspect & Clear
                                        </button>
                                    ) : (
                                        <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold text-[10px] uppercase">
                                            <CheckCircle2 size={12} />
                                            Authorized
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {trades.length === 0 && !loading && (
                    <div className="p-20 text-center">
                        <Search className="mx-auto text-slate-200 mb-4" size={48} />
                        <h3 className="text-xl font-bold text-slate-900">Queue Empty</h3>
                        <p className="text-slate-400">No goods currently awaiting customs inspection.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomsDashboard;
