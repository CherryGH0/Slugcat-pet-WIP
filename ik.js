function solveTwoBoneIK(hipX, hipY, targetX, targetY, upperLen, lowerLen, bendSign = 1) {
	let dx = targetX - hipX;
	let dy = targetY - hipY;
	let dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

	const maxReach = upperLen + lowerLen - 0.5;
	const minReach = Math.abs(upperLen - lowerLen) + 0.5;
	const clampedDist = Math.max(minReach, Math.min(maxReach, dist));

	const dirX = dx / dist;
	const dirY = dy / dist;
	const footX = hipX + dirX * clampedDist;
	const footY = hipY + dirY * clampedDist;

	const baseAngle = Math.atan2(dirY, dirX);
	const cosA = (upperLen * upperLen + clampedDist * clampedDist - lowerLen * lowerLen) / (2 * upperLen * clampedDist);
	const angleA = Math.acos(Math.max(-1, Math.min(1, cosA)));

	const kneeAngle = baseAngle - angleA * bendSign;
	const kneeX = hipX + Math.cos(kneeAngle) * upperLen;
	const kneeY = hipY + Math.sin(kneeAngle) * upperLen;

	return { kneeX, kneeY, footX, footY };
}