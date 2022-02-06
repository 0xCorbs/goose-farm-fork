pragma solidity 0.8.0;

import "./libs/BEP20.sol";

contract Token is BEP20("Farm Token", "TOKEN") {
    using SafeMath for uint256;

    uint256 constant MAX_CAP_SUPPLY = 10000 ether;
    // Burn address
    address public constant BURN_ADDRESS =
        0x000000000000000000000000000000000000dEaD;
    // The operator can only update the transfer tax rate
    address private _operator;
    // Events
    event OperatorTransferred(
        address indexed previousOperator,
        address indexed newOperator
    );
    modifier onlyOperator() {
        require(
            _operator == msg.sender,
            "operator: caller is not the operator"
        );
        _;
    }

    /**
     * @notice Constructs the Token contract.
     */
    constructor() {
        _operator = _msgSender();
        transferOwnership(_msgSender());
        emit OperatorTransferred(address(0), _operator);
    }

    /// @notice Creates `_amount` token to `_to`. Must only be called by the owner (MasterChef).
    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }

    // To receive native coin from swapRouter when swapping
    receive() external payable {}

    /**
     * @dev Returns the address of the current operator.
     */
    function operator() public view returns (address) {
        return _operator;
    }

    /**
     * @dev Transfers operator of the contract to a new account (`newOperator`).
     * Can only be called by the current operator.
     */
    function transferOperator(address newOperator) public onlyOperator {
        require(
            newOperator != address(0),
            "TMGO::transferOperator: new operator is the zero address"
        );
        emit OperatorTransferred(_operator, newOperator);
        _operator = newOperator;
    }

    function safe32(uint256 n, string memory errorMessage)
        internal
        pure
        returns (uint32)
    {
        require(n < 2**32, errorMessage);
        return uint32(n);
    }

    function getChainId() internal view returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
}
