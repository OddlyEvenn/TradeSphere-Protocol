// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TradeRegistry.sol";

/**
 * @title DocumentVerification
 * @dev Handles multi-role verification of trade documents using a semaphore-style approval model.
 */
contract DocumentVerification {
    TradeRegistry public tradeRegistry;

    struct VerificationState {
        string docIpfsHash;
        bool customsVerified;
        bool bankVerified;
        bool isFullyVerified;
    }

    mapping(uint256 => VerificationState) public verifications;

    event DocumentsSubmitted(uint256 indexed tradeId, string ipfsHash);
    event VerificationUpdated(uint256 indexed tradeId, string role, bool status);
    event DocumentsFullyVerified(uint256 indexed tradeId);

    constructor(address _tradeRegistry) {
        tradeRegistry = TradeRegistry(_tradeRegistry);
    }

    function submitDocuments(uint256 _tradeId, string calldata _ipfsHash) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(msg.sender == trade.exporter, "Only exporter can submit docs");
        
        verifications[_tradeId].docIpfsHash = _ipfsHash;
        tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.DOCS_SUBMITTED);
        
        emit DocumentsSubmitted(_tradeId, _ipfsHash);
    }

    function verifyAsCustoms(uint256 _tradeId) external {
        // In a real app, 'Customs' role would be managed via RBAC
        verifications[_tradeId].customsVerified = true;
        emit VerificationUpdated(_tradeId, "Customs", true);
        _checkFullVerification(_tradeId);
    }

    function verifyAsBank(uint256 _tradeId) external {
        TradeRegistry.Trade memory trade = tradeRegistry.getTrade(_tradeId);
        require(msg.sender == trade.advisingBank || msg.sender == trade.issuingBank, "Only banks can verify");
        
        verifications[_tradeId].bankVerified = true;
        emit VerificationUpdated(_tradeId, "Bank", true);
        _checkFullVerification(_tradeId);
    }

    function _checkFullVerification(uint256 _tradeId) internal {
        VerificationState storage state = verifications[_tradeId];
        if (state.customsVerified && state.bankVerified && !state.isFullyVerified) {
            state.isFullyVerified = true;
            tradeRegistry.updateStatus(_tradeId, TradeRegistry.TradeStatus.DOCS_VERIFIED);
            emit DocumentsFullyVerified(_tradeId);
        }
    }
}
