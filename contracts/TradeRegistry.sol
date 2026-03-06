// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TradeRegistry
 * @dev Central registry for all trades. Manages participants, state machine,
 *      and authorization of satellite contracts (LoC, DocVerification, Payment).
 *
 * ── State Machine ────────────────────────────────────────────────────────────
 *  OFFER_ACCEPTED  → TRADE_INITIATED (both parties on-chain confirm)
 *  TRADE_INITIATED → LOC_INITIATED   (importer selects bank)
 *  LOC_INITIATED   → LOC_UPLOADED    (importer bank uploads doc + IPFS hash)
 *  LOC_UPLOADED    → LOC_APPROVED    (exporter bank approves)
 *  LOC_APPROVED    → FUNDS_LOCKED    (importer bank locks funds)
 *  FUNDS_LOCKED    → GOODS_SHIPPED   (shipping company issues BoL)
 *  GOODS_SHIPPED   → CUSTOMS_CLEARED or DUTY_PENDING (customs decision)
 *  DUTY_PENDING    → DUTY_PAID       (importer pays duty via bank)
 *  DUTY_PAID       → CUSTOMS_CLEARED (tax authority releases)
 *  CUSTOMS_CLEARED → PAYMENT_AUTHORIZED (importer bank authorizes)
 *  PAYMENT_AUTHORIZED → SETTLEMENT_CONFIRMED (exporter bank confirms)
 *  SETTLEMENT_CONFIRMED → COMPLETED
 * ─────────────────────────────────────────────────────────────────────────────
 */
contract TradeRegistry {

    // ── Enums ──────────────────────────────────────────────────────────────
    enum TradeStatus {
        OFFER_ACCEPTED,        // 0  – Importer accepted exporter offer (DB side triggers)
        TRADE_INITIATED,       // 1  – Both parties confirmed on-chain
        LOC_INITIATED,         // 2  – Importer selected bank; LoC process started
        LOC_UPLOADED,          // 3  – Importer bank uploaded LoC document (IPFS hash stored)
        LOC_APPROVED,          // 4  – Exporter bank approved the LoC
        FUNDS_LOCKED,          // 5  – Importer bank locked funds in escrow
        GOODS_SHIPPED,         // 6  – Shipping company issued Bill of Lading
        CUSTOMS_CLEARED,       // 7  – Customs authority cleared the goods
        DUTY_PENDING,          // 8  – Goods held; tax authority calculating duty
        DUTY_PAID,             // 9  – Importer paid the required duty
        PAYMENT_AUTHORIZED,    // 10 – Importer bank authorized payment release
        SETTLEMENT_CONFIRMED,  // 11 – Exporter bank confirmed off-chain settlement
        COMPLETED,             // 12 – Trade fully completed
        DISPUTED,              // 13 – Trade under dispute
        EXPIRED                // 14 – Trade expired without completion
    }

    // ── Structs ────────────────────────────────────────────────────────────
    struct Trade {
        uint256 tradeId;
        address importer;
        address exporter;
        address issuingBank;    // importer's bank
        address advisingBank;   // exporter's bank
        address shippingCompany;
        TradeStatus status;
        uint256 createdAt;
        uint256 amount;
        bool importerConfirmed; // for TRADE_INITIATED mutual confirmation
        bool exporterConfirmed;
    }

    // ── Storage ────────────────────────────────────────────────────────────
    mapping(uint256 => Trade) public trades;
    mapping(address => bool) public authorizedContracts;
    address public owner;
    uint256 public nextTradeId;

    // ── Events ─────────────────────────────────────────────────────────────
    event TradeCreated(uint256 indexed tradeId, address importer, address exporter, uint256 amount);
    event TradeStatusUpdated(uint256 indexed tradeId, TradeStatus oldStatus, TradeStatus newStatus);
    event TradeConfirmed(uint256 indexed tradeId, address confirmedBy);
    event TradeInitiated(uint256 indexed tradeId);
    event ContractAuthorized(address indexed contractAddress, bool authorized);

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

    modifier onlyParticipant(uint256 _tradeId) {
        Trade storage trade = trades[_tradeId];
        require(
            msg.sender == trade.importer ||
            msg.sender == trade.exporter ||
            msg.sender == trade.issuingBank ||
            msg.sender == trade.advisingBank ||
            msg.sender == trade.shippingCompany,
            "Not a participant"
        );
        _;
    }

    // ── External Functions ─────────────────────────────────────────────────

    /**
     * @notice Create a new on-chain trade record after offer acceptance.
     *         Sets status to OFFER_ACCEPTED. Both parties must then call
     *         confirmTrade() to move to TRADE_INITIATED.
     * @param _exporter      Exporter wallet address
     * @param _issuingBank   Importer's bank wallet address
     * @param _advisingBank  Exporter's bank wallet address
     * @param _amount        Trade value in wei
     */
    function createTrade(
        address _exporter,
        address _issuingBank,
        address _advisingBank,
        uint256 _amount
    ) external returns (uint256) {
        uint256 tradeId = nextTradeId++;
        trades[tradeId] = Trade({
            tradeId:           tradeId,
            importer:          msg.sender,
            exporter:          _exporter,
            issuingBank:       _issuingBank,
            advisingBank:      _advisingBank,
            shippingCompany:   address(0),
            status:            TradeStatus.OFFER_ACCEPTED,
            createdAt:         block.timestamp,
            amount:            _amount,
            importerConfirmed: false,
            exporterConfirmed: false
        });

        emit TradeCreated(tradeId, msg.sender, _exporter, _amount);
        return tradeId;
    }

    /**
     * @notice Importer or exporter confirms the final trade agreement.
     *         When both confirm, status advances to TRADE_INITIATED.
     */
    function confirmTrade(uint256 _tradeId) external {
        Trade storage trade = trades[_tradeId];
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

        emit TradeConfirmed(_tradeId, msg.sender);

        if (trade.importerConfirmed && trade.exporterConfirmed) {
            TradeStatus old = trade.status;
            trade.status = TradeStatus.TRADE_INITIATED;
            emit TradeInitiated(_tradeId);
            emit TradeStatusUpdated(_tradeId, old, TradeStatus.TRADE_INITIATED);
        }
    }

    /**
     * @notice Importer requests a Letter of Credit, transitioning the trade
     *         to LOC_INITIATED on-chain so the bank can upload it.
     */
    function requestLetterOfCredit(uint256 _tradeId) external {
        Trade storage trade = trades[_tradeId];
        require(msg.sender == trade.importer, "Only importer");
        require(
            trade.status == TradeStatus.TRADE_INITIATED || trade.status == TradeStatus.OFFER_ACCEPTED,
            "Invalid status"
        );

        TradeStatus old = trade.status;
        trade.status = TradeStatus.LOC_INITIATED;
        emit TradeStatusUpdated(_tradeId, old, TradeStatus.LOC_INITIATED);
    }

    /**
     * @notice Assign a shipping company to the trade.
     *         Called by the importer after funds are locked.
     */
    function assignShippingCompany(uint256 _tradeId, address _shippingCompany) external {
        Trade storage trade = trades[_tradeId];
        require(msg.sender == trade.importer, "Only importer");
        require(trade.status == TradeStatus.FUNDS_LOCKED, "Funds not locked yet");
        require(_shippingCompany != address(0), "Invalid address");
        trade.shippingCompany = _shippingCompany;
    }

    /**
     * @notice Assign an advising bank (exporter bank) to the trade.
     *         Called by the exporter before the LoC is uploaded/approved.
     */
    function assignAdvisingBank(uint256 _tradeId, address _advisingBank) external {
        Trade storage trade = trades[_tradeId];
        require(msg.sender == trade.exporter, "Only exporter");
        require(_advisingBank != address(0), "Invalid address");
        trade.advisingBank = _advisingBank;
    }

    /**
     * @notice Authorize or de-authorize a satellite contract to call updateStatus.
     */
    function setAuthorizedContract(address _contract, bool _authorized) external onlyOwner {
        authorizedContracts[_contract] = _authorized;
        emit ContractAuthorized(_contract, _authorized);
    }

    /**
     * @notice Update trade status. Only callable by authorized satellite contracts or owner.
     */
    function updateStatus(uint256 _tradeId, TradeStatus _newStatus) external onlyAuthorized {
        TradeStatus old = trades[_tradeId].status;
        trades[_tradeId].status = _newStatus;
        emit TradeStatusUpdated(_tradeId, old, _newStatus);
    }

    /**
     * @notice Read a trade record.
     */
    function getTrade(uint256 _tradeId) external view returns (Trade memory) {
        return trades[_tradeId];
    }
}
