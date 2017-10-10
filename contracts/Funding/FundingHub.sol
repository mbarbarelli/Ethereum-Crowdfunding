pragma solidity ^0.4.11; 

import '../Projects/StandardProject.sol'; 

contract FundingHub {

    event LogStandardProjectCreation(address indexed projectCreator, StandardProject indexed standardProject);
    event LogProjectContribution(address indexed projectContract, address contributor, uint contribution);    

    enum Status {
        Active,
        Inactive
    }

    address public creator;
    uint public createdAtBlock;
    Status public status;

    function createProject(uint _fundingCap, uint _deadline) public returns(StandardProject);
    function contribute(Project _project, uint _contribution) public;
}