


async function getSerialPorts() {
    serialPortsArray = [];
    await SerialPort.list().then((ports, err) => {
        if(err) {
          return serialPortsArray;
        } 
        if (ports.length > 0) {
            ports.forEach(function (port) {
                serialPortsArray.push(port.path);
            });
        }

    })
    return serialPortsArray;
}

function oscSlipOnMessage (oscMessage) {
    //console.log(oscMessage);
    if ( oscUdp) {
        oscUdp.send(oscMessage, udpSendIp, udpSendPort);
    }
};

function disconnectSerialPort() {
    oscSlip.close();
    oscSlip = undefined;
    serialConnectButton.innerText = '🔌 Connect Serial';
}

function oscSlipOnOpen() {
    serialConnectButton.innerText = '🔌 Disconnect Serial';
}

function oscSlipOnError() {
    console.log("Error");
    serialConnectButton.innerText = '🔌 Connect Serial';
}

function connectSerialPort() {

    const selectedPortPath =  serialPortSelector.value;
    console.log(selectedPortPath);    

    // Instantiate a new OSC Serial Port.
    oscSlip = new osc.SerialPort({
        devicePath: selectedPortPath, 
        bitrate:115200, 
        metadata: true
    });

    // Listen for the message event and map the OSC message to the synth.
    oscSlip.on("message", oscSlipOnMessage);
    oscSlip.on("open", oscSlipOnOpen);
    oscSlip.on("error", oscSlipOnError);

    // Open the port.
    oscSlip.open();
};

