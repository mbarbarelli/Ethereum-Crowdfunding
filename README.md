# Ethereum Crowdfunding

A decentralised crowdfunding blockchain application.

## Contracts

### Hub contracts 

#### `FundingHub.sol` 

The  funding interface contract. 

#### `StandardFundingHub.sol` 

The project funding hub implementation contract.  Allows for creation of a project, stores a record of all projects created by the hub, and allows users to fund each project. 

#### `Owned.sol`

Child contract which manages ownership of the funding hub. 

### Project contracts

#### `Project.sol`

Project interface contract.  Include stages and stage management modifiers. 

#### `StandardProject.sol`

Project implementation contract.  Enables funding of a project, refunds and payouts. 

### Token contracts

#### `Token.sol`

Standard ERC-20 token interface.

#### `FundingToken`

Funding token implementation.  Allows deposits, withdrawals, transfers, allowance transfers (typically mediated by the token's parent project contract) and keeps a record of individual contributions

### Utility contracts 

#### `Math.sol` 

Standard overflow and underflow protection routines. 

##  dApp Workflow 

### Project created during funding hub deployment. (As per `2_deploy_contracts.js`)

![Project Created](/images/1.png)

###  Createing a new project
![Project Creation](/images/2.png)

![Project Creation](/images/3.png)

![Project Creation](/images/4.png)

###  Funding a project 

![Project Funding](/images/5.png)

![Project Funding](/images/6.png)

## Tests

Tests written using Node async/await. 
### Test cases

```
it("Should perform an end-to-end test concluding with pay out.", async () => {
	...
});
```

```
 it("Should demonstrate project expiry, using testrpc 'time travel'.", async () => { 
	 ...
 });
```

```
 it("Should demonstrate project expiry, funding failure, and refunds.", async () => { 
	 ...
 });
```

```
 it("Should create several projects for one hub.", async () => { 
	 ...
 });
```

```
 it("Should not allow funding if hub is deactivated", async () => { 
	 ...
 });
```
