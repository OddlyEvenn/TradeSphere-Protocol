import React, { useState, useEffect } from 'react';
import { ShieldAlert, Gavel, Vote, Timer, Eye, AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { walletService } from '../services/WalletService';
import { useToast } from '../contexts/ToastContext';

interface DisputePanelProps {
    trade: any;
    currentUserRole: string;
    currentUserWallet: string;
    onUpdate: () => void;
}

const VOTING_NODES = ['IMPORTER', 'EXPORTER', 'INSPECTOR', 'CUSTOMS', 'INSURANCE', 'IMPORTER_BANK', 'EXPORTER_BANK'];
const VOTE_THRESHOLD = 4;

const DisputePanel: React.FC<DisputePanelProps> = ({ trade, currentUserRole, currentUserWallet, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [evidenceHash, setEvidenceHash] = useState('');
    const [countdown, setCountdown] = useState('');
    const [deadlineExpired, setDeadlineExpired] = useState(false);
    const [inspectorDecision, setInspectorDecision] = useState(true);
    const [cargoStatus, setCargoStatus] = useState(0); // 0=Safe, 1=Damaged, 2=Fake
    const [notes, setNotes] = useState('');
    const toast = useToast();

    const canVote = VOTING_NODES.includes(currentUserRole);
    const isInspector = currentUserRole === 'INSPECTOR';
    const isEntryRejected = trade.status === 'ENTRY_REJECTED';
    const isVotingActive = trade.status === 'VOTING_ACTIVE';
    const isResolved = ['TRADE_REVERTED_BY_CONSENSUS', 'DISPUTE_RESOLVED_NO_REVERT', 'CLAIM_PAYOUT_APPROVED'].includes(trade.status);

    // 24-hour countdown timer
    useEffect(() => {
        if (!trade.votingDeadline || !isVotingActive) return;

        const interval = setInterval(() => {
            const deadline = new Date(trade.votingDeadline).getTime();
            const now = Date.now();
            const diff = deadline - now;

            if (diff <= 0) {
                setCountdown('00:00:00');
                setDeadlineExpired(true);
                clearInterval(interval);
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setCountdown(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
            setDeadlineExpired(false);
        }, 1000);

        return () => clearInterval(interval);
    }, [trade.votingDeadline, isVotingActive]);

    // Activate 7-node voting (after ENTRY_REJECTED)
    const handleActivateVoting = async () => {
        setLoading(true);
        try {
            const contract = walletService.getConsensusDispute();
            toast.info("Activating 7-node voting on-chain...");
            const tx = await contract.activateVoting(trade.blockchainId, evidenceHash || "");
            await tx.wait();
            toast.success("Voting activated! 24-hour timer started.");
            setEvidenceHash('');
            onUpdate();
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to activate voting: " + (err.reason || err.message));
        } finally {
            setLoading(false);
        }
    };

    const hasVoted = trade.events?.some((e: any) => 
        (e.event === 'VOTE_CAST_REVERT' || e.event === 'VOTE_CAST_NO_REVERT') && 
        e.actor?.walletAddress?.toLowerCase() === currentUserWallet.toLowerCase()
    );

    const hasReported = trade.events?.some((e: any) => 
        e.event === 'INSPECTOR_DECISION' && 
        e.actorRole === 'INSPECTOR'
    );

    // Cast vote: 1 = REVERT, 2 = NO_REVERT
    const handleVote = async (voteType: number, voteName: string) => {
        setLoading(true);
        try {
            const contract = walletService.getConsensusDispute();
            toast.info(`Casting vote for ${voteName}...`);
            const tx = await contract.castVote(trade.blockchainId, voteType);
            await tx.wait();
            toast.success(`Vote for ${voteName} cast successfully!`);
            onUpdate();
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to cast vote: " + (err.reason || err.message));
        } finally {
            setLoading(false);
        }
    };

    // Inspector field decision
    const handleInspectorDecision = async () => {
        setLoading(true);
        try {
            const contract = walletService.getConsensusDispute();
            toast.info("Submitting inspector field decision...");
            const tx = await contract.submitInspectorDecision(trade.blockchainId, inspectorDecision, cargoStatus, notes || "No specific notes provided.");
            await tx.wait();
            toast.success("Inspector decision recorded on-chain!");
            onUpdate();
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to submit decision: " + (err.reason || err.message));
        } finally {
            setLoading(false);
        }
    };

    // Finalize voting after deadline
    const handleFinalizeVoting = async () => {
        setLoading(true);
        try {
            const contract = walletService.getConsensusDispute();
            toast.info("Finalizing voting...");
            const tx = await contract.finalizeVoting(trade.blockchainId);
            await tx.wait();
            toast.success("Voting finalized! Check outcome.");
            onUpdate();
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to finalize: " + (err.reason || err.message));
        } finally {
            setLoading(false);
        }
    };

    // Don't show if trade isn't in a dispute-relevant state
    if (!trade.blockchainId) return null;
    if (trade.status === 'COMPLETED' || trade.status === 'EXPIRED') return null;
    if (!isEntryRejected && !isVotingActive && !isResolved) return null;

    return (
        <div className={`card-premium mt-10 ${isResolved ? 'border-slate-200 bg-slate-50' : isVotingActive ? 'border-purple-200 bg-purple-50' : 'border-rose-200 bg-rose-50'}`}>

            {/* ── OUTCOME RENDERING ── */}
            {isResolved && (
                <div className="space-y-4">
                    {trade.status === 'TRADE_REVERTED_BY_CONSENSUS' && (
                        <>
                            <h2 className="text-xl font-black text-rose-900 flex items-center gap-2">
                                <XCircle className="text-rose-600" /> Transaction Reverted by Consensus
                            </h2>
                            <div className="bg-rose-100 border border-rose-200 rounded-2xl p-4">
                                <p className="text-sm font-bold text-rose-800">
                                    The 7-node consensus voted ≥ {VOTE_THRESHOLD} for REVERT. Escrow funds have been returned to the Importer.
                                </p>
                            </div>
                        </>
                    )}
                    {trade.status === 'DISPUTE_RESOLVED_NO_REVERT' && (
                        <>
                            <h2 className="text-xl font-black text-emerald-900 flex items-center gap-2">
                                <CheckCircle2 className="text-emerald-600" /> Dispute Resolved — No Revert
                            </h2>
                            <div className="bg-emerald-100 border border-emerald-200 rounded-2xl p-4">
                                <p className="text-sm font-bold text-emerald-800">
                                    Votes were below the {VOTE_THRESHOLD}-vote threshold. The trade continues as normal.
                                </p>
                            </div>
                        </>
                    )}
                    {trade.status === 'CLAIM_PAYOUT_APPROVED' && (
                        <>
                            <h2 className="text-xl font-black text-indigo-900 flex items-center gap-2">
                                <Gavel className="text-indigo-600" /> Insurance Claim Payout Approved
                            </h2>
                            <div className="bg-indigo-100 border border-indigo-200 rounded-2xl p-4">
                                <p className="text-sm font-bold text-indigo-800">
                                    Inspector confirmed cargo damage. Insurance payout has been routed to the Exporter.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── ENTRY REJECTED — Activate Voting ── */}
            {isEntryRejected && (
                <div className="space-y-6">
                    <h2 className="text-xl font-black text-rose-900 flex items-center gap-2">
                        <ShieldAlert className="text-rose-600" /> Entry Rejected — Activate Dispute Voting
                    </h2>
                    <p className="text-sm text-rose-800 font-medium">
                        Customs rejected entry for this trade. Activate the 7-node consensus voting to resolve the dispute. A 24-hour deadline will start.
                    </p>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Evidence IPFS Hash (optional)"
                            value={evidenceHash}
                            onChange={(e) => setEvidenceHash(e.target.value)}
                            className="input-premium flex-1 border-rose-200 focus:ring-rose-500"
                        />
                        <button
                            onClick={handleActivateVoting}
                            disabled={loading}
                            className="btn-primary !bg-rose-600 hover:!bg-rose-700 shadow-rose-200 flex-shrink-0"
                        >
                            {loading ? 'Processing...' : 'Activate 7-Node Voting'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── VOTING ACTIVE — Full Voting Engine ── */}
            {isVotingActive && (
                <div className="space-y-8">
                    <div className="flex items-start justify-between">
                        <h2 className="text-xl font-black text-purple-900 flex items-center gap-2">
                            <Vote className="text-purple-600" /> 7-Node Consensus Voting
                        </h2>
                        {/* 24hr Countdown Timer */}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-mono text-lg font-black ${deadlineExpired ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-purple-100 text-purple-700 border border-purple-200'}`}>
                            <Timer size={18} />
                            {countdown || '--:--:--'}
                        </div>
                    </div>

                    {/* Threshold Indicator */}
                    <div className="bg-white/60 backdrop-blur-sm border border-purple-100 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-purple-600 uppercase tracking-widest">Revert Threshold</span>
                            <span className="text-xs font-black text-purple-900">{VOTE_THRESHOLD} of 7 votes needed</span>
                        </div>
                        <div className="w-full bg-purple-100 rounded-full h-3">
                            <div className="bg-purple-600 h-3 rounded-full transition-all duration-500" style={{ width: `${(VOTE_THRESHOLD / 7) * 100}%` }}></div>
                        </div>
                    </div>

                    {/* Voting Buttons */}
                    {canVote && !deadlineExpired && (
                        <div className="space-y-4">
                            <NoVoteHeader hasVoted={hasVoted} currentUserRole={currentUserRole} />
                            {!hasVoted ? (
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => handleVote(1, 'REVERT (Refund Importer)')}
                                        disabled={loading}
                                        className="btn-primary !bg-rose-600 hover:!bg-rose-700 shadow-rose-200 flex-1 whitespace-nowrap"
                                    >
                                        Vote REVERT (Refund)
                                    </button>
                                    <button
                                        onClick={() => handleVote(2, 'NO REVERT (Continue Trade)')}
                                        disabled={loading}
                                        className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 shadow-emerald-200 flex-1 whitespace-nowrap"
                                    >
                                        Vote NO REVERT
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-purple-100 border border-purple-200 rounded-2xl p-4 flex items-center gap-3">
                                    <CheckCircle2 className="text-purple-600" size={20} />
                                    <p className="text-sm font-bold text-purple-800">Your consensus vote has already been recorded on-chain.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Inspector Decision Form */}
                    {isInspector && !deadlineExpired && (
                        <div className="bg-white/60 backdrop-blur-sm border border-purple-100 rounded-2xl p-5 space-y-4">
                            <h3 className="text-sm font-black text-purple-900 uppercase tracking-widest flex items-center gap-2">
                                <Eye size={16} /> Inspector Field Decision
                            </h3>
                            {!hasReported ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-purple-700 mb-1 block">Decision</label>
                                            <select
                                                value={inspectorDecision ? 'yes' : 'no'}
                                                onChange={(e) => setInspectorDecision(e.target.value === 'yes')}
                                                className="input-premium text-sm py-2 border-purple-200 focus:ring-purple-500 w-full"
                                            >
                                                <option value="yes">Yes — Approve</option>
                                                <option value="no">No — Reject</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-purple-700 mb-1 block">Cargo Status</label>
                                            <select
                                                value={cargoStatus}
                                                onChange={(e) => setCargoStatus(Number(e.target.value))}
                                                className="input-premium text-sm py-2 border-purple-200 focus:ring-purple-500 w-full"
                                            >
                                                <option value={0}>Safe</option>
                                                <option value={1}>Damaged</option>
                                                <option value={2}>Fake Documents</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-purple-700 mb-1 block">Inspector Notes / Reason</label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Provide detailed reasoning for your decision (e.g. Evidence of tampering, physical damage reports...)"
                                            className="input-premium text-sm py-3 border-purple-200 focus:ring-purple-500 w-full min-h-[100px] resize-none"
                                        />
                                    </div>
                                    <button
                                        onClick={handleInspectorDecision}
                                        disabled={loading}
                                        className="btn-primary !bg-purple-600 hover:!bg-purple-700 shadow-purple-200 w-full"
                                    >
                                        {loading ? 'Processing...' : 'Submit Inspector Decision'}
                                    </button>
                                </>
                            ) : (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                                    <CheckCircle2 className="text-emerald-600" size={20} />
                                    <p className="text-sm font-bold text-emerald-800">Inspector report has been already submitted and finalized.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Finalize Button (after deadline) */}
                    {deadlineExpired && (
                        <div className="bg-rose-100 border border-rose-200 rounded-2xl p-4 space-y-3">
                            <p className="text-sm font-bold text-rose-800 flex items-center gap-2">
                                <AlertTriangle size={16} /> Voting deadline has expired. Anyone can finalize the vote.
                            </p>
                            <button
                                onClick={handleFinalizeVoting}
                                disabled={loading}
                                className="btn-primary !bg-rose-600 hover:!bg-rose-700 shadow-rose-200 w-full"
                            >
                                {loading ? 'Finalizing...' : 'Finalize Voting'}
                            </button>
                        </div>
                    )}

                    {/* Non-voter message */}
                    {!canVote && (
                        <p className="text-sm font-bold text-purple-700 bg-white/50 p-4 rounded-xl inline-block border border-purple-200">
                            Awaiting 7 Consensus Nodes to resolve this dispute.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// Helper component for cleaner voting header
const NoVoteHeader: React.FC<{ hasVoted: boolean, currentUserRole: string }> = ({ hasVoted, currentUserRole }) => {
    if (hasVoted) return null;
    return (
        <p className="text-sm text-purple-800 font-medium">
            As an authorized voting node ({currentUserRole.replace(/_/g, ' ')}), cast your consensus vote:
        </p>
    );
};

export default DisputePanel;
