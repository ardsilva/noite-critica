# Noite Crítica — projeto Unity (scaffold)

**Estado: código de partida, nunca aberto no Unity Editor nem compilado.** Foi escrito como porta
1:1 do motor web (`src/main.js`) para que o capítulo 1 rode no Unity lendo o mesmo
`content/chapter1.json` e os mesmos GLB. Espere corrigir erros de compilação na primeira abertura.

## Montar o projeto (Unity 6 LTS, template 3D URP)

1. No Unity Hub: **New project → Universal 3D**, apontando para esta pasta `unity/`
   (ou crie em outro lugar e copie `Assets/Scripts/NoiteCritica` para dentro).
2. **Package Manager → Add package by name**:
   - `com.unity.cloud.gltfast` (importar `.glb`)
   - `com.unity.nuget.newtonsoft-json` (ler o JSON do capítulo)
   - `com.unity.ai.navigation` (NavMesh para o clique-para-andar)
   - `com.unity.cinemachine` e `com.unity.timeline` (câmeras e cutscenes)
3. Copie para `Assets/`:
   - `public/assets/*.glb` → `Assets/Models/`
   - `content/chapter1.json` → `Assets/Content/` (vira `TextAsset`)
4. Cena `Chapter1`:
   - Arraste `exterior.glb` e `hall.glb` para a cena. Em cada raiz, adicione **RoomBinder**
     (`roomId` = `exterior` / `hall`; `hiddenAtStart` = lista `rooms.<id>.hide` do JSON).
   - Marque os pisos (`ground`, `dung_floor`) como *Navigation Static* e faça o bake do NavMesh.
   - Arraste os seis `kid_*.glb`; em cada um adicione **NavMeshAgent** + **KidActor** (`kidId`).
   - Um objeto `Game` com **RuleRunner** (JSON, salas, crianças) e **PointClickController**.
   - Implemente `IGameServices` num MonoBehaviour (`GameServices.cs`) e arraste em
     `RuleRunner.servicesBehaviour`. É aqui que entram UI Toolkit, Cinemachine e áudio.
5. Play. O `RuleRunner` roda a cutscene `intro` e libera o jogo.

## O que falta implementar no Unity

| Item | Referência na build web |
|---|---|
| `IGameServices` (falas, Mestre, cartões, leitura, objetivo) | `say`, `voice`, `card`, `title`, `read` em `src/main.js` |
| Painel de verbos, grupo e inventário | `buildPanel()` + `src/style.css` |
| Efeitos com nome (`thunder`, `windows_on`, `eyes_on`, `gargoyle_wake`, `chandelier`, `transform_hall`, `mimic_bite`, `clock_strike`, `open_caio`) | `fx()` |
| Minijogos `melody` e `clock` | `melodyUI()`, `clockUI()` |
| Cura (verbo da Bia em outra criança) e dicas (Falar com colega) | `clickKid()`, `hint()` |
| Retratos do hall (textura por personagem) | `setupRoom()` + `src/portraits.js` |
| Luzes por sala | bloco de luzes em `setupRoom()` |

## Notas de conversão

- glTF usa -Z para frente; o Unity usa +Z. O `RuleRunner` já inverte Z ao ler `[x, z]` do JSON.
  Confira a orientação depois do primeiro import do glTFast (ele também converte).
- Os personagens vêm sem rig: `KidActor` gira os nós `armL/armR/legL/legR` por código. No marco M2
  isso é trocado por rig humanoide + Animator, mantendo a API `Play("cast")`.
- Build WebGL para a Vercel: ver `docs/TECH.md` §7.
