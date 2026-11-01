// Definições das cartas colecionáveis. Toda carta referencia um modelo de unidade (src/data/units.js)
// ou descreve um feitiço. IDs são estáveis: nunca renomeie um id já salvo em perfis.
import { UNITS } from './units.js';

export const RARITIES = {
  comum: { label: 'Comum', color: '#b8c4d6', order: 0 },
  rara: { label: 'Rara', color: '#f0a03c', order: 1 },
  epica: { label: 'Épica', color: '#b46cf0', order: 2 },
  lendaria: { label: 'Lendária', color: '#4fe0d0', order: 3 },
};

export const CARDS = [
  {
    id: 'escudeiro', name: 'Escudeiro de Ferro', type: 'troop', cost: 3, rarity: 'comum', unlockLevel: 1,
    unitId: 'escudeiro', count: 1, tags: ['terrestre', 'corpo a corpo'],
    role: 'Defensor versátil',
    description: 'Guerreiro com escudo que absorve o primeiro golpe pesado. Ótimo para segurar avanços.',
  },
  {
    id: 'arqueiras', name: 'Arqueiras do Bosque', type: 'troop', cost: 3, rarity: 'comum', unlockLevel: 1,
    unitId: 'arqueira', count: 2, tags: ['terrestre', 'à distância', 'antiaéreo'],
    role: 'Suporte à distância',
    description: 'Duas arqueiras que acertam alvos aéreos e terrestres de longe.',
  },
  {
    id: 'lobos', name: 'Lobos Sombrios', type: 'troop', cost: 3, rarity: 'comum', unlockLevel: 1,
    unitId: 'lobo', count: 3, tags: ['terrestre', 'rápida', 'corpo a corpo'],
    role: 'Pressão rápida',
    description: 'Matilha veloz que derruba tropas frágeis e pune torres desprotegidas.',
  },
  {
    id: 'diabretes', name: 'Diabretes', type: 'troop', cost: 2, rarity: 'comum', unlockLevel: 1,
    unitId: 'diabrete', count: 4, tags: ['terrestre', 'enxame', 'rápida'],
    role: 'Enxame barato',
    description: 'Quatro diabretes ágeis. Cercam tanques, mas morrem para dano em área.',
  },
  {
    id: 'corvos', name: 'Corvos da Névoa', type: 'troop', cost: 2, rarity: 'comum', unlockLevel: 1,
    unitId: 'corvo', count: 4, tags: ['aérea', 'enxame', 'rápida'],
    role: 'Enxame aéreo',
    description: 'Bando aéreo veloz. Só pode ser atingido por quem mira o céu.',
  },
  {
    id: 'bombardeiro', name: 'Bombardeiro Anão', type: 'troop', cost: 3, rarity: 'comum', unlockLevel: 1,
    unitId: 'bombardeiro', count: 1, tags: ['terrestre', 'à distância', 'dano em área'],
    role: 'Antienxame terrestre',
    description: 'Arremessa bombas que causam dano em área. Não alcança alvos aéreos.',
  },
  {
    id: 'javali', name: 'Cavaleiro Javali', type: 'troop', cost: 4, rarity: 'rara', unlockLevel: 1,
    unitId: 'javali', count: 1, tags: ['terrestre', 'rápida', 'mira construções'],
    role: 'Ataque relâmpago',
    description: 'Ignora tropas e corre pela ponte direto para as construções inimigas.',
  },
  {
    id: 'saraivada', name: 'Saraivada', type: 'spell', cost: 3, rarity: 'comum', unlockLevel: 1,
    tags: ['feitiço', 'dano em área'], role: 'Limpeza de enxames',
    description: 'Três ondas de flechas cobrem uma grande área. Dano reduzido em torres.',
    spell: { radius: 4, damage: 160, waves: 3, waveInterval: 0.3, delay: 0.6, towerFactor: 0.35 },
  },
  {
    id: 'meteoro', name: 'Meteoro Rúnico', type: 'spell', cost: 4, rarity: 'rara', unlockLevel: 2,
    tags: ['feitiço', 'dano em área'], role: 'Dano pesado em área',
    description: 'Uma rocha encantada cai do céu, causa dano alto e empurra tropas.',
    spell: { radius: 2.5, damage: 440, delay: 1.0, towerFactor: 0.35, knockback: 1.2, travel: true },
  },
  {
    id: 'balista', name: 'Balista', type: 'building', cost: 4, rarity: 'rara', unlockLevel: 2,
    unitId: 'balista', count: 1, tags: ['construção', 'defensiva'],
    role: 'Defesa de longo alcance',
    description: 'Construção defensiva de longo alcance contra tropas terrestres. Atrai quem mira construções.',
  },
  {
    id: 'mago', name: 'Mago das Runas', type: 'troop', cost: 5, rarity: 'rara', unlockLevel: 3,
    unitId: 'mago', count: 1, tags: ['terrestre', 'à distância', 'dano em área', 'antiaéreo'],
    role: 'Dano em área versátil',
    description: 'Lança runas explosivas que atingem grupos no chão e no ar.',
  },
  {
    id: 'grifo', name: 'Grifo de Tempestade', type: 'troop', cost: 4, rarity: 'rara', unlockLevel: 3,
    unitId: 'grifo', count: 1, tags: ['aérea', 'rápida'],
    role: 'Caçador aéreo',
    description: 'Mergulha sobre o primeiro alvo causando 2,5x de dano. Rápido e ataca céu e solo.',
  },
  {
    id: 'fonte', name: 'Fonte de Cura', type: 'spell', cost: 3, rarity: 'rara', unlockLevel: 3,
    tags: ['feitiço', 'suporte'], role: 'Sustentação',
    description: 'Cura continuamente as suas tropas e construções na área por 4 segundos.',
    spell: { radius: 3, heal: 110, duration: 4, delay: 0, friendly: true },
  },
  {
    id: 'dragonete', name: 'Dragonete de Brasa', type: 'troop', cost: 4, rarity: 'epica', unlockLevel: 4,
    unitId: 'dragonete', count: 1, tags: ['aérea', 'dano em área'],
    role: 'Dano em área aéreo',
    description: 'Cospe brasas que queimam grupos. Resistente e difícil de alcançar.',
  },
  {
    id: 'forja', name: 'Forja de Diabretes', type: 'building', cost: 5, rarity: 'rara', unlockLevel: 4,
    unitId: 'forja', count: 1, tags: ['construção', 'geradora'],
    role: 'Pressão contínua',
    description: 'Gera diabretes periodicamente. Ao ruir, libera mais dois.',
  },
  {
    id: 'hino', name: 'Hino de Guerra', type: 'spell', cost: 2, rarity: 'epica', unlockLevel: 4,
    tags: ['feitiço', 'suporte'], role: 'Amplificador',
    description: 'Suas tropas na área ficam 35% mais rápidas para mover e atacar por 6 segundos.',
    spell: { radius: 4, rage: 0.35, duration: 6, delay: 0, friendly: true },
  },
  {
    id: 'golem', name: 'Golem Rúnico', type: 'troop', cost: 6, rarity: 'epica', unlockLevel: 5,
    unitId: 'golem', count: 1, tags: ['terrestre', 'tanque', 'mira construções'],
    role: 'Tanque de cerco',
    description: 'Colosso lento que só ataca construções. Ao cair, explode e libera dois fragmentos.',
  },
  {
    id: 'geada', name: 'Geada Eterna', type: 'spell', cost: 4, rarity: 'epica', unlockLevel: 5,
    tags: ['feitiço', 'controle'], role: 'Controle de grupo',
    description: 'Congela inimigos e torres na área por 3 segundos e causa dano leve.',
    spell: { radius: 3, damage: 75, freeze: 3, delay: 0.2, towerFactor: 0.5 },
  },
  {
    id: 'feiticeira', name: 'Feiticeira do Abismo', type: 'troop', cost: 5, rarity: 'lendaria', unlockLevel: 6,
    unitId: 'feiticeira', count: 1, tags: ['terrestre', 'à distância', 'antitanque', 'antiaéreo'],
    role: 'Derrubadora de tanques',
    description: 'Um raio contínuo cujo dano cresce muito enquanto mantém o mesmo alvo.',
  },
  {
    id: 'esqueletos', name: 'Esqueletos Errantes', type: 'troop', cost: 1, rarity: 'comum', unlockLevel: 1,
    unitId: 'esqueleto', count: 3, tags: ['terrestre', 'enxame', 'ciclo'],
    role: 'Distração barata',
    description: 'Três esqueletos frágeis por apenas 1 de Éter. Ótimos para distrair tanques e girar o baralho.',
  },
  {
    id: 'faisca', name: 'Faísca Arcana', type: 'spell', cost: 2, rarity: 'comum', unlockLevel: 1,
    tags: ['feitiço', 'dano em área', 'atordoamento'], role: 'Resposta instantânea',
    description: 'Descarga instantânea que causa dano, atordoa por 0,5s e reinicia ataques que carregam.',
    spell: { radius: 2.5, damage: 120, stun: 0.5, delay: 0, towerFactor: 0.35 },
  },
  {
    id: 'canhao', name: 'Canhão de Bronze', type: 'building', cost: 3, rarity: 'comum', unlockLevel: 2,
    unitId: 'canhao', count: 1, tags: ['construção', 'defensiva'],
    role: 'Defesa barata',
    description: 'Construção defensiva barata contra tropas terrestres. Atrai gigantes e golens para o centro.',
  },
  {
    id: 'atiradora', name: 'Atiradora Real', type: 'troop', cost: 4, rarity: 'rara', unlockLevel: 3,
    unitId: 'atiradora', count: 1, tags: ['terrestre', 'à distância', 'antiaéreo'],
    role: 'Dano à distância de alvo único',
    description: 'Besta pesada de longo alcance. Derruba unidades aéreas e apoia avanços.',
  },
  {
    id: 'gigante', name: 'Gigante da Colina', type: 'troop', cost: 5, rarity: 'rara', unlockLevel: 3,
    unitId: 'gigante', count: 1, tags: ['terrestre', 'tanque', 'mira construções'],
    role: 'Tanque de avanço',
    description: 'Ogro resistente que marcha direto para as construções. Proteja-o com tropas de suporte.',
  },
  {
    id: 'berserker', name: 'Berserker do Norte', type: 'troop', cost: 4, rarity: 'epica', unlockLevel: 4,
    unitId: 'berserker', count: 1, tags: ['terrestre', 'corpo a corpo', 'dano em área'],
    role: 'Destruidor de enxames',
    description: 'Gira o machado e atinge todos os inimigos terrestres ao redor de uma vez.',
  },
];

export const CARD_MAP = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export function getCard(id) {
  const c = CARD_MAP[id];
  if (!c) throw new Error(`Carta desconhecida: ${id}`);
  return c;
}

/** Multiplicador de atributos por nível da carta. */
export function levelMult(level) {
  return Math.pow(1.1, Math.max(0, (level | 0) - 1));
}

export const MAX_CARD_LEVEL = 9;

/** Validação estrutural dos dados — falha cedo se alguém cadastrar uma carta inconsistente. */
export function validateCards(cards = CARDS) {
  const errors = [];
  const ids = new Set();
  for (const c of cards) {
    if (ids.has(c.id)) errors.push(`id duplicado: ${c.id}`);
    ids.add(c.id);
    if (!(c.cost >= 1 && c.cost <= 10)) errors.push(`${c.id}: custo inválido`);
    if (!RARITIES[c.rarity]) errors.push(`${c.id}: raridade inválida`);
    if (!['troop', 'building', 'spell'].includes(c.type)) errors.push(`${c.id}: tipo inválido`);
    if (c.type === 'spell') {
      if (!c.spell || !(c.spell.radius > 0)) errors.push(`${c.id}: feitiço sem raio`);
    } else {
      const u = UNITS[c.unitId];
      if (!u) errors.push(`${c.id}: unidade ${c.unitId} inexistente`);
      else {
        if (!(u.hp > 0)) errors.push(`${c.id}: hp inválido`);
        if (c.type === 'building' && !u.building) errors.push(`${c.id}: construção sem flag building`);
        if (u.deathSpawn && !UNITS[u.deathSpawn.unitId]) errors.push(`${c.id}: deathSpawn inválido`);
        if (u.spawn && !UNITS[u.spawn.unitId]) errors.push(`${c.id}: spawn inválido`);
      }
      if (!(c.count >= 1)) errors.push(`${c.id}: count inválido`);
    }
    if (!c.name || !c.description) errors.push(`${c.id}: sem nome/descrição`);
  }
  return errors;
}
