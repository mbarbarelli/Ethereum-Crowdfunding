pragma solidity ^0.4.11; 

import '../Projects/Project.sol'; 
import "../Utils/Math.sol";

contract StandardProject is Project {
        
    function StandardProject(address _creator, uint _fundingCap, uint _deadline)        
        public 
        Project(_creator, _fundingCap, _deadline)        
    {

    }

    function fund(uint _funding, address investor) 
        evalExpiry
        evalFundingStage
        public
    {
        require(stage == FundingStage.Open || 
                stage == FundingStage.FundingRaised);

        // Reduce contribution amount if it exceeds funding cap, or overflows
        if (amountRaised() + _funding > fundingCap || 
            amountRaised() + _funding < amountRaised()) {
            _funding = fundingCap - amountRaised();
        }
 
        require(fundingToken.contribute(_funding, investor) && 
                fundingToken.transferFrom(investor, this, _funding));

        LogProjectContributed(investor, _funding);

        if (amountRaised() == fundingCap) {
            stage = FundingStage.CapReached;             
            LogFundingCapReached(now, _funding);            
        } else {
            stage = FundingStage.FundingRaised; 
        }
    }    

    function refund()
        evalExpiry
        evalFundingStage
        public 
    {
        require(stage == FundingStage.Failed);
        uint toRefund = fundingToken.contributionOf(msg.sender);
        require(fundingToken.transfer(msg.sender, toRefund));       
        LogRefund(msg.sender, this, toRefund); 
    }

    function payout() 
        evalExpiry
        evalFundingStage
        public
    {
        require(stage == FundingStage.Success || 
                stage == FundingStage.EarlySuccess);
        
        uint payOut = fundingToken.balanceOf(this);
        require(fundingToken.transfer(beneficiary, payOut));
        stage = FundingStage.PaidOut;
        status = ProjectStatus.Closed;
        LogPayout(beneficiary, payOut);
    }
}