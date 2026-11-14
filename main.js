const { app, BrowserWindow, session } = require('electron');

app.commandLine.appendSwitch('no-sandbox');

// Replace with the IP, Port, and Username from your Webshare Proxy List
const PROXY_CONFIG = 'direct://';
const PROXY_USER = '';
const PROXY_PASS = '';


function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Maple Web',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    }
  });

  // Apply proxy to both main window and <webview> tags
  session.defaultSession.setProxy({
    proxyRules: PROXY_CONFIG
  }).then(() => {
    win.loadFile('index.html');
  });
}

// Automatically handle Webshare proxy authentication
app.on('login', (event, webContents, details, authInfo, callback) => {
  if (authInfo.isProxy) {
    event.preventDefault();
    callback(PROXY_USER, PROXY_PASS);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
