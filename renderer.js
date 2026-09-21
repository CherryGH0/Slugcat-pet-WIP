const { ipcRenderer } = require('electron');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const slugcat = new Slugcat(200, 200);

let mouse = { x: 200, y: 200 };
window.addEventListener('mousemove', (e) => {
	mouse.x = e.clientX;
	mouse.y = e.clientY;
	updatePassthrough();
});

function updatePassthrough() {
	const nearBody = slugcat.nearPoint(mouse.x, mouse.y, 20);
	ipcRenderer.send('set-ignore-mouse-events', !nearBody);
}

let lastTime = performance.now();
function loop(now) {
	const delta = Math.min((now - lastTime) / 1000, 0.033);
	lastTime = now;
	const dragTarget = isDragging ? mouse : null;
	slugcat.update(delta, dragTarget);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	slugcat.draw(ctx);
	requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

let isDragging = false;
window.addEventListener('mousedown', (e) => {
	if (slugcat.nearPoint(e.clientX, e.clientY, 20)) {
		isDragging = true;
	}
});

window.addEventListener('mouseup', () => {
	isDragging = false;
});