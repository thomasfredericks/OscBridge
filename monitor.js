const { ipcRenderer } = require('electron');


let oscOutput = document.getElementById('osc-output');

let oscOutputLengths = []; // Array to keep track of line lengths
let oscOutputMax = 64;


function isPreOverflowing(preElement) {
    return preElement.scrollHeight > preElement.clientHeight ;
}

ipcRenderer.on('osc-message', (event, oscMessage) => {
   
    const args = oscMessage.args;
    let types ='';
    let values = '';
    args.forEach((arg, index) => {
        types += String(arg.type);
        values += String(arg.value);
    });
    
    let line = oscMessage.address+' '+types+' '+values+'\n';

    oscOutputLengths.push(line.length); // Store the length of the added line

    let content = line + oscOutput.innerText;
    
    if ( oscOutputLengths.length > oscOutputMax ) {
        let lengthToRemove = oscOutputLengths[0];
        oscOutputLengths.shift();
       // console.log('content.length '+content.length);
        content = content.slice(0, content.length - lengthToRemove);
      //  console.log('content.length '+content.length);
    }

    oscOutput.innerText = content;

    //console.log('scrollHeight '+oscOutput.scrollHeight);
    //    console.log('clientHeight '+oscOutput.clientHeight);
/*
    while (isPreOverflowing(oscOutput) && oscOutputLengths.length > 0 ) {
        console.log('The <pre> element is overflowing.');
        console.log("oscOutputLengths.length "+oscOutputLengths.length );
        console.log('scrollHeight '+oscOutput.scrollHeight);
        console.log('clientHeight '+oscOutput.clientHeight);
        let lengthToRemove = oscOutputLengths[0];
        oscOutputLengths.shift();
        console.log('lengthToRemove '+lengthToRemove);
        content.slice(0, content.length - lengthToRemove);
        oscOutput.innerText = content;
    } 
*/

  //document.getElementById('osc-output').innerText +=  `\n${JSON.stringify(oscMessage)}`;

});