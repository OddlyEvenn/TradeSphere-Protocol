// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TradeRegistry} from "./TradeRegistry.sol";

/**
 * @title DocumentVerification
 * @dev Handles shipping (Bill of Lading) and the unified Custom & Tax Authority flow.
 *
 * ── Document Flow ────────────────────────────────────────────────────────────
 *  1. Shipping company issues Bill of Lading → GOODS_SHIPPED
 *
 *  2. Custom & Tax Authority evaluates goods (3 decisions):
 *     Decision 0 (CLEAR)  → CUSTOMS_CLEARED, no tax
 *     Decision 1 (FLAGS)  → CUSTOMS_FLAGGED, taxAmount set
 *     Decision 2 (REJECT) → ENTRY_REJECTED, triggers voting
 *
 *  3. [If FLAGGED] Exporter pays tax externally; Custom & Tax Authority
 *     calls payTaxAndRelease() → CUSTOMS_CLEARED
 *
 *  4. [If REJECTED] ConsensusDispute handles 7-node voting
 * ─────────────────────────────────────────────────────────────────────────────
 */
contract DocumentVerification {
    TradeRegistry public immutable tradeRegistry;

    // ── Structs ────────────────────────────────────────────────────────────
    struct VerificationState {
        string  bolIpfsHash;            // IPFS CID of the Bill of Lading
        string  customsCertIpfsHash;    // IPFS CID of customs clearance certificate
        uint256 taxAmount;              // Tax amount set by Custom & Tax Authority (decision 1)
        bool    bolIssued;
        bool    customsCleared;
        uint8   customsDecision;        // 0=clear, 1=flags, 2=reject
        bool    taxPaid;                // Exporter has paid the required tax
    }

    // ── Storage ────────────────────────────────────────────────────────────
    mapping(uint256 => VerificationState) public verifications;

    // ── Events ─────────────────────────────────────────────────────────────
    event BillOfLadingIssued(uint256 indexed tradeId, string ipfsHash, address indexed issuedBy);
    event CustomsDecisionMade(uint256 indexed tradeId, uint8 indexed decision, uint256 taxAmount, address indexed decidedBy);
    event TaxPaidAndGoodsReleased(uint256 indexed tradeId, uint256 indexed taxAmount, address indexed releasedBy);

    // ── Constructor ────────────────────────────────────────────────────────
    constructor(address _tradeRegistry) {
        tradeRegistry = TradeRegistry(_tradeRegistry);
    }

    // ── Modifiers ──────────────────────────────────────────────────────────
    modifier onlyShippingCompany(uint256 tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(msg.sender == trade.shippingCompany, "Only assigned shipping company");
        _;
    }

    modifier onlyCustomsAuthority(uint256 tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(msg.sender == trade.customsAuthority, "Only Custom & Tax Authority");
        _;
    }

    // ── External Functions ─────────────────────────────────────────────────

    /**
     * @notice Shipping company accepts goods and issues the Bill of Lading.
     *         Stores BoL IPFS CID on-chain → GOODS_SHIPPED.
     */
    function issueBillOfLading(
        uint256 tradeId,
        string calldata ipfsHash
    ) external onlyShippingCompany(tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(
            trade.status == TradeRegistry.TradeStatus.SHIPPING_ASSIGNED,
            "Trade must be in SHIPPING_ASSIGNED status"
        );
        require(bytes(ipfsHash).length > 0, "IPFS hash required");
        require(!verifications[tradeId].bolIssued, "BoL already issued");

        verifications[tradeId].bolIpfsHash = ipfsHash;
        verifications[tradeId].bolIssued = true;

        // Move event before external call
        emit BillOfLadingIssued(tradeId, ipfsHash, msg.sender);

        tradeRegistry.updateStatus(tradeId, TradeRegistry.TradeStatus.GOODS_SHIPPED);
    }

    /**
     * @notice Custom & Tax Authority evaluates goods at destination.
     *         Decision 0 (CLEAR):  No tax → CUSTOMS_CLEARED
     *         Decision 1 (FLAGS):  Tax required → CUSTOMS_FLAGGED (with taxAmount)
     *         Decision 2 (REJECT): Entry rejected → ENTRY_REJECTED (triggers voting)
     *
     * @param tradeId       On-chain trade ID
     * @param decision      0: Clear, 1: Flags (add tax), 2: Entry Rejection
     * @param taxAmount     Tax amount in wei (only relevant for decision 1)
     * @param certIpfsHash  Optional: IPFS CID of customs certificate
     */
    function verifyAsCustoms(
        uint256 tradeId,
        uint8 decision,
        uint256 taxAmount,
        string calldata certIpfsHash
    ) external onlyCustomsAuthority(tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(trade.status == TradeRegistry.TradeStatus.GOODS_SHIPPED, "Goods not yet shipped");

        VerificationState storage state = verifications[tradeId];
        state.customsDecision = decision;

        if (bytes(certIpfsHash).length > 0) {
            state.customsCertIpfsHash = certIpfsHash;
        }

        // Move event before external calling logic
        emit CustomsDecisionMade(tradeId, decision, taxAmount, msg.sender);

        if (decision == 0) {
            // CLEAR — no tax, customs cleared
            state.customsCleared = true;
            tradeRegistry.updateStatus(tradeId, TradeRegistry.TradeStatus.CUSTOMS_CLEARED);
        } else if (decision == 1) {
            // FLAGS — set tax amount, goods held
            require(taxAmount > 0, "Tax amount must be > 0 for flagged goods");
            state.taxAmount = taxAmount;
            tradeRegistry.updateStatus(tradeId, TradeRegistry.TradeStatus.CUSTOMS_FLAGGED);
        } else if (decision == 2) {
            // ENTRY REJECTION — trade goes to dispute/voting
            tradeRegistry.updateStatus(tradeId, TradeRegistry.TradeStatus.ENTRY_REJECTED);
        } else {
            revert("Invalid decision code");
        }
    }

    /**
     * @notice Custom & Tax Authority confirms that the Exporter has paid the required
     *         tax externally and releases the goods → CUSTOMS_CLEARED.
     *         Only callable when trade is in CUSTOMS_FLAGGED status.
     */
    function payTaxAndRelease(uint256 tradeId) external onlyCustomsAuthority(tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(trade.status == TradeRegistry.TradeStatus.CUSTOMS_FLAGGED, "Trade not flagged");

        VerificationState storage state = verifications[tradeId];
        require(state.taxAmount > 0, "No tax was assessed");
        require(!state.taxPaid, "Tax already paid");

        state.taxPaid = true;
        state.customsCleared = true;

        // Move event before external call
        emit TaxPaidAndGoodsReleased(tradeId, state.taxAmount, msg.sender);

        tradeRegistry.updateStatus(tradeId, TradeRegistry.TradeStatus.CUSTOMS_CLEARED);
    }

    /**
     * @notice Read the full verification state for a trade.
     */
    function getVerification(uint256 tradeId) external view returns (VerificationState memory) {
        return verifications[tradeId];
    }

    /**
     * @notice Read just the IPFS hash of the Bill of Lading for a trade.
     */
    function getBolIpfsHash(uint256 tradeId) external view returns (string memory) {
        return verifications[tradeId].bolIpfsHash;
    }
}
