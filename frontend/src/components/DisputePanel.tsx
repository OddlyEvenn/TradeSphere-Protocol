import React, { useState, useEffect } from 'react';
import { ShieldAlert, Gavel, FileWarning } from 'lucide-react';
import { walletService } from '../services/WalletService';
import { useToast } from '../contexts/ToastContext';

interface DisputePanelProps {
    trade: any;
    currentUserRole: string;
    currentUserWallet: string;
    onUpdate: () => void;
}

const DisputePanel: React.FC<DisputePanelProps> = ({ trade, currentUserRole, currentUserWallet, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [evidenceHash, setEvidenceHash] = useState('');
    const toast = useToast();

    // Determine permissions based on ConsensusDispute.sol logic
    const canRaiseDispute = ['IMPORTER', 'EXPORTER', 'INSPECTOR', 'IMPORTER_BANK'].includes(currentUserRole);
    const canVote = ['INSPECTOR', 'CUSTOMS', 'INSURANCE', 'IMPORTER_BANK'].includes(currentUserRole);

    const isDisputed = trade.status === 'DISPUTED';

    const handleRaiseDispute = async () => {
        if (!evidenceHash) return toast.error("Evidence IPFS Hash is required");
        setLoading(true);
        try {
            const contract = walletService.getConsensusDispute();
            toast.info("Raising dispute on-chain...");
            const tx = await contract.raiseDispute(trade.blockchainId, evidenceHash);
            await tx.wait();
            toast.success("Dispute raised successfully! Awaiting consensus.");
            setEvidenceHash('');
            onUpdate();
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to raise dispute: " + (err.reason || err.message));
        } finally {
            setLoading(false);
        }
    };

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

    if (!trade.blockchainId || trade.status === 'COMPLETED' || trade.status === 'TRADE_REVERTED_BY_CONSENSUS' || trade.status === 'CLAIM_PAYOUT_APPROVED') return null;

    if (!canRaiseDispute && !canVote) return null;

    return (
        <div className={`card-premium mt-10 ${isDisputed ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
            <h2 className={`text-xl font-black mb-6 flex items-center gap-2 ${isDisputed ? 'text-rose-900' : 'text-amber-900'}`}>
                {isDisputed ? <Gavel className="text-rose-600" /> : <ShieldAlert className="text-amber-600" />}
                {isDisputed ? 'Active Dispute Resolution' : 'Dispute & Arbitration'}
            </h2>
            
            {!isDisputed && canRaiseDispute && (
                <div className="space-y-4">
                    <p className="text-sm text-amber-800 font-medium">If there is a breach of contract or SLA, you can raise an on-chain dispute.</p>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Evidence IPFS Hash (Qm...)"
                            value={evidenceHash}
                            onChange={(e) => setEvidenceHash(e.target.value)}
                            className="input-premium flex-1 border-amber-200 focus:ring-amber-500"
                        />
                        <button
                            onClick={handleRaiseDispute}
                            disabled={loading}
                            className="btn-primary !bg-amber-600 hover:!bg-amber-700 shadow-amber-200 flex-shrink-0"
                        >
                            {loading ? 'Processing...' : 'Raise Dispute'}
                        </button>
                    </div>
                </div>
            )}

            {isDisputed && canVote && (
                <div className="space-y-6">
                    <p className="text-sm text-rose-800 font-medium">This trade is under active dispute. As an authorized node, please cast your consensus vote (Requires 3 points to resolve).</p>
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={() => handleVote(1, 'REVERT (Refund Importer)')}
                            disabled={loading}
                            className="btn-primary !bg-rose-600 hover:!bg-rose-700 shadow-rose-200 flex-1 whitespace-nowrap"
                        >
                            Vote REVERT (Refund)
                        </button>
                        <button
                            onClick={() => handleVote(2, 'PAYOUT (Compensate Exporter)')}
                            disabled={loading}
                            className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 shadow-emerald-200 flex-1 whitespace-nowrap"
                        >
                            Vote PAYOUT (Insurance)
                        </button>
                        <button
                            onClick={() => handleVote(3, 'REJECT (Dismiss)')}
                            disabled={loading}
                            className="btn-secondary !bg-slate-100 !text-slate-700 flex-1 whitespace-nowrap"
                        >
                            Vote REJECT
                        </button>
                    </div>
                </div>
            )}
            {isDisputed && !canVote && (
                <p className="text-sm font-bold text-rose-700 bg-white/50 p-4 rounded-xl inline-block mt-4 border border-rose-200">
                    Awaiting Consensus Nodes to resolve this dispute.
                </p>
            )}
        </div>
    );
};

export default DisputePanel;
