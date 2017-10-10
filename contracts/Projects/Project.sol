pragma solidity ^0.4.11; 

import '../Tokens/FundingToken.sol'; 

contract Project {

    event LogProjectContributed(address indexed contributor, uint indexed amount);
    event LogFundingCapReached(uint indexed time, uint funding);
    event LogRefund(address indexed contributor, address indexed project, uint indexed amount); 
    event LogPayout(address indexed beneficiary, uint indexed payout);
        
    enum ProjectStatus {
        Active, 
        Expired, 
        Closed
    }

    enum FundingStage {
        Open,
        FundingRaised,
        CapReached, 
        EarlySuccess,
        Success,
        PaidOut,
        Failed
    }    
                
    uint createdAtBlock;
    uint creationTime;
    uint public deadline; 
    uint public fundingCap; 
    address public beneficiary;

    ProjectStatus status;
    FundingStage stage;  
    FundingToken public fundingToken;  
  
    modifier evalExpiry {
        if (now > creationTime + deadline && 
            status != ProjectStatus.Closed) {
            status = ProjectStatus.Expired;            
        }        
        _;
    } 

    modifier evalFundingStage {
        if (status != ProjectStatus.Closed) {
            if ((stage != FundingStage.CapReached || 
                stage != FundingStage.EarlySuccess) && 
                status == ProjectStatus.Expired) {
                    stage = FundingStage.Failed;
            } else if (stage == FundingStage.CapReached && 
                       status == ProjectStatus.Active) {
                    stage = FundingStage.EarlySuccess;
            } else if (stage == FundingStage.CapReached && 
                       status == ProjectStatus.Expired) {
                    stage = FundingStage.Success;
            }
        }
        _;
    }    

    function Project(address _creator, uint _fundingCap, uint _deadline)
        public 
    {
        beneficiary = _creator; 
        fundingCap = _fundingCap; 
        creationTime = now; 
        deadline = _deadline; 
        fundingToken = new FundingToken();
        stage = FundingStage.Open;
        status = ProjectStatus.Active;
    }   

	function fund(uint _funding, address investor);
	function refund();
	function payout();

    function amountRaised()
        public 
        constant
        returns(uint amount)
    {
        amount = fundingToken.balanceOf(this);
    }

    function projectStatus()
        evalExpiry
        evalFundingStage
        public 
        constant 
        returns (ProjectStatus)
    {
        return status;
    }

    function fundingStage()
        evalExpiry
        evalFundingStage    
        public 
        constant 
        returns (FundingStage)
    {
        return stage;
    }    

    function () {}          
}