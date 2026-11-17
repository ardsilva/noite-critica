# Noite Crítica — Plano de produção

> Dono: Produção · v0.1 · Organizado como um estúdio clássico, mesmo com equipe de uma pessoa:
> cada "departamento" abaixo é um chapéu, com seus entregáveis e sua definição de pronto.

## 1. Departamentos e entregáveis

| Departamento | Responsável por | Entregável da v0.1 | Próximo entregável |
|---|---|---|---|
| **Direção** | Visão, pilares, corte de escopo | Pilares e estrutura da temporada (GDD §2, §8) | Responder às perguntas em aberto (GDD §11) |
| **Game Design** | Mecânicas, verbos, PV, iniciativa | GDD | Regra de 0 PV / resgate de retrato; soluções alternativas |
| **Narrativa** | Mundo, personagens, falas, cutscenes | Bíblia + roteiro do cap. 1 (NARRATIVA) | Roteiro do cap. 2; revisão de voz por personagem |
| **Puzzle / Level Design** | Grafos de dependência, salas, dicas | PUZZLES + 2 salas jogáveis | Blockout e grafo do porão (cap. 2) |
| **Arte 3D (Blender)** | Personagens, cenários, props | 6 crianças, jardim, hall (2 estados), gerados por script | Passe manual de modelagem; rig humanoide |
| **Animação / Cinemática** | Ciclos, gestos, cutscenes | Animação procedural; 3 cutscenes por tuplas | Clips de andar/idle/gesto; Timeline no Unity |
| **Arte 2D / UI** | Painel de verbos, retratos, tipografia | UI completa da build web | Ícones de item desenhados (hoje são emoji) |
| **Áudio** | Trilha, efeitos, voz | Sintetizador em tempo real | Tema principal gravado; biblioteca de SFX |
| **Engenharia** | Motores, pipeline, build, deploy | Motor web, intérprete, pipeline Blender, scaffold Unity | Projeto Unity real; save; localização |
| **QA** | Testes, matriz de dead-ends | Playthrough automatizado (`npm test`) | Playtest com 5 pessoas; telemetria de travamento |
| **Produção** | Roadmap, marcos, riscos | Este documento | Burndown por capítulo |

## 2. Marcos

| Marco | Conteúdo | Critério de pronto | Estado |
|---|---|---|---|
| **M0 — Fatia vertical web** | Cap. 1 jogável do início ao fim no navegador, com cutscenes, 2 salas, 6 classes | `npm test` passa; publicado na Vercel | **Concluído (v0.1)** |
| **M1 — Projeto Unity de pé** | Abrir `unity/` no Unity 6, importar GLB, implementar `IGameServices`, jogar o cap. 1 | Cap. 1 completo no editor do Unity lendo o mesmo JSON | A fazer (precisa de máquina com Unity) |
| **M2 — Passe de arte** | Remodelar à mão sobre o blockout, rig + clips, materiais, iluminação URP | Comparativo antes/depois aprovado pela direção | A fazer |
| **M3 — Capítulo 2** | Porão: 2 a 3 salas, mecânica "dois lados" (Caio sozinho + grupo no hall) | Jogável na web e no Unity | Pré-produção |
| **M4 — Infra de produto** | Save, opções, localização EN, telemetria | Save persiste entre sessões | A fazer |
| **M5 — Demo pública** | Cap. 1 + 2 polidos, página, trailer | Playtest externo sem travamentos > 5 min | A fazer |

## 3. Backlog priorizado (próxima sessão)

1. **[Direção]** Responder GDD §11 (Creatura Crunch, grupo fixo ou 3 de 6, idioma, monetização).
2. **[Engenharia]** M1: abrir o scaffold no Unity 6 e corrigir o que o compilador apontar
   (ver `unity/README.md`).
3. **[Engenharia]** Save em `localStorage` (flags, inventário, PV, sala) na build web.
4. **[Puzzle]** Grafo de dependências do cap. 2 antes de modelar qualquer coisa.
5. **[Arte]** Segundo ângulo de câmera no jardim (close da porta) e no hall (close do relógio).
6. **[Design]** Uma solução alternativa por puzzle principal (ex.: Leo distrai o corvo com música
   enquanto Caio pega a argola).
7. **[Áudio]** Tema principal construído sobre as 4 notas da senha.
8. **[QA]** Suporte a toque (mobile): hoje o jogo assume mouse e hover.

## 4. Pipeline de conteúdo (como se faz uma sala nova)

1. **Puzzle design** escreve o grafo (Mermaid) em `docs/`.
2. **Level design** faz o blockout em `blender/build_assets.py` (ou num `.blend` manual),
   nomeando `hs_*` e `st_*` conforme o contrato (TECH §3).
3. `npm run assets` exporta o GLB.
4. **Narrativa/Design** escreve a sala em `content/chapterN.json`: câmera, área de caminhada,
   hotspots, regras, dicas, cutscenes.
5. `npm run dev` para jogar; `tools/playthrough.mjs` ganha o roteiro de solução da sala nova.
6. **Arte** substitui o blockout mantendo os nomes. Nada no JSON muda.

## 5. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Scaffold Unity nunca foi compilado | M1 demora mais do que parece | Tratar M1 como tarefa própria; a build web segue jogável em paralelo |
| Dois motores para manter | Divergência de comportamento | Regra: lógica só no JSON; `npm test` é a referência de comportamento |
| Arte gerada por script tem teto de qualidade | Visual de protótipo | M2 é passe manual; o script vira só blockout |
| 8 capítulos é muito conteúdo para 1 pessoa | Projeto não termina | Cada capítulo é publicável sozinho; cortar cap. 3 a 7 para 3 capítulos se preciso |
| Sem toque/mobile | Perde metade do público web | Item 8 do backlog antes da demo pública |
| Referências reconhecíveis demais | Problema de identidade/IP | Nenhum nome, personagem, arte ou texto de obras existentes; revisão a cada capítulo |

## 6. Convenções

- **Git**: `main` sempre jogável. Um branch por capítulo ou sistema. Commits no imperativo.
- **Versão**: `0.<capítulo>.<patch>` até a demo pública.
- **Idioma**: documentação e textos de jogo em PT-BR; código e nomes de nós em inglês/ASCII.
- **Definição de pronto de um capítulo**: grafo documentado, solução no teste automatizado, matriz
  de dead-ends revisada, README atualizado.
