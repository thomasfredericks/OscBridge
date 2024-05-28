const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const electronSettings = require('electron-settings');
const { SerialPort } = require('serialport');
const osc = require("osc");
const os = require("os");
const WebSocket = require("ws");

//const serial = require("./serial.js");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let headless = false;

function sendSync(name,o) {
    if ( mainWindow) mainWindow.webContents.send(name, {type:"sync",data:o});
}

// SERIAL
/////////

let oscSlip = undefined;

let serialSettings= {
    path:"", 
    baud:115200, 
    
};

let serialStatus = {
    paths:[],
    state:"closed"
}

let serialSync = {
    settings:serialSettings,
    status:serialStatus,
    type:"serial"
}

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


function oscSlipOnMessage (oscMessage) {
    if ( oscUdp )  oscUdp.send(oscMessage);
    clients.forEach((client) => {
        
        client.send(oscMessage);
    });
    
};


function oscSlipOnOpen() {
    serialStatus.state = "opened";
    //serialConnectButton.innerText = '🔌 Disconnect Serial';
    console.log("Opened serial port "+serialSettings.path+" with baud "+serialSettings.baud);
    storeSetting("serial",serialSettings);
    sendSync("serial",serialSync);
}



function oscSlipClose(errorFlag) {
    errorFlag =  errorFlag || false;
    if ( oscSlip ) {
        oscSlip.close();
        oscSlip = undefined;
        if ( errorFlag == true ) {
            serialStatus.state = "error";
        } else {
            
            serialStatus.state = "closed";
        }
        sendSync("serial",serialSync);
    }
}

function oscSlipOnError(error) {
    console.log("Serial SLIP error (port missing or opened by another application)!");
    //console.log(error);
    oscSlipClose(true);
}

function oscSlipOpen(path,baud) {
    
    oscSlipClose();
    serialSettings.path = path;
    serialSettings.baud = baud;
    
    // Instantiate a new OSC Serial Port.
    oscSlip = new osc.SerialPort({
        devicePath: serialSettings.path, 
        bitrate: serialSettings.baud, 
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

function oscUdpOnError(error) {
    console.log(error);
    oscUdpClose(true);
}

function oscUdpOnReady() {
    // udpConnectButton.innerText = '📢 Disconnect UDP';
    udpStatus.state = "opened";
    var ipAddresses = getIPAddresses();
    
    console.log("Started UDP and listening on the following ports: ");
    ipAddresses.forEach(function (address) {
        console.log(" Host:", address + ", Port:", oscUdp.options.localPort);
    });
    storeSetting("udp",udpSettings);
    sendSync("udp",udpSync);
    
}


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
    udpSettings.receivePort = receivePort;
    udpSettings.sendIp = sendIp;
    udpSettings.sendPort = sendPort;
    
    oscUdp = new osc.UDPPort({
        localAddress: "0.0.0.0",
        localPort: udpSettings.receivePort,
        metadata: true,
        remotePort: udpSettings.sendPort,
        remoteAddress: udpSettings.sendIp
    });
    oscUdp.on("ready", oscUdpOnReady);
    
    oscUdp.on("message", oscUdpOnMessage);
    //oscUdp.on("raw", oscUdpOnRaw);
    
    oscUdp.on("error", oscUdpOnError);
    
    oscUdp.open();
}


// WEBSOCKET
////////////

let websocketSettings =  {
    port: 8080
    
}

let websocketStatus = {
    state: "closed"
}

let websocketSync = {
    settings:websocketSettings,
    status:websocketStatus,
    type:"websocket"
}

const clients = new Set();

let wss;

function oscWebSocketClose() {
    if ( wss) {
        clients.clear();
        wss.close();
        wss = undefined;
        websocketStatus.state = "closed";
        sendSync("websocket",websocketSync);
    }
}

function oscWebSocketOpen(port) {
    
    oscWebSocketClose();
    wss = new WebSocket.Server({ port: websocketSettings.port });
    websocketStatus.state = "opening";
    sendSync("websocket",websocketSync);
    
    wss.on('listening', () => {
        console.log('WebSocket server is listening on port '+websocketSettings.port);
        websocketStatus.state = "opened";
        storeSetting("websocket",websocketSettings);
        sendSync("websocket",websocketSync);
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
        
    });
}



// WINDOW
//////////

function listenWindowMessages() {
    // Handle message from renderer process
    ipcMain.on('global', (event, msg) => {
        
        if ( msg.type == "sync" ) {
            sendSync("global", {serial:serialSync,udp:udpSync,websocket:websocketSync});
            
        } else {
            console.log("ipcMain received unknow message");
        }
    });
    
    ipcMain.on('command', (event, msg) => {
        
        if ( msg.target == "serial") {
            if ( msg.type == "open" ) {
                oscSlipOpen(msg.args.path ,msg.args.baud);
            } else if ( msg.type == "close") {
                oscSlipClose();
            } else {
                console.log("ipcMain received unknow message");
            }
        } else if (  msg.target == "udp" ) {
            if ( msg.type == "open" ) {
                oscUdpOpen(msg.args.receivePort ,msg.args.sendIp, msg.args.sendPort);
            } else if ( msg.type == "close") {
                oscUdpClose();
            }  else {
                console.log("ipcMain received unknow message");
            }
        } else if ( msg.target == "websocket" ) {
            if ( msg.type == "open" ) {
                oscWebSocketOpen(msg.args.port);
            } else if ( msg.type == "close") {
                oscWebSocketClose();
            } else {
                console.log("ipcMain received unknow message");
            }
            
        } 
        else {
            console.log("ipcMain received unknow message");
        }
    });
}

function createWindow() {
    
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 260,
        height: 600, 
        backgroundColor: "#ccc",
        webPreferences: {
            nodeIntegration: true, // to allow require
            contextIsolation: false, // allow use with Electron 12+
            enableRemoteModule: false // For Electron v10+, if you want to use electron-settings within a browser window, set to true 
        }
    })
    
    
    listenWindowMessages();
    
    
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

// SETTINGS
////////////

function storeSetting(name,o) {
    
    electronSettings.setSync(name,o);
}

function loadSetting(name,o) {
    if (electronSettings.hasSync(name)) {
        let settingObject = electronSettings.getSync(name);
        Object.keys(o).forEach(key => {
            if ( key in settingObject ) {
                o[key] = settingObject[key];
                console.log("Found "+key+" for "+name+" as "+o[key] );
            }
            
        });
        return true;
    } else {
        return false;
    }
    
}

// MAIN
////////

async function start() {
    serialStatus.paths= await getSerialPaths();
    // LOAD SETTINGS AND AUTO-CONNECT IF SETTINGS ARE FOUND
    if ( loadSetting("serial",serialSettings) ) oscSlipOpen(serialSettings.path, serialSettings.baud);
    if ( loadSetting("udp",udpSettings) ) oscUdpOpen(udpSettings.receivePort, udpSettings.sendIp, udpSettings.sendPort);
    if ( loadSetting("websocket",websocketSettings) ) oscWebSocketOpen(websocketSettings.port) ;
    
    //const args = process.argv.slice(2); // Skip the first two elements
    const args = process.argv;
    headless = args.includes('--headless');
    
    if (headless) {
        console.log('Running in headless mode');
        
    } else {
        createWindow();
    }
}

// This method will be called when Electron has finished    
// initialization and is ready to create browser windows.np
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
        createWindow();
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
