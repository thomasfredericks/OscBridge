const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const url = require('url');
const electronSettings = require('electron-settings');
const { SerialPort } = require('serialport');
const osc = require("osc");
const os = require("os");
const WebSocket = require("ws");
const slip = require("slip");


const udpWorker = new Worker(path.resolve(__dirname, 'udpWorker.js'));

//const serial = require("./serial.js");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
//let monitorWindow = undefined;
let headless = false;

let mainWindowIsReady = false;

function sendSync(name,o) {
    if ( mainWindowIsReady ) mainWindow.webContents.send(name, {type:"sync",data:o});
}

// MONITOR
//////////

let monitorSerial = false;
let monitorUdp = false;
let monitorWebsocket = false;

const monitorDateOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false // Set to true for 12-hour format with AM/PM
  };

function monitorLog(msg) {
    console.log(msg);
    if (mainWindowIsReady) {
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', monitorDateOptions);
        mainWindow.webContents.send('monitor', {type:"log",data:{time:time,msg:msg}});
    }
}



// SERIAL
/////////

// https://www.npmjs.com/package/slip

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


function oscSlipOnMessage (msg) {

    if ( msg.length % 4 != 0) console.log("Error");
    
    //if ( oscUdp )  oscUdpSend(msg);
    
    //console.log("A SLIP message was received! Here is it: " + msg);
            // Send the updated messages to the monitoring window
            /*
            if (monitorSerial && mainWindowIsReady) {
                
                const now = new Date();
                
                const time = now.toLocaleTimeString('en-US', monitorDateOptions);
               
                mainWindow.webContents.send('monitor', {type:"osc-message", data:{source:"Serial",time:time,oscMessage:oscMessage}});
            }
 
            if ( oscUdp )  oscUdp.send(oscMessage);
    
            clients.forEach((client) => {
                client.send(oscMessage);
            });
    */
};


var slipDecoder = new slip.Decoder({
    onMessage: oscSlipOnMessage,
    maxMessageSize: 209715200,
    bufferSize: 2048
});


function oscSlipSend(buf) {
   
    let encoded = slip.encode(buf);
    
    oscSlip.write(encoded);
}

function oscSlipOnClose() {
    // THIS SHOULD ONLY BE CALLLED only IF THE SERIAL WAS PHYSICALLY DISCONNECTED
    monitorLog("Serial was disconnect");
    oscSlip = undefined;
    serialStatus.state = "error";
    sendSync("serial",serialSync);
    //oscSlip = undefined;
}

function oscSlipClose(errorFlag) {
    errorFlag =  errorFlag || false;
    if ( oscSlip ) {
        oscSlip.off("close", oscSlipOnClose); // SO THE CALLBACK IS NOT CALLED WHEN WE CLOSE OURSELVES
        oscSlip.close();
        oscSlip = undefined;
        serialStatus.state = "closed";
        sendSync("serial",serialSync);
        monitorLog("Serial was closed");
    }
}


function oscSlipOpen(path,baud) {

    console.log(path);
    
    oscSlipClose();
    serialSettings.path = path;
    serialSettings.baud = baud;
    
    // Instantiate a new OSC Serial Port.

    oscSlip = new SerialPort({path: serialSettings.path , baudRate: serialSettings.baud ,  autoOpen: false});
    
    // Listen for the message event and map the OSC message to the synth.
    //oscSlip.on("open", oscSlipOnOpen); //serial.path = data.path;


    oscSlip.on('error', (error) => {
        if ( error.message == "Port is not open" || error.message.includes("Access denied") || error.message == undefined) {
            monitorLog("Serial SLIP error (port missing or opened by another application)!");
            oscSlip = undefined;
            serialStatus.state = "error";
            sendSync("serial",serialSync);
        } else {
            console.log("error.message: " + error.message);
            console.log("error.stack: " + error.stack);
            console.log("error.name: " + error.name);
        }
    });

    oscSlip.on('data', (data) => {    
        // Feed incoming data to the SLIP decoder
        slipDecoder.decode(data);
    });

    
    // Open the port
    oscSlip.open((err) => {
        if (err) {
            return console.log('Error opening port:', err.message);
        }
        
        serialStatus.state = "opened";
        //serialConnectButton.innerText = '🔌 Disconnect Serial';
        monitorLog("Opened serial port "+serialSettings.path+" with baud "+serialSettings.baud);
        storeSetting("serial",serialSettings);
        sendSync("serial",serialSync);
        oscSlip.on("close", oscSlipOnClose);
    });
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
        monitorLog('WebSocket server is listening on port '+websocketSettings.port);
        websocketStatus.state = "opened";
        storeSetting("websocket",websocketSettings);
        sendSync("websocket",websocketSync);
    });
    
    // Listen for connection events
    wss.on('connection', (ws) => {
        monitorLog('A new WebSocket client connected!');
        
        
        let oscWebSocket = new osc.WebSocketPort({
            socket: ws,
            metadata: true
        });
        
        // Add the new oscWebSocket to the set
        clients.add(oscWebSocket);
        //console.log(clients.size);
        
        oscWebSocket.on('message', (oscMessage) => {
            // console.log('Received WebSocket message');
            // console.log(message);
            // Echo the message back to the client
            //ws.send(`You said: ${message}`);

            // Send the updated messages to the monitoring window
          
            // Send the updated messages to the monitoring window

            if (monitorWebsocket && mainWindowIsReady) {
                const now = new Date();
                const time = now.toLocaleTimeString('en-US', monitorDateOptions);
                mainWindow.webContents.send('monitor', {type:"osc-message",data:{source:"WebSocket",time:time,oscMessage:oscMessage}});
            }

            clients.forEach((client) => {
                if (client !== oscWebSocket ) {
                    client.send(oscMessage);
                }
            });
            
            if ( oscSlip )  {
                oscSlip.send(oscMessage);
            }
    
            if ( oscUdp )  oscUdp.send(oscMessage);
    
        });
        
        // Handle connection close
        oscWebSocket.on('close', () => {
            monitorLog('A WebSocket client disconnected');
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

    ipcMain.on('monitor', (event, msg) => {

        if ( msg.type == "open") {
            if (msg.data == "serial") {
                monitorSerial = true;
            } else if (msg.data == "udp") {
                monitorUdp = true;
            } else if (msg.data == "websocket") {
                monitorWebsocket = true;
            }
        } else  if ( msg.type == "close") {
            if (msg.data == "serial") {
                monitorSerial = false;
            } else if (msg.data == "udp") {
                monitorUdp = false;
            } else if (msg.data == "websocket") {
                monitorWebsocket = false;
            }
        } 
        /*
        if ( msg.target == "listen") {
            if ( msg.type == "open" ) {
                monitorListening = true;
            } else if ( msg.type == "close") {
                monitorListening = false;
            } else {
                console.log("ipcMain received unknow message");
            }
        } 
        */
    });

}

function createWindow() {
    
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600, 
        backgroundColor: "#ccc",
        resizable: false,  // Prevent window from being resizable
        autoHideMenuBar: true,  // Hide the default menu bar

        devTools: true,  // Disable the developer tools

        webPreferences: {
            nodeIntegration: true, // to allow require
            contextIsolation: false, // allow use with Electron 12+
            enableRemoteModule: false // For Electron v10+, if you want to use electron-settings within a browser window, set to true 
        }
        
    })
    
    mainWindowIsReady = true;

    listenWindowMessages();
    
    
    // and load the index.html of the app.
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }))
    
    // Open the DevTools.
    globalShortcut.register('Ctrl+Shift+I', () => {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    });
    
    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
        mainWindowIsReady = false;
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
        app.quit();
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
                //console.log("Found "+key+" for "+name+" as "+o[key] );
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
    monitorLog("--------------------------------");
    monitorLog("OscBridge by Thomas O Fredericks");
    monitorLog("--------------------------------");
    //const args = process.argv.slice(2); // Skip the first two elements
    const args = process.argv;
    headless = args.includes('--headless');
    if (headless) console.log('Running in headless mode');
        
    serialStatus.paths= await getSerialPaths();

    
    // LOAD SETTINGS AND AUTO-CONNECT IF SETTINGS ARE FOUND

    if ( loadSetting("serial",serialSettings) ) oscSlipOpen(serialSettings.path, serialSettings.baud);
    if ( electronSettings.hasSync("udp") ) {
        let tempSettings = electronSettings.getSync(udp);
        udpWorker.postMessage({type: 'open', settings: tempSettings});
    }
    /*
    if ( loadSetting("udp",udpSettings) )  oscUdpOpen(udpSettings.receivePort, udpSettings.sendIp, udpSettings.sendPort);
    */
    if ( loadSetting("websocket",websocketSettings) ) oscWebSocketOpen(websocketSettings.port) ;
    

    if (!headless) {
        createWindow();
         // Create the monitoring window when the app is ready
        //createMonitorWindow();
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

app.WindowAllClosed += () => app.Exit();

app.on('activate', function() {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
})


app.on('will-quit', () => {

    mainWindowIsReady = false;

    oscSlipClose();
    oscWebSocketClose();
    udpWorker.postMessage({ type: 'close'});

    //oscUdpClose();

    // Example string array
    const exitMessagesArray = ["We condemn the invasion of Ukraine by Poutine.", "We condemn the Palestinian apartheid!", "Freedom for all!", "Every worker should have the same rights, even seasonal and internationnal workers", "Be kind to animals!", "Be kind to plants!"];

    // Get a random index
    const randomIndex = Math.floor(Math.random() * exitMessagesArray.length);

    // Select the random element
    const randomElement = exitMessagesArray[randomIndex];

    console.log(randomElement);

    

  });

