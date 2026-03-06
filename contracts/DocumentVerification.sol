// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TradeRegistry.sol";

/**
 * @title DocumentVerification
 * @dev Handles shipping (Bill of Lading), customs verification, and tax duty flow.
 *
 * ── Document Flow ────────────────────────────────────────────────────────────
 *  1. Shipping company calls issueBillOfLading(tradeId, ipfsHash)
 *     → Stores BoL IPFS CID on-chain → status: GOODS_SHIPPED
 *
 *  2. Customs authority verifies goods:
 *     - If cleared: verifyAsCustoms(tradeId, true) → CUSTOMS_CLEARED
 *     - If not:     verifyAsCustoms(tradeId, false) → DUTY_PENDING
 *
 *  3. [If DUTY_PENDING] Tax authority records duty payment:
 *     recordDutyPayment(tradeId) → DUTY_PAID
 *
 *  4. [After DUTY_PAID] Tax authority releases goods:
 *     releaseFromDuty(tradeId) → CUSTOMS_CLEARED
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
contract DocumentVerification {
    TradeRegistry public tradeRegistry;

    // ── Structs ────────────────────────────────────────────────────────────
    struct VerificationState {
        string bolIpfsHash;        // IPFS CID of the Bill of Lading
        string customsCertIpfsHash;// IPFS CID of customs clearance certificate (optional)
        bool   bolIssued;
        bool   customsCleared;
        bool   dutyRequired;
        bool   dutyPaid;
    }

    // ── Storage ────────────────────────────────────────────────────────────
    mapping(uint256 => VerificationState) public verifications;

    // ── Events ─────────────────────────────────────────────────────────────
    event BillOfLadingIssued(uint256 indexed tradeId, string ipfsHash, address issuedBy);
    event CustomsDecision(uint256 indexed tradeId, bool cleared, address decidedBy);
    event DutyPaymentRecorded(uint256 indexed tradeId, address recordedBy);
    event GoodsReleasedFromDuty(uint256 indexed tradeId, address releasedBy);

    // ── Constructor ────────────────────────────────────────────────────────
    constructor(address _tradeRegistry) {
        tradeRegistry = TradeRegistry(_tradeRegistry);
    }

    // ── Modifiers ──────────────────────────────────────────────────────────
    modifier onlyShippingCompany(uint256 _tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(msg.sender == trade.shippingCompany, "Only assigned shipping company");
        _;
    }

    // ── External Functions ─────────────────────────────────────────────────

    /**
     * @notice Shipping company accepts goods and issues the Bill of Lading.
     *         Stores the BoL IPFS CID on-chain and transitions to GOODS_SHIPPED.
     * @param _tradeId   On-chain trade ID
     * @param _ipfsHash  IPFS CID of the signed Bill of Lading document
     */
    function issueBillOfLading(
        uint256 _tradeId,
        string calldata _ipfsHash
    ) external onlyShippingCompany(_tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(
            trade.status == TradeRegistry.TradeStatus.FUNDS_LOCKED,
            "Trade must be in FUNDS_LOCKED status"
        );
        require(bytes(_ipfsHash).length > 0, "IPFS hash required");
        require(!verifications[_tradeId].bolIssued, "BoL already issued");

        verifications[_tradeId].bolIpfsHash = _ipfsHash;
        verifications[_tradeId].bolIssued = true;

        tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.GOODS_SHIPPED);
        emit BillOfLadingIssued(_tradeId, _ipfsHash, msg.sender);
    }

    /**
     * @notice Customs authority verifies goods and makes a clearance decision.
     *         - cleared = true  → CUSTOMS_CLEARED (payment flow begins)
     *         - cleared = false → DUTY_PENDING (tax authority must calculate duty)
     * @param _tradeId           On-chain trade ID
     * @param _cleared           Whether goods are cleared (true) or held (false)
     * @param _certIpfsHash      Optional: IPFS CID of customs certificate (pass "" if none)
     */
    function verifyAsCustoms(
        uint256 _tradeId,
        bool _cleared,
        string calldata _certIpfsHash
    ) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(trade.status == TradeRegistry.TradeStatus.GOODS_SHIPPED, "Goods not yet shipped");

        VerificationState storage state = verifications[_tradeId];

        if (bytes(_certIpfsHash).length > 0) {
            state.customsCertIpfsHash = _certIpfsHash;
        }

        if (_cleared) {
            state.customsCleared = true;
            tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.CUSTOMS_CLEARED);
        } else {
            state.dutyRequired = true;
            tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.DUTY_PENDING);
        }

        emit CustomsDecision(_tradeId, _cleared, msg.sender);
    }

    /**
     * @notice Tax authority records that the importer has paid the required duty.
     *         Transitions status to DUTY_PAID.
     */
    function recordDutyPayment(uint256 _tradeId) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(trade.status == TradeRegistry.TradeStatus.DUTY_PENDING, "No pending duty");

        VerificationState storage state = verifications[_tradeId];
        require(state.dutyRequired, "Duty was not required");
        require(!state.dutyPaid, "Duty already recorded as paid");

        state.dutyPaid = true;
        tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.DUTY_PAID);
        emit DutyPaymentRecorded(_tradeId, msg.sender);
    }

    /**
     * @notice Tax authority releases goods from customs after duty payment.
     *         Transitions status to CUSTOMS_CLEARED so payment flow can proceed.
     */
    function releaseFromDuty(uint256 _tradeId) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(trade.status == TradeRegistry.TradeStatus.DUTY_PAID, "Duty not paid yet");

        VerificationState storage state = verifications[_tradeId];
        require(state.dutyPaid, "Duty not recorded as paid");

        state.customsCleared = true;
        tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.CUSTOMS_CLEARED);
        emit GoodsReleasedFromDuty(_tradeId, msg.sender);
    }

    /**
     * @notice Read the full verification state for a trade.
     */
    function getVerification(uint256 _tradeId) external view returns (VerificationState memory) {
        return verifications[_tradeId];
    }

    /**
     * @notice Read just the IPFS hash of the Bill of Lading for a trade.
     */
    function getBolIpfsHash(uint256 _tradeId) external view returns (string memory) {
        return verifications[_tradeId].bolIpfsHash;
    }
}
