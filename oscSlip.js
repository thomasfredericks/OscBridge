// All of the Node.js APIs are available in this process.
    const serialConnectButton = document.getElementById ('connect-serial-button');
    const serialPortSelector = document.getElementById ('serial-port-selector');

    const { SerialPort } = require('serialport');
    //const tableify = require('tableify');
    
    async function listSerialPorts() {
      await SerialPort.list().then((ports, err) => {
        if(err) {
          document.getElementById('error').textContent = err.message
          return
      } else {
          document.getElementById('error').textContent = ''
      }
      console.log('ports', ports);

      if (ports.length === 0) {
          document.getElementById('error').textContent = 'No ports discovered'
      } else {
        serialConnectButton.disabled = false;
        // Empty the selector... this is gross how this is done...
        serialPortSelector.innerHTML = "";
        // Fill the selector
        ports.forEach(function (port) {
            //const label = port.displayName || port.path;
            const option = document.createElement("option");
            //option.text = port.displayName || port.path;
            option.text = port.path;
            //option.value = "3"; // Optionally set a value
            serialPortSelector.add(option);

            //let option = $("<option value=" + "'" + port.path + "'>" + label + "</option>");
            //serialPortSelector.append(option);
        });
    }

    //tableHTML = tableify(ports)
    //document.getElementById('ports').innerHTML = tableHTML
})
  }


/*

//
// Set a timeout that will check for new serialPorts every 2 seconds.
// This timeout reschedules itself.
function listPorts() {
  listSerialPorts();
  setTimeout(listPorts, 2000);
}
setTimeout(listPorts, 2000);
*/
  listSerialPorts();

function oscSlipOnMessage (oscMessage) {
    console.log(oscMessage);
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
        devicePath: selectedPortPath, bitrate:115200
    });

    // Listen for the message event and map the OSC message to the synth.
    oscSlip.on("message", oscSlipOnMessage);
    oscSlip.on("open", oscSlipOnOpen);
    oscSlip.on("error", oscSlipOnError);

    // Open the port.
    oscSlip.open();
};

serialConnectButton.addEventListener('click', function () {
    if ( oscSlip ) {
        disconnectSerialPort();
    } else {
        connectSerialPort();
    }
});