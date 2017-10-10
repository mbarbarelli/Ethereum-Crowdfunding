require("file-loader?name=../index.html!../index.html"); 
require("file-loader?name=../styles/fundingHub.css!../styles/fundingHub.css"); 

var ko = require("knockout"); 
const Web3 = require("web3"); 
const Promise = require("bluebird"); 
const truffleContract = require("truffle-contract"); 

const fundingHubJson = require("../../build/contracts/StandardFundingHub.json"); 
const standardProjectJson = require("../../build/contracts/StandardProject.json"); 
const fundingTokenJson = require("../../build/contracts/FundingToken.json"); 

var fundingHub_address;

if(typeof web3 !== 'undefined'){
    window.web3 = new Web3(web3.currentProvider);
} else {
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
}

require("./utils/utils.js"); 

Promise.promisifyAll(web3.eth, {suffix: "Promise"}); 

const FundingHub = truffleContract(fundingHubJson); 
const Project = truffleContract(standardProjectJson); 
const FundingToken = truffleContract(fundingTokenJson); 

FundingHub.setProvider(web3.currentProvider); 
Project.setProvider(web3.currentProvider); 
FundingToken.setProvider(web3.currentProvider); 

let fHub; 

const ZERO = "0x0000000000000000000000000000000000000000";
window.projects = [];
window.projectsAddresses = [];

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

window.addEventListener('load', () => {
    return FundingHub.deployed()
        .then(instance => {
            fHub = instance; 
            fundingHub_address = fHub.address; 
            return web3.eth.getAccountsPromise();            
        })
        .then(accounts => {
            if(accounts.length == 0){
                throw new Error("No accounts detected.");
            } else {
                prepareUI();
                window.accounts = accounts; 
                window.owner = web3.eth.coinbase; 
            }
            return getProjects();  
        })
        .then(() => {
            bindData();
        })
        .catch(e => {
            window.error = e.message; 
            console.log(e.message); 
        });
}); 

const prepareUI = () => {
    $(document).ready(function () {
        $('.modal').modal();
        $('select').material_select();
    });
}

const getProjectAddresses = () => {
    return fHub.projectList.call(ZERO)
        .then(projectHash => {
            return iteratePrjAddresses(projectHash);
        })
        .catch(e => {
            console.error(e.message);
        });
}

const iteratePrjAddresses = (currentPrjHash) => {    
    return Promise.try(() => {
        return fHub.projects.call(currentPrjHash)
    })
    .then(prjAddress => {
        if(prjAddress != ZERO) {
            window.projectsAddresses.push(prjAddress);
            return fHub.projectList.call(currentPrjHash)
                .then(result => {
                    currentPrjHash = result;
                })
                .then(() => {
                    return Promise.try(() => {
                        return iteratePrjAddresses(currentPrjHash);
                    });
                })
                .catch(e => {
                    console.error(e.message);
                })

        } 
    });
}

const getProject = (prjAddress) => {
    let project; 
    var fundingCap, beneficiary, deadline; 
    var status, fundingStage, amountRaised; 
    var fundingToken; 

    return Project.at(prjAddress)
        .then(instance => {
            project = instance;
            return project.fundingCap()
        })
        .then(_cap => {
            fundingCap = _cap; 
            return project.deadline()
        })
        .then(_deadline => {
            deadline = _deadline;
            return project.beneficiary()
        })
        .then(_beneficiary => {
            beneficiary = _beneficiary;
            return project.projectStatus()
        })
        .then(_status => {
            status = _status;
            return project.fundingStage()
        })
        .then(_stage => {
            fundingStage = _stage;
            return project.fundingToken()
        })
        .then(_token => {
            fundingToken = _token;
            return project.amountRaised()
        })
        .then(_amountRaised => {
            amountRaised = _amountRaised;
            window.projects.push({
                address: project.address, 
                fundingCap: fundingCap, 
                deadline: deadline,
                amountRaised: amountRaised,
                beneficiary: beneficiary, 
                status: status, 
                fundingStage: fundingStage, 
                fundingToken: fundingToken
            });            
        })
        .catch(e => {
            console.log(e.message);
        })
}

const getProjects = () => {
    window.projects = [];
    window.projectsAddresses = [];
    var promises = [];

    return getProjectAddresses()
        .then(() => {
            $.each(window.projectsAddresses, function (i, address) {
                promises.push(getProject(address))
            });
            return Promise.all(promises)
        })
}

const lookup = (obj, value) => {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            if(obj[key] == value){
                return key;
            }
        }
    }
}

const bindData = () => {
    ko.bindingHandlers["materializeSelect"] = {
        after: ['options'],
        init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            $(element).material_select();
            var boundValue = valueAccessor();
            boundValue.options.subscribe(function () {
                $(element).material_select();
            });
        },
        update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        }
    };

    function ProjectData(data) {
        this.address = ko.observable(data.address);
        this.beneficiary = ko.observable(data.beneficiary);
        this.fundingCap = ko.observable(data.fundingCap);
        this.deadline = ko.observable(data.deadline);
        this.fundingStage = ko.observable(data.fundingStage);
        this.fundingToken = ko.observable(data.fundingToken);
        this.status = ko.observable(data.status);
        this.amountRaised = ko.observable(data.amountRaised);
        this.fundingStageLookup = ko.computed(() => {
            return lookup(FundingStage, this.fundingStage());  
        });
        this.statusLookup = ko.computed(() => {
            return lookup(ProjectStatus, this.status());  
        });       
    }

    function AccountData(data) {
        this.address = ko.observable(data);
    }

    function ViewModel() {
        var self = this;
        self.projectData = ko.observableArray([]);
        self.accounts = ko.observableArray(window.accounts);
        self.projectCreator = ko.observable();
        self.fundingCap = ko.observable();
        self.deadline = ko.observable();
        self.currentProjectAddress = ko.observable();
        self.contributionAmount = ko.observable();
        self.contributor = ko.observable(); 
       
        self.mapProjectData = (data) => {
            return $.map(data, function (item) { return new ProjectData(item) });
        }
        
        self.createProject = () => {
            self.projectData([]);
            $('#mdlCreateProject').modal('close');
            return fHub.createProject.sendTransaction(self.fundingCap(), self.deadline(), 
                {from: self.projectCreator(), gas:2000000})
                .then((txHash => {
                    return web3.eth.getTransactionReceiptMined(txHash);
                }))
                .then(receipt => {                    
                    return getProjects();
                })
                .then(() => {
                    self.projectData(self.mapProjectData(window.projects));
                })
                .catch(e => {
                    console.log(e.message);
                })
        }

        self.setCurrentProjectAddress = (item) => {
            self.currentProjectAddress(item.address());
        }

        self.projectContribute = () => {
            let project, token; 

            $('#mdlContribute').modal('close');
            self.projectData([]);
            return Project.at(self.currentProjectAddress())
                .then(instance => {
                    project = instance; 
                    return project.fundingToken()                    
                })
                .then(_token_address => {
                    return FundingToken.at(_token_address)
                })
                .then(instance => {
                    token = instance;                     
                    return token.deposit.sendTransaction({from: self.contributor(), value: Number(self.contributionAmount())})
                })
                .then(txHash => {
                    return web3.eth.getTransactionReceiptMined(txHash);
                })
                .then(receipt => {
                    return token.approve(self.currentProjectAddress(), self.contributionAmount(), {from: self.contributor()});
                })
                .then(() => {
                    return fHub.contribute.sendTransaction(self.currentProjectAddress(), Number(self.contributionAmount()), {from: self.contributor(), gas:2000000})
                })
                .then(txHash => {
                    return web3.eth.getTransactionReceiptMined(txHash)
                })
                .then(receipt => {                    
                    return getProjects();
                })
                .then(() => {
                    self.projectData(self.mapProjectData(window.projects));
                })
                .catch(e => {
                    console.error(e.message);
                });
        }                

        self.projectData(self.mapProjectData(window.projects));
    }
    ko.applyBindings(new ViewModel());
}