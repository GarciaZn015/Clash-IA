export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};
/** Distância entre bordas de dois círculos (entidades). */
export const edgeDist = (a, b) => Math.max(0, dist(a.x, a.y, b.x, b.y) - a.radius - b.radius);
