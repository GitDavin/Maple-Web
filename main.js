const { app, BrowserWindow, WebContentsView, session, ipcMain } = require('electron');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');

const TOP_UI_HEIGHT = 112; // Tab bar (36px) + Navbar (44px) + Bookmarks bar (32px)
const HOME_URL = 'https://duckduckgo.com';

let win;
let uiView;
const tabs = new Map();
let activeTabId = null;
let nextTabId = 1;

function layout() {
  if (!win || !uiView) return;
  const [width, height] = win.getContentSize();
  uiView.setBounds({ x: 0, y: 0, width, height: TOP_UI_HEIGHT });

  const activeView = tabs.get(activeTabId);
  if (activeView) {
    activeView.setBounds({
      x: 0,
      y: TOP_UI_HEIGHT,
      width,
      height: Math.max(0, height - TOP_UI_HEIGHT)
    });
  }
}

function sendTabState() {
  if (!uiView) return;
  const list = [];
  for (const [id, view] of tabs.entries()) {
    list.push({
      id,
      title: view.webContents.getTitle() || 'New Tab',
      url: view.webContents.getURL() || HOME_URL,
      active: id === activeTabId
    });
  }
  uiView.webContents.send('tabs-updated', list);
}

function switchTab(id) {
  if (!tabs.has(id)) return;
  for (const [tabId, view] of tabs.entries()) {
    if (tabId === id) {
      win.contentView.addChildView(view);
    } else {
      win.contentView.removeChildView(view);
    }
  }
  activeTabId = id;
  layout();
  sendTabState();
}

function createTab(url = HOME_URL) {
  const id = nextTabId++;
  const view = new WebContentsView({
    webPreferences: {
      sandbox: false
    }
  });

  // Open target="_blank" links in a new Maple Web tab
  view.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    createTab(newUrl);
    return { action: 'deny' };
  });

  view.webContents.on('did-navigate', sendTabState);
  view.webContents.on('did-navigate-in-page', sendTabState);
  view.webContents.on('page-title-updated', sendTabState);

  tabs.set(id, view);
  switchTab(id);
  view.webContents.loadURL(url);
}

function closeTab(id) {
  const view = tabs.get(id);
  if (!view) return;
  win.contentView.removeChildView(view);
  view.webContents.close();
  tabs.delete(id);

  if (tabs.size === 0) {
    createTab(HOME_URL);
  } else if (activeTabId === id) {
    const lastId = Array.from(tabs.keys()).pop();
    switchTab(lastId);
  } else {
    sendTabState();
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Maple Web',
    icon: __dirname + '/icon.png'
  });

  uiView = new WebContentsView({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.contentView.addChildView(uiView);
  uiView.webContents.loadFile('index.html');

  win.on('resize', layout);
  win.on('maximize', layout);
  win.on('unmaximize', layout);

  ipcMain.on('tab-new', (e, url) => createTab(url || HOME_URL));
  ipcMain.on('tab-switch', (e, id) => switchTab(id));
  ipcMain.on('tab-close', (e, id) => closeTab(id));

  ipcMain.on('nav-go', (e, url) => {
    const view = tabs.get(activeTabId);
    if (view) view.webContents.loadURL(url);
  });
  ipcMain.on('nav-back', () => {
    const view = tabs.get(activeTabId);
    if (view && view.webContents.canGoBack()) view.webContents.goBack();
  });
  ipcMain.on('nav-forward', () => {
    const view = tabs.get(activeTabId);
    if (view && view.webContents.canGoForward()) view.webContents.goForward();
  });
  ipcMain.on('nav-reload', () => {
    const view = tabs.get(activeTabId);
    if (view) view.webContents.reload();
  });
  ipcMain.on('nav-home', () => {
    const view = tabs.get(activeTabId);
    if (view) view.webContents.loadURL(HOME_URL);
  });

  session.defaultSession.setProxy({ mode: 'direct' }).then(() => {
    createTab(HOME_URL);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
