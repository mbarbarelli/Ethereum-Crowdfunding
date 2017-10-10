pragma solidity ^0.4.11; 

import '../Funding/FundingHub.sol'; 
import '../Funding/Owned.sol';

contract StandardFundingHub is FundingHub, Owned {

    mapping (bytes32 => Project) public projects;
    mapping (bytes32 => bytes32) public projectList;

    modifier atStatus(Status _expectedStatus) {
        require(status == _expectedStatus);
        _;
    }

    function StandardFundingHub()
        public        
    {
        owner = msg.sender;
        status = Status.Active; 
    }

    function createProject(
        uint _fundingCap, 
        uint _deadline) 
        atStatus(Status.Active)
        public
        returns (StandardProject projectContract)
    {
        bytes32 projectHash = keccak256(msg.sender, _fundingCap, now + _deadline);
        // ensure that project does not already exist.
        require(address(projects[projectHash]) == 0x0);
        projectContract = new StandardProject(msg.sender, _fundingCap, _deadline);        
        addProject(projectContract, projectHash);
        LogStandardProjectCreation(msg.sender, projectContract);
    }

    function contribute(Project _project, uint _amount) 
        atStatus(Status.Active)
        public
    {   
        require(address(_project) != 0x0 && _amount > 0);
        StandardProject(_project).fund(_amount, msg.sender);
        LogProjectContribution(_project, msg.sender, _amount);    
    }

    function addProject(StandardProject _projectContract, bytes32 _projectHash)
        internal 
    {
        projects[_projectHash] = _projectContract;
        projectList[_projectHash] = projectList[0x0]; 
        projectList[0x0] = _projectHash;
    }    

    function toggleActive() 
        fromOwner 
        public 
    {
        status = status == Status.Active ? Status.Inactive : Status.Active;
    }        
}