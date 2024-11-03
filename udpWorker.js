
const { parentPort } = require('worker_threads');

// Import the dgram module
const dgram = require('dgram');

// UDP
/////////

let udpSettings =  {
    sendPort: 8001,
    receivePort: 8000,
    sendIp: "127.0.0.1"
    
}

let udpStatus = {
    state: "closed"
}

let udpSync = {
    settings: udpSettings,
    status: udpStatus,
    type:"udp"
}

let oscUdp;

function getIPAddresses() {
    
    const interfaces = os.networkInterfaces();
    const ipAddresses = [];
    
    for (let deviceName in interfaces) {
        let addresses = interfaces[deviceName];
        for (let i = 0; i < addresses.length; i++) {
            let addressInfo = addresses[i];
            if (addressInfo.family === "IPv4" && !addressInfo.internal) {
                ipAddresses.push(addressInfo.address);
            }
        }
    }
    
    return ipAddresses;
};


function oscUdpClose(errorFlag) {
    errorFlag =  errorFlag || false;
    if ( oscUdp) {
        oscUdp.close();
        oscUdp = undefined;
        if ( errorFlag ) {
            udpStatus.state = "error";
        } else {
            
            udpStatus.state = "closed";
        }
        sendSync("udp",udpSync);
    }
    
}

/*
function oscUdpOnMessage(oscMessage) {

            // Send the updated messages to the monitoring window

            if (monitorUdp && mainWindowIsReady) {
                const now = new Date();
                const time = now.toLocaleTimeString('en-US', monitorDateOptions);
                mainWindow.webContents.send('monitor', {type:"osc-message",data:{source:"UDP",time:time,oscMessage:oscMessage}});
            }
            
            if ( oscSlip )  {
                oscSlip.send(oscMessage);
            }

            clients.forEach((client) => {
                client.send(oscMessage);
            });
    
}
*/

function oscUdpSend(data) {
    oscUdp.send(Buffer.from(data), udpSettings.sendPort , udpSettings.sendIp , (err) => {
        if (err) {
            console.log('Error sending message:', err);
        } else {
            //console.log('Message sent:', data);
        }
        // Close the socket after sending the message
       // oscUdpClose(true);
    });
}

function oscUdpOpen() {
    
    oscUdpClose();

   oscUdp = dgram.createSocket('udp4');

   oscUdp.on('error', (err) => {
    monitorLog("udp error"+error.message);
    oscUdpClose(true);
  });

   oscUdp.on('listening', () => {
    udpStatus.state = "opened";
    var ipAddresses = getIPAddresses();
    
    monitorLog("Started UDP and listening on the following ports: ");
    ipAddresses.forEach(function (address) {
        monitorLog("Host: "+address + " Port: " + udpSettings.receivePort);
    });
    storeSetting("udp",udpSettings);
    sendSync("udp",udpSync);
  });

  oscUdp.on('message', (buf, rinfo) => {
    //console.log(`server got: ${buf} from ${rinfo.address}:${rinfo.port}`);
    if ( oscSlip )  {
        oscSlipSend(buf);
    }
  });

  oscUdp.bind(udpSettings.receivePort);




}

// Listen for messages from the main thread
parentPort.on('message', (msg) => {
    if ( msg.type == 'open') {
        udpSettings = msg.settings;
        oscUdpOpen();
    } else if (msg.type === 'send') {
      // Send a UDP message
      oscUdp.send(msg.data, msg.port, msg.host, (err) => {
        if (err) {
          parentPort.postMessage({ type: 'error', error: err.message });
        } else {
          parentPort.postMessage({ type: 'status', status: 'Message sent' });
        }
      });
    } else if (msg.type === 'close') {
      // Close the UDP socket
      oscUdp.close(() => {
        parentPort.postMessage({ type: 'status', status: 'Socket closed' });
      });
    }
  });