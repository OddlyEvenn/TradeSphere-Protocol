// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TradeRegistry
 * @dev Central registry for all trades. Manages participants, state machine,
 *      and authorization of satellite contracts (LoC, DocVerification, Payment, Consensus).
 *
 * ── State Machine ────────────────────────────────────────────────────────────
 *  OFFER_ACCEPTED  → TRADE_INITIATED (both parties on-chain confirm)
 *  TRADE_INITIATED → LOC_INITIATED   (importer selects bank)
 *  LOC_INITIATED   → LOC_UPLOADED    (importer bank uploads doc + IPFS hash)
 *  LOC_UPLOADED    → LOC_APPROVED    (exporter bank approves)
 *  LOC_APPROVED    → FUNDS_LOCKED    (importer bank locks funds)
 *  FUNDS_LOCKED    → SHIPPING_ASSIGNED (importer assigns shipping)
 *  SHIPPING_ASSIGNED → GOODS_SHIPPED (shipping company issues BoL)
 *  GOODS_SHIPPED   → CUSTOMS_CLEARED (customs decision: 0 = clear)
 *  GOODS_SHIPPED   → CUSTOMS_FLAGGED (customs decision: 1 = flags / tax)
 *  GOODS_SHIPPED   → ENTRY_REJECTED  (customs decision: 2 = rejected)
 *  CUSTOMS_FLAGGED → CUSTOMS_CLEARED (exporter pays tax, customs releases)
 *  ENTRY_REJECTED  → VOTING_ACTIVE   (7-node voting starts, 24hr timer)
 *  VOTING_ACTIVE   → TRADE_REVERTED_BY_CONSENSUS (votes >= 4)
 *  VOTING_ACTIVE   → DISPUTE_RESOLVED_NO_REVERT  (votes < 4)
 *  CUSTOMS_CLEARED → GOODS_RECEIVED  (importer confirms receipt)
 *  GOODS_RECEIVED  → PAYMENT_AUTHORIZED (importer bank authorizes)
 *  PAYMENT_AUTHORIZED → SETTLEMENT_CONFIRMED (exporter bank confirms)
 *  SETTLEMENT_CONFIRMED → COMPLETED
 * ─────────────────────────────────────────────────────────────────────────────
 */
contract TradeRegistry {

    // ── Enums ──────────────────────────────────────────────────────────────
    enum TradeStatus {
        OFFER_ACCEPTED,                // 0
        TRADE_INITIATED,               // 1
        LOC_INITIATED,                 // 2
        LOC_UPLOADED,                  // 3
        LOC_APPROVED,                  // 4
        FUNDS_LOCKED,                  // 5
        SHIPPING_ASSIGNED,             // 6
        GOODS_SHIPPED,                 // 7
        CUSTOMS_CLEARED,               // 8
        CUSTOMS_FLAGGED,               // 9  (was DUTY_PENDING — now "flags" with tax)
        ENTRY_REJECTED,                // 10 (customs rejected entry → triggers voting)
        VOTING_ACTIVE,                 // 11 (7-node voting in progress)
        GOODS_RECEIVED,                // 12 (importer confirms goods receipt)
        PAYMENT_AUTHORIZED,            // 13
        SETTLEMENT_CONFIRMED,          // 14
        COMPLETED,                     // 15
        DISPUTED,                      // 16
        EXPIRED,                       // 17
        TRADE_REVERTED_BY_CONSENSUS,   // 18 (vote >= 4 threshold passed)
        DISPUTE_RESOLVED_NO_REVERT,    // 19 (vote < 4 — no revert)
        CLAIM_PAYOUT_APPROVED          // 20 (insurance payout for damaged cargo)
    }

    // ── Structs ────────────────────────────────────────────────────────────
    struct Trade {
        uint256 tradeId;
        uint256 amount;
        uint256 createdAt;
        uint256 shippingDeadline;  // SLA 1
        uint256 clearanceDeadline; // SLA 2
        uint256 votingDeadline;    // 24-hour voting window (set on ENTRY_REJECTED)
        address importer;
        address exporter;
        address issuingBank;       // importer's bank
        address advisingBank;      // exporter's bank
        address shippingCompany;
        address inspector;         // Inspector Node
        address customsAuthority;  // Merged Custom & Tax Authority Node
        address insuranceNode;     // Insurance Node
        TradeStatus status;
        bool importerConfirmed;
        bool exporterConfirmed;
    }

    // ── Storage ────────────────────────────────────────────────────────────
    mapping(uint256 => Trade) public trades;
    mapping(address => bool) public authorizedContracts;
    address public immutable owner;
    uint256 public nextTradeId;

    // ── Events ─────────────────────────────────────────────────────────────
    event TradeCreated(uint256 indexed tradeId, address indexed importer, address indexed exporter, uint256 amount);
    event TradeStatusUpdated(uint256 indexed tradeId, TradeStatus oldStatus, TradeStatus newStatus);
    event TradeConfirmed(uint256 indexed tradeId, address indexed confirmedBy);
    event TradeInitiated(uint256 indexed tradeId);
    event ContractAuthorized(address indexed contractAddress, bool indexed authorized);
    event AdvisingBankAssigned(uint256 indexed tradeId, address indexed advisingBank);
    event ShippingCompanyAssigned(uint256 indexed tradeId, address indexed shippingCompany);
    event VotingDeadlineSet(uint256 indexed tradeId, uint256 indexed deadline);

    // ── Constructor ────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ── Modifiers ──────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }

    modifier onlyParticipant(uint256 tradeId) {
        Trade storage trade = trades[tradeId];
        require(
            msg.sender == trade.importer ||
            msg.sender == trade.exporter ||
            msg.sender == trade.issuingBank ||
            msg.sender == trade.advisingBank ||
            msg.sender == trade.shippingCompany ||
            msg.sender == trade.inspector ||
            msg.sender == trade.customsAuthority ||
            msg.sender == trade.insuranceNode,
            "Not a participant"
        );
        _;
    }

    // ── External Functions ─────────────────────────────────────────────────

    /**
     * @notice Create a new on-chain trade record after offer acceptance.
     *         Sets status to OFFER_ACCEPTED. Both parties must then call
     *         confirmTrade() to move to TRADE_INITIATED.
     */
    function createTrade(
        address exporter,
        address issuingBank,
        address advisingBank,
        address inspector,
        address customsAuthority,
        address insuranceNode,
        uint256 amount,
        uint256 shippingDeadline,
        uint256 clearanceDeadline
    ) external returns (uint256) {
        uint256 tradeId = nextTradeId;
        ++nextTradeId;
        trades[tradeId] = Trade({
            tradeId:           tradeId,
            importer:          msg.sender,
            exporter:          exporter,
            issuingBank:       issuingBank,
            advisingBank:      advisingBank,
            shippingCompany:   address(0),
            inspector:         inspector,
            customsAuthority:  customsAuthority,
            insuranceNode:     insuranceNode,
            status:            TradeStatus.OFFER_ACCEPTED,
            createdAt:         block.timestamp,
            amount:            amount,
            shippingDeadline:  shippingDeadline,
            clearanceDeadline: clearanceDeadline,
            votingDeadline:    0,
            importerConfirmed: false,
            exporterConfirmed: false
        });

        emit TradeCreated(tradeId, msg.sender, exporter, amount);
        return tradeId;
    }

    /**
     * @notice Importer or exporter confirms the final trade agreement.
     *         When both confirm, status advances to TRADE_INITIATED.
     */
    function confirmTrade(uint256 tradeId) external {
        Trade storage trade = trades[tradeId];
        require(trade.status == TradeStatus.OFFER_ACCEPTED, "Trade not in OFFER_ACCEPTED status");
        require(
            msg.sender == trade.importer || msg.sender == trade.exporter,
            "Only importer or exporter"
        );

        if (msg.sender == trade.importer) {
            require(!trade.importerConfirmed, "Importer already confirmed");
            trade.importerConfirmed = true;
        } else {
            require(!trade.exporterConfirmed, "Exporter already confirmed");
            trade.exporterConfirmed = true;
        }

        emit TradeConfirmed(tradeId, msg.sender);

        if (trade.importerConfirmed && trade.exporterConfirmed) {
            TradeStatus old = trade.status;
            trade.status = TradeStatus.TRADE_INITIATED;
            emit TradeInitiated(tradeId);
            emit TradeStatusUpdated(tradeId, old, TradeStatus.TRADE_INITIATED);
        }
    }

    /**
     * @notice Importer requests a Letter of Credit → LOC_INITIATED.
     */
    function requestLetterOfCredit(uint256 tradeId) external {
        Trade storage trade = trades[tradeId];
        require(msg.sender == trade.importer, "Only importer");
        require(
            trade.status == TradeStatus.TRADE_INITIATED || trade.status == TradeStatus.OFFER_ACCEPTED,
            "Invalid status"
        );

        TradeStatus old = trade.status;
        trade.status = TradeStatus.LOC_INITIATED;
        emit TradeStatusUpdated(tradeId, old, TradeStatus.LOC_INITIATED);
    }

    /**
     * @notice Assign a shipping company to the trade (importer, after funds locked).
     */
    function assignShippingCompany(uint256 tradeId, address shippingCompany) external {
        Trade storage trade = trades[tradeId];
        require(msg.sender == trade.importer, "Only importer");
        require(trade.status == TradeStatus.FUNDS_LOCKED, "Funds not locked yet");
        require(shippingCompany != address(0), "Invalid address");

        trade.shippingCompany = shippingCompany;
        emit ShippingCompanyAssigned(tradeId, shippingCompany);

        TradeStatus old = trade.status;
        trade.status = TradeStatus.SHIPPING_ASSIGNED;
        emit TradeStatusUpdated(tradeId, old, TradeStatus.SHIPPING_ASSIGNED);
    }

    /**
     * @notice Assign an advising bank (exporter bank) to the trade.
     */
    function assignAdvisingBank(uint256 tradeId, address advisingBank) external {
        Trade storage trade = trades[tradeId];
        require(msg.sender == trade.exporter, "Only exporter");
        require(advisingBank != address(0), "Invalid address");
        trade.advisingBank = advisingBank;
        emit AdvisingBankAssigned(tradeId, advisingBank);
    }

    /**
     * @notice Importer signals that goods have been received perfectly.
     *         Transitions from CUSTOMS_CLEARED → GOODS_RECEIVED.
     */
    function confirmGoodsReceived(uint256 tradeId) external {
        Trade storage trade = trades[tradeId];
        require(msg.sender == trade.importer, "Only importer");
        require(trade.status == TradeStatus.CUSTOMS_CLEARED, "Customs not cleared");

        TradeStatus old = trade.status;
        trade.status = TradeStatus.GOODS_RECEIVED;
        emit TradeStatusUpdated(tradeId, old, TradeStatus.GOODS_RECEIVED);
    }

    /**
     * @notice Authorize or de-authorize a satellite contract to call updateStatus.
     */
    function setAuthorizedContract(address contractAddress, bool authorized) external onlyOwner {
        authorizedContracts[contractAddress] = authorized;
        emit ContractAuthorized(contractAddress, authorized);
    }

    /**
     * @notice Update trade status. Only callable by authorized satellite contracts or owner.
     */
    function updateStatus(uint256 tradeId, TradeStatus newStatus) external onlyAuthorized {
        TradeStatus old = trades[tradeId].status;
        trades[tradeId].status = newStatus;
        emit TradeStatusUpdated(tradeId, old, newStatus);
    }

    /**
     * @notice Set the 24-hour voting deadline on a trade. Called by ConsensusDispute.
     */
    function setVotingDeadline(uint256 tradeId, uint256 deadline) external onlyAuthorized {
        trades[tradeId].votingDeadline = deadline;
        emit VotingDeadlineSet(tradeId, deadline);
    }

    /**
     * @notice Importer's bank triggers a revert if the shipping deadline is breached.
     */
    function triggerSLABreachRevert(uint256 tradeId) external {
        Trade storage trade = trades[tradeId];
        require(msg.sender == trade.issuingBank, "Only issuing bank");
        require(
            trade.status == TradeStatus.FUNDS_LOCKED || trade.status == TradeStatus.SHIPPING_ASSIGNED,
            "Invalid status for SLA revert"
        );
        require(block.timestamp > trade.shippingDeadline, "Deadline not yet breached");

        TradeStatus old = trade.status;
        trade.status = TradeStatus.TRADE_REVERTED_BY_CONSENSUS;
        emit TradeStatusUpdated(tradeId, old, TradeStatus.TRADE_REVERTED_BY_CONSENSUS);
    }

    /**
     * @notice Issuing Bank or Importer triggers revert if clearance deadline is breached (SLA 2).
     */
    function triggerClearanceSLABreachRevert(uint256 tradeId) external {
        Trade storage trade = trades[tradeId];
        require(msg.sender == trade.issuingBank || msg.sender == trade.importer, "Not authorized");
        require(
            trade.status == TradeStatus.GOODS_SHIPPED || trade.status == TradeStatus.CUSTOMS_FLAGGED,
            "Invalid status for clearance revert"
        );
        require(block.timestamp > trade.clearanceDeadline, "Clearance deadline not yet breached");

        TradeStatus old = trade.status;
        trade.status = TradeStatus.TRADE_REVERTED_BY_CONSENSUS;
        emit TradeStatusUpdated(tradeId, old, TradeStatus.TRADE_REVERTED_BY_CONSENSUS);
    }

    /**
     * @notice Any participant can raise a dispute, halting the trade.
     */
    function raiseDispute(uint256 tradeId) external onlyParticipant(tradeId) {
        Trade storage trade = trades[tradeId];
        require(
            trade.status != TradeStatus.COMPLETED && trade.status != TradeStatus.TRADE_REVERTED_BY_CONSENSUS,
            "Cannot dispute finished trade"
        );

        TradeStatus old = trade.status;
        trade.status = TradeStatus.DISPUTED;
        emit TradeStatusUpdated(tradeId, old, TradeStatus.DISPUTED);
    }

    /**
     * @notice Read a trade record.
     */
    function getTrade(uint256 tradeId) external view returns (Trade memory) {
        return trades[tradeId];
    }
}
