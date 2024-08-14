const { ipcRenderer } = require('electron');


ipcRenderer.on('osc-message', (event, oscMessage) => {
   
    const args = oscMessage.args;
    let types ='';
    let values = '';
    args.forEach((arg, index) => {
        types += String(arg.type);
        values += String(arg.value);
    });

let content = oscMessage.address+' '+types+' '+values+'\n'+document.getElementById('osc-output').innerText;
content = String(content.length ) + content;
//let content = document.getElementById('osc-output').innerText+'\n'+oscMessage.address+' '+types+' '+values;
    /*
const maxChars = 200;

    // If content exceeds maxChars, trim the beginning
   if (content.length > maxChars) {
        content = content.slice(0,maxChars);
    }
*/
console.log(content);
  document.getElementById('osc-output').innerText = content;
  //document.getElementById('osc-output').innerText +=  `\n${JSON.stringify(oscMessage)}`;

});