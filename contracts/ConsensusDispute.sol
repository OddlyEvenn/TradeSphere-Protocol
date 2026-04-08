// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TradeRegistry} from "./TradeRegistry.sol";

/**
 * @title ConsensusDispute
 * @dev Manages the 7-node equal-weight consensus voting for trade disputes
 *      triggered by ENTRY_REJECTED from Custom & Tax Authority.
 *
 * ── 7 Voting Nodes (1 vote each) ────────────────────────────────────────────
 *   1. Importer
 *   2. Exporter
 *   3. Inspector
 *   4. Custom & Tax Authority
 *   5. Insurance Node
 *   6. Issuing Bank (Importer Bank)
 *   7. Advising Bank (Exporter Bank)
 *
 *   Fixed Threshold = 4 votes to pass (revert the transaction)
 *   Voting Window   = 24 hours from dispute activation
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── Inspector Field Decision ────────────────────────────────────────────────
 *   The Inspector submits a structured decision:
 *     - decision: true (yes) / false (no)
 *     - cargoStatus: 0 = safe, 1 = damaged, 2 = fake_documents
 *   If cargo is damaged → Exporter can file insurance claim
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ── Resolution ──────────────────────────────────────────────────────────────
 *   Votes >= 4 for REVERT  → TRADE_REVERTED_BY_CONSENSUS (escrow → importer)
 *   Votes < 4 for REVERT   → DISPUTE_RESOLVED_NO_REVERT (no revert)
 *   If cargo damaged        → CLAIM_PAYOUT_APPROVED (insurance payout)
 * ────────────────────────────────────────────────────────────────────────────
 */
contract ConsensusDispute {
    TradeRegistry public immutable tradeRegistry;

    uint256 public constant VOTING_DURATION = 24 hours;
    uint256 public constant VOTE_THRESHOLD = 4;

    enum Vote { NONE, REVERT, NO_REVERT }

    enum CargoStatus { SAFE, DAMAGED, FAKE_DOCUMENTS }

    struct InspectorDecision {
        bool submitted;
        bool decision;           // true = yes (agrees with rejection), false = no
        CargoStatus cargoStatus; // physical cargo condition
        string notes;            // optional notes from inspector
    }

    struct Dispute {
        uint256 tradeId;
        string  evidenceIpfsHash;
        bool    active;
        bool    finalized;
        uint256 votingDeadline;
        uint256 totalRevertVotes;
        uint256 totalNoRevertVotes;
        uint256 totalVotesCast;
        mapping(address => bool) hasVoted;
    }

    // ── Storage ────────────────────────────────────────────────────────────
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => InspectorDecision) public inspectorDecisions;

    // ── Events ─────────────────────────────────────────────────────────────
    event DisputeActivated(uint256 indexed tradeId, uint256 indexed votingDeadline, address indexed activatedBy);
    event VoteCast(uint256 indexed tradeId, address indexed voter, Vote vote);
    event InspectorDecisionSubmitted(uint256 indexed tradeId, bool decision, CargoStatus cargoStatus);
    event VotingFinalized(uint256 indexed tradeId, uint256 revertVotes, uint256 noRevertVotes, TradeRegistry.TradeStatus outcome);
    event SLABreachTriggered(uint256 indexed tradeId);

    // ── Constructor ────────────────────────────────────────────────────────
    constructor(address _tradeRegistry) {
        tradeRegistry = TradeRegistry(_tradeRegistry);
    }

    // ── External Functions ─────────────────────────────────────────────────

    /**
     * @notice Activate voting after ENTRY_REJECTED. Sets a 24-hour voting window.
     *         Can be called by any participant. Transitions trade to VOTING_ACTIVE.
     */
    function activateVoting(uint256 _tradeId, string calldata _evidenceIpfsHash) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(
            trade.status == TradeRegistry.TradeStatus.ENTRY_REJECTED,
            "Trade must be in ENTRY_REJECTED status"
        );
        require(!disputes[_tradeId].active, "Voting already active");

        // Verify caller is a participant
        require(
            msg.sender == trade.importer ||
            msg.sender == trade.exporter ||
            msg.sender == trade.inspector ||
            msg.sender == trade.customsAuthority ||
            msg.sender == trade.insuranceNode ||
            msg.sender == trade.issuingBank ||
            msg.sender == trade.advisingBank,
            "Not a trade participant"
        );

        uint256 deadline = block.timestamp + VOTING_DURATION;

        Dispute storage d = disputes[_tradeId];
        d.tradeId = _tradeId;
        d.evidenceIpfsHash = _evidenceIpfsHash;
        d.active = true;
        d.votingDeadline = deadline;

        // Update trade status to VOTING_ACTIVE and set deadline on TradeRegistry
        tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.VOTING_ACTIVE);
        tradeRegistry.setVotingDeadline(_tradeId, deadline);

        emit DisputeActivated(_tradeId, deadline, msg.sender);
    }

    /**
     * @notice Cast a vote on an active dispute. Each of the 7 nodes gets 1 vote.
     *         Voting is only allowed within the 24-hour window.
     */
    function castVote(uint256 _tradeId, Vote _vote) external {
        Dispute storage d = disputes[_tradeId];
        require(d.active, "No active dispute");
        require(!d.finalized, "Voting already finalized");
        require(block.timestamp <= d.votingDeadline, "Voting period expired - call finalizeVoting");
        require(!d.hasVoted[msg.sender], "Already voted");
        require(_vote == Vote.REVERT || _vote == Vote.NO_REVERT, "Invalid vote");

        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);

        // Verify caller is one of the 7 voting nodes
        require(
            msg.sender == trade.importer ||
            msg.sender == trade.exporter ||
            msg.sender == trade.inspector ||
            msg.sender == trade.customsAuthority ||
            msg.sender == trade.insuranceNode ||
            msg.sender == trade.issuingBank ||
            msg.sender == trade.advisingBank,
            "Not a voting node"
        );

        d.hasVoted[msg.sender] = true;
        ++d.totalVotesCast;

        if (_vote == Vote.REVERT) {
            ++d.totalRevertVotes;
        } else {
            ++d.totalNoRevertVotes;
        }

        emit VoteCast(_tradeId, msg.sender, _vote);

        // Auto-finalize if threshold reached or all votes are in
        if (d.totalRevertVotes >= VOTE_THRESHOLD) {
            _finalizeVoting(_tradeId);
        } else if (d.totalVotesCast == 7) {
            _finalizeVoting(_tradeId);
        }
    }

    /**
     * @notice Inspector submits a structured field decision.
     *         - decision: true/false (agrees with rejection)
     *         - cargoStatus: 0=safe, 1=damaged, 2=fake_documents
     *         Can only be called by the Inspector during active voting.
     */
    function submitInspectorDecision(
        uint256 _tradeId,
        bool _decision,
        CargoStatus _cargoStatus,
        string calldata _notes
    ) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(msg.sender == trade.inspector, "Only Inspector");

        Dispute storage d = disputes[_tradeId];
        require(d.active, "No active dispute");
        require(!d.finalized, "Voting already finalized");

        InspectorDecision storage insp = inspectorDecisions[_tradeId];
        require(!insp.submitted, "Inspector decision already submitted");

        insp.submitted = true;
        insp.decision = _decision;
        insp.cargoStatus = _cargoStatus;
        insp.notes = _notes;

        emit InspectorDecisionSubmitted(_tradeId, _decision, _cargoStatus);
    }

    /**
     * @notice Finalize voting after the 24-hour deadline has passed.
     *         Anyone can call this after the deadline to resolve the dispute.
     */
    function finalizeVoting(uint256 _tradeId) external {
        Dispute storage d = disputes[_tradeId];
        require(d.active, "No active dispute");
        require(!d.finalized, "Already finalized");
        require(block.timestamp > d.votingDeadline, "Voting period not yet expired");

        _finalizeVoting(_tradeId);
    }

    /**
     * @notice Check if the voting deadline has been breached (SLA auto-breach).
     *         Marks the dispute as having an SLA breach event.
     */
    function triggerVotingSLABreach(uint256 _tradeId) external {
        Dispute storage d = disputes[_tradeId];
        require(d.active, "No active dispute");
        require(!d.finalized, "Already finalized");
        require(block.timestamp > d.votingDeadline, "Voting deadline not breached");

        emit SLABreachTriggered(_tradeId);

        // Auto-finalize on SLA breach
        _finalizeVoting(_tradeId);
    }

    // ── View Functions ─────────────────────────────────────────────────────

    /**
     * @notice Get the Inspector's field decision for a trade dispute.
     */
    function getInspectorDecision(uint256 _tradeId) external view returns (
        bool submitted,
        bool decision,
        CargoStatus cargoStatus,
        string memory notes
    ) {
        InspectorDecision storage insp = inspectorDecisions[_tradeId];
        return (insp.submitted, insp.decision, insp.cargoStatus, insp.notes);
    }

    /**
     * @notice Get voting summary for a dispute.
     */
    function getVotingSummary(uint256 _tradeId) external view returns (
        bool active,
        bool finalized,
        uint256 votingDeadline,
        uint256 revertVotes,
        uint256 noRevertVotes,
        uint256 totalVotesCast
    ) {
        Dispute storage d = disputes[_tradeId];
        return (d.active, d.finalized, d.votingDeadline, d.totalRevertVotes, d.totalNoRevertVotes, d.totalVotesCast);
    }

    // ── Internal ───────────────────────────────────────────────────────────

    function _finalizeVoting(uint256 _tradeId) internal {
        Dispute storage d = disputes[_tradeId];
        d.active = false;
        d.finalized = true;

        TradeRegistry.TradeStatus outcome;

        // Check if Inspector found cargo damaged → enable insurance claim for exporter
        InspectorDecision storage insp = inspectorDecisions[_tradeId];
        bool cargoDamaged = insp.submitted && insp.cargoStatus == CargoStatus.DAMAGED;

        if (d.totalRevertVotes >= VOTE_THRESHOLD) {
            // Votes >= 4: Transaction Revert — escrow returned to Importer
            outcome = TradeRegistry.TradeStatus.TRADE_REVERTED_BY_CONSENSUS;
        } else if (cargoDamaged) {
            // Cargo was damaged but votes < threshold → insurance claim
            outcome = TradeRegistry.TradeStatus.CLAIM_PAYOUT_APPROVED;
        } else {
            // Votes < 4 and no cargo damage → No revert
            outcome = TradeRegistry.TradeStatus.DISPUTE_RESOLVED_NO_REVERT;
        }

        tradeRegistry.updateStatus(_tradeId, outcome);
        emit VotingFinalized(_tradeId, d.totalRevertVotes, d.totalNoRevertVotes, outcome);
    }
}
