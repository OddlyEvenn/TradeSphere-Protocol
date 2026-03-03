// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TradeRegistry.sol";
import "./DocumentVerification.sol";

/**
 * @title PaymentSettlement
 * @dev Handles escrow authorization based on verification and delivery signals.
 */
contract PaymentSettlement {
    TradeRegistry public tradeRegistry;
    DocumentVerification public docVerification;

    mapping(uint256 => bool) public importerConfirmedReceipt;

    event PaymentAuthorized(uint256 indexed tradeId, uint256 amount);
    event ReceiptConfirmed(uint256 indexed tradeId);

    constructor(address _tradeRegistry, address _docVerification) {
        tradeRegistry = TradeRegistry(_tradeRegistry);
        docVerification = DocumentVerification(_docVerification);
    }

    function confirmReceipt(uint256 _tradeId) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(msg.sender == trade.importer, "Only importer can confirm receipt");
        
        importerConfirmedReceipt[_tradeId] = true;
        tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.GOODS_RECEIVED);
        
        emit ReceiptConfirmed(_tradeId);
        _authorizePayment(_tradeId);
    }

    function _authorizePayment(uint256 _tradeId) internal {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        (, , , bool isFullyVerified) = docVerification.verifications(_tradeId);
        
        if (isFullyVerified && importerConfirmedReceipt[_tradeId]) {
            tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.PAYMENT_AUTHORIZED);
            emit PaymentAuthorized(_tradeId, trade.amount);
        }
    }
}
