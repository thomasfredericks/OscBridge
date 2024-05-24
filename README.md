# OscBridge
A bridge between Serial SLIP, OSC UDP and OSC WebSocket made in Electron.

## Install and run
- `npm install`
- `npm start`


## Development Notes


### ICP Protocol

All messages are follow the following structure : `'message', {type:"type" , ...}`

#### WebContents

* `'message', {target:"global", cmd:"status"} ` : Request current status.
* `'message', {target:"serial", cmd:"open", args:{path:"",baud:115200}}` : Request serial open.
* `'message', {target:"serial", cmd:"close"}` : Request serial close.

#### Main

* `'message', {target:"global", cmd:"status", args:{serial:serial,udp:udp}` : Returns status when requested by Client.
* `'message', {target:"serial", cmd:"status", args:{serial:serial}} ` : Returns results of serial connect or disconnect request.