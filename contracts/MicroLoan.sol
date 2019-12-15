pragma solidity ^0.5.12;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";

contract MicroLoan is GSNRecipient, Ownable {

    // borrower address => (loan hash => amount of ethers)
    mapping(address => mapping(bytes32 => uint256)) public loans;
    // loan hash => Loan state
    mapping(bytes32 => Loan) public requestedLoans;

    // Loan structure contains borrowers address and status of the loan
    struct Loan {
        address borrower;
        bool isApproved;
    }

    // default constructor
    constructor () public {
        // solium-disable-previous-line no-empty-blocks
    }

    /**
     * Event for request creation logging
     * @param borrower who request the money
     * @param amount of ether to borrow
     * @param loanID id of created request
     */
    event AddNewLoanRequest (
        address indexed borrower,
        uint256 amount,
        bytes32 indexed loanID
    );

    /**
     * Event for accepted request logging
     * @param borrower who requested the money
     * @param amount of ether borrowed
     * @param loanID id of accepted request
     */
    event RequestAccepted (
        address indexed borrower,
        uint256 amount,
        bytes32 indexed loanID
    );

    /**
     * Event for closed request logging
     * @param loanID id of closed request
     */
    event RequestClosed (
        bytes32 indexed loanID
    );

    /**
     * Event for approved request logging
     * @param borrower address to whom was approved request
     * @param amount of lent ethers
     * @param loanID id of approved request
     */
    event RequestApproved (
        address indexed borrower,
        uint256 amount,
        bytes32 indexed loanID
    );

    /**
     * Event for rejected request logging
     * @param loanID id of rejected request
     */
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
     * Accept approved request, money will be received by the lender
     * @param loanID request id
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
     * Close loan request if the request was funded then the money will be returned to the owner
     * @param loanID request id
     */
    function loanClose(bytes32 loanID) public {
        require(requestedLoans[loanID].borrower == _msgSender(), "MicroLoan: sender should be borrower");
        _closeRequest(loanID, _msgSender());
        emit RequestClosed(loanID);
    }

    /**
     * Approve request
     * @param loanID request id
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
     * Decline request for money, if request was funded then money will be returned
     * @param loanID id of request
     */
    function declineRequest(bytes32 loanID) public onlyOwner {
        address borrower = requestedLoans[loanID].borrower;
        require(borrower != address(0), "MicroLoan: borrower address should be initialized");

        _closeRequest(loanID, borrower);

        emit RequestRejected(loanID);
    }

    /**
     * Delete request data and returns money back to the owner if request was approved
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
