let Math = artifacts.require('Math.sol');
let StandardFundingHub = artifacts.require('StandardFundingHub.sol');

var fundingCap = web3.toWei(2, "ether"); 
var deadlineInSeconds = 60 * 60; 

module.exports = function(deployer) {
  deployer.deploy(Math);
  deployer.link(Math, StandardFundingHub);
  deployer.deploy(StandardFundingHub)
    .then(() => {
      return StandardFundingHub.deployed()
        .then((hub) => {
          return hub.createProject(fundingCap, deadlineInSeconds, {from: web3.eth.coinbase});
        })
    });
};
