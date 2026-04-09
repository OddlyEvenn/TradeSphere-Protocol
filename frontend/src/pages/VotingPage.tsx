import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams, useNavigate, Link } from 'react-router-dom';
import { 
    Gavel, 
    Package, 
    Landmark, 
    ShieldCheck, 
    AlertCircle, 
    Clock, 
    CheckCircle, 
    Info, 
    ChevronRight, 
    User,
    Globe,
    FileText,
    ArrowLeft,
    ShieldAlert,
    ClipboardCheck,
    DollarSign
} from 'lucide-react';
import { ethers } from 'ethers';
import api from '../services/api';
import { walletService } from '../services/WalletService';
import { useToast } from '../contexts/ToastContext';

interface Trade {
    id: string;
    blockchainId: number;
    productName: string;
    quantity: string;
    amount: number;
    status: string;
    importer: { name: string; walletAddress: string };
    exporter: { name: string; walletAddress: string };
    importerBank: { name: string; walletAddress: string };
    exporterBank: { name: string; walletAddress: string };
    shipping: { name: string; walletAddress: string };
    customs: { name: string; walletAddress: string };
    inspector: { name: string; walletAddress: string };
    insurance: { name: string; walletAddress: string };
    votingDeadline?: string;
}

interface VotingSummary {
    active: boolean;
    finalized: boolean;
    votingDeadline: number;
    revertVotes: number;
    noRevertVotes: number;
    totalVotesCast: number;
}

interface InspectorDecision {
    submitted: boolean;
    decision: boolean;
    cargoStatus: number;
    notes: string;
}

const VOTING_NODES = [
    'IMPORTER',
    'EXPORTER',
    'IMPORTER_BANK',
    'EXPORTER_BANK',
    'CUSTOMS',
    'INSPECTOR',
    'INSURANCE'
];

const VotingPage: React.FC = () => {
    const { user, account } = useOutletContext<{ user: any; account: string | null }>();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const toast = useToast();

    const [trades, setTrades] = useState<Trade[]>([]);
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
    const [votingSummary, setVotingSummary] = useState<VotingSummary | null>(null);
    const [inspectorDecision, setInspectorDecision] = useState<InspectorDecision | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [countdown, setCountdown] = useState<string>('--:--:--');
    
    // Form states
    const [evidenceHash, setEvidenceHash] = useState('');
    const [insDecision, setInsDecision] = useState(true);
    const [cargoStatus, setCargoStatus] = useState(0);
    const [insNotes, setInsNotes] = useState('');

    useEffect(() => {
        fetchTrades();
    }, []);

    useEffect(() => {
        if (id && trades.length > 0) {
            const trade = trades.find(t => t.id === id);
            if (trade) {
                setSelectedTrade(trade);
                fetchOnChainData(trade.blockchainId);
            }
        }
    }, [id, trades]);

    const fetchTrades = async () => {
        setLoading(true);
        try {
            // Fetch trades in dispute-relevant statuses
            const res = await api.get('/trades');
            const filtered = res.data.filter((t: any) => 
                ['ENTRY_REJECTED', 'VOTING_ACTIVE', 'TRADE_REVERTED_BY_CONSENSUS', 'DISPUTE_RESOLVED_NO_REVERT', 'CLAIM_PAYOUT_APPROVED'].includes(t.status)
            );
            setTrades(filtered);
            
            if (!id && filtered.length > 0) {
                // Pre-select first one if no ID in URL
                // Actually better to let user select
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load trades");
        } finally {
            setLoading(false);
        }
    };

    const fetchOnChainData = async (blockchainId: number) => {
        try {
            const contract = walletService.getConsensusDispute();
            const summary = await contract.getVotingSummary(blockchainId);
            const decision = await contract.getInspectorDecision(blockchainId);

            setVotingSummary({
                active: summary[0],
                finalized: summary[1],
                votingDeadline: Number(summary[2]),
                revertVotes: Number(summary[3]),
                noRevertVotes: Number(summary[4]),
                totalVotesCast: Number(summary[5])
            });

            setInspectorDecision({
                submitted: decision[0],
                decision: decision[1],
                cargoStatus: Number(decision[2]),
                notes: decision[3]
            });
        } catch (err) {
            console.error("On-chain data fetch failed", err);
        }
    };

    // Countdown Timer Logic
    useEffect(() => {
        if (!votingSummary?.votingDeadline || !votingSummary.active) return;

        const interval = setInterval(() => {
            const deadline = votingSummary.votingDeadline * 1000;
            const now = Date.now();
            const diff = deadline - now;

            if (diff <= 0) {
                setCountdown('00:00:00');
                clearInterval(interval);
                return;
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [votingSummary]);

    const handleActivate = async () => {
        if (!selectedTrade) return;
        setActionLoading(true);
        try {
            const contract = walletService.getConsensusDispute();
            toast.info("Activating 7-Node Consensus on-chain...");
            const tx = await contract.activateVoting(selectedTrade.blockchainId, evidenceHash || "Implicit rejection evidence");
            await tx.wait();
            toast.success("Consensus activated! Nodes can now vote.");
            fetchOnChainData(selectedTrade.blockchainId);
            fetchTrades(); // Refresh statuses
        } catch (err: any) {
            toast.error("Activation failed: " + (err.reason || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    const handleVote = async (voteType: number) => {
        if (!selectedTrade) return;
        setActionLoading(true);
        try {
            const contract = walletService.getConsensusDispute();
            const voteName = voteType === 1 ? "REVERT" : "NO REVERT";
            toast.info(`Casting vote: ${voteName}...`);
            const tx = await contract.castVote(selectedTrade.blockchainId, voteType);
            await tx.wait();
            toast.success(`Vote for ${voteName} recorded!`);
            fetchOnChainData(selectedTrade.blockchainId);
        } catch (err: any) {
            toast.error("Voting failed: " + (err.reason || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    const handleFinalize = async () => {
        if (!selectedTrade) return;
        setActionLoading(true);
        try {
            const contract = walletService.getConsensusDispute();
            toast.info("Finalizing consensus on-chain...");
            const tx = await contract.finalizeVoting(selectedTrade.blockchainId);
            await tx.wait();
            toast.success("Voting finalized! Outcome enforced on-chain.");
            fetchOnChainData(selectedTrade.blockchainId);
            fetchTrades();
        } catch (err: any) {
            toast.error("Finalization failed: " + (err.reason || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    const handleInspectorSubmit = async () => {
        if (!selectedTrade) return;
        if (!account) return toast.error("Please connect your wallet first.");

        setActionLoading(true);
        try {
            // CRITICAL PRE-CHECK: Verify that the connected wallet matches the 
            // on-chain inspector address before sending the transaction.
            const registry = walletService.getTradeRegistry();
            const onChainTrade = await registry.getTrade(selectedTrade.blockchainId);
            const onChainInspector = onChainTrade.inspector;

            if (onChainInspector === ethers.ZeroAddress) {
                toast.error(
                    "BLOCKCHAIN MISMATCH: This trade was registered with NO authorized Inspector (0x0). " +
                    "The Importer must re-register the trade on-chain with your wallet address assigned."
                );
                return;
            }

            if (onChainInspector.toLowerCase() !== account.toLowerCase()) {
                toast.error(
                    `WALLET MISMATCH: The authorized on-chain Inspector is ${onChainInspector.slice(0, 10)}... ` +
                    `but your connected wallet is ${account.slice(0, 10)}... ` +
                    `The Importer must re-register the trade with your correct wallet address.`
                );
                return;
            }

            const contract = walletService.getConsensusDispute();
            toast.info("Submitting official inspector report...");
            const tx = await contract.submitInspectorDecision(
                selectedTrade.blockchainId, 
                insDecision, 
                cargoStatus, 
                insNotes || "No notes provided."
            );
            await tx.wait();
            toast.success("Inspector report submitted!");
            fetchOnChainData(selectedTrade.blockchainId);
        } catch (err: any) {
            toast.error("Submission failed: " + (err.reason || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    const handleClaimRefund = async () => {
        if (!selectedTrade) return;
        setActionLoading(true);
        try {
            const contract = walletService.getPaymentSettlement();
            toast.info("Claiming escrow refund from blockchain vault...");
            const tx = await contract.refundImporter(selectedTrade.blockchainId);
            await tx.wait();
            toast.success("Funds successfully refunded to Importer Bank!");
            fetchOnChainData(selectedTrade.blockchainId);
        } catch (err: any) {
            toast.error("Refund failed: " + (err.reason || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    const handleClaimInsurance = async () => {
        if (!selectedTrade) return;
        setActionLoading(true);
        try {
            const contract = walletService.getPaymentSettlement();
            toast.info("Withdrawing insurance payout from blockchain...");
            const tx = await contract.payoutInsurance(selectedTrade.blockchainId);
            await tx.wait();
            toast.success("Insurance payout successfully withdrawn!");
            fetchOnChainData(selectedTrade.blockchainId);
        } catch (err: any) {
            toast.error("Withdrawal failed: " + (err.reason || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ENTRY_REJECTED': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'VOTING_ACTIVE': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'TRADE_REVERTED_BY_CONSENSUS': return 'bg-slate-900 text-white border-slate-900';
            case 'DISPUTE_RESOLVED_NO_REVERT': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'CLAIM_PAYOUT_APPROVED': return 'bg-blue-50 text-blue-600 border-blue-100';
            default: return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    const isVotingDeadlineExpired = () => {
        if (!votingSummary?.votingDeadline) return false;
        return Date.now() > (votingSummary.votingDeadline * 1000);
    };

    return (
        <div className="space-y-8 animate-in">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-100 ring-4 ring-blue-50">
                            <ShieldAlert className="text-white" size={24} />
                        </div>
                        7-Node Consensus Protocol
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Decentralized dispute resolution and verification hub.</p>
                </div>
                
                {selectedTrade && (
                    <button 
                        onClick={() => { setSelectedTrade(null); navigate('/dashboard/voting'); }}
                        className="btn-secondary"
                    >
                        <ArrowLeft size={18} />
                        Back to List
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Trade List / Selector */}
                {!selectedTrade ? (
                    <div className="lg:col-span-12 space-y-6">
                        <div className="card-premium">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                    <Package className="text-blue-600" size={24} />
                                    Active Dispute Queue
                                </h2>
                                <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-sm font-bold border border-blue-100">
                                    {trades.length} Potential Actions
                                </span>
                            </div>

                            {loading ? (
                                <div className="py-20 text-center">
                                    <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Accessing Distributed Ledger...</p>
                                </div>
                            ) : trades.length === 0 ? (
                                <div className="py-20 text-center glass rounded-[2rem] border-dashed border-2">
                                    <CheckCircle className="mx-auto text-emerald-500 mb-4" size={48} />
                                    <h3 className="text-xl font-black text-slate-900">System Nominal</h3>
                                    <p className="text-slate-500 mt-1 max-w-sm mx-auto">All trades are currently synchronized. No active disputes require consensus action.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {trades.map(trade => (
                                        <div 
                                            key={trade.id}
                                            onClick={() => navigate(`/dashboard/voting/${trade.id}`)}
                                            className="group cursor-pointer bg-white border border-slate-100 p-6 rounded-[2rem] hover:border-blue-200 transition-all hover:shadow-2xl hover:shadow-blue-100/30 relative overflow-hidden active:scale-[0.98]"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(trade.status)}`}>
                                                    {trade.status.replace(/_/g, ' ')}
                                                </div>
                                                <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                                            </div>
                                            <h3 className="text-lg font-black text-slate-900 truncate mb-1">{trade.productName}</h3>
                                            <p className="text-sm font-bold text-slate-400 mb-4">Blockchain ID: #{trade.blockchainId}</p>
                                            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</span>
                                                    <span className="text-lg font-black text-blue-600">${trade.amount.toLocaleString()}</span>
                                                </div>
                                                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                    <Gavel size={20} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Selected Trade Details & Voting Hub */}
                        <div className="lg:col-span-8 space-y-8">
                            {/* Consensus Dashboard Card */}
                            <div className="card-premium overflow-hidden relative">
                                {/* Decorative Gradient */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] -z-10"></div>
                                
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 bg-blue-50 rounded-[1.5rem] flex items-center justify-center text-blue-600 shadow-inner">
                                            <Gavel size={32} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900">Consensus Hub</h2>
                                            <p className="text-slate-500 font-medium">Trade #{selectedTrade.blockchainId} — {selectedTrade.productName}</p>
                                        </div>
                                    </div>

                                    {votingSummary?.active && (
                                        <div className="flex items-center gap-4 bg-slate-900 text-white px-6 py-4 rounded-[1.5rem] shadow-xl shadow-slate-200">
                                            <Clock className="text-blue-400 animate-pulse" size={20} />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Time Remaining</span>
                                                <span className="text-xl font-black font-mono leading-none tracking-wider text-blue-50">{countdown}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* On-Chain Vote Status Grid */}
                                {votingSummary ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                                        <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                                            <div className="flex justify-between items-center mb-6">
                                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Vote Tally</span>
                                                <span className="text-xs font-black uppercase tracking-widest text-blue-600">{votingSummary.totalVotesCast}/7 Cast</span>
                                            </div>
                                            
                                            <div className="space-y-6">
                                                <div>
                                                    <div className="flex justify-between mb-2">
                                                        <span className="text-sm font-black text-slate-700">REVERT (YES)</span>
                                                        <span className="text-sm font-black text-rose-600">{votingSummary.revertVotes}</span>
                                                    </div>
                                                    <div className="h-3 bg-white rounded-full overflow-hidden border border-slate-100">
                                                        <div 
                                                            className="h-full bg-rose-500 transition-all duration-1000" 
                                                            style={{ width: `${(votingSummary.revertVotes / 7) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between mb-2">
                                                        <span className="text-sm font-black text-slate-700">NO REVERT (NO)</span>
                                                        <span className="text-sm font-black text-emerald-600">{votingSummary.noRevertVotes}</span>
                                                    </div>
                                                    <div className="h-3 bg-white rounded-full overflow-hidden border border-slate-100">
                                                        <div 
                                                            className="h-full bg-emerald-500 transition-all duration-1000" 
                                                            style={{ width: `${(votingSummary.noRevertVotes / 7) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-8 pt-6 border-t border-slate-200/50 flex items-center gap-3">
                                                <Info size={16} className="text-blue-500" />
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                                    Threshold: 4 votes required to enforce REVERT outcome.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 flex flex-col items-center justify-center text-center">
                                            {votingSummary.finalized ? (
                                                <>
                                                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                                        <CheckCircle size={32} />
                                                    </div>
                                                    <h3 className="text-xl font-black text-slate-900 uppercase">Consensus Reached</h3>
                                                    <p className="text-slate-500 text-sm font-medium mt-1">Outcome has been broadcast to the ledger.</p>
                                                </>
                                            ) : votingSummary.active ? (
                                                <>
                                                    <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                                                        <Clock size={32} />
                                                    </div>
                                                    <h3 className="text-xl font-black text-slate-900 uppercase">Voting Active</h3>
                                                    <p className="text-slate-500 text-sm font-medium mt-1">Nodes must cast their hash-signed votes.</p>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                                        <AlertCircle size={32} />
                                                    </div>
                                                    <h3 className="text-xl font-black text-slate-900 uppercase">Pending Activation</h3>
                                                    <p className="text-slate-500 text-sm font-medium mt-1">Waiting for authorized node to trigger protocol.</p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-12 text-center text-slate-400">
                                        Loading on-chain protocol state...
                                    </div>
                                )}

                                {/* Node Participant Status Circle */}
                                <div className="mb-10">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 text-center">Protocol Participants</h3>
                                    <div className="flex flex-wrap justify-center gap-4">
                                        {[
                                            { role: 'Importer', wallet: selectedTrade.importer?.walletAddress || '', icon: User },
                                            { role: 'Exporter', wallet: selectedTrade.exporter?.walletAddress || '', icon: User },
                                            { role: 'Imp. Bank', wallet: selectedTrade.importerBank?.walletAddress || '', icon: Landmark },
                                            { role: 'Exp. Bank', wallet: selectedTrade.exporterBank?.walletAddress || '', icon: Landmark },
                                            { role: 'Customs', wallet: selectedTrade.customs?.walletAddress || '', icon: ShieldCheck },
                                            { role: 'Inspector', wallet: selectedTrade.inspector?.walletAddress || '', icon: ClipboardCheck },
                                            { role: 'Insurance', wallet: selectedTrade.insurance?.walletAddress || '', icon: ShieldCheck }
                                        ].map((node, i) => (
                                            <div key={i} className="flex flex-col items-center gap-2 group">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all border-2 ${
                                                    account && node.wallet && account.toLowerCase() === node.wallet.toLowerCase() 
                                                    ? 'bg-blue-600 border-blue-200 text-white scale-110' 
                                                    : 'bg-white border-slate-100 text-slate-400 group-hover:border-blue-100 group-hover:text-blue-600'
                                                }`}>
                                                    <node.icon size={24} />
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-tighter ${
                                                    account && node.wallet && account.toLowerCase() === node.wallet.toLowerCase() ? 'text-blue-600' : 'text-slate-400'
                                                }`}>
                                                    {node.role}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Action Panels */}
                            <div className="space-y-8">
                                {/* Activation Action */}
                                {selectedTrade.status === 'ENTRY_REJECTED' && !votingSummary?.active && (
                                    <div className="card-premium border-rose-200 bg-rose-50/20">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center">
                                                <AlertCircle size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-rose-900">Activate Consensus Mechanism</h3>
                                                <p className="text-rose-700/70 text-sm font-medium">As a stakeholder, you can trigger a 7-node decentralized vote to resolve this dispute.</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="bg-white/50 p-6 rounded-[2rem] border border-rose-100">
                                                <label className="text-xs font-black text-rose-800 uppercase tracking-widest mb-3 block">Evidence IPFS Hash (Optional)</label>
                                                <div className="relative">
                                                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300" size={18} />
                                                    <input 
                                                        type="text" 
                                                        value={evidenceHash}
                                                        onChange={(e) => setEvidenceHash(e.target.value)}
                                                        placeholder="Qm..."
                                                        className="input-premium pl-12 border-rose-100 focus:border-rose-300 focus:ring-rose-200/50"
                                                    />
                                                </div>
                                            </div>
                                            <button 
                                                onClick={handleActivate}
                                                disabled={actionLoading}
                                                className="w-full btn-primary bg-rose-600 hover:bg-rose-700 shadow-rose-200 h-16 text-lg"
                                            >
                                                {actionLoading ? 'Initializing Protocol...' : 'Activate 7-Node Consensus'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Voting Action */}
                                {votingSummary?.active && !votingSummary.finalized && (
                                    <div className="card-premium border-blue-200 bg-blue-50/20">
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                                                <Gavel size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-blue-900">Cast Your Consensus Vote</h3>
                                                <p className="text-blue-700/70 text-sm font-medium">Your vote will be cryptographically signed by your wallet and broadcast to the ledger.</p>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <button 
                                                onClick={() => handleVote(1)}
                                                disabled={actionLoading}
                                                className="group relative h-40 bg-white border-2 border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-rose-500 transition-all hover:shadow-2xl hover:shadow-rose-100/50 active:scale-[0.98] overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-[5rem] -z-10 transition-all group-hover:scale-110"></div>
                                                <ShieldAlert size={40} className="text-rose-500" />
                                                <div className="text-center">
                                                    <span className="block text-lg font-black text-slate-900">REVERT (YES)</span>
                                                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Reject Trade & Refund</span>
                                                </div>
                                            </button>

                                            <button 
                                                onClick={() => handleVote(2)}
                                                disabled={actionLoading}
                                                className="group relative h-40 bg-white border-2 border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-emerald-500 transition-all hover:shadow-2xl hover:shadow-emerald-100/50 active:scale-[0.98] overflow-hidden"
                                            >
                                                <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-50 rounded-br-[5rem] -z-10 transition-all group-hover:scale-110"></div>
                                                <CheckCircle size={40} className="text-emerald-500" />
                                                <div className="text-center">
                                                    <span className="block text-lg font-black text-slate-900">NO REVERT (NO)</span>
                                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Clear Trade & Proceed</span>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Finalization Action */}
                                {votingSummary?.active && !votingSummary.finalized && isVotingDeadlineExpired() && (
                                    <div className="card-premium border-amber-200 bg-amber-50/20">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                                                <CheckCircle size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-amber-900">Consensus Period Expired</h3>
                                                <p className="text-amber-700/70 text-sm font-medium">The 24-hour voting window has closed. Any participant can now trigger finalization.</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleFinalize}
                                            disabled={actionLoading}
                                            className="w-full btn-primary bg-amber-500 hover:bg-amber-600 shadow-amber-200 h-16 text-lg"
                                        >
                                            Finalize Protocol Outcome
                                        </button>
                                    </div>
                                )}

                                {/* Resolved View */}
                                {votingSummary?.finalized && (
                                    <div className="card-premium bg-slate-50 border-slate-200">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                                                <ShieldCheck size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900">Consensus Protocol Resolved</h3>
                                                <p className="text-slate-500 text-sm font-medium">Final outcome: <span className="text-blue-600 font-black">{selectedTrade.status.replace(/_/g, ' ')}</span></p>
                                            </div>
                                        </div>
                                        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/50 space-y-4">
                                            <div className="flex justify-between items-center text-sm font-bold text-slate-600">
                                                <span>Total Node Weight</span>
                                                <span className="text-slate-900 font-black">7 Nodes</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm font-bold text-slate-600">
                                                <span>On-Chain Timestamp</span>
                                                <span className="text-slate-900 font-black">{new Date().toLocaleString()}</span>
                                            </div>
                                            <div className="pt-4 border-t border-slate-50">
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Outcome Immutable on Ledger</p>
                                            </div>
                                        </div>

                                        {/* Financial Claim Buttons */}
                                        <div className="mt-8 space-y-4">
                                            {selectedTrade.status === 'CLAIM_PAYOUT_APPROVED' && user.role === 'EXPORTER' && (
                                                <button 
                                                    onClick={handleClaimInsurance}
                                                    disabled={actionLoading}
                                                    className="w-full btn-primary bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 h-16 text-lg flex items-center justify-center gap-3"
                                                >
                                                    <ShieldCheck size={24} />
                                                    {actionLoading ? 'Withdrawing...' : 'Withdraw Insurance Payout'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sidebar: Inspector Decision & Full Details */}
                        <div className="lg:col-span-4 space-y-8">
                            {/* Inspector Special Dashboard (Only for Inspector) */}
                            {user.role === 'INSPECTOR' && votingSummary?.active && !votingSummary.finalized && (
                                <div className="card-premium border-purple-200 bg-purple-50/20 shadow-purple-100">
                                    <h3 className="text-xl font-black text-purple-900 mb-6 flex items-center gap-3">
                                        <ClipboardCheck size={24} />
                                        Inspector Report
                                    </h3>
                                    
                                    <div className="space-y-6">
                                        <div>
                                            <label className="text-xs font-black text-purple-800 uppercase tracking-widest mb-2 block">Authenticity Check</label>
                                            <select 
                                                value={insDecision ? 'yes' : 'no'}
                                                onChange={(e) => setInsDecision(e.target.value === 'yes')}
                                                className="input-premium border-purple-100 focus:border-purple-300 focus:ring-purple-200/50"
                                            >
                                                <option value="yes">Genuine Documents</option>
                                                <option value="no">Fake Documents Flagged</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-black text-purple-800 uppercase tracking-widest mb-2 block">Cargo Physical Status</label>
                                            <select 
                                                value={cargoStatus}
                                                onChange={(e) => setCargoStatus(Number(e.target.value))}
                                                className="input-premium border-purple-100 focus:border-purple-300 focus:ring-purple-200/50"
                                            >
                                                <option value={0}>Safe / Intact</option>
                                                <option value={1}>Damaged / Compromised</option>
                                                <option value={2}>Mismatched Batch</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-black text-purple-800 uppercase tracking-widest mb-2 block">Detailed Reasoning</label>
                                            <textarea 
                                                value={insNotes}
                                                onChange={(e) => setInsNotes(e.target.value)}
                                                placeholder="Explain reasoning for decision... (Max 500 chars)"
                                                className="input-premium h-32 resize-none border-purple-100 focus:border-purple-300 focus:ring-purple-200/50"
                                            />
                                        </div>

                                        <button 
                                            onClick={handleInspectorSubmit}
                                            disabled={actionLoading}
                                            className="w-full btn-primary bg-purple-600 hover:bg-purple-700 shadow-purple-200 flex items-center gap-3 h-14"
                                        >
                                            <ShieldAlert size={20} />
                                            Submit Formal Report
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Trade Metadata Sidebar */}
                            <div className="card-premium overflow-hidden">
                                <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
                                    <FileText size={20} className="text-blue-600" />
                                    Trade Specification
                                </h3>
                                
                                <div className="space-y-6">
                                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                        <div className="grid grid-cols-2 gap-y-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</span>
                                                <span className="text-sm font-black text-slate-900">{selectedTrade.quantity}</span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Value</span>
                                                <span className="text-sm font-black text-blue-600 font-mono">${selectedTrade.amount.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {[
                                            { label: 'Importer', val: selectedTrade.importer?.name || 'N/A', bank: selectedTrade.importerBank?.name || 'Not Assigned' },
                                            { label: 'Exporter', val: selectedTrade.exporter?.name || 'N/A', bank: selectedTrade.exporterBank?.name || 'Not Assigned' }
                                        ].map((p, i) => (
                                            <div key={i} className="flex items-center gap-4 group">
                                                <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                                    <User size={20} />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{p.label}</span>
                                                    <span className="text-sm font-black text-slate-900 truncate">{p.val}</span>
                                                    <span className="text-[10px] font-bold text-blue-500 uppercase">{p.bank}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {inspectorDecision?.submitted && (
                                        <div className="pt-6 border-t border-slate-100">
                                            <h4 className="text-xs font-black text-purple-700 uppercase tracking-widest mb-4">Inspector's On-Chain Submission</h4>
                                            <div className="bg-purple-50 p-6 rounded-[2rem] border border-purple-100 space-y-3">
                                                <div className="flex justify-between items-center text-xs font-bold">
                                                    <span className="text-purple-700/60">Cargo Status:</span>
                                                    <span className="text-purple-900 font-black">
                                                        {inspectorDecision.cargoStatus === 0 ? 'SAFE' : 
                                                         inspectorDecision.cargoStatus === 1 ? 'DAMAGED' : 'FAKE DOCS'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs font-bold">
                                                    <span className="text-purple-700/60">Verdict:</span>
                                                    <span className={inspectorDecision.decision ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                                                        {inspectorDecision.decision ? 'VERIFIED' : 'REJECTED'}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] leading-relaxed text-purple-800/70 font-medium pt-2 italic">
                                                    "{inspectorDecision.notes}"
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default VotingPage;
