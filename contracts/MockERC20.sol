pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

abstract contract ERC20WithDecimals is ERC20 {
    uint8 private immutable _decimals;

    constructor(uint8 decimals_) {
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}

contract MockERC20 is ERC20WithDecimals {
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 supply_
    ) ERC20(name_, symbol_) ERC20WithDecimals(decimals_) {
        _mint(msg.sender, supply_);
    }
}
