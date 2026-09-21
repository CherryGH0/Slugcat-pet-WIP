function verletIntegrate(points, oldPoints, gravity, airDamping, delta) {
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const op = oldPoints[i];
		const vx = (p.x - op.x) * airDamping;
		const vy = (p.y - op.y) * airDamping;
		op.x = p.x;
		op.y = p.y;
		p.x += vx + gravity.x * delta * delta;
		p.y += vy + gravity.y * delta * delta;
	}
}

function applyConstraints(points, segmentLength, iterations = 5) {
	for (let iter = 0; iter < iterations; iter++) {
		for (let i = 0; i < points.length - 1; i++) {
			const a = points[i];
			const b = points[i + 1];
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const dist = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
			const error = (dist - segmentLength) / dist;
			const cx = dx * error * 0.5;
			const cy = dy * error * 0.5;
			a.x += cx;
			a.y += cy;
			b.x -= cx;
			b.y -= cy;
		}
	}
}

function applyBendingConstraint(points, stiffness) {
	for (let i = 1; i < points.length - 1; i++) {
		const prev = points[i - 1];
		const curr = points[i];
		const next = points[i + 1];
		const targetX = (prev.x + next.x) / 2;
		const targetY = (prev.y + next.y) / 2;
		curr.x += (targetX - curr.x) * stiffness;
		curr.y += (targetY - curr.y) * stiffness;
	}
}

function applyFloor(points, oldPoints, floorY, floorFriction, radii) {
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const op = oldPoints[i];
		const offset = radii ? radii[i] : 0;
		const effectiveFloor = floorY - offset;
		if (p.y > effectiveFloor) {
			const vx = (p.x - op.x) * floorFriction;
			p.y = effectiveFloor;
			op.x = p.x - vx;
			op.y = effectiveFloor;
		}
	}
}

function applyCircleCollision(points, oldPoints, cx, cy, cr, startIndex = 0) {
	for (let i = startIndex; i < points.length; i++) {
		const p = points[i];
		const dx = p.x - cx;
		const dy = p.y - cy;
		const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
		if (dist < cr) {
			const nx = dx / dist;
			const ny = dy / dist;
			p.x = cx + nx * cr;
			p.y = cy + ny * cr;
			oldPoints[i].x = p.x;
			oldPoints[i].y = p.y;
		}
	}
}

function applyBounds(point, oldPoint, minX, maxX, minY) {
	if (point.x < minX) {
		point.x = minX;
		oldPoint.x = point.x;
	} else if (point.x > maxX) {
		point.x = maxX;
		oldPoint.x = point.x;
	}
	if (point.y < minY) {
		point.y = minY;
		oldPoint.y = point.y;
	}
}