const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const settings = require('electron-settings');
const { SerialPort } = require('serialport');
const osc = require("osc");
const os = require("os");

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
let serial = {path:"", baud:115200, opened:false, paths:[]};

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
    console.log(oscMessage);
    /*
    if ( oscUdp) {
        oscUdp.send(oscMessage, udpSendIp, udpSendPort);
    }
    */
};

function oscSlipOnOpen() {
    serial.opened = true;
    
    //serialConnectButton.innerText = '🔌 Disconnect Serial';
    mainWindow.webContents.send('message', {target:"serial",cmd:"status", args:{serial:serial}});
}



function oscSlipClose() {
    if ( oscSlip ) {
        oscSlip.close();
        oscSlip = undefined;
        serial.opened = false;
        mainWindow.webContents.send('message', {target:"serial",cmd:"status", args:{serial:serial}});
    }
}

function oscSlipOnError() {
    oscSlipClose();
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

        // Open the port.
        oscSlip.open();
}



// UDP
/////////

let udp =  {
    sendPort: 8001,
    receivePort: 8000,
    sendIp: "127.0.0.1",
    opened: false
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


function oscUdpClose() {
	if ( oscUdp) {
        oscUdp.close();
        oscUdp = undefined;
        udp.opened = false;
        mainWindow.webContents.send('message', {target:"udp",cmd:"status", args:{udp:udp}});
    }
    
}

function oscUdpOnReady() {
   // udpConnectButton.innerText = '📢 Disconnect UDP';
   udp.opened = true;
    var ipAddresses = getIPAddresses();

    console.log("Listening for OSC over UDP.");
    ipAddresses.forEach(function (address) {
        console.log(" Host:", address + ", Port:", oscUdp.options.localPort);
    });
    mainWindow.webContents.send('message', {target:"udp",cmd:"status", args:{udp:udp}});

}

function oscUdpOnError() {
    oscUdpClose();
}

function oscUdpOnMessage() {
   /*
   if ( oscSlip ) {
			oscSlip.send(oscMessage);
		}
        */
}



function oscUdpOpen(receivePort, sendIp, sendPort) {

    oscUdpClose();
    udp.receivePort = receivePort;
    udp.sendIp = sendIp;
    udp.sendPort = sendPort;

	oscUdp = new osc.UDPPort({
		localAddress: "0.0.0.0",
		localPort: udp.receivePort,
		metadata: true
	});
	oscUdp.on("ready", oscUdpOnReady);

	oscUdp.on("message", oscUdpOnMessage);

	oscUdp.on("error", oscUdpOnError);

	oscUdp.open();
}


// WINDOW
//////////

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

        if ( data.target == "global") {
            if ( data.cmd == "status" ) {
                mainWindow.webContents.send('message', {target:"global",cmd:"status",args:{udp: udp, serial:serial}});
            }
        } else if ( data.target == "serial") {
            if ( data.cmd == "open" ) {
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
