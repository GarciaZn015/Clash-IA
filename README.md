# Bastiões do Éter

Jogo de batalha estratégica em tempo real com cartas, em fantasia medieval estilizada. Dois comandantes disputam uma arena invocando tropas, construções e feitiços para derrubar as torres do adversário. Universo, nomes, arte, sons e regras são originais.

## Como executar

Requisitos: Node.js 18 ou superior. Não há dependências para instalar.

```bash
npm start          # servidor local em http://localhost:5173
```

Abra o endereço no navegador (desktop ou celular). Qualquer servidor estático também funciona, porque o jogo é HTML + JavaScript (módulos ES) sem etapa de build. Abrir o `index.html` direto via `file://` não funciona, porque os navegadores bloqueiam módulos ES nesse modo.

### Comandos

| Comando | O que faz |
| --- | --- |
| `npm start` | Servidor estático local (porta 5173, ou `node scripts/serve.mjs 8080`). |
| `npm test` | Testes automatizados das regras (Node test runner, sem dependências). |
| `npm run simulate -- 10 hard easy` | Partidas IA x IA sem renderização, com o resultado de cada uma. |
| `npm run balance -- 300` | Teste de balanceamento: taxa de vitória por carta em partidas IA x IA com baralhos aleatórios. |
| `npm run smoke` | Teste no navegador real (Chromium via Playwright, se instalado): menus, arrasto de cartas, redimensionamento, pausa, fim de partida, salvamento. As capturas de tela ficam em `screenshots/`. |

## Como jogar

- Destrua a **Torre do Rei** inimiga para vencer na hora. Se o tempo (3 min) acabar, vence quem tiver mais **coroas** (uma por torre destruída).
- Em caso de empate, vem a **prorrogação** de 1 min com morte súbita. Depois dela, vence quem preservou mais vida nas torres; se a vida for igual, a partida termina empatada.
- **Éter** regenera até 10. No último minuto e na prorrogação, regenera em dobro.
- Arraste uma carta até a arena, ou toque na carta e depois no local. A tropa aparece exatamente onde você tocou; se o toque cair um pouco dentro do rio ou sobre uma torre, ela vai para o ponto válido mais próximo. No teclado, as teclas `1`–`4` selecionam cartas e `Esc`/`P` pausam.
- Tropas e construções só podem ser posicionadas no seu lado do rio. Ao derrubar uma torre auxiliar inimiga, você também pode posicioná-las naquela lateral do campo inimigo. Feitiços podem ser lançados em qualquer lugar.

## Funcionalidades

- **Partida completa contra a IA**: contagem regressiva, cronômetro, Éter em dobro, prorrogação, desempate, tela de resultado com estatísticas, pausa e desistência.
- **25 cartas** nos arquétipos clássicos do gênero, todas com nome, arte e personagens próprios: tanques que miram construções (Gigante da Colina, Golem Rúnico), enxames terrestres e aéreos (Esqueletos Errantes, Diabretes, Corvos), tropas à distância (Arqueiras, Atiradora Real, Mago), corpo a corpo (Escudeiro, Berserker com ataque giratório), construções (Canhão, Balista, Forja), feitiços de dano, controle e suporte (Faísca Arcana com atordoamento, Meteoro, Saraivada, Geada, Fonte de Cura, Hino de Guerra) e especialistas (Feiticeira com dano crescente, Cavaleiro Javali, Grifo com mergulho).
- **Combate real**: tropas terrestres só atravessam o rio pelas pontes (o corpo inteiro precisa estar sobre as tábuas), colisões, seleção de alvos (terrestre/aéreo/construções), projéteis teleguiados, dano em área, escudo, congelamento, cura, aceleração, efeitos ao morrer e unidades geradas.
- **IA** em três dificuldades (Fácil, Normal, Difícil). Ela lê o estado da partida e decide entre defender a lane ameaçada com contra-escolhas, lançar feitiços que valham o custo, finalizar torres, contra-atacar com tropas sobreviventes, montar ataques com tanque e evitar desperdício de Éter.
- **Progressão**: XP e nível do jogador, moedas, troféus, desbloqueio de cartas por nível, coleção, melhoria de cartas (cópias + moedas), 3 baralhos editáveis, baús com tempo de destrancamento, loja diária, presente diário, missões diárias, conquistas e histórico das últimas 20 partidas.
- **Persistência** em `localStorage` com validação e saneamento. Um salvamento corrompido é preservado como backup e o jogo reinicia sem travar.
- **Apresentação**: personagens no estilo chibi de jogos mobile, com contorno e sombreamento; torres de pedra com estandartes; arena com gramado, calçamento, rio animado e pontes de madeira; cartas com moldura por raridade e gota de Éter. Toda a arte é procedural (unidades, torres, retratos das cartas), 3 arenas temáticas, partículas, anéis de impacto, números de dano, tremor de tela, banners de eventos. Áudio sintetizado em tempo real (efeitos e trilha), com volumes independentes de música e efeitos.
- **Interface** responsiva (celular e desktop), tutorial inicial, configurações (volumes, mudo, números de dano, efeitos reduzidos).

## Arquitetura

```
src/
  core/         constantes de regras, RNG determinístico, matemática
  data/         cartas, unidades, baralhos da IA, modos e arenas (dados puros e validáveis)
  sim/          simulação autoritativa: Match (estado, regras, combate), deck, posicionamento, navegação
  ai/           AIController (lê o estado, joga via match.playCard)
  progression/  perfil, economia (baús/loja), missões/conquistas, recompensas, armazenamento
  render/       Renderer (canvas), Effects (partículas/feedback), sprites procedurais
  audio/        AudioEngine (Web Audio) + mapeamento evento→som
  ui/           App (telas e menus), Battle (laço de jogo e entrada), utilitários DOM
tests/          testes das regras críticas (node --test)
scripts/        servidor, simulação, balanceamento, smoke test no navegador
```

Princípios:

- **A simulação não depende da renderização.** `Match` roda em passos fixos de 1/30 s, sem DOM, e é determinística para uma mesma semente. Ela recebe comandos (`playCard`) e emite eventos (`spawn`, `attack`, `hit`, `death`, `towerDestroyed`, `end`…). Renderer, efeitos e áudio só leem esse estado e esses eventos.
- **Regras centralizadas.** Todo dano passa por `Match.applyDamage`, e toda jogada (do jogador ou da IA) passa por `Match.canPlay`/`playCard`. O posicionamento fica em `sim/placement.js` e é compartilhado entre validação, prévia na UI e IA.
- **IDs estáveis.** Entidades se referenciam por `id` (`targetId`), resolvido com `getEntity`, que retorna `null` para entidades mortas. Por isso não sobram referências inválidas. Projéteis cujo alvo morreu somem sem causar dano.
- **Pronto para expansão.** Modos e regras ficam em `data/modes.js` (duração, Éter, prorrogação podem ser sobrescritos por desafios e eventos), assim como as arenas temáticas. Novas cartas são dados validados em `data/cards.js` + `data/units.js`. Para multiplayer, `Match` já é o núcleo determinístico que pode rodar no servidor validando comandos `playCard`.

## Testes

`npm test` cobre: dados das cartas, ciclo do baralho, contagem e início, Éter (consumo, bloqueio, regeneração, limite, dobro), posicionamento (lados, rio, torres, bolsão), travessia por pontes, voo sobre o rio, seleção de alvos, dano, escudo e morte com limpeza de referências, torres e despertar do rei, feitiços, golem e construções geradoras, vitória pelo rei com estado congelado após o fim, empate simultâneo, prorrogação, morte súbita, desempate, determinismo, IA (Éter, defesa, posicionamento válido, uso de feitiços, escala de dificuldade), progressão (XP, desbloqueios, melhorias, baralho, baús, loja, missões, conquistas, recompensas), persistência (ida e volta, dados corrompidos ou adulterados) e desempenho com 150 unidades simultâneas.

## Limitações conhecidas

- Não há multiplayer online. O jogo tem apenas o modo individual contra a IA, como planejado para a primeira versão.
- A arte é vetorial e procedural (sem spritesheets), e as animações são feitas com transformações simples (balanço, investida, recuo).
- Baús e loja usam o relógio local do dispositivo, então alterar a hora do sistema afeta os temporizadores.
- O balanceamento foi medido apenas com partidas IA x IA (`npm run balance`). Partidas humanas podem revelar outras estratégias dominantes.
