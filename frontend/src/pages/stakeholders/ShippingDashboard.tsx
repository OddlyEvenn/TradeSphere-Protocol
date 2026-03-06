import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Truck, MapPin, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const ShippingDashboard: React.FC = () => {
    const [trades, setTrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
        fetchTrades();
    }, []);

    const fetchTrades = async () => {
        try {
            const res = await api.get('/trades');
            setTrades(res.data.filter((t: any) =>
                ['SHIPPING_NOMINATED', 'GOODS_SHIPPED', 'DOCS_SUBMITTED', 'DOCS_VERIFIED'].includes(t.status)
            ));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (tradeId: string, nextStatus: string) => {
        try {
            await api.patch(`/trades/${tradeId}`, { status: nextStatus });
            toast.success(`Status updated to ${nextStatus.replace(/_/g, ' ')}`);
            fetchTrades();
        } catch (err) {
            console.error('Failed to update shipment status', err);
            toast.error('Failed to update status');
        }
    };

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Logistics Terminal</h1>
                <p className="text-slate-500 font-medium mt-1">Manage active sea and air freight shipments.</p>
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
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${trade.status === 'GOODS_SHIPPED' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    {trade.status}
                                </span>
                            </div>
                            <h3 className="font-black text-lg text-slate-900 mb-2">{trade.productName}</h3>
                            <div className="flex items-center gap-2 text-slate-400 mb-6">
                                <MapPin size={14} />
                                <span className="text-xs font-bold uppercase tracking-widest">To: {trade.destination}</span>
                            </div>
                            <div className="pt-6 border-t border-slate-50">
                                {trade.status === 'SHIPPING_NOMINATED' && (
                                    <button
                                        onClick={() => handleAction(trade.id, 'GOODS_SHIPPED')}
                                        className="btn-primary w-full text-xs"
                                    >
                                        Accept Shipment
                                    </button>
                                )}
                                {trade.status === 'GOODS_SHIPPED' && (
                                    <button
                                        onClick={() => handleAction(trade.id, 'DOCS_SUBMITTED')}
                                        className="btn-primary w-full text-xs bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        Issue Bill of Lading
                                    </button>
                                )}
                                {['DOCS_SUBMITTED', 'DOCS_VERIFIED'].includes(trade.status) && (
                                    <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-xs py-2 bg-emerald-50 rounded-xl">
                                        <ShieldCheck size={14} /> BoL Issued
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {trades.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
                            <Truck className="mx-auto text-slate-300 mb-4" size={48} />
                            <h3 className="text-xl font-bold text-slate-900">No Active Shipments</h3>
                            <p className="text-slate-400">Shipments will appear here once Exporters confirm dispatch.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ShippingDashboard;
