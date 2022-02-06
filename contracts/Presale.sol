// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./libs/IBEP20.sol";
import "./libs/SafeBEP20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Presale is ReentrancyGuard {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;
    // Maps user to the number of tokens owned
    mapping(address => uint256) public tokensOwned;
    // The number of unclaimed tokens the user has
    mapping(address => uint256) public tokensUnclaimed;

    // TOKEN token
    IBEP20 TOKEN;
    // Sale active
    bool public isSaleActive;
    // Claim active
    bool public isClaimActive;
    // Starting timestamp
    uint256 public startingTimeStamp;
    // Total TOKEN sold
    uint256 public totalTokensSold = 0;
    // Price of presale TOKEN, 1 USDC
    uint256 public USDCPerToken = 1;
    // Amount of USDC received in presale
    uint256 public USDCReceived = 0;
    // hard cap
    uint256 public CAP = 3000;
    // USDC token
    IBEP20 USDC;

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "You're not the owner");
        _;
    }

    event TokenBuy(address user, uint256 tokens);
    event TokenClaim(address user, uint256 tokens);

    constructor(
        address _TOKEN,
        address _USDC,
        uint256 _startingTimestamp
    ) public {
        TOKEN = IBEP20(_TOKEN);
        USDC = IBEP20(_USDC);
        isSaleActive = true;
        owner = msg.sender;
        startingTimeStamp = _startingTimestamp;
    }

    function buy(uint256 _amount, address beneficiary) public nonReentrant {
        require(isSaleActive, "Presale has not started");

        address _buyer = beneficiary;
        uint256 tokens = _amount.div(USDCPerToken);

        require(
            USDCReceived + _amount <= 3000 ether,
            "Presale hardcap reached"
        );
        require(
            block.timestamp >= startingTimeStamp,
            "Presale has not started"
        );

        USDC.safeTransferFrom(beneficiary, address(this), _amount);

        tokensOwned[_buyer] = tokensOwned[_buyer].add(tokens);
        tokensUnclaimed[_buyer] = tokensUnclaimed[_buyer].add(tokens);
        totalTokensSold = totalTokensSold.add(tokens);
        USDCReceived = USDCReceived.add(_amount);
        emit TokenBuy(beneficiary, tokens);
    }

    function setSaleActive(bool _isSaleActive) external onlyOwner {
        isSaleActive = _isSaleActive;
    }

    function setClaimActive(bool _isClaimActive) external onlyOwner {
        isClaimActive = _isClaimActive;
    }

    function getTokensOwned() external view returns (uint256) {
        return tokensOwned[msg.sender];
    }

    function getTokensUnclaimed() external view returns (uint256) {
        return tokensUnclaimed[msg.sender];
    }

    function getTOKENTokensLeft() external view returns (uint256) {
        return TOKEN.balanceOf(address(this));
    }

    function claimTokens(address claimer) external {
        require(isClaimActive, "Claim is not allowed yet");
        require(tokensOwned[msg.sender] > 0, "User should own some TOKENs");
        require(
            tokensUnclaimed[msg.sender] > 0,
            "User should have unclaimed TOKENs"
        );
        require(
            TOKEN.balanceOf(address(this)) >= tokensUnclaimed[msg.sender],
            "There are not enough TOKENs to transfer."
        );

        TOKEN.safeTransfer(msg.sender, tokensUnclaimed[msg.sender]);
        emit TokenClaim(msg.sender, tokensUnclaimed[msg.sender]);
        tokensUnclaimed[msg.sender] = 0;
    }

    function withdrawFunds() external onlyOwner {
        USDC.safeTransfer(msg.sender, USDC.balanceOf(address(this)));
    }

    function withdrawUnsoldTOKEN() external onlyOwner {
        uint256 amount = TOKEN.balanceOf(address(this)) - totalTokensSold;
        TOKEN.safeTransfer(msg.sender, amount);
    }

    function withdrawAllTOKEN() external onlyOwner {
        TOKEN.safeTransfer(msg.sender, TOKEN.balanceOf(address(this)));
    }
}
