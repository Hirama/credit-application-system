const MicroLoan = artifacts.require("MicroLoan");

module.exports = function (deployer) {
  deployer.deploy(MicroLoan);
};
