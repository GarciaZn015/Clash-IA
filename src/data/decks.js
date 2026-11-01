// Baralhos iniciais e baralhos da IA por dificuldade.

export const STARTER_DECK = ['escudeiro', 'arqueiras', 'lobos', 'diabretes', 'corvos', 'bombardeiro', 'saraivada', 'javali'];

export const AI_DECKS = {
  easy: [
    ['escudeiro', 'arqueiras', 'lobos', 'diabretes', 'corvos', 'bombardeiro', 'saraivada', 'javali'],
  ],
  normal: [
    ['escudeiro', 'arqueiras', 'mago', 'javali', 'meteoro', 'balista', 'diabretes', 'grifo'],
    ['lobos', 'bombardeiro', 'grifo', 'javali', 'saraivada', 'fonte', 'escudeiro', 'corvos'],
    ['gigante', 'atiradora', 'esqueletos', 'faisca', 'canhao', 'bombardeiro', 'meteoro', 'corvos'],
  ],
  hard: [
    ['golem', 'mago', 'dragonete', 'diabretes', 'meteoro', 'saraivada', 'hino', 'arqueiras'],
    ['javali', 'geada', 'balista', 'feiticeira', 'escudeiro', 'corvos', 'meteoro', 'saraivada'],
    ['golem', 'feiticeira', 'grifo', 'lobos', 'forja', 'meteoro', 'bombardeiro', 'fonte'],
    ['gigante', 'berserker', 'atiradora', 'esqueletos', 'faisca', 'canhao', 'hino', 'meteoro'],
  ],
};

export const DIFFICULTIES = {
  easy: { id: 'easy', label: 'Fácil', levelOffset: -1, rewardMult: 0.7 },
  normal: { id: 'normal', label: 'Normal', levelOffset: 0, rewardMult: 1 },
  hard: { id: 'hard', label: 'Difícil', levelOffset: 1, rewardMult: 1.5 },
};
