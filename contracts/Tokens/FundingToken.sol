pragma solidity ^0.4.11;

import "../Tokens/Token.sol";
import "../Utils/Math.sol";

contract FundingToken is Token {
    using Math for *;

    event LogDeposit(address indexed account, uint indexed amount);
    event LogWithdrawal(address indexed account, uint indexed amount); 

    mapping (address => uint) balances;
    mapping (address => uint) contributions;
    mapping (address => mapping (address => uint)) allowances;
    
    uint totalTokens;

    function deposit()
        public
        payable
    {
        balances[msg.sender] = balances[msg.sender].add(msg.value);
        totalTokens = totalTokens.add(msg.value);
        LogDeposit(msg.sender, msg.value);
    }    

    function withdraw(uint value)
        public
    {
        balances[msg.sender] = balances[msg.sender].sub(value);
        totalTokens = totalTokens.sub(value);
        msg.sender.transfer(value);
        LogWithdrawal(msg.sender, value);
    }    

    function transfer(address to, uint value)
        public
        returns (bool)
    {
        if (!balances[msg.sender].safeToSub(value) || 
            !balances[to].safeToAdd(value))
            return false;
        balances[msg.sender] -= value;
        balances[to] += value;
        Transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint value)
        public
        returns (bool)
    {
        if (!balances[from].safeToSub(value) || 
            !allowances[from][msg.sender].safeToSub(value) || 
            !balances[to].safeToAdd(value))
            return false;
        balances[from] -= value;
        allowances[from][msg.sender] -= value;
        balances[to] += value;
        Transfer(from, to, value);
        return true;
    }

    function approve(address spender, uint value)
        public
        returns (bool)
    {
        allowances[msg.sender][spender] = value;
        Approval(msg.sender, spender, value);
        return true;
    }

    function contribute(uint value, address contributor) 
        public 
        returns (bool)
    {
        if (!contributions[contributor].safeToAdd(value))
            return false; 
        contributions[contributor] += value;
        return true;
    }    

    function allowance(address owner, address spender)
        public
        constant
        returns (uint)
    {
        return allowances[owner][spender];
    }

    function balanceOf(address owner)
        public
        constant
        returns (uint)
    {
        return balances[owner];
    }

    function contributionOf(address contributor)
        public 
        constant 
        returns (uint)
    {
        return contributions[contributor];
    }

    function totalSupply()
        public
        constant
        returns (uint)
    {
        return totalTokens;
    }
}
