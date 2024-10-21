const { parentPort } = require('worker_threads');
const { SerialPort } = require('serialport');
const osc = require("osc");

let oscSlip = undefined;

// parentPort.postMessage({ type: 'sync', data: { state: 'closed' } });
let slipSettings= {
    path:"", 
    baud:115200, 
    
};

let slipSync = {
    type:'sync',
    settings:slipSettings,
    paths:[],
    state:"closed",
    msg:''
}


function oscSlipOnClose() {
    // THIS SHOULD ONLY BE CALLLED only IF THE SERIAL WAS PHYSICALLY DISCONNECTED
    
    oscSlip = undefined;
    slipSync.state = "error";
    slipSync.msg = "Serial was disconnect";
    parentPort.postMessage(slipSync);
    //oscSlip = undefined;
}

function oscSlipOnOpen() {
    slipSync.state =  "opened";
    slipSync.msg = "Opened slip port "+slipSettings.path+" with baud "+slipSettings.baud;
    parentPort.postMessage(slipSync);
    oscSlip.on("close", oscSlipOnClose);
}

function oscSlipClose(errorFlag) {
    errorFlag =  errorFlag || false;
    if ( oscSlip ) {
        oscSlip.off("close", oscSlipOnClose); // SO THE CALLBACK IS NOT CALLED WHEN WE CLOSE OURSELVES
        oscSlip.close();
        oscSlip = undefined;
        slipSync.state = "closed";
        slipSync.msg = "Serial was closed";
        parentPort.postMessage(slipSync);
    }
}

// ONE ERROR IS CALLED IF TRY TO CLOSSE AN UNOPENED
function oscSlipOnError(error) {

    if ( error.message == "Port is not open" || error.message.includes("Access denied") || error.message == undefined) {
        oscSlip = undefined;
        slipSync.state = "error";
        slipSync.msg = "Serial SLIP error (port missing or opened by another application)!";
        parentPort.postMessage(slipSync);
    } else {
        console.log("error.message: " + error.message);
        console.log("error.stack: " + error.stack);
        console.log("error.name: " + error.name);
    }
}

function oscSlipOnMessage (oscMessage) {

    parentPort.postMessage({type: 'osc', msg: oscMessage});

};

function oscSlipOpen(path,baud) {
  
    oscSlipClose();
    slipSettings.path = path;
    slipSettings.baud = baud;
    
    // Instantiate a new OSC Serial Port.
    oscSlip = new osc.SerialPort({
        devicePath: slipSettings.path, 
        bitrate: slipSettings.baud, 
        metadata: true
    });
      
    // Listen for the message event and map the OSC message to the synth.
    oscSlip.on("open", oscSlipOnOpen); //slip.path = data.path;
    oscSlip.on("error", oscSlipOnError);
    oscSlip.on("message", oscSlipOnMessage);
  
    //oscSlip.on("raw", oscSlipOnRaw);
    
    // Open the port.
    oscSlip.open();

}

/*
async function getSerialPaths() {
    let paths = [];
    await SerialPort.list().then((ports, err) => {
        if(err) {
            return paths;
        } 
        if (ports.length > 0) {
            ports.forEach(function (port) {
                paths.push(port.path);
            });
        }
        
    })
    
    return paths;
}

slipSync.paths= await getSerialPaths();
*/

slipSync.paths = [];
SerialPort.list().then((ports, err) => {
    if(err) {
        return ;
    } 
    if (ports.length > 0) {
        ports.forEach(function (port) {
            slipSync.paths .push(port.path);
        });
    }
    
})



parentPort.on('message', (msg) => {
    if (msg.type === 'open') {
      oscSlipOpen(msg.settings.path, msg.settings.baud);
    } else if (msg.type === 'close') {
        oscSlipClose();
    } else if ( msg.type === 'syncrequest') {
        parentPort.postMessage(slipSync);
    }
  });