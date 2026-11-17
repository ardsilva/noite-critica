# Noite Crítica — Game Design Document

> Versão 0.1 · documento vivo · dono: Game Design
> Fonte de verdade do conteúdo jogável: [`content/chapter1.json`](../content/chapter1.json)

## 1. Conceito em uma frase

Na noite de Halloween de 1987, seis crianças jogam um RPG de mesa achado na varanda de uma mansão
abandonada. O dado tira 1, a casa vira a masmorra, a própria casa é o Mestre, e cada fantasia vira uma
classe de verdade.

## 2. Pilares

| Pilar | O que significa na prática |
|---|---|
| **A casa é o Mestre** | A mansão narra, pede testes, aplica regras e trapaceia. Todo puzzle é uma *regra de mesa* que o jogador precisa entender, não um cadeado arbitrário. |
| **Seis fichas, seis jeitos** | Cada criança tem um verbo exclusivo. Nenhum puzzle se resolve com uma criança só; a graça é trocar de personagem. |
| **Medo de criança, não de adulto** | Tom de aventura assustadora de sessão da tarde: mímicos, gárgulas e corvos. Ninguém morre: quem chega a 0 PV "vira quadro na parede" (e pode ser resgatado). |
| **Capítulos curtos e fechados** | Cada capítulo é uma sessão de 20 a 40 minutos, com começo, clímax e gancho. Produção em fatias verticais. |

## 3. Referências (o que pegamos de cada uma)

- **Aventuras point-and-click de mansão dos anos 80**: elenco jogável que se troca a qualquer momento,
  verbos na tela, humor seco, cutscenes que mostram o que a casa está tramando.
- **Aventuras de crianças dos anos 80 contra o sobrenatural**: a turma de bicicleta, o porão, o mundo
  de fantasia do RPG vazando para o mundo real.
- **RPG de mesa clássico**: iniciativa, testes de atributo, pontos de vida, classes, armadilhas, mímico.
- **"Creatura Crunch, o Monstro"**: referência citada pelo diretor; não foi localizada pela equipe.
  Ver *Perguntas em aberto* (seção 11). Por enquanto, o papel de "criatura que mastiga" é do Mímico.

Tudo no jogo (nomes, personagens, arte, texto, música) é original.

## 4. Elenco jogável

| Criança | Classe | Fantasia de Halloween | Verbo exclusivo | Personalidade | Iniciativa |
|---|---|---|---|---|---|
| **Bia** | Curandeira | Enfermeira de campanha, maleta de primeiros socorros | **Curar** — restaura PV, tira a condição *machucado* | A responsável. Anota tudo. | 8 |
| **Caio** | Ladino | Capuz e máscara de ladrão, argola de gazuas | **Gazua** — abre fechaduras de verdade | Cínico, negociante de doces. | 19 |
| **Tomás** | Cavaleiro | Armadura de papelão, balde na cabeça | **Força** — empurra, levanta, destrava | Coração enorme, dados azarados. | 3 |
| **Íris** | Maga | Chapéu de estrelas, varinha de vela de aniversário | **Magia** — lê runas, solta faísca | A que leu o livro inteiro. | 14 |
| **Leo** | Bardo | Chapéu de pena, teclado de brinquedo | **Tocar** — melodias que abrem, acalmam, distraem | Achou a caixa. A culpa é dele. | 11 |
| **Nina** | Patrulheira | Capa verde, estilingue, binóculo | **Rastrear** — lê rastros, fala com bichos | Observadora, poucas palavras. | 16 |

Cada classe tem um **emblema** (cruz, chave, espada, estrela, nota, flecha) que aparece nas portas do
hall, no relógio e na interface.

## 5. Antagonista: O Mestre

A casa. Fala em caixas de texto roxas, sempre no vocabulário de mesa ("Teste de Força: sucesso").
Não é exatamente mau: é um Mestre que **quer que a campanha termine**, porque faz décadas que nenhuma
mesa chega ao fim. Os retratos nas paredes são mesas anteriores (1931, 1957...) que ficaram a 0 PV.
O arco da temporada é descobrir quem foi o primeiro jogador, e o que acontece quando alguém tira 20.

## 6. Loop de jogo

1. **Explorar** a cena (clicar para andar, olhar, falar).
2. **Ler a regra** que o Mestre impôs ali (placa, convite, fala).
3. **Escolher a ficha certa** e usar o verbo de classe, ou um item, no lugar certo.
4. **Pagar o preço dos erros** em PV (e curar com a Bia).
5. **Destravar a próxima cena** e ganhar um pedaço da história em cutscene.

## 7. Mecânicas

### 7.1 Interface (verbos)
Painel inferior no estilo clássico: grupo (6 retratos com PV), linha de frase, 4 verbos comuns
(**Olhar, Pegar, Usar, Falar**) + 1 **verbo de classe** que muda com a criança ativa, e inventário
compartilhado. Atalhos: `1-6` troca de criança, `Q W E R T` verbos, botão direito olha, `H` pede dica.
Clique simples sem verbo: olha na primeira vez, usa nas seguintes.

### 7.2 Pontos de Vida e condições
- Cada criança tem 3 PV. Armadilhas e jogadas fora da regra tiram 1 PV e aplicam *machucado*.
- *Machucado* bloqueia o verbo de classe em tarefas físicas até a Bia curar.
- Com 1 PV a criança se recusa a fazer coisas perigosas (protege o jogador de travar o jogo).
- No capítulo 1 ninguém chega a 0. A partir do capítulo 2, 0 PV = a criança vira retrato e precisa
  ser resgatada por outra (ver ROADMAP).

### 7.3 Iniciativa
Rolada na cutscene de abertura e registrada no *bloco da sessão*. Define a **ordem dos capítulos**:
a casa abre uma porta por vez, na ordem de iniciativa (Caio 19, Nina 16, Íris 14, Leo 11, Bia 8,
Tomás 3). É a resposta para "qual porta abre, e por quê?".

### 7.4 Sistema de dicas embutido
**Falar** com qualquer colega devolve uma dica contextual sobre o próximo passo (lista ordenada de
condições em `rooms.<sala>.hints`). Sem menu de dicas: a dica vem na voz do personagem.

### 7.5 Soluções alternativas (meta de design, parcial na v0.1)
Como nas aventuras clássicas de elenco, a meta é que puzzles importantes tenham 2 soluções por classes
diferentes. Na v0.1 cada puzzle tem uma solução e várias respostas de "quase" por classe.

## 8. Estrutura da temporada

| Cap. | Título | Porta | Protagonista da provação | Local | Status |
|---|---|---|---|---|---|
| 1 | O Limiar | (entrada) | todos (tutorial das 6 classes) | Jardim + Hall | **jogável (v0.1)** |
| 2 | A Vez do Ladino | Chave | Caio | Porão / adega | pré-produção |
| 3 | A Vez da Patrulheira | Flecha | Nina | Estufa / jardim de inverno | conceito |
| 4 | A Vez da Maga | Estrela | Íris | Biblioteca | conceito |
| 5 | A Vez do Bardo | Nota | Leo | Sala de música / teatrinho | conceito |
| 6 | A Vez da Curandeira | Cruz | Bia | Enfermaria / cozinha | conceito |
| 7 | A Vez do Cavaleiro | Espada | Tomás | Sala de armas | conceito |
| 8 | A Mesa do Mestre | — | todos | Sótão | conceito |

Detalhes narrativos em [NARRATIVA.md](NARRATIVA.md); puzzles do capítulo 1 em [PUZZLES.md](PUZZLES.md).

## 9. Direção de arte

- **2.5D**: cenários e personagens 3D low-poly, câmera fixa por sala com leve paralaxe, como um
  diorama de papelão iluminado por lanterna.
- **Personagens**: "bonecos de fantasia caseira", cabeça grande, fantasia legível de longe pela
  silhueta e pela cor da classe.
- **Luz**: noite azul fria fora, janelas e abóboras quentes; dentro da masmorra, tochas roxas (a cor
  do Mestre) contra dourado dos emblemas.
- **Duas camadas de realidade**: toda sala tem versão *casa* e versão *masmorra* (conjuntos
  `house_*` e `dung_*` no mesmo arquivo). A transformação é sempre mostrada em cena.
- **UI**: pixel-fonte para verbos, fonte gótica de caixa de jogo de tabuleiro para o Mestre e títulos.

## 10. Áudio

- v0.1: tudo sintetizado em tempo real (WebAudio): tema em arpejo menor, vento, efeitos.
- Meta: trilha chiptune + instrumentos de brinquedo (kalimba, melódica, teclado de plástico).
  O instrumento do Leo é diegético: as 4 notas da senha são o motivo do tema principal.

## 11. Perguntas para o diretor (respondidas em 2026-11-17)

**Decisões:** (1) Creatura Crunch: ignorar, nada dele entra no design. (2) Equipe de **3 de 6**: no cap. 2, Caio obrigatório + 2 apoios entre os 5 restantes (opção A). (3) **PT-BR primeiro**, EN depois do cap. 2. (4) **Tudo grátis por ora**, sem Stripe/Supabase. Perguntas originais abaixo, para histórico.

1. **Creatura Crunch, o Monstro**: não achamos o jogo com esse nome. O que você quer trazer dele:
   o monstro que come coisas, o humor, a estrutura? Com isso definimos se o Mímico vira mascote
   recorrente ou se entra uma criatura nova no capítulo 2.
2. **Grupo fixo ou escolha de equipe?** Hoje as 6 crianças andam juntas. Alternativa clássica:
   escolher 3 de 6 por capítulo (aumenta rejogabilidade, multiplica o custo de conteúdo).
3. **Idioma**: PT-BR primeiro. Inglês desde já (os textos já estão isolados no JSON) ou depois?
4. **Monetização** (se houver): capítulo 1 grátis na web, demais pagos? Se sim, o plano técnico é
   Stripe Checkout + Supabase para contas e saves na nuvem (ver TECH.md).
