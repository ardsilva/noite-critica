# Handoff: Noite Crítica (para continuar no Claude Code do terminal)

Cole o conteúdo deste arquivo (ou peça ao Claude para ler `HANDOFF.md`) ao abrir o repositório.

## O que é
Point-and-click 2.5D em capítulos. Halloween de 1987: seis crianças jogam um RPG de mesa achado na
varanda de uma mansão; o dado tira 1, a casa vira masmorra, a casa é o Mestre. Jogo autoral (nada
de nomes, arte ou texto de obras existentes). Dono: ardsilva (GitHub e Vercel).

## Estado (v0.1, 2 commits locais, ainda NÃO no GitHub nem na Vercel)
- **Capítulo 1 "O Limiar" jogável de ponta a ponta na web** (Three.js + Vite): intro, jardim, hall,
  transformação do hall em masmorra, final. Seis classes com verbo exclusivo (Bia Curar, Caio Gazua,
  Tomás Força, Íris Magia, Leo Tocar, Nina Rastrear), PV/cura, dicas, 2 minijogos (senha cantada,
  relógio da iniciativa). Puzzle do hall: abre a porta de quem tem a maior iniciativa (Caio, 19).
- **Conteúdo como dados:** `content/chapter1.json` (salas, hotspots, regras, cutscenes). A engine só interpreta.
- **Blender:** `blender/build_assets.py` (bpy headless, `pip install bpy`) gera os GLB em `public/assets/`.
  Contrato de nomes: `hs_*` hotspot, `st_*` estado, `win_*`, `glow_*`, `house_*`/`dung_*`.
- **Unity:** `unity/Assets/Scripts/NoiteCritica/*.cs` é só um scaffold, **nunca compilado**. Falta
  implementar `IGameServices` (UI/câmera/áudio/FX). Ver `unity/README.md`.
- **Testes:** `tools/playthrough.mjs` (joga o capítulo todo) e `tools/mouse.mjs` (cliques reais) passaram.
  Precisam de `npx vite preview --port 4173` rodando e Playwright instalado.
- **Docs:** `docs/GDD.md`, `NARRATIVA.md`, `PUZZLES.md`, `TECH.md`, `PRODUCAO.md`; README atualizado.
- Uma versão jogável (artifact privado do Claude) existe, mas só vive na sessão web.

## O que NÃO foi feito (e por quê)
1. **Repo GitHub e deploy Vercel:** a sessão web só tinha acesso a `ardsilva/maniac-mansion-remake`; criar
   repo novo foi bloqueado. Vercel não tem projeto "noite-critica" ainda.
2. **Unity real:** sem Unity Editor no ambiente.
3. **"Creatura Crunch, o Monstro":** o jogo não foi identificado; nada dele está no design (GDD §11).
4. Sem save, sem toque/mobile; áudio sintetizado; arte é blockout gerado por script.

## Primeiros passos no terminal (nesta ordem)
1. Extrair o repo do bundle (`noite-critica.bundle`, enviado por email e na sessão):
   `git clone noite-critica.bundle noite-critica && cd noite-critica`
2. Criar repo vazio `noite-critica` no GitHub (UI ou `gh repo create ardsilva/noite-critica --public`),
   depois: `git remote set-url origin git@github.com:ardsilva/noite-critica.git && git push -u origin main`
3. Vercel: importar o repo (preset Vite, `npm run build` -> `dist/`, sem env vars), ou `vercel --prod`.
4. Local: `npm install && npm run dev` (http://localhost:5173). Testes: `npm run build && npx vite preview --port 4173`
   e em outro terminal `npm test`.
5. Conferir o jogo online e atualizar o README com a URL da Vercel.

## Depois do deploy (backlog, ordem sugerida)
1. Responder as 4 perguntas do `docs/GDD.md` §11 (Creatura Crunch; grupo fixo ou 3 de 6; idioma; venda
   de capítulos com Stripe + Supabase).
2. M1: abrir `unity/` no Unity 6 (URP, glTFast, Newtonsoft, AI Navigation, Cinemachine), corrigir erros de
   compilação e implementar `IGameServices`.
3. Save em localStorage; suporte a toque.
4. Capítulo 2 "A Vez do Ladino" (porão; Caio sozinho de um lado, grupo ajuda do hall). Escrever o grafo
   de puzzles em `docs/` antes de modelar.

## Regras do projeto
- Lógica de puzzle só no JSON; `npm test` é a referência de comportamento.
- Atualizar o README a cada marco; `main` sempre jogável; commits no imperativo.
- Textos de jogo e docs em PT-BR; código e nomes de nós em ASCII/inglês.
- Nada de nomes, personagens, arte ou texto de jogos existentes.
