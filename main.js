const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const settings = require('electron-settings');
const { SerialPort } = require('serialport');
const osc = require("osc");
const os = require("os");
const WebSocket = require("ws");

//const serial = require("./serial.js");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
/*
let defaultSettings = {
    serialPath : "", 
    udpSendPort : 8001,
    udpReceivePort : 8000,
    udpSendIp : "127.0.0.1",
};


let options = {
    serialPortsArray: []
}


let status = {
    serialConnected: false,
    udpConnected: false
}
*/

// SERIAL
/////////

let oscSlip = undefined;

let serial = {
    path:"", 
    baud:115200, 
    paths:[],
    state:"closed"
};

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
/*
function oscSlipOnRaw(data,packetInfo) {
    //console.log(`Received serial message: ${data}`);
    if ( oscUdp )  oscUdp.sendRaw(data);
    clients.forEach((client) => {
        
          client.sendRaw(data);
    });

    
}
*/

function oscSlipOnMessage (oscMessage) {
    if ( oscUdp )  oscUdp.send(oscMessage);
    clients.forEach((client) => {
        
          client.send(oscMessage);
    });
    
};


function oscSlipOnOpen() {
    serial.state = "opened";
    //serialConnectButton.innerText = '🔌 Disconnect Serial';
    console.log("Opened serial port "+serial.path+" with baud "+serial.baud);
    mainWindow.webContents.send('message', {target:"serial",cmd:"status", args:{serial:serial}});
}



function oscSlipClose(fromError) {
    fromError =  fromError || false;
    if ( oscSlip ) {
        oscSlip.close();
        oscSlip = undefined;
        if ( fromError == true ) {
            serial.state = "error";
        } else {
            
            serial.state = "closed";
        }
        mainWindow.webContents.send('message', {target:"serial",cmd:"status", args:{serial:serial}});
    }
}

function oscSlipOnError(error) {
    console.log(error);
    oscSlipClose(true);
}

function oscSlipOpen(path,baud) {
    
    oscSlipClose();
    serial.path = path;
    serial.baud = baud;
    
    // Instantiate a new OSC Serial Port.
    oscSlip = new osc.SerialPort({
        devicePath: serial.path, 
        bitrate: serial.baud, 
        metadata: true
    });
    
    // Listen for the message event and map the OSC message to the synth.
    oscSlip.on("open", oscSlipOnOpen); //serial.path = data.path;
    oscSlip.on("error", oscSlipOnError);
    oscSlip.on("message", oscSlipOnMessage);
    //oscSlip.on("raw", oscSlipOnRaw);
    
    // Open the port.
    oscSlip.open();
}



// UDP
/////////

let udp =  {
    sendPort: 8001,
    receivePort: 8000,
    sendIp: "127.0.0.1",
    state: "closed"
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


function oscUdpClose(fromError) {
    fromError =  fromError || false;
    if ( oscUdp) {
        oscUdp.close();
        oscUdp = undefined;
        if ( fromError ) {
            udp.state = "error";
        } else {
            
            udp.state = "closed";
        }
        mainWindow.webContents.send('message', {target:"udp",cmd:"status", args:{udp:udp}});
    }

}

function oscUdpOnError(error) {
    console.log(error);
    oscUdpClose(true);
}

function oscUdpOnReady() {
    // udpConnectButton.innerText = '📢 Disconnect UDP';
    udp.state = "opened";
    var ipAddresses = getIPAddresses();
    
    console.log("Started UDP and listening on the following ports: ");
    ipAddresses.forEach(function (address) {
        console.log(" Host:", address + ", Port:", oscUdp.options.localPort);
    });
    mainWindow.webContents.send('message', {target:"udp",cmd:"status", args:{udp:udp}});
    
}


/*
function oscUdpOnRaw(data,packetInfo) {
    console.log(`Received udp message: ${data}`);
    if ( oscSlip )  {
        console.log(`Sending to serial: ${data}`);
        oscSlip.sendRaw(data);
    }
    clients.forEach((client) => {
        client.sendRaw(data);
    });
}
*/

function oscUdpOnMessage(message) {
    
 //console.log(`Received udp message: ${message}`);
    if ( oscSlip )  {
        //console.log(`Sending to serial: ${message}`);
        oscSlip.send(message);
    }
    clients.forEach((client) => {
        client.send(message);
    });
    
}



function oscUdpOpen(receivePort, sendIp, sendPort) {
    
    oscUdpClose();
    udp.receivePort = receivePort;
    udp.sendIp = sendIp;
    udp.sendPort = sendPort;
    
    oscUdp = new osc.UDPPort({
        localAddress: "0.0.0.0",
        localPort: udp.receivePort,
        metadata: true,
        remotePort: udp.sendPort,
        remoteAddress: udp.sendIp
    });
    oscUdp.on("ready", oscUdpOnReady);
    
    oscUdp.on("message", oscUdpOnMessage);
    //oscUdp.on("raw", oscUdpOnRaw);
    
    oscUdp.on("error", oscUdpOnError);
    
    oscUdp.open();
}


// WEBSOCKET
////////////

let websocket =  {
    port: 8080 ,
    state: "closed"
}

const clients = new Set();

let wss;

function oscWebSocketClose() {
    if ( wss) {
        clients.clear();
        wss.close();
        wss = undefined;
        websocket.state = "closed";
        mainWindow.webContents.send('message', {target:"websocket",cmd:"status", args:{websocket:websocket}});
    }
}

function oscWebSocketOpen(port) {
    
    oscWebSocketClose();
    wss = new WebSocket.Server({ port: websocket.port });
    websocket.state = "opening";
    mainWindow.webContents.send('message', {target:"websocket",cmd:"status", args:{websocket:websocket}});

    wss.on('listening', () => {
        console.log('WebSocket server is listening on port '+websocket.port);
        websocket.state = "opened";
        mainWindow.webContents.send('message', {target:"websocket",cmd:"status", args:{websocket:websocket}});
      });
    
    // Listen for connection events
    wss.on('connection', (ws) => {
        console.log('A new WebSocket client connected!');
        

        let oscWebSocket = new osc.WebSocketPort({
            socket: ws,
            metadata: true
        });
        
        // Add the new oscWebSocket to the set
        clients.add(oscWebSocket);
        //console.log(clients.size);


        // Listen for messages from the client
/*
        oscWebSocket.on('raw', (data,packetInfo) => {
            console.log(`Received webscoket message: ${data}`);
            // Echo the message back to the client
            //ws.send(`You said: ${message}`);
            clients.forEach((client) => {
                if (client !== oscWebSocket && client.readyState === WebSocket.OPEN) {
                  client.sendRaw(data);
                }
            });
            if ( oscSlip )  oscSlip.sendRaw(data);
            if ( oscUdp)  oscUdp.sendRaw(data);
        });
*/

oscWebSocket.on('message', (message) => {
   // console.log('Received WebSocket message');
   // console.log(message);
    // Echo the message back to the client
    //ws.send(`You said: ${message}`);

    clients.forEach((client) => {
        if (client !== oscWebSocket ) {
          client.send(message);
        }
    });
    if ( oscSlip )  oscSlip.send(message);
    if ( oscUdp)  oscUdp.send(message);
});
        
        // Handle connection close
        oscWebSocket.on('close', () => {
            console.log('A WebSocket client disconnected');
            // Remove the client from the set
            clients.delete(oscWebSocket);
            //console.log(clients.size);
        });
        
        // Send a welcome message to the client
        //ws.send('Welcome to the WebSocket server!');
    });
}

// WINDOW
//////////

function createWindow() {
    
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 260,
        height: 600, 
        backgroundColor: "#ccc",
        webPreferences: {
            nodeIntegration: true, // to allow require
            contextIsolation: false, // allow use with Electron 12+
            enableRemoteModule: true // For Electron v10+, if you want to use electron-settings within a browser window, 
        }
    })
    
    // Handle message from renderer process
    ipcMain.on('message', (event, data) => {
        
        if ( data.target == "global") {
            if ( data.cmd == "status" ) {
                mainWindow.webContents.send('message', {target:"global",cmd:"status",args:{udp: udp, serial:serial,websocket:websocket}});
            }
        } else if ( data.target == "serial") {
            if ( data.cmd == "open" ) {
                //console.log(data);
                oscSlipOpen(data.args.path ,data.args.baud);
            } else if ( data.cmd == "close") {
                oscSlipClose();
            }
        } else if ( data.target == "udp") {
            if ( data.cmd == "open" ) {
                oscUdpOpen(data.args.receivePort ,data.args.sendIp, data.args.sendPort);
            } else if ( data.cmd == "close") {
                oscUdpClose();
            }
        } else if ( data.target == "websocket") {
            if ( data.cmd == "open" ) {
                oscWebSocketOpen(data.args.port);
            } else if ( data.cmd == "close") {
                oscWebSocketClose();
            }
        }
        
        //console.log('Data received in the main process:', data);
        // You can process the data here and send a response back if needed
    });
    
    
    
    // and load the index.html of the app.
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }))
    
    // Open the DevTools.
    //mainWindow.webContents.openDevTools()
    
    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })
    
    
}
/*
function getSettingValue ( name, defaultValue) {
    if ( storage.hasSync(name) ) return storage.getSync(name);
    else return defaultValue;
}
*/


/*
// Yes settings is alreay an object but just to make sure... and remove all functions
function settingsToObject() {
    let settingsCopy = {};
    Object.keys(defaultSettings).forEach(key => {
        settingsCopy[key] = settings.getSync(key);
    });
    return settingsCopy;
}

function settingsToJson() {
    return JSON.stringify(settingsToObject());
}

function loadSettings() {
    // LOAD DEFAUTLS INTO SETTINGS
    Object.keys(defaultSettings).forEach(key => {
        if (!settings.hasSync(key)) {
            settings.setSync(key, defaultSettings[key]);
        }
    });
}
*/


async function start() {
    //loadSettings();
    serial.paths= await getSerialPaths();
    createWindow();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', start)

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    app.quit()
})

app.on('activate', function() {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
