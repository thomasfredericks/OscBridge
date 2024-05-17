const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const settings = require('electron-settings');
const { SerialPort } = require('serialport');
const osc = require("osc");
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

let serialPaths = [];

let serial =  {
    connected: false,
    baud: 57600,
    path: ""
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

// UDP
/////////

let udp =  {
    sendPort: 8001,
    receivePort: 8000,
    sendIp: "127.0.0.1"
}

/*
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
*/

function oscSlipOnOpen() {
    //serialConnectButton.innerText = '🔌 Disconnect Serial';
    mainWindow.webContents.send('message', {type:"serial",serial:serial});
}

function oscSlipOnError() {
    console.log("Error opening serial port");
    //serialConnectButton.innerText = '🔌 Connect Serial';
}

function oscSlipConnect() {
    if ( oscSlip ) oscSlip.close();



            // Instantiate a new OSC Serial Port.
            oscSlip = new osc.SerialPort({
                devicePath: data.path, 
                bitrate:data.baud, 
                metadata: true
            });

            // Listen for the message event and map the OSC message to the synth.
            oscSlip.on("open", oscSlipOnOpen); //serial.path = data.path;
            oscSlip.on("error", oscSlipOnError);
            oscSlip.on("message", oscSlipOnMessage);

            // Open the port.
            oscSlip.open();
}



function createWindow() {

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
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
        
        if ( data.type == "init") {
            mainWindow.webContents.send('message', {type:"init",udp: udp, serial:serial, serialPaths:serialPaths});
        } else if (data.type == "get") {       
            else console.log("get what?");
        } else if ( data.type == "connect" ) {
            if (data.what == "serial") {
                oscSlipConnect();
            } else {
                console.log("connect what?");
            }
        } else {
            console.log("unknown message type");
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
    mainWindow.webContents.openDevTools()

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
    serialPaths= await getSerialPaths();
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
