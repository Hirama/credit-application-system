const MicroLoan = artifacts.require("MicroLoan");
const truffleAssert = require('truffle-assertions');

contract("happy path test", async accounts => {
    it("should be owner of the contract", async () => {
        let instance = await MicroLoan.deployed();
        let owner = await instance.owner.call();
        assert.equal(accounts[0], owner);
    });

    it("should create loan request correctly", async () => {
        let instance = await MicroLoan.deployed();
        let borrower = accounts[1];

        let requestAmount = 10;

        let result = await instance.loanRequest(requestAmount, {from: borrower});
        truffleAssert.eventEmitted(result, 'AddNewLoanRequest', (ev) => {
            return ev.borrower === borrower && ev.amount.toNumber() === requestAmount;
        }, 'AddNewLoanRequest should be emitted with correct parameters');
    });

    it("should cancel loan request correctly by borrower", async () => {
        let instance = await MicroLoan.deployed();
        let borrower = accounts[1];

        let requestAmount = 10;

        let requestResult = await instance.loanRequest(requestAmount, {from: borrower});
        truffleAssert.eventEmitted(requestResult, 'AddNewLoanRequest', (ev) => {
            return ev.borrower === borrower && ev.amount.toNumber() === requestAmount;
        }, 'AddNewLoanRequest should be emitted with correct parameters');

        let cancelResult = await instance.loanClose(requestResult.logs[0].args.loanID, {from: borrower});
        truffleAssert.eventEmitted(cancelResult, 'RequestClosed', (ev) => {
            return ev.loanID === requestResult.logs[0].args.loanID;
        }, 'RequestClosed should be emitted with correct parameters');
    });

    it("should decline loan request correctly by lender", async () => {
        let instance = await MicroLoan.deployed();
        let owner = accounts[0];
        let borrower = accounts[1];

        let requestAmount = 10;

        let requestResult = await instance.loanRequest(requestAmount, {from: borrower});
        truffleAssert.eventEmitted(requestResult, 'AddNewLoanRequest', (ev) => {
            return ev.borrower === borrower && ev.amount.toNumber() === requestAmount;
        }, 'AddNewLoanRequest should be emitted with correct parameters');

        let declineResult = await instance.declineRequest(requestResult.logs[0].args.loanID, {from: owner});
        truffleAssert.eventEmitted(declineResult, 'RequestRejected', (ev) => {
            return ev.loanID === requestResult.logs[0].args.loanID;
        }, 'RequestRejected should be emitted with correct parameters');
    });

    it("should approve loan request by lender", async () => {
        let instance = await MicroLoan.deployed();
        let owner = accounts[0];
        let borrower = accounts[1];

        let requestAmount = 10;

        let amountToSend = 10;

        let requestResult = await instance.loanRequest(requestAmount, {from: borrower});
        truffleAssert.eventEmitted(requestResult, 'AddNewLoanRequest', (ev) => {
            return ev.borrower === borrower && ev.amount.toNumber() === requestAmount;
        }, 'AddNewLoanRequest should be emitted with correct parameters');

        let approveResult = await instance.approveRequest(requestResult.logs[0].args.loanID, {
            from: owner,
            value: amountToSend
        });
        truffleAssert.eventEmitted(approveResult, 'RequestApproved', (ev) => {
            return ev.borrower === borrower && ev.loanID === requestResult.logs[0].args.loanID && ev.amount.toNumber() === amountToSend;
        }, 'RequestApproved should be emitted with correct parameters');
    });

    it("should accept loan request by borrower with exact requested amount", async () => {
        let instance = await MicroLoan.deployed();
        let owner = accounts[0];
        let borrower = accounts[1];

        let requestAmount = 10;
        let amountToSend = 10;

        let requestResult = await instance.loanRequest(requestAmount, {from: borrower});
        truffleAssert.eventEmitted(requestResult, 'AddNewLoanRequest', (ev) => {
            return ev.borrower === borrower && ev.amount.toNumber() === requestAmount;
        }, 'AddNewLoanRequest should be emitted with correct parameters');

        let approveResult = await instance.approveRequest(requestResult.logs[0].args.loanID, {
            from: owner,
            value: amountToSend
        });
        truffleAssert.eventEmitted(approveResult, 'RequestApproved', (ev) => {
            return ev.borrower === borrower && ev.loanID === requestResult.logs[0].args.loanID && ev.amount.toNumber() === amountToSend;
        }, 'RequestApproved should be emitted with correct parameters');

        let initialBalance = await web3.eth.getBalance(borrower);
        initialBalance = web3.utils.toBN(initialBalance);

        let acceptResult = await instance.loanAccept(requestResult.logs[0].args.loanID, {from: borrower});
        truffleAssert.eventEmitted(acceptResult, 'RequestAccepted', (ev) => {
            return ev.borrower === borrower && ev.loanID === requestResult.logs[0].args.loanID && ev.amount.toNumber() === amountToSend;
        }, 'RequestAccepted should be emitted with correct parameters');

        const gasUsed = web3.utils.toBN(acceptResult.receipt.gasUsed);
        // Obtain gasPrice from the transaction
        const tx = await web3.eth.getTransaction(acceptResult.tx);
        const gasPrice = tx.gasPrice;
        const expected = web3.utils.toBN(gasPrice);
        let finalBalance = await web3.eth.getBalance(borrower);
        finalBalance = web3.utils.toBN(finalBalance);
        assert.equal(
            // restore balance before call and compare with expected amount
            finalBalance.add(expected.mul(gasUsed)).toString(),
            initialBalance.add(web3.utils.toBN(amountToSend)),
            "Amount wasn't correctly funded from the lender"
        );
    });

    it("should accept loan request by borrower with lower approved amount", async () => {
        let instance = await MicroLoan.deployed();
        let owner = accounts[0];
        let borrower = accounts[1];

        let requestAmount = 10;
        let amountToSend = 5;

        let requestResult = await instance.loanRequest(requestAmount, {from: borrower});
        truffleAssert.eventEmitted(requestResult, 'AddNewLoanRequest', (ev) => {
            return ev.borrower === borrower && ev.amount.toNumber() === requestAmount;
        }, 'AddNewLoanRequest should be emitted with correct parameters');

        let approveResult = await instance.approveRequest(requestResult.logs[0].args.loanID, {
            from: owner,
            value: amountToSend
        });
        truffleAssert.eventEmitted(approveResult, 'RequestApproved', (ev) => {
            return ev.borrower === borrower && ev.loanID === requestResult.logs[0].args.loanID && ev.amount.toNumber() === amountToSend;
        }, 'RequestApproved should be emitted with correct parameters');

        let initialBalance = await web3.eth.getBalance(borrower);
        initialBalance = web3.utils.toBN(initialBalance);

        let acceptResult = await instance.loanAccept(requestResult.logs[0].args.loanID, {from: borrower});
        truffleAssert.eventEmitted(acceptResult, 'RequestAccepted', (ev) => {
            return ev.borrower === borrower && ev.loanID === requestResult.logs[0].args.loanID && ev.amount.toNumber() === amountToSend;
        }, 'RequestAccepted should be emitted with correct parameters');

        const gasUsed = web3.utils.toBN(acceptResult.receipt.gasUsed);
        // Obtain gasPrice from the transaction
        const tx = await web3.eth.getTransaction(acceptResult.tx);
        const gasPrice = tx.gasPrice;
        const expected = web3.utils.toBN(gasPrice);
        let finalBalance = await web3.eth.getBalance(borrower);
        finalBalance = web3.utils.toBN(finalBalance);
        assert.equal(
            // restore balance before call and compare with expected amount
            finalBalance.add(expected.mul(gasUsed)).toString(),
            initialBalance.add(web3.utils.toBN(amountToSend)),
            "Amount wasn't correctly funded from the lender"
        );
    });

    it("should accept loan request by borrower with higher approved amount", async () => {
        let instance = await MicroLoan.deployed();
        let owner = accounts[0];
        let borrower = accounts[1];

        let requestAmount = 10;
        let amountToSend = 15;

        let requestResult = await instance.loanRequest(requestAmount, {from: borrower});
        truffleAssert.eventEmitted(requestResult, 'AddNewLoanRequest', (ev) => {
            return ev.borrower === borrower && ev.amount.toNumber() === requestAmount;
        }, 'AddNewLoanRequest should be emitted with correct parameters');

        let approveResult = await instance.approveRequest(requestResult.logs[0].args.loanID, {
            from: owner,
            value: amountToSend
        });
        truffleAssert.eventEmitted(approveResult, 'RequestApproved', (ev) => {
            return ev.borrower === borrower && ev.loanID === requestResult.logs[0].args.loanID && ev.amount.toNumber() === amountToSend;
        }, 'RequestApproved should be emitted with correct parameters');

        let initialBalance = await web3.eth.getBalance(borrower);
        initialBalance = web3.utils.toBN(initialBalance);

        let acceptResult = await instance.loanAccept(requestResult.logs[0].args.loanID, {from: borrower});
        truffleAssert.eventEmitted(acceptResult, 'RequestAccepted', (ev) => {
            return ev.borrower === borrower && ev.loanID === requestResult.logs[0].args.loanID && ev.amount.toNumber() === amountToSend;
        }, 'RequestAccepted should be emitted with correct parameters');

        const gasUsed = web3.utils.toBN(acceptResult.receipt.gasUsed);
        // Obtain gasPrice from the transaction
        const tx = await web3.eth.getTransaction(acceptResult.tx);
        const gasPrice = tx.gasPrice;
        const expected = web3.utils.toBN(gasPrice);
        let finalBalance = await web3.eth.getBalance(borrower);
        finalBalance = web3.utils.toBN(finalBalance);
        assert.equal(
            // restore balance before call and compare with expected amount
            finalBalance.add(expected.mul(gasUsed)).toString(),
            initialBalance.add(web3.utils.toBN(amountToSend)),
            "Amount wasn't correctly funded from the lender"
        );
    });

    it("should cancel the loan request by the borrower after funding by the lender if it is not used", async () => {
        let instance = await MicroLoan.deployed();
        let owner = accounts[0];
        let borrower = accounts[1];

        let requestAmount = 10;
        let amountToSend = 15;

        let requestResult = await instance.loanRequest(requestAmount, {from: borrower});
        truffleAssert.eventEmitted(requestResult, 'AddNewLoanRequest', (ev) => {
            return ev.borrower === borrower && ev.amount.toNumber() === requestAmount;
        }, 'AddNewLoanRequest should be emitted with correct parameters');

        let approveResult = await instance.approveRequest(requestResult.logs[0].args.loanID, {
            from: owner,
            value: amountToSend
        });
        truffleAssert.eventEmitted(approveResult, 'RequestApproved', (ev) => {
            return ev.borrower === borrower && ev.loanID === requestResult.logs[0].args.loanID && ev.amount.toNumber() === amountToSend;
        }, 'RequestApproved should be emitted with correct parameters');

        let initialBalance = await web3.eth.getBalance(owner);
        initialBalance = web3.utils.toBN(initialBalance);

        let acceptResult = await instance.loanClose(requestResult.logs[0].args.loanID, {from: borrower});
        truffleAssert.eventEmitted(acceptResult, 'RequestClosed', (ev) => {
            return ev.loanID === requestResult.logs[0].args.loanID;
        }, 'RequestClosed should be emitted with correct parameters');

        // Obtain gasPrice from the transaction
        const tx = await web3.eth.getTransaction(acceptResult.tx);
        const gasPrice = tx.gasPrice;
        const expected = web3.utils.toBN(gasPrice);
        let finalBalance = await web3.eth.getBalance(owner);
        finalBalance = web3.utils.toBN(finalBalance);
        assert.equal(
            finalBalance.toString(),
            initialBalance.add(web3.utils.toBN(amountToSend)).toString(),
            "Amount wasn't correctly funded from the contract"
        );
    });

    it("should decline the loan request by the lender after funding by lender if it is not used", async () => {
        let instance = await MicroLoan.deployed();
        let owner = accounts[0];
        let borrower = accounts[1];

        let requestAmount = 10;
        let amountToSend = 15;

        let requestResult = await instance.loanRequest(requestAmount, {from: borrower});
        truffleAssert.eventEmitted(requestResult, 'AddNewLoanRequest', (ev) => {
            return ev.borrower === borrower && ev.amount.toNumber() === requestAmount;
        }, 'AddNewLoanRequest should be emitted with correct parameters');

        let approveResult = await instance.approveRequest(requestResult.logs[0].args.loanID, {
            from: owner,
            value: amountToSend
        });
        truffleAssert.eventEmitted(approveResult, 'RequestApproved', (ev) => {
            return ev.borrower === borrower && ev.loanID === requestResult.logs[0].args.loanID && ev.amount.toNumber() === amountToSend;
        }, 'RequestApproved should be emitted with correct parameters');

        let initialBalance = await web3.eth.getBalance(owner);
        initialBalance = web3.utils.toBN(initialBalance);

        let acceptResult = await instance.declineRequest(requestResult.logs[0].args.loanID, {from: owner});
        truffleAssert.eventEmitted(acceptResult, 'RequestRejected', (ev) => {
            return ev.loanID === requestResult.logs[0].args.loanID;
        }, 'RequestRejected should be emitted with correct parameters');

        const gasUsed = web3.utils.toBN(acceptResult.receipt.gasUsed);
        // Obtain gasPrice from the transaction
        const tx = await web3.eth.getTransaction(acceptResult.tx);
        const gasPrice = tx.gasPrice;
        const expected = web3.utils.toBN(gasPrice);
        let finalBalance = await web3.eth.getBalance(owner);
        finalBalance = web3.utils.toBN(finalBalance);
        assert.equal(
            finalBalance.add(expected.mul(gasUsed)).toString(),
            initialBalance.add(web3.utils.toBN(amountToSend)).toString(),
            "Amount wasn't correctly funded from the lender"
        );
    });
});

contract("side cases test", async accounts => {

});