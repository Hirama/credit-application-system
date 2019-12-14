pragma solidity ^0.5.12;

import "@openzeppelin/contracts/ownership/Ownable.sol";

contract MicroLoan is Ownable {

    // borrower address => (loan hash => amount of ethers)
    mapping(address => mapping(bytes32 => uint256)) public loans;
    // loan hash => borrower address
    mapping(bytes32 => Loan) public requestedLoans;

    struct Loan {
        address borrower;
        bool isApproved;
    }

    constructor () public {

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
        bytes32 loanHash = keccak256(abi.encodePacked(msg.sender, amount, this));
        loans[msg.sender][loanHash] = amount;
        // store requested amount of ethers
        requestedLoans[loanHash].borrower = msg.sender;
        // map loan id to the borrower address
        emit AddNewLoanRequest(msg.sender, amount, loanHash);
        return true;
    }

    /**
     * Accept approved request
     * @return true if data was stored
     */
    function loanAccept(bytes32 loanID) public {
        require(requestedLoans[loanID].isApproved);
        uint256 withdrawAmount = loans[msg.sender][loanID];
        // prevent re-entrancy attacks
        loans[msg.sender][loanID] = 0;
        // withdraw money
        emit RequestAccepted(msg.sender, withdrawAmount, loanID);
        return msg.sender.transfer(withdrawAmount);
    }

    /**
     * Close loan request
     * @return true if data was stored
     */
    function loanClose(bytes32 loanID) public {
        require(requestedLoans[loanID].borrower == msg.sender);
        _closeRequest(loanID, msg.sender);
        emit RequestClosed(loanID);
    }

    /**
     * Approve request for money and accepts ethers
     * @param loanID id of request
     */
    function approveRequest(bytes32 loanID) public onlyOwner payable {
        address borrower = requestedLoans[loanID].borrower;
        require(borrower != address(0));
        require(msg.value > 0);

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
        require(borrower != address(0));

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

}
