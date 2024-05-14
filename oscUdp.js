let udpSendPort = 8001;
let udpReceivePort = 8000;
let udpSendIp= "127.0.0.1";

const udpConnectButton = document.getElementById ('connect-udp-button');


function getIPAddresses() {
	const os = require("os"),
	interfaces = os.networkInterfaces(),
	ipAddresses = [];

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

function disconnectUdp() {
	oscUdp.close();
    oscUdp = undefined;
    udpConnectButton.innerText = '📢 Connect UDP';
}

function connectUdp() {
	oscUdp = new osc.UDPPort({
		localAddress: "0.0.0.0",
		localPort: udpReceivePort
	});
	oscUdp.on("ready", function () {
		udpConnectButton.innerText = '📢 Disconnect UDP';
		var ipAddresses = getIPAddresses();

		console.log("Listening for OSC over UDP.");
		ipAddresses.forEach(function (address) {
			console.log(" Host:", address + ", Port:", oscUdp.options.localPort);
		});

	});

	oscUdp.on("message", function (oscMessage) {
		console.log("From UDP "+oscMessage);
		if ( oscSlip ) {
			oscSlip.send(oscMessage);
		}
		//serial.send(oscMessage);
	});

	oscUdp.on("error", function (err) {
		console.log(err);
	});

	oscUdp.open();
}

udpConnectButton.addEventListener('click', function () {
    if ( oscUdp ) {
        disconnectUdp();
    } else {
        connectUdp();
    }
});