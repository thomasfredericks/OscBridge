//const { ipcRenderer } = require('electron');


let oscOutput = document.getElementById('osc-output');

let oscOutputLengths = []; // Array to keep track of line lengths
let oscOutputMax = 64;

const monitorFilter = document.getElementById ('monitor-filter');

let listeningSerial = "closed";
let listeningUdp = "closed";
let listeningWebsocket = "closed";

const monitorSerial = document.getElementById ('monitor-serial');
const monitorUdp = document.getElementById ('monitor-udp');
const monitorWebsocket = document.getElementById ('monitor-websocket');

monitorSerial.style.backgroundColor = buttonColors[listeningSerial].backgroundColor;
monitorSerial.style.color = buttonColors[listeningSerial].color;

monitorSerial.addEventListener('click', function () {
    if ( listeningSerial == "opened"  ) {
        listeningSerial = "closed";
        ipcRenderer.send('monitor', {data:"serial", type:"close"});
    } else {
        listeningSerial = "opened";
        ipcRenderer.send('monitor', {data:"serial", type:"open"});
    }
    monitorSerial.style.backgroundColor = buttonColors[listeningSerial].backgroundColor;
    monitorSerial.style.color = buttonColors[listeningSerial].color;
});


monitorUdp.style.backgroundColor = buttonColors[listeningUdp].backgroundColor;
monitorUdp.style.color = buttonColors[listeningUdp].color;

monitorUdp.addEventListener('click', function () {
    if ( listeningUdp == "opened"  ) {
        listeningUdp = "closed";
        ipcRenderer.send('monitor', {data:"udp", type:"close"});
    } else {
        listeningUdp = "opened";
        ipcRenderer.send('monitor', {data:"udp", type:"open"});
    }
    monitorUdp.style.backgroundColor = buttonColors[listeningUdp].backgroundColor;
    monitorUdp.style.color = buttonColors[listeningUdp].color;
});

monitorWebsocket.style.backgroundColor = buttonColors[listeningWebsocket].backgroundColor;
monitorWebsocket.style.color = buttonColors[listeningWebsocket].color;

monitorWebsocket.addEventListener('click', function () {
    if ( listeningWebsocket == "opened"  ) {
        listeningWebsocket = "closed";
        ipcRenderer.send('monitor', {data:"websocket", type:"close"});
    } else {
        listeningWebsocket = "opened";
        ipcRenderer.send('monitor', {data:"websocket", type:"open"});
    }
    monitorWebsocket.style.backgroundColor = buttonColors[listeningWebsocket].backgroundColor;
    monitorWebsocket.style.color = buttonColors[listeningWebsocket].color;
});


function isPreOverflowing(preElement) {
    return preElement.scrollHeight > preElement.clientHeight ;
}

function appendToMonitor(line) {
    oscOutputLengths.push(line.length); // Store the length of the added line
    
    let content = oscOutput.innerText+line;
    
    while ( oscOutputLengths.length > oscOutputMax ) {
        let lengthToRemove = oscOutputLengths[0];
        oscOutputLengths.shift();
       // console.log('content.length '+content.length);
        //content = content.slice(0, content.length - lengthToRemove);
        content = content.slice(lengthToRemove, content.length);
      //  console.log('content.length '+content.length);

      
    }

    oscOutput.innerText = content;
}

ipcRenderer.on('monitor', (event, msg) => {

    if ( msg.type == "osc-message") {
        const data = msg.data;
        const args = data.oscMessage.args;
        let types ='';
        let values = '';
        args.forEach((arg, index) => {
            types += String(arg.type);
            values += String(arg.value);
            values += " ";
        });
        
        let line = data.oscMessage.address+' '+types+' '+values+'\n';
    
        const filterInput = monitorFilter.value.trim();
        if (filterInput.length > 0 ) {
            if (line.includes(filterInput) == false ) return;
        }

        appendToMonitor(data.time+" "+data.source+" "+line);
    
       

    } else if ( msg.type == "log") {
        const data = msg.data;
        appendToMonitor(data.time+" > "+data.msg+'\n');
    }
   
   

});