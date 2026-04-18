// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TradeRegistryUnoptimized
 * @dev A version of TradeRegistry without gas optimizations for presentation benchmarking.
 */
contract TradeRegistryUnoptimized {

    enum TradeStatus { OFFER_ACCEPTED, TRADE_INITIATED, LOC_INITIATED, LOC_UPLOADED, LOC_APPROVED, FUNDS_LOCKED, SHIPPING_ASSIGNED, GOODS_SHIPPED, CUSTOMS_CLEARED, CUSTOMS_FLAGGED, ENTRY_REJECTED, VOTING_ACTIVE, GOODS_RECEIVED, PAYMENT_AUTHORIZED, SETTLEMENT_CONFIRMED, COMPLETED, DISPUTED, EXPIRED, TRADE_REVERTED_BY_CONSENSUS, DISPUTE_RESOLVED_NO_REVERT, CLAIM_PAYOUT_APPROVED }

    struct Trade {
        // UNOPTIMIZED: Using uint256 for everything and disorganized layout to prevent packing
        uint256 tradeId;
        uint256 amount;
        uint256 status; // Should be uint8
        uint256 createdAt;
        uint256 importerConfirmed; // Should be bool
        uint256 shippingDeadline;
        uint256 exporterConfirmed; // Should be bool
        uint256 clearanceDeadline;
        uint256 votingDeadline;
        address importer;
        address exporter;
        address issuingBank;
        address advisingBank;
        address shippingCompany;
        address inspector;
        address customsAuthority;
        address insuranceNode;
    }

    mapping(uint256 => Trade) public trades;
    mapping(address => bool) public authorizedContracts;
    address public owner; // NOT immutable
    uint256 public nextTradeId;

    constructor() {
        owner = msg.sender;
    }

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
        nextTradeId = nextTradeId + 1; // Post-increment (more gas)
        
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
            status:            0,
            createdAt:         block.timestamp,
            amount:            amount,
            shippingDeadline:  shippingDeadline,
            clearanceDeadline: clearanceDeadline,
            votingDeadline:    0,
            importerConfirmed: 0,
            exporterConfirmed: 0
        });

        return tradeId;
    }

    function updateStatus(uint256 tradeId, uint256 newStatus) external {
        // Memory copy instead of storage pointer
        Trade memory trade = trades[tradeId];
        trade.status = newStatus;
        trades[tradeId] = trade; // Write back the whole struct
    }

    function setAuthorizedContract(address contractAddress, bool authorized) external {
        require(msg.sender == owner, "Only owner");
        authorizedContracts[contractAddress] = authorized;
    }
}
