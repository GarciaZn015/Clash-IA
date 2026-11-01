// Modelos de unidades e construções (estatísticas no nível 1).
// Velocidades em tiles/s, alcance em tiles (medido entre bordas), hitSpeed em segundos por ataque.
// targets: 'ground' | 'both' | 'buildings'

export const UNITS = {
  escudeiro: {
    name: 'Escudeiro de Ferro',
    hp: 800, shield: 240, damage: 92, hitSpeed: 1.1, range: 0.6, speed: 1.0,
    radius: 0.5, mass: 6, targets: 'ground',
  },
  arqueira: {
    name: 'Arqueira do Bosque',
    hp: 190, damage: 51, hitSpeed: 1.0, range: 5.0, speed: 1.0,
    radius: 0.4, mass: 3, targets: 'both', projectile: { kind: 'arrow', speed: 12 },
  },
  lobo: {
    name: 'Lobo Sombrio',
    hp: 245, damage: 64, hitSpeed: 0.9, range: 0.5, speed: 1.6,
    radius: 0.42, mass: 3, targets: 'ground',
  },
  diabrete: {
    name: 'Diabrete',
    hp: 82, damage: 44, hitSpeed: 1.0, range: 0.4, speed: 1.6,
    radius: 0.3, mass: 1, targets: 'ground',
  },
  corvo: {
    name: 'Corvo da Névoa',
    hp: 62, damage: 36, hitSpeed: 0.9, range: 0.5, speed: 1.9,
    radius: 0.3, mass: 1, air: true, targets: 'both',
  },
  bombardeiro: {
    name: 'Bombardeiro Anão',
    hp: 290, damage: 105, hitSpeed: 1.8, range: 4.5, speed: 1.0,
    radius: 0.45, mass: 3, targets: 'ground', splash: 1.3, projectile: { kind: 'bomb', speed: 7, arc: true },
  },
  mago: {
    name: 'Mago das Runas',
    hp: 540, damage: 115, hitSpeed: 1.4, range: 5.0, speed: 1.0,
    radius: 0.5, mass: 4, targets: 'both', splash: 1.2, projectile: { kind: 'rune', speed: 10 },
  },
  javali: {
    name: 'Cavaleiro Javali',
    hp: 980, damage: 170, hitSpeed: 1.5, range: 0.7, speed: 2.0,
    radius: 0.55, mass: 6, targets: 'buildings',
  },
  golem: {
    name: 'Golem Rúnico',
    hp: 2700, damage: 170, hitSpeed: 1.5, range: 0.75, speed: 0.7,
    radius: 0.85, mass: 18, targets: 'buildings',
    deathSpawn: { unitId: 'fragmento', count: 2 },
    deathDamage: { radius: 2.2, damage: 160 },
  },
  fragmento: {
    name: 'Fragmento Rúnico',
    hp: 460, damage: 62, hitSpeed: 1.2, range: 0.6, speed: 0.9,
    radius: 0.5, mass: 6, targets: 'buildings',
  },
  grifo: {
    name: 'Grifo de Tempestade',
    hp: 540, damage: 98, hitSpeed: 1.0, range: 1.4, speed: 1.5,
    radius: 0.55, mass: 5, air: true, targets: 'both',
    ability: { type: 'firstStrike', mult: 2.5 },
  },
  dragonete: {
    name: 'Dragonete de Brasa',
    hp: 680, damage: 78, hitSpeed: 1.6, range: 3.5, speed: 1.5,
    radius: 0.6, mass: 5, air: true, targets: 'both', splash: 1.0, projectile: { kind: 'fire', speed: 9 },
  },
  feiticeira: {
    name: 'Feiticeira do Abismo',
    hp: 580, damage: 22, hitSpeed: 0.4, range: 5.5, speed: 1.0,
    radius: 0.5, mass: 4, targets: 'both',
    ability: { type: 'ramp', stages: [1, 3, 8], stageTime: 2.0 },
  },
  esqueleto: {
    name: 'Esqueleto Errante',
    hp: 72, damage: 62, hitSpeed: 1.0, range: 0.45, speed: 1.25,
    radius: 0.3, mass: 1, targets: 'ground',
  },
  gigante: {
    name: 'Gigante da Colina',
    hp: 2050, damage: 145, hitSpeed: 1.5, range: 0.75, speed: 0.75,
    radius: 0.75, mass: 15, targets: 'buildings',
  },
  atiradora: {
    name: 'Atiradora Real',
    hp: 350, damage: 94, hitSpeed: 1.15, range: 6.0, speed: 1.0,
    radius: 0.45, mass: 4, targets: 'both', projectile: { kind: 'bolt', speed: 15 },
  },
  berserker: {
    name: 'Berserker do Norte',
    hp: 1000, damage: 120, hitSpeed: 1.5, range: 0.6, speed: 1.0,
    radius: 0.5, mass: 7, targets: 'ground', spin: 1.3,
  },
  canhao: {
    name: 'Canhão de Bronze',
    building: true, hp: 720, lifetime: 30, damage: 92, hitSpeed: 0.9, range: 5.5, speed: 0,
    radius: 0.8, mass: 999, targets: 'ground', projectile: { kind: 'cannon', speed: 14 },
  },
  balista: {
    name: 'Balista',
    building: true, hp: 900, lifetime: 32, damage: 118, hitSpeed: 1.1, range: 7.0, speed: 0,
    radius: 0.9, mass: 999, targets: 'ground', projectile: { kind: 'bolt', speed: 16 },
  },
  forja: {
    name: 'Forja de Diabretes',
    building: true, hp: 820, lifetime: 40, damage: 0, hitSpeed: 0, range: 0, speed: 0,
    radius: 0.9, mass: 999, targets: 'none',
    spawn: { unitId: 'diabrete', count: 2, interval: 6.0, firstDelay: 1.0 },
    deathSpawn: { unitId: 'diabrete', count: 2 },
  },
};

export function getUnit(id) {
  const u = UNITS[id];
  if (!u) throw new Error(`Unidade desconhecida: ${id}`);
  return u;
}
