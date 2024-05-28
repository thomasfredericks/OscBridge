# OscBridge
A bridge between Serial SLIP, OSC UDP and OSC WebSocket made in Electron.

![OscBridge Connections](connections.png)


## Install dev and test
- `npm install` : Install and setup all packages.
- `npm start` : Run with a window.
- `npx electron . --headless` : Run headless.

## Generate icons
- [Electron-icon-maker](https://www.npmjs.com/package/electron-icon-maker) was used to convert the logo to the icons.

## Build
- `npm install --save-dev electron-builder`
- `npm run build` : Under Windows, I need to run as administrator.

### Build notes

- Do **not** use the *packed* (single *.exe*) of the Windows build. Use the version that is inside a folder, i.e. the *unpacked* version. The packed version needs to be decompressed everytime it is launched and does not behave properly in *headless* mode.