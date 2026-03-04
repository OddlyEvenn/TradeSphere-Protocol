// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TradeRegistry
 * @dev Manages the overall trade state and participants.
 */
contract TradeRegistry {
    enum TradeStatus {
        CREATED,
        LOC_REQUESTED,
        LOC_ISSUED,
        DOCS_SUBMITTED,
        DOCS_VERIFIED,
        GOODS_RECEIVED,
        PAYMENT_AUTHORIZED,
        COMPLETED,
        DISPUTED,
        EXPIRED
    }

    struct Trade {
        uint256 tradeId;
        address importer;
        address exporter;
        address issuingBank;
        address advisingBank;
        TradeStatus status;
        uint256 createdAt;
        uint256 amount;
    }

    mapping(uint256 => Trade) public trades;
    mapping(address => bool) public authorizedContracts;
    address public owner;
    uint256 public nextTradeId;

    event TradeCreated(uint256 indexed tradeId, address importer, address exporter, uint256 amount);
    event TradeStatusUpdated(uint256 indexed tradeId, TradeStatus newStatus);
    event ContractAuthorized(address indexed contractAddress, bool authorized);

    constructor() {
        owner = msg.sender;
    }

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
            msg.sender == trade.advisingBank,
            "Not a participant"
        );
        _;
    }

    function createTrade(
        address _exporter,
        address _issuingBank,
        address _advisingBank,
        uint256 _amount
    ) external returns (uint256) {
        uint256 tradeId = nextTradeId++;
        trades[tradeId] = Trade({
            tradeId: tradeId,
            importer: msg.sender,
            exporter: _exporter,
            issuingBank: _issuingBank,
            advisingBank: _advisingBank,
            status: TradeStatus.CREATED,
            createdAt: block.timestamp,
            amount: _amount
        });

        emit TradeCreated(tradeId, msg.sender, _exporter, _amount);
        return tradeId;
    }

    function setAuthorizedContract(address _contract, bool _authorized) external onlyOwner {
        authorizedContracts[_contract] = _authorized;
        emit ContractAuthorized(_contract, _authorized);
    }

    function updateStatus(uint256 _tradeId, TradeStatus _newStatus) external onlyAuthorized {
        trades[_tradeId].status = _newStatus;
        emit TradeStatusUpdated(_tradeId, _newStatus);
    }

    function getTrade(uint256 _tradeId) external view returns (Trade memory) {
        return trades[_tradeId];
    }
}
