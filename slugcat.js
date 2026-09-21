class Slugcat {
	constructor(startX, startY, radius = 10, legLength = 20) {

		// Тело/Физика
		this.radius = radius;
		this.point = { x: startX, y: startY };
		this.oldPoint = { x: startX, y: startY };
		this.angle = 0;
		this.angularVelocity = 0;
		this.prevVx = 0;
		this.lastFrameX = startX;

		// Умом
		this.moveState = 'idle';
		this.facing = 1;
		this.grounded = false;
		this.state = 'idle';
		this.stateTimer = 1 + Math.random() * 2;
		this.walkTarget = null;
		this.walkSpeed = 150;

		// Позвоночник
		this.spineSegmentCount = 4;
		this.spineSegmentLength = 12;
		this.spinePoints = [];
		this.spineOldPoints = [];
		for (let i = 0; i < this.spineSegmentCount; i++) {
			const sy = startY - i * this.spineSegmentLength;
			this.spinePoints.push({ x: startX, y: sy });
			this.spineOldPoints.push({ x: startX, y: sy });
		}

		// Ноги
		this.legLength = legLength;
		this.bobPhase = 0;
		this.lastBobAmount = 0;
		this.footOffsets = [-8, 8];
		this.stepFootIndex = 0;
		this.stepTimer = 0;
		this.stepInterval = 0.15;
		this.stepDuration = 0.15;
		this.stepLift = 5;
		this.feet = this.footOffsets.map(offsetX => ({
			x: startX + offsetX, y: Room.floorY,
			stepping: false,
			fromX: startX + offsetX, fromY: Room.floorY,
			toX: startX + offsetX, toY: Room.floorY,
			stepT: 0
		}));

		// Хвост 
		this.tailSegmentCount = 5;
		this.tailSegmentLength = 10;
		this.tailPoints = [];
		this.tailOldPoints = [];
		for (let i = 0; i < this.tailSegmentCount; i++) {
			const tx = startX - i * this.tailSegmentLength;
			this.tailPoints.push({ x: tx, y: startY });
			this.tailOldPoints.push({ x: tx, y: startY });
		}
	}

	// Обновление ---------------------------------------------------------------

	update(delta, dragTarget) {
		if (dragTarget) {
			this.oldPoint.x = this.point.x;
			this.oldPoint.y = this.point.y;
			const pull = Math.min(1, 15 * delta);
			this.point.x += (dragTarget.x - this.point.x) * pull;
			this.point.y += (dragTarget.y - this.point.y) * pull;
			this.clampToRoom();
			this.updateAngle(delta);
			this.updateGroundState();
			this.updateMoveState();
			this.updateSpine(delta);
			this.updateTail(delta);
			this.updateFeet(delta);
			return;
		}

		const vx = (this.point.x - this.oldPoint.x) * 0.999;
		const vy = (this.point.y - this.oldPoint.y) * 0.999;
		this.oldPoint.x = this.point.x;
		this.oldPoint.y = this.point.y;
		this.point.x += vx + Room.gravity.x * delta * delta;
		this.point.y += vy + Room.gravity.y * delta * delta;
		this.clampToRoom();

		const standFloor = Room.floorY - this.legLength;
		const legsGrounded = this.point.y >= standFloor;

		if (legsGrounded) {
			const pull = Math.min(1, 6 * delta);
			this.point.y += (standFloor - this.point.y) * pull;

			const dampY = 0.5;
			this.oldPoint.y += (this.point.y - this.oldPoint.y) * dampY;

			const vxFriction = (this.point.x - this.oldPoint.x) * 0.85;
			this.oldPoint.x = this.point.x - vxFriction;
			
			const targetAngle = this.moveState === 'moving' ? this.facing * 0.35 : 0;
			const uprightTorque = 100;
			const uprightDamping = 10;
			this.angularVelocity += -(this.angle - targetAngle) * uprightTorque * delta;
			this.angularVelocity -= this.angularVelocity * uprightDamping * delta;

			this.updateAI(delta);
			if (this.moveState === 'moving') {
				this.bobPhase += delta * (Math.PI / this.stepInterval);
			} else {
				this.bobPhase = 0;
			}
			const bobAmount = this.moveState === 'moving' ? Math.abs(Math.sin(this.bobPhase)) * 3 : 0;
			const bobDelta = bobAmount - this.lastBobAmount;
			this.point.y -= bobDelta;
			this.oldPoint.y -= bobDelta;
			this.lastBobAmount = bobAmount;
		}

		this.updateAngle(delta);
		this.updateGroundState();
		this.updateMoveState();
		this.updateSpine(delta);
		this.updateTail(delta);
		this.updateFeet(delta);
	}

	updateAI(delta) {
		this.stateTimer -= delta;

		if (this.state === 'idle') {
			if (this.stateTimer <= 0) {
				this.state = 'walking';
				const dir = Math.random() < 0.5 ? -1 : 1;
				const distance = 100 + Math.random() * 150;
				this.walkTarget = this.point.x + dir * distance;
				this.walkTarget = Math.max(50, Math.min(Room.width - 50, this.walkTarget));
			}
		} else if (this.state === 'walking') {
			const dx = this.walkTarget - this.point.x;
			if (Math.abs(dx) < 5) {
				this.state = 'idle';
				this.stateTimer = 1 + Math.random() * 3;
			} else {
				const dir = Math.sign(dx);
				const step = dir * this.walkSpeed * delta;
				this.point.x += step;
				this.oldPoint.x += step;
			}
		}
	}

	updateAngle(delta) {
		const vxNow = this.point.x - this.oldPoint.x;
		const accX = vxNow - this.prevVx;
		this.prevVx = vxNow;

		const torqueFactor = 0.08;
		const angularDamping = 0.995;

		this.angularVelocity += -accX * torqueFactor;
		this.angularVelocity *= angularDamping;
		this.angle += this.angularVelocity * delta;
	}

	updateGroundState() {
		const standFloor = Room.floorY - this.legLength;
		this.grounded = this.point.y >= standFloor - 0.5;
	}

	updateMoveState() {
		const vx = this.point.x - this.lastFrameX;
		this.lastFrameX = this.point.x;
		const speed = Math.abs(vx);

		if (speed > 0.3) {
			this.moveState = 'moving';
			this.facing = vx > 0 ? 1 : -1;
		} else {
			this.moveState = 'idle';
		}
	}

	updateSpine(delta) {
		const attachX = this.point.x;
		const attachY = this.point.y;

		this.spinePoints[0].x = attachX;
		this.spinePoints[0].y = attachY;
		this.spineOldPoints[0].x = attachX;
		this.spineOldPoints[0].y = attachY;

		verletIntegrate(this.spinePoints, this.spineOldPoints, Room.gravity, 0.7, delta);

		this.spinePoints[0].x = attachX;
		this.spinePoints[0].y = attachY;

		this.applyUprightBias(this.spinePoints, this.spineSegmentLength, 0.3, this.angle);
		applyConstraints(this.spinePoints, this.spineSegmentLength, 6);
		applyBendingConstraint(this.spinePoints, 0.4);
		applyFloor(this.spinePoints, this.spineOldPoints, Room.floorY, 0.5);

		this.spinePoints[0].x = attachX;
		this.spinePoints[0].y = attachY;
	}

	updateTail(delta) {
		const attachX = this.point.x;
		const attachY = this.point.y;

		this.tailPoints[0].x = attachX;
		this.tailPoints[0].y = attachY;
		this.tailOldPoints[0].x = attachX;
		this.tailOldPoints[0].y = attachY;

		verletIntegrate(this.tailPoints, this.tailOldPoints, Room.gravity, 0.97, delta);

		this.tailPoints[0].x = attachX;
		this.tailPoints[0].y = attachY;

		applyConstraints(this.tailPoints, this.tailSegmentLength, 6);
		applyBendingConstraint(this.tailPoints, 0.03);

		const radii = this.tailPoints.map((_, i) => this.getTailRadius(i));
		applyFloor(this.tailPoints, this.tailOldPoints, Room.floorY, 0.3, radii);
		applyCircleCollision(this.tailPoints, this.tailOldPoints, this.point.x, this.point.y, this.radius, 1);

		this.tailPoints[0].x = attachX;
		this.tailPoints[0].y = attachY;

		const tailSwing = this.tailPoints[1].x - attachX;
		const tailTorque = 0.015;
		this.angularVelocity += -tailSwing * tailTorque * delta;
	}

	updateFeet(delta) {
		const cos = Math.cos(this.angle);
		const sin = Math.sin(this.angle);

		this.stepTimer -= delta;
		let doStep = false;
		if (this.stepTimer <= 0) {
			doStep = true;
			this.stepTimer = this.stepInterval;
		}
		const allowedFoot = this.stepFootIndex;

		for (let i = 0; i < 2; i++) {
			const offsetX = this.footOffsets[i];
			const hipX = this.point.x + offsetX * cos;
			const hipY = this.point.y + offsetX * sin;
			const foot = this.feet[i];

			const distToFloor = Room.floorY - hipY;
			const isReaching = distToFloor <= this.legLength;

			if (!isReaching) {
				foot.stepping = false;
				foot.x = hipX - sin * this.legLength;
				foot.y = hipY + cos * this.legLength;
				continue;
			}

			if (foot.stepping) {
				foot.stepT += delta / this.stepDuration;
				if (foot.stepT >= 1) {
					foot.stepT = 1;
					foot.stepping = false;
					foot.x = foot.toX;
					foot.y = foot.toY;
				} else {
					const t = foot.stepT;
					const lift = Math.sin(t * Math.PI) * this.stepLift;
					foot.x = foot.fromX + (foot.toX - foot.fromX) * t;
					foot.y = foot.fromY + (foot.toY - foot.fromY) * t - lift;
				}
				continue;
			}

			if (doStep && i === allowedFoot) {
				const moveDirX = this.point.x - this.oldPoint.x;
				const dirSign = moveDirX > 0.02 ? 1 : (moveDirX < -0.02 ? -1 : 0);

				let targetX;
				if (this.grounded && this.moveState === 'moving') {
					const stepDistance = 30;
					targetX = this.point.x + this.facing * stepDistance;
				} else {
					targetX = this.point.x + offsetX + dirSign * 15;
				}
				const targetY = Room.floorY;

				const distX = targetX - foot.x;
				const distY = targetY - foot.y;
				const moveDist = Math.sqrt(distX * distX + distY * distY);

				if (moveDist > 2) {
					foot.fromX = foot.x;
					foot.fromY = foot.y;
					foot.toX = targetX;
					foot.toY = targetY;
					foot.stepT = 0;
					foot.stepping = true;
				}

				this.stepFootIndex = 1 - i;
			}
		}
	}

	clampToRoom() {
		const margin = this.radius + 5;
		applyBounds(this.point, this.oldPoint, margin, Room.width - margin, margin);
	}

	applyUprightBias(points, segmentLength, strength, angle) {
		const dirX = Math.sin(angle);
		const dirY = -Math.cos(angle);
		for (let i = 1; i < points.length; i++) {
			const below = points[i - 1];
			const p = points[i];
			const targetX = below.x + dirX * segmentLength;
			const targetY = below.y + dirY * segmentLength;
			p.x += (targetX - p.x) * strength;
			p.y += (targetY - p.y) * strength;
		}
	}

	getTailRadius(i) {
		const t = i / (this.tailSegmentCount - 1);
		return Math.max(2, 12 * (1 - t));
	}

	nearPoint(x, y, radius) {
		const dx = x - this.point.x;
		const dy = y - this.point.y;
		return Math.sqrt(dx * dx + dy * dy) < radius + this.radius;
	}

	// Отрисовка---------------------------------------------------------------

	draw(ctx) {
		this.drawSpine(ctx);
		this.drawTail(ctx);
		this.drawLegs(ctx);
		this.drawBody(ctx);
	}

	drawSpine(ctx) {
		const left = [];
		const right = [];
		for (let i = 0; i < this.spinePoints.length; i++) {
			let dir;
			if (i === 0) {
				dir = { x: this.spinePoints[1].x - this.spinePoints[0].x, y: this.spinePoints[1].y - this.spinePoints[0].y };
			} else if (i === this.spinePoints.length - 1) {
				dir = { x: this.spinePoints[i].x - this.spinePoints[i - 1].x, y: this.spinePoints[i].y - this.spinePoints[i - 1].y };
			} else {
				dir = { x: this.spinePoints[i + 1].x - this.spinePoints[i - 1].x, y: this.spinePoints[i + 1].y - this.spinePoints[i - 1].y };
			}
			const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
			const nx = -dir.y / len;
			const ny = dir.x / len;
			const r = 10;
			left.push({ x: this.spinePoints[i].x + nx * r, y: this.spinePoints[i].y + ny * r });
			right.push({ x: this.spinePoints[i].x - nx * r, y: this.spinePoints[i].y - ny * r });
		}
		const outline = left.concat(right.reverse());
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.moveTo((outline[0].x + outline[outline.length - 1].x) / 2, (outline[0].y + outline[outline.length - 1].y) / 2);
		for (let i = 0; i < outline.length; i++) {
			const next = outline[(i + 1) % outline.length];
			const midX = (outline[i].x + next.x) / 2;
			const midY = (outline[i].y + next.y) / 2;
			ctx.quadraticCurveTo(outline[i].x, outline[i].y, midX, midY);
		}
		ctx.closePath();
		ctx.fill();
	}

	drawTail(ctx) {
		const left = [];
		const right = [];
		for (let i = 0; i < this.tailPoints.length; i++) {
			let dir;
			if (i === 0) {
				dir = { x: this.tailPoints[1].x - this.tailPoints[0].x, y: this.tailPoints[1].y - this.tailPoints[0].y };
			} else if (i === this.tailPoints.length - 1) {
				dir = { x: this.tailPoints[i].x - this.tailPoints[i - 1].x, y: this.tailPoints[i].y - this.tailPoints[i - 1].y };
			} else {
				dir = { x: this.tailPoints[i + 1].x - this.tailPoints[i - 1].x, y: this.tailPoints[i + 1].y - this.tailPoints[i - 1].y };
			}
			const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
			const nx = -dir.y / len;
			const ny = dir.x / len;
			const r = this.getTailRadius(i);
			left.push({ x: this.tailPoints[i].x + nx * r, y: this.tailPoints[i].y + ny * r });
			right.push({ x: this.tailPoints[i].x - nx * r, y: this.tailPoints[i].y - ny * r });
		}
		const outline = left.concat(right.reverse());
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.moveTo((outline[0].x + outline[outline.length - 1].x) / 2, (outline[0].y + outline[outline.length - 1].y) / 2);
		for (let i = 0; i < outline.length; i++) {
			const next = outline[(i + 1) % outline.length];
			const midX = (outline[i].x + next.x) / 2;
			const midY = (outline[i].y + next.y) / 2;
			ctx.quadraticCurveTo(outline[i].x, outline[i].y, midX, midY);
		}
		ctx.closePath();
		ctx.fill();
	}

	drawLegs(ctx) {
		const legSegment = this.legLength / 2;
		const cos = Math.cos(this.angle);
		const sin = Math.sin(this.angle);

		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 4;
		ctx.lineCap = 'round';

		for (let i = 0; i < this.footOffsets.length; i++) {
			const offsetX = this.footOffsets[i];
			const hipX = this.point.x + offsetX * cos;
			const hipY = this.point.y + offsetX * sin;
			const foot = this.feet[i];
			const bendSign = (this.grounded && this.moveState === 'moving') ? this.facing : (i === 0 ? -1 : 1);

			const { kneeX, kneeY, footX, footY } = solveTwoBoneIK(hipX, hipY, foot.x, foot.y, legSegment, legSegment, bendSign);

			ctx.beginPath();
			ctx.moveTo(hipX, hipY);
			ctx.lineTo(kneeX, kneeY);
			ctx.lineTo(footX, footY);
			ctx.stroke();
		}
	}

	drawBody(ctx) {
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(this.point.x, this.point.y, this.radius, 0, Math.PI * 2);
		ctx.fill();

		const cos = Math.cos(this.angle);
		const sin = Math.sin(this.angle);
		const lineLen = 10;
		const topX = this.point.x + sin * lineLen;
		const topY = this.point.y - cos * lineLen;
		const botX = this.point.x - sin * lineLen;
		const botY = this.point.y + cos * lineLen;

		ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(topX, topY);
		ctx.lineTo(botX, botY);
		ctx.stroke();
	}
}