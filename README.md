# Applications on micro-loans
## Concept
The SC allows users to create loan applications. 
The owner of the SC can repay the loan application or reject it.
The SC work only with ethers.

## Solidity Contracts
*   [MicroLoan.sol](./contracts/MicroLoan.sol)  
    * Create request for loan
    * Request approve by contract owner
    * Request accept by lender and receive a money
    * Request reject and decline
*   [Migrations.sol](./contracts/Migrations.sol)  
    Store migrations

### Install

`npm install`

### Test

`npm run test`