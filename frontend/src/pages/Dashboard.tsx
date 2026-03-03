import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Plus, Package, FileText, CheckCircle, Clock, Shield, Globe, Lock, Truck, Landmark, Activity, Gavel, Percent } from 'lucide-react';

import CreateTradeModal from '../components/CreateTradeModal';

interface Trade {
    id: string;
    status: string;
    amount: number;
    createdAt: string;
}

const Dashboard: React.FC = () => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));
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

    if (!user) return <div className="p-10 text-center font-bold">Access Denied. Please Sign In.</div>;

    const renderRoleHeader = () => {
        switch (user.role) {
            case 'IMPORTER':
                return { title: 'Importer Portal', subtitle: 'Manage your trade applications and payments', icon: Package };
            case 'EXPORTER':
                return { title: 'Exporter Terminal', subtitle: 'Track incoming credits and shipment status', icon: Truck };
            case 'IMPORTER_BANK':
            case 'EXPORTER_BANK':
                return { title: 'Bank Control', subtitle: 'Verify creditworthiness and release settlements', icon: Landmark };
            case 'SHIPPING':
                return { title: 'Logistics Hub', subtitle: 'Manage BOL and shipment milestone tracking', icon: Truck };
            case 'CUSTOMS':
                return { title: 'Customs Authority', subtitle: 'International trade clearance and inspection', icon: Globe };
            case 'INSURANCE':
                return { title: 'Insurance Underwriting', subtitle: 'Assess risk and verify trade coverage', icon: Shield };
            case 'TAX_AUTHORITY':
                return { title: 'Tax & Duties', subtitle: 'Manage trade-related taxation and duties', icon: Percent };
            case 'REGULATORS':
                return { title: 'Compliance Oversight', subtitle: 'System-wide audit and regulation monitoring', icon: Gavel };
            default:
                return { title: 'Trade Control', subtitle: 'Operational overview', icon: Shield };
        }
    };

    const header = renderRoleHeader();
    const HeaderIcon = header.icon;

    return (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-10 bg-slate-50 min-h-screen font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-6 border-b border-slate-200 gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-primary-800 text-white rounded-2xl shadow-lg">
                        <HeaderIcon size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">{header.title}</h1>
                        <p className="text-slate-500 font-medium">{header.subtitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Signed in as</p>
                        <p className="text-sm font-black text-slate-900">{user.name}</p>
                    </div>
                    {user.role === 'IMPORTER' && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 bg-primary-800 hover:bg-primary-900 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg hover:shadow-primary-100"
                        >
                            <Plus size={20} />
                            Initiate Trade
                        </button>
                    )}
                </div>
            </div>

            {/* Role-Specific Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                <ActionCard title="Verified Records" value={trades.length.toString()} icon={<CheckCircle className="text-emerald-500" />} />
                <ActionCard title="Pending Review" value="0" icon={<Clock className="text-amber-500" />} />
                <ActionCard title="Active Protocol" value="Polygon" icon={<Activity className="text-primary-700" />} />
                <ActionCard title="System Health" value="Stable" icon={<Shield className="text-primary-700" />} />
            </div>

            <CreateTradeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onTradeCreated={fetchTrades}
            />

            <h2 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-wider">Recent Activity</h2>

            {loading ? (
                <div className="flex justify-center py-24">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-primary-800"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
                    {trades.map((trade) => (
                        <div key={trade.id} className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.05)] transition-all cursor-pointer group">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-primary-800 group-hover:text-white transition-all">
                                    <Package size={28} />
                                </div>
                                <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${trade.status === 'CREATED' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    {trade.status}
                                </span>
                            </div>
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Batch ID</h3>
                            <p className="text-slate-900 font-bold mb-4">{trade.id.toUpperCase().slice(0, 12)}</p>

                            <div className="flex items-end justify-between">
                                <div>
                                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Value (USD)</h3>
                                    <p className="text-3xl font-black text-slate-900 tracking-tight">${trade.amount.toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                    <Clock size={14} />
                                    {new Date(trade.createdAt).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-50">
                                <button className="w-full py-3 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-primary-800 hover:text-white transition-all text-sm">
                                    View Protocol Details
                                </button>
                            </div>
                        </div>
                    ))}
                    {trades.length === 0 && (
                        <div className="col-span-full bg-white border-2 border-dashed border-slate-100 rounded-[2.5rem] py-32 text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                                <FileText size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-1">Accessing Ledger...</h3>
                            <p className="text-slate-400 font-medium">No active trade records found in this sequence.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ActionCard = ({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            <p className="text-2xl font-black text-slate-900">{value}</p>
        </div>
        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
            {icon}
        </div>
    </div>
);

export default Dashboard;
