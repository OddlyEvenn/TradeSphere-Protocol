// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TradeRegistry.sol";

/**
 * @title ConsensusDispute
 * @dev Manages the weighted consensus voting for trade disputes.
 *
 * ── Voting Weights ──────────────────────────────────────────────────────────
 *   Inspector    = 2 points  (physical cargo verification)
 *   Customs      = 1 point   (legal compliance)
 *   Insurance    = 1 point   (claim evaluation)
 *   Issuing Bank = 1 point   (financial protection)
 *   Threshold    = >= 3 points to execute a major state change
 * ────────────────────────────────────────────────────────────────────────────
 */
contract ConsensusDispute {
    TradeRegistry public tradeRegistry;

    enum Vote { NONE, REVERT, PAYOUT, REJECT }

    struct Dispute {
        uint256 tradeId;
        string evidenceIpfsHash;
        bool active;
        uint256 totalRevertPoints;
        uint256 totalPayoutPoints;
        mapping(address => bool) hasVoted;
    }

    mapping(uint256 => Dispute) public disputes;

    event DisputeRaised(uint256 indexed tradeId, string evidenceIpfsHash, address raisedBy);
    event VoteCast(uint256 indexed tradeId, address indexed voter, Vote vote, uint256 points);
    event ConsensusReached(uint256 indexed tradeId, TradeRegistry.TradeStatus newStatus);

    constructor(address _tradeRegistry) {
        tradeRegistry = TradeRegistry(_tradeRegistry);
    }

    /**
     * @notice Raise a dispute with evidence.
     *         Uses updateStatus (authorized contract) instead of raiseDispute
     *         because msg.sender in the cross-contract call would be this
     *         contract's address, not the original caller.
     */
    function raiseDispute(uint256 _tradeId, string calldata _evidenceIpfsHash) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(
            msg.sender == trade.importer ||
            msg.sender == trade.exporter ||
            msg.sender == trade.inspector ||
            msg.sender == trade.issuingBank,
            "Not authorized to raise dispute"
        );
        require(!disputes[_tradeId].active, "Dispute already active");
        require(
            trade.status != TradeRegistry.TradeStatus.COMPLETED &&
            trade.status != TradeRegistry.TradeStatus.TRADE_REVERTED_BY_CONSENSUS,
            "Cannot dispute finished trade"
        );

        Dispute storage d = disputes[_tradeId];
        d.tradeId = _tradeId;
        d.evidenceIpfsHash = _evidenceIpfsHash;
        d.active = true;

        // Use updateStatus (this contract is authorized) instead of raiseDispute
        tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.DISPUTED);
        emit DisputeRaised(_tradeId, _evidenceIpfsHash, msg.sender);
    }

    /**
     * @notice Cast a vote on an active dispute.
     */
    function castVote(uint256 _tradeId, Vote _vote) external {
        Dispute storage d = disputes[_tradeId];
        require(d.active, "No active dispute");
        require(!d.hasVoted[msg.sender], "Already voted");

        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        uint256 points = 0;

        if (msg.sender == trade.inspector) {
            points = 2;
        } else if (
            msg.sender == trade.customsNode ||
            msg.sender == trade.insuranceNode ||
            msg.sender == trade.issuingBank
        ) {
            points = 1;
        } else {
            revert("Not a voting node");
        }

        d.hasVoted[msg.sender] = true;

        if (_vote == Vote.REVERT) {
            d.totalRevertPoints += points;
        } else if (_vote == Vote.PAYOUT) {
            d.totalPayoutPoints += points;
        }

        emit VoteCast(_tradeId, msg.sender, _vote, points);

        // Check Threshold (>= 3)
        if (d.totalRevertPoints >= 3) {
            _resolveDispute(_tradeId, TradeRegistry.TradeStatus.TRADE_REVERTED_BY_CONSENSUS);
        } else if (d.totalPayoutPoints >= 3) {
            _resolveDispute(_tradeId, TradeRegistry.TradeStatus.CLAIM_PAYOUT_APPROVED);
        }
    }

    function _resolveDispute(uint256 _tradeId, TradeRegistry.TradeStatus _newStatus) internal {
        disputes[_tradeId].active = false;
        tradeRegistry.updateStatus(_tradeId, _newStatus);
        emit ConsensusReached(_tradeId, _newStatus);
    }
}
