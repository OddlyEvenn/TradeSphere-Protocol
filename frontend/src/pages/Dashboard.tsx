import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { walletService } from '../services/WalletService';
import { Plus, Package, FileText, CheckCircle, Clock, Shield, Globe, Lock, Truck, Landmark, Activity, Gavel, Percent, Wallet, ArrowRight } from 'lucide-react';

import CreateTradeModal from '../components/CreateTradeModal';

interface Trade {
    id: string;
    blockchainId: number | null;
    status: string;
    amount: number;
    createdAt: string;
}

const Dashboard: React.FC = () => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [account, setAccount] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

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

    const handleConnectWallet = async () => {
        const addr = await walletService.connect();
        if (addr) {
            setAccount(addr);
            // Sync with backend
            try {
                await api.post('/auth/update-wallet', {
                    userId: user.id,
                    walletAddress: addr
                });
                console.log("Wallet address synced with backend");
            } catch (err) {
                console.error("Failed to sync wallet address", err);
            }
        }
    };

    const handleBlockchainAction = async (trade: Trade, action: string) => {
        if (!account) {
            alert("Please connect your wallet first!");
            return;
        }

        setActionLoading(`${trade.id}-${action}`);
        try {
            let tx;
            if (action === 'REQUEST_LOC') {
                const contract = walletService.getLetterOfCredit();
                tx = await contract.requestLoC(trade.blockchainId, Math.floor(Date.now() / 1000) + 86400 * 30);
            } else if (action === 'ISSUE_LOC') {
                const contract = walletService.getLetterOfCredit();
                tx = await contract.issueLoC(trade.blockchainId);
            } else if (action === 'SUBMIT_DOCS') {
                const contract = walletService.getDocumentVerification();
                tx = await contract.submitDocuments(trade.blockchainId, "QmTestIpfsHash123");
            } else if (action === 'VERIFY_BANK') {
                const contract = walletService.getDocumentVerification();
                tx = await contract.verifyAsBank(trade.blockchainId);
            }

            if (tx) {
                console.log("Transaction sent:", tx.hash);
                await tx.wait();
                console.log("Transaction confirmed!");
                // The backend listener will pick this up, but we refresh anyway
                setTimeout(fetchTrades, 3000);
            }
        } catch (error: any) {
            console.error(`Action ${action} failed:`, error);
            alert(`Error: ${error.reason || error.message || "Execution reverted"}`);
        } finally {
            setActionLoading(null);
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
            case 'CUSTOMS':
                return { title: 'Customs Authority', subtitle: 'International trade clearance and inspection', icon: Globe };
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
                    <div className="p-4 bg-[indigo] text-white rounded-2xl shadow-lg">
                        <HeaderIcon size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">{header.title}</h1>
                        <p className="text-slate-500 font-medium">{header.subtitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleConnectWallet}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg ${account
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <Wallet size={20} />
                        {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
                    </button>
                    {user.role === 'IMPORTER' && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 bg-[indigo] hover:bg-indigo-900 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg hover:shadow-indigo-100"
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
                <ActionCard title="Active Network" value="Sepolia" icon={<Globe className="text-amber-500" />} />
                <ActionCard title="Wallet Status" value={account ? "Connected" : "Not Linked"} icon={<Activity className={`${account ? 'text-emerald-500' : 'text-slate-300'}`} />} />
                <ActionCard title="System Health" value="Stable" icon={<Shield className="text-indigo-700" />} />
            </div>

            <CreateTradeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onTradeCreated={fetchTrades}
            />

            <h2 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-wider">Recent Activity</h2>

            {loading ? (
                <div className="flex justify-center py-24">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-indigo-800"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
                    {trades.map((trade) => (
                        <div key={trade.id} className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.05)] transition-all group">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-800 group-hover:text-white transition-all">
                                    <Package size={28} />
                                </div>
                                <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${trade.status === 'CREATED' ? 'bg-amber-50 text-amber-600' :
                                    trade.status === 'PAYMENT_AUTHORIZED' ? 'bg-emerald-50 text-emerald-600' :
                                        'bg-indigo-50 text-indigo-700'
                                    }`}>
                                    {trade.status}
                                </span>
                            </div>

                            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Blockchain Hash</h3>
                            <p className="text-slate-900 font-mono text-xs mb-4 truncate italic">
                                {trade.blockchainId ? `ID: ${trade.blockchainId}` : 'Awaiting confirmation...'}
                            </p>

                            <div className="flex items-end justify-between mb-8">
                                <div>
                                    <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Contract Value</h3>
                                    <p className="text-3xl font-black text-slate-900 tracking-tight">${trade.amount.toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                    <Clock size={12} />
                                    {new Date(trade.createdAt).toLocaleDateString()}
                                </div>
                            </div>

                            {/* Blockchain Action Buttons */}
                            <div className="space-y-3">
                                {trade.status === 'CREATED' && user.role === 'IMPORTER' && (
                                    <ActionButton
                                        label="Apply for LoC"
                                        loading={actionLoading === `${trade.id}-REQUEST_LOC`}
                                        onClick={() => handleBlockchainAction(trade, 'REQUEST_LOC')}
                                    />
                                )}
                                {trade.status === 'LOC_REQUESTED' && user.role === 'IMPORTER_BANK' && (
                                    <ActionButton
                                        label="Issue & Lock Funds"
                                        loading={actionLoading === `${trade.id}-ISSUE_LOC`}
                                        onClick={() => handleBlockchainAction(trade, 'ISSUE_LOC')}
                                    />
                                )}
                                {trade.status === 'LOC_ISSUED' && user.role === 'EXPORTER' && (
                                    <ActionButton
                                        label="Submit Shipping Docs"
                                        loading={actionLoading === `${trade.id}-SUBMIT_DOCS`}
                                        onClick={() => handleBlockchainAction(trade, 'SUBMIT_DOCS')}
                                    />
                                )}
                                {trade.status === 'DOCS_SUBMITTED' && user.role === 'EXPORTER_BANK' && (
                                    <ActionButton
                                        label="Verify Documents (Exporter Bank)"
                                        loading={actionLoading === `${trade.id}-VERIFY_BANK`}
                                        onClick={() => handleBlockchainAction(trade, 'VERIFY_BANK')}
                                    />
                                )}
                                {trade.status === 'DOCS_SUBMITTED' && user.role === 'CUSTOMS' && (
                                    <ActionButton
                                        label="Verify Documents (Customs)"
                                        loading={actionLoading === `${trade.id}-VERIFY_BANK`}
                                        onClick={() => handleBlockchainAction(trade, 'VERIFY_BANK')}
                                    />
                                )}
                                <button className="w-full py-4 bg-slate-50 text-slate-500 font-bold rounded-2xl hover:bg-slate-100 transition-all text-sm flex items-center justify-center gap-2">
                                    View Ledger <ArrowRight size={16} />
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

const ActionButton = ({ label, loading, onClick }: { label: string, loading: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        disabled={loading}
        className="w-full py-4 bg-indigo-700 text-white font-black rounded-2xl hover:bg-indigo-800 transition-all text-sm shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
        {loading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : <Activity size={18} />}
        {label}
    </button>
);

export default Dashboard;
