function getEventSignature(abi, name) {
    for (var i = 0; i < abi.length; i++) {
      var item = abi[i];
      if (item.type != "event") continue;
        if (item.name === name)
            var signature = item.name + "(" + item.inputs.map(function (input) { return input.type; }).join(",") + ")";
    }    
    return signature;
}

function getParamFromTxEvent(transaction, paramName, contractFactory, eventName) {    
    //console.log(transaction);
    assert.isObject(transaction)
    let logs = transaction.logs
    if(eventName != null) {
        logs = logs.filter((l) => l.event === eventName)
    }
    assert.equal(logs.length, 1, 'too many logs found!')
    
    let param = logs[0].args[paramName]
     
    if(contractFactory != null) {
        let contract = contractFactory.at(param)
        assert.isObject(contract, `getting ${paramName} failed for ${param}`)
        return contract
    } else {
        return param
    }
}

async function assertRejects(q, msg) {
    let res, catchFlag = false
    try {
        res = await q
    } catch(e) {
        catchFlag = true
    } finally {
        if(!catchFlag)
            assert.fail(res, null, msg)
    }
}

function delay(delay) {
  return new Promise(function (resolve) {
    setTimeout(resolve, delay)
  })
}

module.exports = {
    getEventSignature, 
    getParamFromTxEvent, 
    assertRejects, 
    delay
}
