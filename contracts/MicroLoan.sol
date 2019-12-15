pragma solidity ^0.5.12;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";

contract MicroLoan is GSNRecipient, Ownable {

    // borrower address => (loan hash => amount of ethers)
    mapping(address => mapping(bytes32 => uint256)) public loans;
    // loan hash => borrower address
    mapping(bytes32 => Loan) public requestedLoans;

    struct Loan {
        address borrower;
        bool isApproved;
    }

    constructor () public {
        // solium-disable-previous-line no-empty-blocks
    }

    event AddNewLoanRequest (
        address indexed borrower,
        uint256 amount,
        bytes32 indexed loanID
    );

    event RequestAccepted (
        address indexed borrower,
        uint256 amount,
        bytes32 indexed loanID
    );

    event RequestClosed (
        bytes32 indexed loanID
    );

    event RequestApproved (
        address indexed borrower,
        uint256 amount,
        bytes32 indexed loanID
    );

    event RequestRejected (
        bytes32 indexed loanID
    );

    /**
     * Register request for loan
     * @param amount of money to be requested
     * @return true if data was stored
     */
    function loanRequest(uint256 amount) public returns (bool) {
        // generate new loan id based on borrower address, amount and contract state
        bytes32 loanHash = keccak256(abi.encodePacked(_msgSender(), amount, this));
        loans[_msgSender()][loanHash] = amount;
        // store requested amount of ethers
        requestedLoans[loanHash].borrower = _msgSender();
        // map loan id to the borrower address
        emit AddNewLoanRequest(_msgSender(), amount, loanHash);
        return true;
    }

    /**
     * Accept approved request
     * @return true if data was stored
     */
    function loanAccept(bytes32 loanID) public {
        require(requestedLoans[loanID].borrower == _msgSender(), "MicroLoan: sender should be predefined");
        require(requestedLoans[loanID].isApproved, "MicroLoan: loan should be approved");
        uint256 withdrawAmount = loans[_msgSender()][loanID];
        // prevent re-entrancy attacks
        delete requestedLoans[loanID];
        delete loans[_msgSender()][loanID];
        // withdraw money
        emit RequestAccepted(_msgSender(), withdrawAmount, loanID);
        return _msgSender().transfer(withdrawAmount);
    }

    /**
     * Close loan request
     * @return true if data was stored
     */
    function loanClose(bytes32 loanID) public {
        require(requestedLoans[loanID].borrower == _msgSender(), "MicroLoan: sender should be borrower");
        _closeRequest(loanID, _msgSender());
        emit RequestClosed(loanID);
    }

    /**
     * Approve request for money and accepts ethers
     * @param loanID id of request
     */
    function approveRequest(bytes32 loanID) public onlyOwner payable {
        address borrower = requestedLoans[loanID].borrower;
        require(borrower != address(0), "MicroLoan: borrower address should be initialized");
        require(msg.value > 0, "MicroLoan: amount should be non zero value");

        loans[borrower][loanID] = msg.value;
        requestedLoans[loanID] = Loan({borrower : borrower, isApproved : true});

        emit RequestApproved(borrower, msg.value, loanID);
    }

    /**
     * Reject request for money
     * @param loanID id of request
     */
    function declineRequest(bytes32 loanID) public onlyOwner {
        address borrower = requestedLoans[loanID].borrower;
        require(borrower != address(0), "MicroLoan: borrower address should be initialized");

        _closeRequest(loanID, borrower);

        emit RequestRejected(loanID);
    }

    /**
     * Delete request data and returns money back to the owner
     * @param loanID id of request
     * @param borrower address
     */
    function _closeRequest(bytes32 loanID, address borrower) private {
        uint256 requestedAmount = loans[borrower][loanID];
        bool isApproved = requestedLoans[loanID].isApproved;
        delete requestedLoans[loanID];
        delete loans[borrower][loanID];
        if (isApproved) {
            address payable owner = address(uint160(owner()));
            owner.transfer(requestedAmount);
        }
    }

    function acceptRelayedCall(
        address relay,
        address from,
        bytes calldata encodedFunction,
        uint256 transactionFee,
        uint256 gasPrice,
        uint256 gasLimit,
        uint256 nonce,
        bytes calldata approvalData,
        uint256 maxPossibleCharge
    ) external view returns (uint256, bytes memory) {
        return _approveRelayedCall();
    }

    function _preRelayedCall(bytes memory context) internal returns (bytes32) {
        return bytes32(uint(1));
    }

    function _postRelayedCall(bytes memory context, bool, uint256 actualCharge, bytes32) internal {
        // solium-disable-previous-line no-empty-blocks
    }

    function getRecipientBalance() public view returns (uint) {
        return IRelayHub(getHubAddr()).balanceOf(address(this));
    }
}
