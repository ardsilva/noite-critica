# Noite Crítica — Documento técnico

> Dono: Engenharia · v0.1

## 1. Visão geral

```
            blender/build_assets.py                 content/chapter1.json
            (Blender 5.x headless)                  (história, regras, cutscenes)
                     │                                        │
                     ▼                                        ▼
            public/assets/*.glb  ───────────────┬──────────────────────────┐
                                                │                          │
                                     src/  (Three.js + Vite)     unity/  (Unity 6, C#)
                                     build web → Vercel          build desktop/WebGL
                                     JOGÁVEL HOJE                SCAFFOLD (não compilado)
```

Duas decisões sustentam tudo:

1. **Conteúdo é dado, não código.** Salas, hotspots, regras de puzzle, falas e cutscenes vivem em
   um JSON. Cada engine tem um intérprete pequeno. Escrever o capítulo 2 é escrever
   `chapter2.json` + modelar as salas, sem tocar no motor.
2. **O Blender é a ferramenta de level design.** O que é clicável ou muda de estado é marcado
   pelo **nome do objeto** no Blender. As engines só leem nomes.

## 2. Por que existe uma build web em Three.js se o alvo é Unity?

O ambiente em que a v0.1 foi produzida não tem o Unity Editor (precisa de licença, interface
gráfica e de uma máquina local). Para ter algo **jogável e publicado hoje**, o vertical slice
roda em Three.js. Não é trabalho perdido:

- os **modelos** são os mesmos GLB que o Unity importa;
- o **conteúdo** é o mesmo JSON;
- o **intérprete** C# (`unity/Assets/Scripts/NoiteCritica`) é uma porta 1:1 do JS.

A build web continua útil depois como **demo de navegador** (capítulo 1 grátis) e como bancada de
teste rápido de puzzles (o teste automatizado joga o capítulo inteiro em segundos).

## 3. Contrato de nomes (Blender → engines)

| Prefixo | Significado | Exemplo |
|---|---|---|
| `hs_<id>` | Hotspot clicável (o nó e todos os filhos). `<id>` casa com `rooms.<sala>.hotspots.<id>` | `hs_mailbox` |
| `st_<id>` | Objeto de estado, ligado/desligado por `["show"]` / `["hide"]` | `st_door_open` |
| `win_*` | Vidraça: a engine controla a emissão | `win_3` |
| `glow_*` | Malha emissiva animada (tocha, olho, lacre) | `glow_torch` |
| `house_*` / `dung_*` | Conjuntos da sala antes/depois da transformação | `dung_set` |
| `kid_<id>` → `body, head, armL, armR, legL, legR` | Hierarquia do personagem, pivô na junta | `kid_tomas` |

Eixos: no Blender, **X direita, Y fundo, Z cima**. O export glTF converte para Y-cima; as
coordenadas no JSON são `[x, z]` no chão, em metros, já no espaço glTF (o Unity inverte Z).

## 4. Esquema do conteúdo (`content/chapter1.json`)

```jsonc
{
  "party":  [{ "id", "name", "cls", "verb", "icon", "color", "ini", "hp", "emb" }],
  "items":  { "<id>": { "name", "icon", "rules": [Regra] } },
  "macros": { "<nome>": [Efeito] },
  "ui":     { "melody": { "answer", "ok": [Efeito], "fail": [Efeito] }, "clock": { ... } },
  "rooms":  { "<id>": { "asset", "camera", "walk", "spawn", "hide", "hints", "protos", "hotspots" } },
  "cutscenes": { "<id>": [Efeito] }
}
```

**Regra**: `{ "v": verbo, "who"?: criança, "item"?: item, "if"?: [condição], "do": [Efeito] }`.
A lista é percorrida em ordem; vale a **primeira** que casa. Sem regra, cai em `strings.defaults`.

- Verbos: `look`, `take`, `use`, `talk`, `ability` (o verbo de classe da criança ativa), `item`.
- Condições: `"flag"`, `"!flag"`, `"has:item"`, `"low"` (ativo com 1 PV). `$a` = criança ativa.
- `proto` + `kid`: hotspots repetidos (6 portas, 6 retratos) compartilham regras com `{name}`,
  `{cls}`, `{ini}`, `{emb}` preenchidos a partir da ficha.

**Efeitos** (tuplas `[op, ...args]`):

| Op | Args | Faz |
|---|---|---|
| `say` | quem, texto | Fala sobre a cabeça do personagem |
| `mestre` / `voice` | texto / nome, cor, texto | Caixa de voz do Mestre ou de um PNJ |
| `card`, `title`, `read` | texto(s) | Cartão de cena, título, papel legível |
| `set`, `unset` | flag | Estado do mundo |
| `give`, `take` | item | Inventário |
| `hp` | quem, delta | PV (negativo aplica `hurt_<quem>`) |
| `show`, `hide` | nomes... | Liga/desliga nós `st_*` |
| `sfx`, `fx` | nome | Som / efeito especial com nome (`thunder`, `transform_hall`...) |
| `anim` | quem, gesto | `cast`, `use`, `push`, `play`, `hurt`, `cheer` |
| `cam`, `camreset` | pos, alvo, seg / seg | Câmera de cutscene |
| `d20` | caminho, seg | Rola o Dado de Osso por um caminho |
| `wait`, `obj`, `room`, `walk`, `place` | ... | Utilitários |
| `if`, `call`, `cutscene`, `ui`, `end` | ... | Fluxo |

## 5. Build web (`src/`)

| Arquivo | Papel |
|---|---|
| `main.js` | Renderer, salas, atores, input, intérprete de regras, cutscenes, UI, efeitos |
| `audio.js` | Sintetizador WebAudio (música e efeitos; zero arquivos de áudio) |
| `portraits.js` | Retratos 2D em canvas (barra do grupo e quadros do hall) |
| `style.css` | Painel de verbos, falas, sobreposições |

- **Render**: Three.js r187, ACES, sombras PCF de uma luz direcional, bloom. `?fx=0` desliga
  bloom e sombras para máquinas fracas.
- **Navegação**: clique → raio no plano do chão → linha reta, limitada por um retângulo e por
  círculos de bloqueio (`rooms.<id>.walk`). Sem pathfinding (as salas são convexas o bastante).
  No Unity isso vira NavMesh.
- **Animação**: procedural (balanço de pernas/braços, gestos). Sem rig, sem clips.
- **API de teste**: `window.game` (`act`, `item`, `heal`, `ui.melody`, `ui.clock`, `idle`).
- **Estado**: em memória. **Não há save ainda** (capítulo de ~15 min); ver roadmap.

### Comandos

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # gera dist/
npm run assets     # regenera os GLB (precisa de: pip install bpy)
npm run preview -- --port 4173   # e, em outro terminal:
npm test           # joga o capítulo inteiro num Chromium headless e grava capturas
```

## 6. Unity (`unity/`)

Estado: **scaffold de código, nunca aberto no editor nem compilado.** Tratar como ponto de
partida revisado, não como projeto pronto. Passo a passo em [`unity/README.md`](../unity/README.md).

| Script | Porta de |
|---|---|
| `GameState.cs` | `S`, `test()`, `findRule()` |
| `RuleRunner.cs` | `run()`, `cutscene()`, `interact()` |
| `RoomBinder.cs`, `Hotspot.cs` | `setupRoom()` (contrato de nomes) |
| `KidActor.cs` | `Actor` (NavMeshAgent + animação procedural) |
| `PointClickController.cs` | input |
| `IGameServices.cs` | interface da apresentação (UI, câmera, áudio, FX) — **a implementar** |

Plano recomendado no Unity: URP, glTFast para importar os GLB, AI Navigation (NavMesh),
Cinemachine para as câmeras fixas por sala, Timeline para cutscenes "de autor" (as tuplas do JSON
servem para o grosso; as cenas-chave merecem Timeline), UI Toolkit para o painel de verbos.

## 7. Publicação

- **Web**: Vercel, projeto ligado ao GitHub; preset Vite (`npm run build` → `dist/`). Todo push em
  `main` publica produção; todo PR ganha preview.
- **Unity WebGL na Vercel** (futuro): o Unity gera uma pasta estática. Ela pode ser publicada
  como um segundo projeto Vercel. Atenção: builds comprimidas com Brotli precisam do cabeçalho
  `Content-Encoding` configurado em `vercel.json`, e builds acima de ~100 MB pedem os dados em
  storage externo (Supabase Storage ou R2).
- **Desktop**: itch.io / Steam, a partir do Unity.

## 8. Serviços (planejado, nada disso existe na v0.1)

| Necessidade | Proposta |
|---|---|
| Save na nuvem, contas | Supabase (Auth + tabela `saves` com RLS por usuário) |
| Venda de capítulos | Stripe Checkout + webhook em função serverless da Vercel → tabela `entitlements` no Supabase |
| Telemetria de puzzles (onde o jogador trava) | Tabela `events` no Supabase, eventos anônimos por flag |
| Localização | Extrair strings do JSON para `locales/<lang>.json` por chave |
