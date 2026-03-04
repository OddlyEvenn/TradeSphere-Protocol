// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TradeRegistry.sol";

/**
 * @title LetterOfCredit
 * @dev Handles the LoC lifecycle, funds locking, and bank approvals.
 */
contract LetterOfCredit {
    TradeRegistry public tradeRegistry;

    struct LoC {
        uint256 tradeId;
        uint256 amount;
        uint256 expiry;
        bool isIssued;
        bool fundsLocked;
    }

    mapping(uint256 => LoC) public locs;

    event LoCRequested(uint256 indexed tradeId, uint256 amount);
    event LoCIssued(uint256 indexed tradeId);
    event FundsLocked(uint256 indexed tradeId, uint256 amount);

    constructor(address _tradeRegistry) {
        tradeRegistry = TradeRegistry(_tradeRegistry);
    }

    modifier onlyIssuingBank(uint256 _tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(msg.sender == trade.issuingBank, "Only issuing bank");
        _;
    }

    modifier onlyImporter(uint256 _tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(msg.sender == trade.importer, "Only importer");
        _;
    }

    function requestLoC(uint256 _tradeId, uint256 _expiry) external onlyImporter(_tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(trade.status == TradeRegistry.TradeStatus.CREATED, "Invalid trade status");

        locs[_tradeId] = LoC({
            tradeId: _tradeId,
            amount: trade.amount,
            expiry: _expiry,
            isIssued: false,
            fundsLocked: false
        });

        tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.LOC_REQUESTED);
        emit LoCRequested(_tradeId, trade.amount);
    }

    function issueLoC(uint256 _tradeId) external onlyIssuingBank(_tradeId) {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(trade.status == TradeRegistry.TradeStatus.LOC_REQUESTED, "LoC not requested");
        
        LoC storage loc = locs[_tradeId];
        require(!loc.isIssued, "Already issued");
        
        loc.isIssued = true;
        loc.fundsLocked = true;

        tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.LOC_ISSUED);
        emit LoCIssued(_tradeId);
        emit FundsLocked(_tradeId, loc.amount);
    }
}
