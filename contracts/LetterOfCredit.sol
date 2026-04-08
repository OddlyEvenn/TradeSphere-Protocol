// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TradeRegistry} from "./TradeRegistry.sol";

/**
 * @title LetterOfCredit
 * @dev Manages the full LoC lifecycle:
 *      1. Importer bank uploads LoC document → stores IPFS hash on-chain → LOC_UPLOADED
 *      2. Exporter bank approves the LoC → LOC_APPROVED
 *      3. Importer bank locks funds in escrow → FUNDS_LOCKED
 *
 * ── IPFS Document Flow ───────────────────────────────────────────────────────
 *  Backend uploads file → Pinata IPFS → returns CID
 *  Importer bank calls uploadLocDocument(tradeId, CID) → CID stored on-chain
 *  Anyone can read locDocHash[tradeId] and retrieve the document via IPFS gateway
 * ─────────────────────────────────────────────────────────────────────────────
 */
contract LetterOfCredit {
    TradeRegistry public immutable tradeRegistry;

    // ── Structs ────────────────────────────────────────────────────────────
    struct LoC {
        uint256 tradeId;
        uint256 amount;
        uint256 expiry;
        string  locDocIpfsHash;   // IPFS CID of the LoC document
        bool    isUploaded;
        bool    isApproved;
        bool    fundsLocked;
    }

    // ── Storage ────────────────────────────────────────────────────────────
    mapping(uint256 => LoC) public locs;

    // ── Events ─────────────────────────────────────────────────────────────
    event LoCDocumentUploaded(uint256 indexed tradeId, string ipfsHash, address indexed uploadedBy);
    event LoCApproved(uint256 indexed tradeId, address indexed approvedBy);
    event FundsLocked(uint256 indexed tradeId, uint256 indexed amount);

    // ── Constructor ────────────────────────────────────────────────────────
    constructor(address _tradeRegistry) {
        tradeRegistry = TradeRegistry(_tradeRegistry);
    }

    // ── Modifiers ──────────────────────────────────────────────────────────
    modifier onlyIssuingBank(uint256 tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(msg.sender == trade.issuingBank, "Only issuing bank (importer bank)");
        _;
    }

    modifier onlyAdvisingBank(uint256 tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(msg.sender == trade.advisingBank, "Only advising bank (exporter bank)");
        _;
    }

    // ── External Functions ─────────────────────────────────────────────────

    /**
     * @notice Importer bank uploads the LoC document (stored on IPFS).
     *         Initialises the LoC record and transitions to LOC_UPLOADED.
     * @param tradeId   On-chain trade ID
     * @param expiry    Unix timestamp for LoC expiry
     * @param ipfsHash  IPFS CID of the uploaded LoC PDF/document
     */
    function uploadLocDocument(
        uint256 tradeId,
        uint256 expiry,
        string calldata ipfsHash
    ) external onlyIssuingBank(tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(
            trade.status == TradeRegistry.TradeStatus.LOC_INITIATED,
            "Trade must be in LOC_INITIATED status"
        );
        require(bytes(ipfsHash).length > 0, "IPFS hash required");

        locs[tradeId] = LoC({
            tradeId:         tradeId,
            amount:          trade.amount,
            expiry:          expiry,
            locDocIpfsHash:  ipfsHash,
            isUploaded:      true,
            isApproved:      false,
            fundsLocked:     false
        });

        // Move event before external call
        emit LoCDocumentUploaded(tradeId, ipfsHash, msg.sender);

        tradeRegistry.updateStatus(tradeId, TradeRegistry.TradeStatus.LOC_UPLOADED);
    }

    /**
     * @notice Exporter bank reviews and approves the uploaded LoC.
     *         Transitions trade to LOC_APPROVED.
     */
    function approveLoC(uint256 tradeId) external onlyAdvisingBank(tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(trade.status == TradeRegistry.TradeStatus.LOC_UPLOADED, "LoC not yet uploaded");

        LoC storage loc = locs[tradeId];
        require(loc.isUploaded, "LoC document not uploaded");
        require(!loc.isApproved, "LoC already approved");

        loc.isApproved = true;

        // Move event before external call
        emit LoCApproved(tradeId, msg.sender);

        tradeRegistry.updateStatus(tradeId, TradeRegistry.TradeStatus.LOC_APPROVED);
    }

    /**
     * @notice Importer bank locks funds in escrow after LoC approval.
     *         Transitions trade to FUNDS_LOCKED.
     */
    function lockFunds(uint256 tradeId) external onlyIssuingBank(tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(tradeId);
        require(trade.status == TradeRegistry.TradeStatus.LOC_APPROVED, "LoC not approved yet");

        LoC storage loc = locs[tradeId];
        require(!loc.fundsLocked, "Funds already locked");

        loc.fundsLocked = true;

        // Move event before external call
        emit FundsLocked(tradeId, loc.amount);

        tradeRegistry.updateStatus(tradeId, TradeRegistry.TradeStatus.FUNDS_LOCKED);
    }

    /**
     * @notice Read the LoC record and its IPFS document hash for a trade.
     */
    function getLoC(uint256 tradeId) external view returns (LoC memory) {
        return locs[tradeId];
    }
}
