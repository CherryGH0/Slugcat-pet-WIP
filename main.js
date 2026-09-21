const { app, BrowserWindow, screen } = require('electron');

function createWindow() {
	const primaryDisplay = screen.getPrimaryDisplay();
	const { width, height } = primaryDisplay.workAreaSize;

	const win = new BrowserWindow({
		width: width,
		height: height,
		x: 0,
		y: 0,
		transparent: true,
		frame: false,
		alwaysOnTop: true,
		hasShadow: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		}
	});

	win.loadFile('index.html');
    win.webContents.openDevTools({ mode: 'detach' });
	win.setIgnoreMouseEvents(true, { forward: true });
}

app.whenReady().then(createWindow);

const { ipcMain } = require('electron');

ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
	const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
	win.setIgnoreMouseEvents(ignore, { forward: true });
});