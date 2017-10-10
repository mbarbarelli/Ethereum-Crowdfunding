const { getEventSignature, getParamFromTxEvent, assertRejects, delay } = require('../utils/utils.js');
const addEvmFunctions = require('../utils/evmFunctions.js');
const Promise = require("bluebird"); 

var StandardFundingHub = artifacts.require('StandardFundingHub.sol');
var StandardProject = artifacts.require('StandardProject.sol');
var Token = artifacts.require('FundingToken.sol');

contract('Funding Hub', async (accounts) => {
  addEvmFunctions(web3);
  Promise.promisifyAll(web3.eth, { suffix: "Promise" });
  Promise.promisifyAll(web3.version, { suffix: "Promise" });
  Promise.promisifyAll(web3.evm, { suffix: "Promise" });

  let fHub; 
  const ZERO = "0x0000000000000000000000000000000000000000";

  var FundingHubStatus = {
    Active: 0,
    Inactive: 1
  };

  var ProjectStatus = {
    Active: 0,
    Expired: 1,
    Closed: 2
  };

  var FundingStage = {
    Open: 0,
    FundingRaised: 1,
    CapReached: 2,
    EarlySuccess: 3,
    Success: 4,
    PaidOut: 5,
    Failed: 6
  };

  const fundingCap = web3.toBigNumber(web3.toWei(10, "ether"));
  var investorDeposit = web3.toWei(5, "ether");
  var contribution = web3.toWei(3.4, "ether");     
   
  let project, fundingToken, result;
  var projectAddress = ZERO;  

  var prjCreator = accounts[0];
  var contributorOne = accounts[1];
  var contributorTwo = accounts[2];
  var contributorThree = accounts[3];
  var projects = [];     
  let deployTimeStamp;

  let isTestRPC;
  
  // before("should identify node type", () => {
  //   var node = await web3.version.getNodePromise(); 
  //   isTestRPC = node.indexOf("EthereumJS TestRPC") >=0;
  // });

  beforeEach(async () => {
    var node = await web3.version.getNodePromise(); 
    isTestRPC = node.indexOf("EthereumJS TestRPC") >=0;    
    fHub = await StandardFundingHub.new({from: web3.eth.coinbase});  
  });

  it("Should perform an end-to-end test concluding with pay out.", async () => {
    projects.length = 0;
    const deadlineInSeconds = 60;

    // Funding hub must be active 
    assert.equal(await fHub.status(), FundingHubStatus.Active, "Funding hub stage should be 'Active'.");
   
    // Create project
    project = getParamFromTxEvent(
      await fHub.createProject(fundingCap.valueOf(), deadlineInSeconds, {from: prjCreator}),
      'standardProject', StandardProject
    ); 

    // Verify funding hub's project record(s) in storage.
    var prjAddress, current = await fHub.projectList.call(0);

    while ((prjAddress = await fHub.projects(current)) != ZERO) {
      projects.push(prjAddress);
      current = await fHub.projectList.call(current);
    }

    assert.equal(projects[0], project.address, "Deployed project address and funding hub record should match."); 
    assert.equal(projects.length, 1, "Should only be one project created at this point."); 

    // Project must be in initial stages 
    assert.equal(await project.projectStatus(), ProjectStatus.Active, "Project status should be 'Active'."); 
    assert.equal(await project.fundingStage(), FundingStage.Open, "Funding stage should be 'Open'."); 
     
    // Create funding token reference
    fundingToken = await Token.at(await project.fundingToken()); 

    // Each project investor must deposit funds into project token and approve project contract as their custodian. 
    await fundingToken.deposit({from: contributorOne, value: investorDeposit});
    assert.equal(await fundingToken.balanceOf.call(contributorOne), investorDeposit); 
    await fundingToken.approve(project.address, investorDeposit, {from: contributorOne});
    assert.equal(await fundingToken.allowance.call(contributorOne, project.address), investorDeposit); 

    await fundingToken.deposit({from: contributorTwo, value: investorDeposit});
    assert.equal(await fundingToken.balanceOf.call(contributorTwo), investorDeposit);
    await fundingToken.approve(project.address, investorDeposit, {from: contributorTwo});
    assert.equal(await fundingToken.allowance.call(contributorTwo, project.address), investorDeposit);     

    await fundingToken.deposit({from: contributorThree, value: investorDeposit});
    assert.equal(await fundingToken.balanceOf.call(contributorThree), investorDeposit);   
    await fundingToken.approve(project.address, investorDeposit, {from: contributorThree});
    assert.equal(await fundingToken.allowance.call(contributorThree, project.address), investorDeposit);     
    
    assert.equal(await fundingToken.balanceOf.call(project.address), 0, "Project should hold no tokens at this point.");

    assert.equal(await fundingToken.totalSupply(), 
                 investorDeposit * 3, 
                 "Total supply of funding token should equal sum of all deposits");
    
    // Each investor makes a contribution to the project. 

    // Verify: 
    // - Correct funding stage.
    // - Investor contribution record kept.
    // - Contribution held by project.

    await fHub.contribute(project.address, contribution, {from: contributorOne});
    assert.equal(await project.fundingStage(), FundingStage.FundingRaised, "Funding stage should be 'FundingRaised'."); 
    assert.equal(await fundingToken.contributionOf.call(contributorOne), contribution);
    assert.equal(await fundingToken.balanceOf.call(project.address), contribution);

    await fHub.contribute(project.address, contribution, {from: contributorTwo});
    assert.equal(await project.fundingStage(), FundingStage.FundingRaised, "Funding stage should be 'FundingRaised'."); 
    assert.equal(await fundingToken.contributionOf.call(contributorTwo), contribution);
    assert.equal(await fundingToken.balanceOf.call(project.address), contribution * 2);

    // Attempt to refund before the end of the project funding period ends
    assertRejects(project.refund({ from: contributorOne }), 
                  "Should not be possible to get a refund before funding period ends.");
    
    // The funding cap should be reached as of the next contribution.
    // Since this contribution amount will exceed the funding cap, 
    // the project contract will attempt avoid excess funding by reducing the contribution so that the amount
    // contributed during the funding period is exactly equal to the funding cap. 
    var adjustedContribution = fundingCap.sub(web3.toBigNumber(await project.amountRaised.call())); 
    
    await fHub.contribute(project.address, contribution, {from: contributorThree});

    assert.equal(await project.fundingStage(), FundingStage.EarlySuccess, "Funding stage should be 'EarlySuccess'."); 
    assert.equal(await fundingToken.contributionOf.call(contributorThree).valueOf(), adjustedContribution.valueOf());
    assert.equal(await fundingToken.balanceOf.call(project.address), fundingCap.valueOf());    

    // Funding cap reached.  Project creator may trigger payout. 
    await project.payout()
    assert.equal(await fundingToken.balanceOf(prjCreator).valueOf(), 
                 fundingCap.valueOf(), 
                 "Project creator should hold all project funding");
    assert.equal(await project.projectStatus(), ProjectStatus.Closed); 
    assert.equal(await project.fundingStage(), FundingStage.PaidOut);
                
  });
 
  it("Should demonstrate project expiry, using testrpc 'time travel'.", async () => { 
    if (!isTestRPC) this.skip("Needs TestRPC");
    let snapshotId, blockNumber; 

    projects.length = 0;
    const deadlineInSeconds = 36000;

    blockNumber = await web3.eth.getBlockNumberPromise(); 

    // Funding hub must be active 
    assert.equal(await fHub.status(), FundingHubStatus.Active, "Funding hub stage should be 'Active'.");

    // Create project
    var txObj = await fHub.createProject(fundingCap.valueOf(), deadlineInSeconds, { from: prjCreator });
    project = getParamFromTxEvent(txObj, 'standardProject', StandardProject);

    // Retreive project contract deployment timestamp
    var receipt = await web3.eth.getTransactionReceiptPromise(txObj.logs[0].transactionHash);
    var block = await web3.eth.getBlockPromise(receipt.blockNumber); 

    assert.equal(block.number, blockNumber + 1); 

    deployTimeStamp = block.timestamp;    

    // Verify funding hub's project record(s) in storage.
    var prjAddress, current = await fHub.projectList.call(0);

    while ((prjAddress = await fHub.projects(current)) != ZERO) {
      projects.push(prjAddress);
      current = await fHub.projectList.call(current);
    }
    
    assert.equal(projects[0], project.address, "Deployed project address and funding hub record should match.");
    assert.equal(projects.length, 1, "Should only be one project created at this point.");

    // Project must be in initial stages 
    assert.equal(await project.projectStatus(), ProjectStatus.Active, "Project status should be 'Active'.");
    assert.equal(await project.fundingStage(), FundingStage.Open, "Funding stage should be 'Open'.");

    // Create funding token reference
    fundingToken = await Token.at(await project.fundingToken());

    // Each project investor must deposit funds into project token and approve project contract as their custodian. 
    await fundingToken.deposit({ from: contributorOne, value: investorDeposit });
    assert.equal(await fundingToken.balanceOf.call(contributorOne), investorDeposit);
    await fundingToken.approve(project.address, investorDeposit, { from: contributorOne });
    assert.equal(await fundingToken.allowance.call(contributorOne, project.address), investorDeposit);

    await fundingToken.deposit({ from: contributorTwo, value: investorDeposit });
    assert.equal(await fundingToken.balanceOf.call(contributorTwo), investorDeposit);
    await fundingToken.approve(project.address, investorDeposit, { from: contributorTwo });
    assert.equal(await fundingToken.allowance.call(contributorTwo, project.address), investorDeposit);

    await fundingToken.deposit({ from: contributorThree, value: investorDeposit });
    assert.equal(await fundingToken.balanceOf.call(contributorThree), investorDeposit);
    await fundingToken.approve(project.address, investorDeposit, { from: contributorThree });
    assert.equal(await fundingToken.allowance.call(contributorThree, project.address), investorDeposit);

    assert.equal(await fundingToken.balanceOf.call(project.address), 0, "Project should hold no tokens at this point.");

    assert.equal(await fundingToken.totalSupply(),
      investorDeposit * 3,
      "Total supply of funding token should equal sum of all deposits");

    // Each investor makes a contribution to the project. 

    // Verify: 
    // - Correct funding stage.
    // - Investor contribution record kept.
    // - Contribution held by project.

    await fHub.contribute(project.address, contribution, { from: contributorOne });
    assert.equal(await project.fundingStage(), FundingStage.FundingRaised, "Funding stage should be 'FundingRaised'.");
    assert.equal(await fundingToken.contributionOf.call(contributorOne), contribution);
    assert.equal(await fundingToken.balanceOf.call(project.address), contribution);

    await fHub.contribute(project.address, contribution, { from: contributorTwo });
    assert.equal(await project.fundingStage(), FundingStage.FundingRaised, "Funding stage should be 'FundingRaised'.");
    assert.equal(await fundingToken.contributionOf.call(contributorTwo), contribution);
    assert.equal(await fundingToken.balanceOf.call(project.address), contribution * 2); 
    
    console.log(`Travelling ${deadlineInSeconds} seconds into the future...`);    
    await web3.evm.increaseTimePromise(deadlineInSeconds + 500);
    
    // Attempt to make a contribution after project expiry should fail.
    assertRejects(fHub.contribute(project.address, contribution, { from: contributorThree }), 
                  "Should not be possible to make project contribution after expiry.");

    assert.equal(await project.projectStatus().valueOf(), ProjectStatus.Expired);
    assert.equal(await project.fundingStage().valueOf(), FundingStage.Failed);
 
    // Confirm pre-refund balance of each contributor
    var balances = await Promise.all([
      fundingToken.balanceOf(contributorOne), 
      fundingToken.balanceOf(contributorTwo)
    ]);
    
    // Make refund requests
    await Promise.all([
      project.refund({from: contributorOne}), 
      project.refund({from: contributorTwo})
    ]);

    var balances = await Promise.all([
      fundingToken.balanceOf(contributorOne), 
      fundingToken.balanceOf(contributorTwo)
    ]);

    // Confirm refund
    assert.equal(balances[0].valueOf(), investorDeposit);
    assert.equal(balances[1].valueOf(), investorDeposit);    
  });    

  it("Should demonstrate project expiry, funding failure, and refunds.", async () => { 
    projects.length = 0;
    const deadlineInSeconds = 10;

    // Funding hub must be active 
    assert.equal(await fHub.status(), FundingHubStatus.Active, "Funding hub stage should be 'Active'.");

    // Create project
    project = getParamFromTxEvent(
      await fHub.createProject(fundingCap.valueOf(), deadlineInSeconds, { from: prjCreator }),
      'standardProject', StandardProject
    );

    // Verify funding hub's project record(s) in storage.
    var prjAddress, current = await fHub.projectList.call(0);

    while ((prjAddress = await fHub.projects(current)) != ZERO) {
      projects.push(prjAddress);
      current = await fHub.projectList.call(current);
    }      
        
    assert.equal(projects[0], project.address, "Deployed project address and funding hub record should match.");
    assert.equal(projects.length, 1, "Should only be one project created at this point.");

    // Project must be in initial stages 
    assert.equal(await project.projectStatus(), ProjectStatus.Active, "Project status should be 'Active'.");
    assert.equal(await project.fundingStage(), FundingStage.Open, "Funding stage should be 'Open'.");

    // Create funding token reference
    fundingToken = await Token.at(await project.fundingToken());

    // Each project investor must deposit funds into project token and approve project contract as their custodian. 
    await fundingToken.deposit({ from: contributorOne, value: investorDeposit });
    assert.equal(await fundingToken.balanceOf.call(contributorOne), investorDeposit);
    await fundingToken.approve(project.address, investorDeposit, { from: contributorOne });
    assert.equal(await fundingToken.allowance.call(contributorOne, project.address), investorDeposit);

    await fundingToken.deposit({ from: contributorTwo, value: investorDeposit });
    assert.equal(await fundingToken.balanceOf.call(contributorTwo), investorDeposit);
    await fundingToken.approve(project.address, investorDeposit, { from: contributorTwo });
    assert.equal(await fundingToken.allowance.call(contributorTwo, project.address), investorDeposit);

    await fundingToken.deposit({ from: contributorThree, value: investorDeposit });
    assert.equal(await fundingToken.balanceOf.call(contributorThree), investorDeposit);
    await fundingToken.approve(project.address, investorDeposit, { from: contributorThree });
    assert.equal(await fundingToken.allowance.call(contributorThree, project.address), investorDeposit);

    assert.equal(await fundingToken.balanceOf.call(project.address), 0, "Project should hold no tokens at this point.");

    assert.equal(await fundingToken.totalSupply(),
      investorDeposit * 3,
      "Total supply of funding token should equal sum of all deposits");

    // Each investor makes a contribution to the project. 

    // Verify: 
    // - Correct funding stage.
    // - Investor contribution record kept.
    // - Contribution held by project.

    await fHub.contribute(project.address, contribution, { from: contributorOne });
    assert.equal(await project.fundingStage(), FundingStage.FundingRaised, "Funding stage should be 'FundingRaised'.");
    assert.equal(await fundingToken.contributionOf.call(contributorOne), contribution);
    assert.equal(await fundingToken.balanceOf.call(project.address), contribution);

    await fHub.contribute(project.address, contribution, { from: contributorTwo });
    assert.equal(await project.fundingStage(), FundingStage.FundingRaised, "Funding stage should be 'FundingRaised'.");
    assert.equal(await fundingToken.contributionOf.call(contributorTwo), contribution);
    assert.equal(await fundingToken.balanceOf.call(project.address), contribution * 2); 
    
    console.log(`Waiting for project period to expire (${deadlineInSeconds} seconds) ...`);    
    await delay((deadlineInSeconds + 5) * 1000);

    // Contract "ping".  In testrpc, executing a transaction after 
    // client side delay may be necessary to update blockchain time...
    await web3.eth.sendTransaction({from: web3.eth.coinbase, to: project.address});

    assert.equal(await project.projectStatus(), ProjectStatus.Expired);
    assert.equal(await project.fundingStage(), FundingStage.Failed);

    // Attempt to make a contribution after project expirty should fail.
    assertRejects(fHub.contribute(project.address, contribution, { from: contributorThree }), 
                  "Should not be possible to make project contribution after expiry.");

    // Confirm pre-refund balance of each contributor
    var balances = await Promise.all([
      fundingToken.balanceOf(contributorOne), 
      fundingToken.balanceOf(contributorTwo)
    ]);
    
    assert.equal(balances[0].valueOf(), investorDeposit - contribution);
    assert.equal(balances[1].valueOf(), investorDeposit - contribution);
    
    // Make refund requests
    await Promise.all([
      project.refund({from: contributorOne}), 
      project.refund({from: contributorTwo})
    ]);

    var balances = await Promise.all([
      fundingToken.balanceOf(contributorOne), 
      fundingToken.balanceOf(contributorTwo)
    ]);

    // Confirm refund
    assert.equal(balances[0].valueOf(), investorDeposit);
    assert.equal(balances[1].valueOf(), investorDeposit);    
  });   

  it("Should create several projects for one hub.", async () => { 
    let project2, project3;     
    projects.length = 0;
    const deadlineInSeconds = 10;

    // Funding hub must be active 
    assert.equal(await fHub.status(), FundingHubStatus.Active, "Funding hub stage should be 'Active'.");

    // Create project
    project = getParamFromTxEvent(
      await fHub.createProject(fundingCap.valueOf(), deadlineInSeconds, { from: prjCreator }),
      'standardProject', StandardProject
    );

    // Note:  The funding cap is adjusted slightly so that the project bytes32 project identifier will differ
    //        for each project.  

    project2 = getParamFromTxEvent(
      await fHub.createProject(fundingCap.add(1000000).valueOf(), deadlineInSeconds, { from: prjCreator }),
      'standardProject', StandardProject
    );

    project3 = getParamFromTxEvent(
      await fHub.createProject(fundingCap.add(1000001).valueOf(), deadlineInSeconds, { from: prjCreator }),
      'standardProject', StandardProject
    );

    // Verify funding hub's project record(s) in storage.
    var prjAddress, current = await fHub.projectList.call(0);

    while ((prjAddress = await fHub.projects(current)) != ZERO) {
      projects.push(prjAddress);
      current = await fHub.projectList.call(current);
    }
    assert.equal(projects.length, 3);        
  });   

  it("Should not allow funding if hub is deactivated", async () => {
    projects.length = 0;
    const deadlineInSeconds = 36000;      
    // Funding hub must be active 
    assert.equal(await fHub.status(), FundingHubStatus.Active, "Funding hub stage should be 'Active'.");

    // Create project
    var txObj = await fHub.createProject(fundingCap.valueOf(), deadlineInSeconds, { from: prjCreator });
    project = getParamFromTxEvent(txObj, 'standardProject', StandardProject);

    // Verify funding hub's project record(s) in storage.
    var prjAddress, current = await fHub.projectList.call(0);

    while ((prjAddress = await fHub.projects(current)) != ZERO) {
      projects.push(prjAddress);
      current = await fHub.projectList.call(current);
    }    

    await fHub.toggleActive({from: web3.eth.coinbase});
    assert.equal(await fHub.status(), FundingHubStatus.Inactive)

    // Attempt to make a contribution after hub is deactivated should fail.
    assertRejects(fHub.contribute(project.address, contribution, { from: contributorThree }), 
      "Should not be possible to make project contribution after expiry.");          
  });
});


