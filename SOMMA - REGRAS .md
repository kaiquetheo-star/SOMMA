# REGRA 1: O Algoritmo do "X-Frame" (Viés de Seleção do Catálogo)

Objetivo: Garantir que o motor determinístico do SOMMA V8 selecione, rankeie e distribua exercícios do bundledCatalog.ts (ou library\_exercises) com viés estético prioritário para o formato em "X": ombros largos, dorsais largas, pernas volumosas e cintura preservada. A regra opera exclusivamente sobre metadados do catálogo e é aplicada dentro de selectExercisesForSplit e finalizeGameplanOrdering.  
---

### 1.1. Mapeamento de Prioridade Biomecânica (selection\_score)

O engine deve calcular um peso de seleção para cada exercício elegível com base nos campos primary\_muscle, movement\_pattern e synergist\_muscles. O score define a ordem de preferência na montagem do split.

| primary\_muscle / Padrão | selection\_score | Justificativa Estética |
| ----- | ----- | ----- |
| deltoid\_lateral | 3.0 | Alargamento visual do superior; ilusão de cintura fina |
| pectoralis\_major\_clavicular | 2.5 | "Capa de armadura" superior; conexão peitoral-ombro |
| latissimus\_dorsi \+ movement\_pattern: vertical\_pull | 2.5 | Largura dorsal (V-Shape) que empurra a silhueta para fora |
| quadriceps (viés vasto lateral) \+ knee\_dominant | 2.0 | Volume externo da coxa; base do X |
| hamstrings / gluteus\_maximus | 1.5 | Espessura posterior; equilíbrio estrutural e joelho |
| Demais músculos / manutenção | 1.0 | Volume complementar ou saúde articular |

*Regra de desempate:* Se selection\_score for igual, priorizar exercícios com stretch\_mediated\_hypertrophy: true e menor cns\_fatigue\_cost.  
---

### 1.2. Filtro de Composição por Split (selectExercisesForSplit)

A função que monta os blocos de Iron deve injetar cotas obrigatórias por sessão, respeitando a rotação Push/Pull/Legs/Upper/Lower definida no weeklyMicrocycle.

| Split | Cota Obrigatória (mínimo por sessão) | Exemplos de movement\_pattern / Catálogo |
| ----- | ----- | ----- |
| Push / Upper | ≥1 deltoid\_lateral (tensão constante) ≥1 pectoralis\_major\_clavicular | Elevação lateral polia/máquina, Supino inclinado 30-45º, Crossover baixo-alto |
| Pull / Upper | ≥1 vertical\_pull (pegada aberta/pronada) ≥1 horizontal\_pull | Puxada alta aberta, Barra fixa, Remada curvada ou cavaleiro |
| Legs / Lower | ≥1 knee\_dominant (viés vasto lateral) ≥1 hip\_hinge ou knee\_flexion | Hack Squat (pés baixos/juntos), Leg Press 45º, Stiff, Mesa Flexora |
| Full Body | Mescla das cotas acima, limitado a 5-6 exercícios | Prioriza compostos de alto selection\_score |

*Distribuição Semanal:* O motor deve garantir que deltoid\_lateral apareça em 3 a 4 sessões/semana, com volume fracionado (ex: 3-4 séries/sessão), nunca concentrado em um único dia. Isso maximiza a síntese proteica natural/TRT sem exceder o MRV.  
---

### 1.3. Protocolo de Proteção de Cintura (Blacklist Determinística)

Para preservar a ilusão do X, o engine aplica um filtro de exclusão rígido antes de qualquer seleção. Exercícios que espessam a linha da cintura são bloqueados ou limitados ao MEV (Volume Mínimo Eficaz).

| Condição de Bloqueio | Ação do Engine |
| ----- | ----- |
| movement\_pattern \=== "lateral\_flexion" | BLOQUEADO (ex: flexão lateral com halter/polía) |
| primary\_muscle \=== "obliques" ou synergist\_muscles contendo "obliques" com carga axial | BLOQUEADO ou limitado a 1x/semana, carga leve |
| primary\_muscle \=== "rectus\_abdominis" com cns\_fatigue\_cost \>= 4 | LIMITADO a 1x/semana; foco em contração, não hipertrofia espessa |
| joint\_stress\_profile contendo "lumbar\_shear" \+ carga alta | SUBSTITUÍDO por variação estável (ex: Hack no lugar de Agacho livre se lombar fadigada) |

*Substituto de Core:* O InstructionPanel deve injetar diariamente o cue de Stomach Vacuum (transverso do abdômen) como ritual de recuperação. Não conta como bloco de Iron, mas como prática de Flow/Spirit ou nota de encerramento.  
---

### 1.4. Ordenação Neuro-Mecânica (finalizeGameplanOrdering)

Dentro do bloco diário, a ordem dos exercícios segue a fadiga do SNC e o objetivo X-Frame:

1. Compostos Prioritários (selection\_score \>= 2.0 e cns\_fatigue\_cost \>= 3) → Posicionados no início do bloco (SNC fresco).  
2. Isoladores de Ombro/Peito Superior (deltoid\_lateral, clavicular) → Meio do bloco ou técnica de pré/pós-exaustão.  
3. Isoladores de Perna/Posterior (knee\_extension, knee\_flexion) → Final do bloco, foco em pump e tensão metabólica.  
4. Se telemetrySuggestsPoorRecovery \=== true (ACWR \> 1.5 ou RPE σ elevado), o motor mantém os isoladores de baixo cns\_fatigue\_cost (ex: elevação lateral, cadeira extensora) e reduz/remove os compostos pesados do dia, preservando o estímulo X-Frame sem fritar o sistema nervoso.

---

### 1.5. Validação Determinística & Injeção de Cues

Após a montagem do weeklyMicrocycle, o motor roda sanitizeBlueprint() com as seguintes verificações:

* Proporção X-Frame: ≥60% do volume semanal de Iron deve vir de exercícios com selection\_score \>= 2.0. Se não, o fallback determinístico substitui exercícios genéricos por alternativas do catálogo com score maior.  
* Cues Biomecânicos: Os biomechanical\_instructions (JSONB) dos exercícios selecionados são renderizados no ExerciseCueCard com foco estético:  
  * *Hack Squat:* "Pés na largura dos ombros, posição baixa na plataforma. Empurre os joelhos para fora. Foco no vasto lateral. Não tranque o joelho no topo."  
  * *Elevação Lateral Polia:* "Cabo cruzado atrás do corpo. Mantenha tensão constante no deltoide lateral. Evite elevação escapular (trapézio fora)."  
  * *Puxada Aberta:* "Peito estufado, inicie o movimento puxando com os cotovelos. Foco na porção inferior/média da dorsal para largura."

### 1.6. Contrato TypeScript (Exemplo \- Resumo para lib/gameplan/engine/)

// Estrutura de configuração injetada em selectExercisesForSplit  
export const XFRAME\_BIAS\_CONFIG \= {  
  priorityWeights: {  
    deltoid\_lateral: 3.0,  
    pectoralis\_major\_clavicular: 2.5,  
    latissimus\_dorsi\_vertical: 2.5,  
    quadriceps\_vastus\_lateral\_bias: 2.0,  
    hamstrings\_glutes: 1.5,  
    default: 1.0  
  },  
  blacklistPatterns: \['lateral\_flexion', 'weighted\_oblique\_isolation', 'high\_load\_rectus\_abdominis'\],  
  minWeeklyFrequency: {  
    deltoid\_lateral: 3,  
    latissimus\_dorsi: 2,  
    quadriceps: 2  
  },  
  waistProtection: {  
    blockObliques: true,  
    limitRectusAbdominis: { maxSessionsPerWeek: 1, maxCnsCost: 3 }  
  }  
} as const;

// Fluxo lógico dentro do engine:  
// 1\. Filtrar bundledCatalog por equipment\_available \+ split pattern  
// 2\. Calcular selection\_score com base em primary\_muscle \+ movement\_pattern  
// 3\. Remover exercícios que batem com blacklistPatterns  
// 4\. Garantir minWeeklyFrequency distribuída no weeklyMicrocycle  
// 5\. Ordenar por selection\_score (desc) → cns\_fatigue\_cost (asc)  
// 6\. Validar proporção X-Frame ≥60% → fallback determinístico se necessário  
// 7\. Injetar biomechanical\_instructions no ExerciseCueCard

# REGRA 2: Telemetria de Carga, Fator TRT e Gestão de Conflitos (O Guardião do SNC)

Objetivo: Garantir que o Head Coach local (lib/gameplan/engine/ e lib/physics/loadTelemetry.ts) use a telemetria de carga interna (sRPE, ACWR) e o Portão RIR para autoregular o treino, protegendo o atleta do overtraining, gerenciando a retenção hídrica da transição hormonal e evitando que o HIIT destrua o dia de pernas. Tudo isso rodando 100% on-device ($0 API).  
---

### 2.1. O Portão RIR (RIR Gate) e a Sobrecarga Progressiva Determinística

No SOMMA V8, a IA não "acha" que você deve aumentar o peso. O RirSelector (pós-série) é o gatilho biológico para a matemática do engine.

* A Conversão: O reported\_rir (0 a 4\) inserido por você é convertido em RPE efetivo (rpe\_score \= 10 \- reported\_rir) e salvo no performance\_logs.  
* A Lógica de Progressão (performanceLogs.ts):  
  * Se reported\_rir \<= 2 (Você chegou perto da falha real, tensão mecânica máxima) \*\*E\*\* o ACWR (ver 2.2) estiver na zona verde \-\> O engine calcula o E1RM (Epley) e prescreve \+2.5% de carga ou \+1 repetição para a próxima sessão.  
  * Se reported\_rir \>= 3 (Você poupou demais, "junk volume") \-\> O engine mantém a carga, mas o TargetLoadBanner na UI exibe o cue: *"A via mTOR exige tensão. Aumente a intensidade na próxima."*  
  * Se reported\_rir \== 0 (Falha concêntrica total) em exercícios de alto cns\_fatigue\_cost (ex: Agachamento Livre, Stiff) \-\> O engine detecta risco de lesão/SNC frito e aplica um micro-deload de 5% na próxima sessão para proteger o sistema nervoso.

### 2.2. Telemetria de Carga Interna (ACWR e RPE σ)

O loadTelemetry.ts calcula a fadiga sistêmica usando o sRPE (RPE da sessão × duração em minutos).

* ACWR (Acute:Chronic Workload Ratio): Compara a carga dos últimos 7 dias (Aguda) com a média dos últimos 28 dias (Crônica).  
  * Zona Verde (0.8 a 1.3): O engine libera o volume para o MRV (foco em hipertrofia máxima).  
  * Zona de Alerta (\> 1.5 \- Spike de Carga): telemetrySuggestsPoorRecovery retorna true. O finalizeGameplanOrdering entra em modo de proteção: remove exercícios compostos de alto impacto articular/SNC (ex: troca Agachamento Livre por Hack Squat ou Leg Press) e reduz o volume total em 20% para a semana seguinte, mantendo apenas a tensão mecânica necessária para não perder massa.  
* RPE σ (Desvio Padrão do RPE): Se o seu RPE variar muito (ex: num dia você treina a RPE 7, no outro a RPE 10), o engine detecta inconsistência de esforço e força um bloco de "Deload Técnico" (cargas moderadas, foco em cadência e conexão mente-músculo).

### 2.3. O Fator TRT (A Transição Hormus → Durateston)

Durante as primeiras 4 a 6 semanas da transição de ésteres, seu corpo vai lidar com a "cauda" do Hormus somada aos picos da Durateston. Isso gera flutuação de Estradiol (E2) e retenção hídrica subcutânea e intramuscular.

* A Regra do Passaporte Biológico: O user\_biological terá um flag de hormonal\_transition\_phase (ou usaremos o baseline\_stress\_level elevado temporariamente).  
* A Ação do Engine: Quando esse flag estiver ativo, o generateDeterministicGameplan capa o volume semanal no MEV (Volume Mínimo Eficaz).  
* Por que? Músculo inchado por retenção hídrica tem menos fluxo sanguíneo e é mais suscetível a lesões (pumps dolorosos, "back pumps" na lombar). Treinar com volume altíssimo (MRV) nessa fase gera inflamação sistêmica, apaga sua cintura e destrói sua recuperação. O foco nessas 4 semanas é manutenção de carga (intensidade), não volume.

### 2.4. Gerenciamento de Conflito: Iron vs. HIIT (Complexos / Assault Bike)

O HIIT que desenhamos (Complexos de Barra e Sprints de Bike) é anabólico e protege o coração, mas gera fadiga neural e depleção de glicogênio.

* A Regra de Isolamento de Pernas: O finalizeGameplanOrdering (a função que ordena a semana) possui uma Blacklist de Adjacência.  
  * É matematicamente proibido que o engine agende um dia de *Legs (Pernas)* no dia seguinte a um dia de *HIIT/Complexos*.  
  * Se você logar um HIIT brutal (RPE 9-10) na Quinta-feira, e a Sexta-feira for dia de Pernas, o engine automaticamente inverte ou troca o treino de Sexta para *Upper Body (Superior)* ou *Mobility/Flow*, e joga o treino de Pernas para o Sábado.  
* Viés de Seleção Pós-HIIT: Se o HIIT for no mesmo dia do Iron (ex: Complexos pós-treino), o bloco de Iron principal deve priorizar exercícios de baixo cns\_fatigue\_cost e alta estabilidade (Máquinas, Polias, Halteres) em vez de barras livres pesadas, pois o SNC já estará pré-fadigado.

---

### 2.5. Contrato TypeScript (exemplo \- Resumo para lib/physics/loadTelemetry.ts e engine/)

typescript  
// Estrutura de configuração injetada no Head Coach  
export const LOAD\_TELEMETRY\_CONFIG \= {  
  acwrThresholds: {  
    optimal: { min: 0.8, max: 1.3 },  
    spike: 1.5, // Gatilho para telemetrySuggestsPoorRecovery  
    detraining: 0.6  
  },  
  trtTransitionModifiers: {  
    volumeCap: 'MEV', // Limita ao Volume Mínimo Eficaz  
    cnsFatigueTolerance: 0.7 // Redz a tolerância a exercícios de alto custo neural  
  },  
  hiitConflictRules: {  
    blockLegsAfterHiit: true, // Proíbe Legs no dia seguinte a HIIT intenso  
    maxHiitSessionsPerMicrocycle: 2  
  }  
} as const;

// Fluxo lógico no computeTrainingLoadSnapshot:  
// 1\. Calcular sRPE diário (RPE \* duração)  
// 2\. Calcular ACWR (7d / 28d)  
// 3\. Verificar flag de transição hormonal no user\_biological  
// 4\. Se ACWR \> 1.5 OU transição hormonal ativa \-\> retornar 'recovery\_mode'  
// 5\. O selectExercisesForSplit recebe 'recovery\_mode' e filtra o bundledCatalog   
//    por cns\_fatigue\_cost \<= 2 e joint\_stress\_profile \== 'low'.

# REGRA 3: A Termodinâmica do "Lean Bulk" e o Timing Peri-Treino (O Motor Metabólico)

Objetivo: Calcular deterministicamente os alvos calóricos, a ciclagem de carboidratos (*Carb Cycling*) e a hidratação baseada no gasto energético do microciclo (frequency\_iron: 6, time\_budget: 90m), otimizando a partição de nutrientes sob o efeito da Durateston e protegendo a estética durante a transição hormonal. Tudo processado em lib/physics/metabolicTelemetry.ts e renderizado na UI.  
---

### 3.1. O Cálculo do Gasto Energético e o "Carb Cycling" Determinístico

O motor não usa uma dieta estática. Ele usa a Ciclagem de Carboidratos sincronizada com o weeklyMicrocycle (a tira de dias na Home). O objetivo é manter a sensibilidade à insulina alta nos dias de descanso/superior, e explodi-la nos dias de perna/HIIT.  
O generateDeterministicGameplan calcula o GET (Gasto Energético Total) usando o user\_biological (peso, altura, idade, BF%) e o custo metabólico dos pilares do dia.

| Tipo de Dia no Microciclo | Balanço Calórico | Distribuição de Macros (Foco) | Justificativa Biomecânica |
| ----- | ----- | ----- | ----- |
| Legs (Pernas) / HIIT | Superavit (+250 kcal) | Carboidrato Alto (4-5g/kg) Proteína (2.2g/kg) Gordura Baixa (0.8g/kg) | Reabastecer glicogênio massivo. A insulina alta no pós-treino empurra aminoácidos para o vasto lateral e glúteo. |
| Push / Pull (Superior) | Manutenção (GET) | Carboidrato Moderado (2.5-3g/kg) Proteína (2.2g/kg) Gordura Moderada (1.2g/kg) | Manter a síntese proteica sem gerar superavit que vire gordura abdominal. |
| Rest / Flow (Descanso) | Leve Déficit (-200 kcal) | Carboidrato Baixo (1.5g/kg) Proteína (2.2g/kg) Gordura Alta (1.5g/kg) | Aumentar a oxidação de gordura (lipólise) e manter a insulina basal baixa. |

---

### 3.2. O Timing Peri-Treino (A Janela da Durateston)

A Durateston otimiza a captação de aminoácidos, mas é a insulina (via carboidrato) que atua como o "caminhão" que leva esse tijolo para dentro do músculo.

* A Regra dos 60%: O motor do SOMMA dita que 60% a 70% da meta de carboidratos do dia deve ser consumida estritamente na janela Peri-Treino (refeição pré-treino e pós-treino).  
* A Injeção no Daily Command: O bloco do dia (daily\_protocols.blocks\[\]) receberá um novo objeto nutrition\_target. O InstructionPanel (ou um novo NutritionCueCard na Home) exibirá:  
  *"Dia de Pernas (Alta Demanda). Meta de Carbo: 320g. Consuma \~190g (60%) nas 2 horas antes e após o treino. Foco em amidos de rápida/média absorção (arroz, batata) para maximizar a via mTOR."*

---

### 3.3. O Protocolo de Hidratação e Eletrólitos (Fator TRT / Cintura Fina)

Como estabelecido na Regra 2, a transição Hormus → Durateston gera flutuação de Estradiol e retenção hídrica subcutânea (o inimigo da cintura fina). O motor metabólico deve prescrever a "lavagem" natural do corpo.

* A Matemática da Água: O metabolicTelemetry.ts calcula a meta de água base: weight\_kg \* 0.05 (ex: 59kg \* 0.05 \= \~3 Litros) \+ 1 Litro extra para cada hora de treino Iron/HIIT.  
* O Cue de Eletrólitos: Para evitar que a água fique retida *fora* do músculo (subcutânea), o motor prescreve aumento de Potássio e Magnésio via alimentos (ex: *"Adicione água de coco ou abacate no pós-treino para bombear água para dentro da célula muscular, secando a pele"*).  
* UI no Analytics: O Biological Passport UI terá um gráfico de "Hydration Wave" que deve bater com a meta diária. Se você não bater a meta de água, o LoadTelemetryStrip pode mostrar um alerta âmbar: *"Hidratação subótima. Risco de pump lombar e retenção facial."*

---

### 3.4. O Contrato TypeScript (Integração no Engine V8)

Para que o Head Coach local (lib/gameplan/engine/generateDeterministicGameplan.ts) entregue isso sem alucinações, o payload do daily\_protocols (Zustand) é expandido:  
// types/biological.ts (Expansão do Nutritional Target)  
export interface NutritionTarget {  
  total\_calories: number;  
  protein\_g: number;  
  carbs\_g: number;  
  fat\_g: number;  
  water\_ml: number;  
  peri\_workout\_carb\_ratio: number; // ex: 0.65 (65% dos carbos no peri-treino)  
  hydration\_focus: 'standard' | 'flush\_sodium'; // Para dias de transição hormonal  
}

// lib/physics/metabolicTelemetry.ts  
export function computeNutritionSnapshot(  
  biological: UserBiological,   
  microcycleDay: MicrocycleDay  
): NutritionTarget {  
  const bmr \= calculateMifflinStJeor(biological);  
  const activityMultiplier \= resolveActivityMultiplier(microcycleDay.pillars); // Baseado em Iron/HIIT  
    
  let calories \= bmr \* activityMultiplier;  
  let carbsPerKg \= 3.0; // Moderado (Padrão)

  if (microcycleDay.focus \=== 'legs' || microcycleDay.has\_hiit) {  
    calories \+= 250; // Superavit  
    carbsPerKg \= 4.5; // Alto Carbo  
  } else if (microcycleDay.pillars.length \=== 0\) {  
    calories \-= 200; // Déficit leve  
    carbsPerKg \= 1.5; // Baixo Carbo  
  }

  // Ajuste de transição hormonal (Regra 2\)  
  const hydrationFocus \= biological.hormonal\_transition ? 'flush\_sodium' : 'standard';

  return {  
    total\_calories: Math.round(calories),  
    protein\_g: Math.round(biological.weight\_kg \* 2.2),  
    carbs\_g: Math.round(biological.weight\_kg \* carbsPerKg),  
    fat\_g: Math.round((calories \- (protein\_g \* 4 \+ carbs\_g \* 4)) / 9),  
    water\_ml: Math.round((biological.weight\_kg \* 50\) \+ (microcycleDay.duration\_minutes \* 15)),  
    peri\_workout\_carb\_ratio: 0.65,  
    hydration\_focus  
  };  
}

### 3.5. A Experiência no "Daily Command" (Quiet Luxury)

Na tela inicial (/(tabs)/home), abaixo dos blocos de treino (Iron/Combat), haverá um Glass Card de *Biological Fueling*.

* Visual: Fundo bg-white/5, tipografia Inter.  
* Conteúdo:  
  * Meta do Dia: "2.650 kcal · 320g C · 130g P · 75g G"  
  * O Ritual: "Janela Anabólica: 190g de Carbo concentrados no Pré/Pós-Treino."  
  * Hidratação: "4.2L de Água (Foco em Potássio hoje)."

### O Resumo da Engenharia da Regra 3

Você não precisa contar cada grama de arroz no SOMMA, porque o Head Coach já fez a conta termodinâmica baseada no seu microciclo de 6 dias.

* Ele sabe que na Quarta-feira (Pernas) você *precisa* de 320g de carboidrato para crescer.  
* Ele sabe que no Domingo (Descanso) você *precisa* cortar o carbo e aumentar a gordura para oxidar a pouca gordura que ganhou na semana, mantendo seu BF na casa dos 12-13% reais (que visualmente parecem 10%).  
* Ele sabe que a Durateston exige que você coma *no horário certo* para não aromatizar e reter líquido na cintura.

# REGRA 4: A Biomecânica da Execução e o Protocolo "Text-Only Elite" (A Conexão Mente-Músculo Determinística)

Objetivo: Substituir a mímica visual por instruções proprioceptivas de alta precisão. O InstructionPanel e o ExerciseCueCard (renderizados na tela de execução do app) usarão a sintaxe de Cadência (Tempo) e Vetores de Força para garantir que a tensão mecânica caia exatamente no ventre muscular alvo (ex: vasto lateral, deltoide lateral), protegendo as articulações e maximizando a *Stretch-Mediated Hypertrophy* (Hipertrofia Mediada por Estiramento).  
---

### 4.1. A Matemática do Tempo Sob Tensão (A Cadência / Tempo)

O motor do SOMMA (generateDeterministicGameplan.ts) não prescreve apenas "3 séries de 10". Ele prescreve a Física do Movimento através de um array de 4 dígitos: \[Excêntrica, Pausa no Alongamento, Concêntrica, Pico de Contração\].  
A ciência atual dita que a fase excêntrica (quando você "segura" o peso descendo) é o maior gatilho para a hipertrofia, pois causa o micro-dano mecânico necessário e ativa os mecanorreceptores.

| Padrão de Movimento | Cadência Prescrita (Tempo) | Justificativa Biomecânica |
| ----- | ----- | ----- |
| Compostos Pesados (Agacho, Supino, Stiff) | 3 \- 1 \- X \- 0 | 3s descendo (controle), 1s pausa no fundo (elimina o reflexo de estiramento, forçando o músculo a iniciar a força do zero), X (explosão concêntrica máxima). |
| Isoladores / Máquinas (Cadeira Extensora, Mesa Flexora) | 3 \- 0 \- 1 \- 1 | Foco no pico de contração (1s no topo) para esmagar o músculo e bombear sangue (pump sarcoplasmático). |
| Tensão Constante (Elevação Lateral Polia, Crossover) | 2 \- 0 \- 1 \- 0 | Movimento fluido. A polia já mantém a tensão; não há ponto de descanso ("lockout"). |

*O TargetLoadBanner na UI exibirá a cadência do dia. Se você terminar a série em 15 segundos quando a cadência exigia 40 segundos, o motor sabe que você "roubou" no tempo e não gerou tensão mecânica real.*  
---

### 4.2. Anatomia do ExerciseCueCard (UI Quiet Luxury)

Quando você clica em um exercício na sua Daily Command, o app não abre um player de vídeo. Ele abre um *Glass Card* (Fundo Obsidian \#0A0A0A, tipografia Inter, detalhes em Matte Gold \#D4AF37). O card é dividido em 4 blocos textuais curtos e cirúrgicos:

1. The Setup (A Ancoragem): Como posicionar o esqueleto para proteger a articulação e isolar o alvo.  
2. The Vector (O Vetor de Força): Para onde você deve empurrar/puxar mentalmente.  
3. The Catch (O Alongamento): O momento mais importante da série, onde a fibra rasga.  
4. The Anti-Pattern (O Erro Fatal): O que o seu ego vai tentar fazer e que você deve evitar.

---

### 4.3. Cues Cirúrgicos para o X-Frame (Exemplos do Catálogo)

Aqui está como o banco de dados local (bundledCatalog.ts) alimenta o InstructionPanel para os exercícios vitais do seu shape de 1,58m:

#### A. Hack Squat (Foco: Vasto Lateral / "Sweep" da Coxa)

* The Setup: "Pés na largura dos ombros, posicionados *baixos* na plataforma. Pontas dos pés levemente para fora."  
* The Vector: "Não empurre apenas o peso para cima. Tente 'rasgar' a plataforma com os pés, empurrando os joelhos para fora na subida."  
* The Catch: "Desça até a coxa encostar na panturrilha. Sinta a pele da coxa esticar. A lombar deve estar colada no banco (sem 'bumbum piscando' / butt wink)."  
* The Anti-Pattern: "Trancar (hiperestender) os joelhos no topo. Mantenha a tensão constante no quadríceps."  
* Tempo: 3 \- 1 \- X \- 0

#### B. Elevação Lateral na Polia Cruzada (Foco: Deltoide Lateral / Abóbada)

* The Setup: "Polia na altura do joelho. Cabo cruzado por trás das costas. Tronco levemente inclinado à frente."  
* The Vector: "Não levante o peso. Empurre a polia para a *parede oposta* da sala, liderando o movimento com o cotovelo, não com a mão."  
* The Catch: "No ponto mais baixo, deixe o cabo puxar seu braço através da linha do corpo, alongando a lateral do ombro."  
* The Anti-Pattern: "Encolher os ombros em direção às orelhas (trapézio roubando a carga). Mantenha a escápula deprimida."  
* Tempo: 2 \- 0 \- 1 \- 0

#### C. Puxada Alta Aberta (Foco: Dorsais / V-Shape)

* The Setup: "Pegada pronada, 1.5x a largura dos ombros. Peito estufado em direção ao teto, coluna torácica levemente estendida."  
* The Vector: "Não puxe a barra. Tente 'quebrar' a barra ao meio e drive os cotovelos em direção aos bolsos traseiros da calça."  
* The Catch: "No topo, deixe as escápulas subirem livremente, sentindo a asa (dorsal) alongar completamente sob o peso."  
* The Anti-Pattern: "Usar o impulso do tronco (barriga) ou deixar os bíceps dominarem a puxada."  
* Tempo: 3 \- 1 \- 1 \- 1

---

### 4.4. O Fator "Falha Técnica" vs. "Falha Concêntrica"

O Portão RIR (Regra 2\) precisa saber *como* você falhou. A ciência do esporte diferencia os dois:

* Falha Técnica: A forma se deteriora (ex: a lombar descola no Stiff, o trapézio rouba na elevação lateral). A série deve acabar aqui.  
* Falha Concêntrica: O músculo alvo não consegue mais mover a carga, mas a forma está intacta.

O InstructionPanel sempre termina com um *Footer Alert* em Matte Gold:  
*"A série termina quando a biomecânica falha, não quando o peso para. Se o trapézio subir, a série acabou. RIR 0 técnico \= RIR 2 real."*  
---

### 4.5. Contrato TypeScript (lib/catalog/biomechanicalInstructions.ts)

Para garantir que o Head Coach local renderize isso perfeitamente na UI *Text-Only Elite*, a tipagem do catálogo é rigorosa:  
export interface ExerciseCueCard {  
  setup: string;       // Ancoragem esquelética  
  vector: string;      // Intenção de movimento (Propriocepção)  
  catch: string;       // Foco no alongamento sob carga (Stretch-mediated)  
  anti\_pattern: string;// O erro do ego  
  tempo: \[number, number, string | number, number\]; // \[Ecc, Pause, Conc, Peak\]  
  failure\_type: 'technical' | 'concentric';  
}

// Exemplo de injeção no bundledCatalog.ts  
export const hack\_squat\_vastus\_bias: Exercise \= {  
  id: 'ex\_hack\_squat\_vl',  
  name: 'Hack Squat (Viés Vasto Lateral)',  
  primary\_muscle: 'quadriceps\_vastus\_lateralis',  
  selection\_score: 2.0, // Regra 1  
  cns\_fatigue\_cost: 3,  
  cue\_card: {  
    setup: "Pés baixos na plataforma, largura dos ombros.",  
    vector: "Empurre os joelhos para fora ao subir.",  
    catch: "Desça profundo. Sinta a coxa alongar sob a carga.",  
    anti\_pattern: "Hiperestender os joelhos no topo. Lombar descolar.",  
    tempo: \[3, 1, 'X', 0\],  
    failure\_type: 'technical' // Se a lombar sair, a série acabou.  
  }  
};

# REGRA 5: A Consolidação do SNC, o Ritual do *Ascension Flare* e a Periodização Ondulatória (O Longevity OS)

Objetivo: Garantir que o Head Coach local (generateDeterministicGameplan.ts) não apenas prescreva o estresse (Iron/Combat), mas também prescreva matematicamente a recuperação parassimpática usando os pilares Spirit (NSDR / Breathwork) e Flow (Mobilidade). A regra usa o ACWR, o baseline\_stress\_level do Passaporte Biológico e o ritual de encerramento do app para hackear o sistema nervoso e forçar a adaptação.  
---

### 5.1. Periodização Ondulatória Diária (DUP no Microciclo de 6 Dias)

Treinar 6 dias seguidos com o mesmo volume e intensidade é a receita para o *overtraining*. O motor do SOMMA aplica a Periodização Ondulatória Diária (DUP). Ele alterna o "foco" do estímulo de Iron dentro do weeklyMicrocycle para que diferentes vias energéticas e neurológicas sejam estressadas e recuperadas em ondas.

| Dia no Microciclo | Foco do Engine (goal\_iron) | Estímulo Biológico |
| ----- | ----- | ----- |
| Push / Pull A | *Hipertrofia Metabólica* (8-12 reps, Tempo 3-0-1-1) | Dano muscular sarcoplasmático, pump, depleção de glicogênio. |
| Legs A | *Tensão Mecânica Pura* (5-8 reps, Tempo 3-1-X-0) | Recrutamento de fibras Tipo II, alto custo de SNC, estímulo miofibrilar. |
| Push / Pull B | *Hipertrofia / Stretch-Mediated* (10-15 reps, foco na excêntrica) | Foco em alongamento sob carga (ex: Crossover, Stiff), dano tecidual profundo. |
| Legs B | *Unilateral / Estabilidade* (Foco em glúteo, core, correção de assimetrias) | Menor custo de SNC sistêmico, alto recrutamento de estabilizadores, saúde articular. |

*O motor (selectExercisesForSplit) lê o focus\_iron do dia e ajusta os target\_reps e a cadence (Regra 4\) automaticamente, sem que você precise planilhar nada.*  
---

### 5.2. O Pilar *Spirit* como "Healer" do SNC (NSDR e Breathwork)

O pilar Spirit no SOMMA não é "meditação hippie"; é Neurobiologia Aplicada. Protocolos de *Non-Sleep Deep Rest* (NSDR) e respiração cíclica (ex: 4-7-8 ou Fisiológico) comprovadamente reduzem o cortisol e aumentam a dopamina basal.

* A Regra das "Healer 48h Zones": O loadTelemetry.ts monitora seu ACWR e seu RPE σ. Se o motor detectar que você teve dois dias consecutivos de *Tensão Mecânica Pura* (Legs A \+ Push A) e seu reported\_rir está caindo (fadiga neural), ele injeta obrigatoriamente um bloco de Spirit de 10 a 15 minutos no final do treino do dia seguinte, ou o prescribe como um bloco isolado no dia de descanso.  
* Injeção de Contexto (baseline\_stress\_level): Se no seu Passaporte Biológico (user\_biological) você relatar um estresse alto (ex: 7-10 no trabalho), o motor (lib/gameplan/engine/) reduz o volume de Iron em 15% e aumenta a duração do bloco Spirit, prescrevendo protocolos de respiração de coerência cardíaca para proteger seu coração (crucial na TRT).  
* Catálogo: O engine puxa os tempo\_id do library\_flow\_spirit (ex: tempo\_478 para ativar o nervo vago).

---

### 5.3. O Ritual do *Ascension Flare* (O Gatilho Pavloviano)

Na arquitetura V8, o *Ascension Flare* (/(workout)/ascension) não é apenas uma tela de carregamento. É uma ferramenta de biohacking de 3 segundos.

* A UX Quiet Luxury: Ao terminar a última série, o app bloqueia a navegação. A tela vai para Obsidian puro (\#0F1512). Um brilho radial sutil em Matte Gold (\#BFA06A) pulsa no centro. Não há barras de progresso brutais ou neon.  
* A Neurociência: Esse ritual visual e a pausa forçada de 3 segundos (enquanto o completeWorkout roda o flushPerformanceQueue em background) servem como um gatilho pavloviano para o seu cérebro. Ele sinaliza o fim do estado *Simpático* (luta/fuga, adrenalina, cortisol) e o início do estado *Parassimpático* (descanso/digestão, hormônio do crescimento).  
* A Regra do Coach: Você *deve* usar esses 3 segundos para soltar o ar profundamente (suspiro fisiológico). O app te ensina que o treino só acabou quando a mente desacelera.

---

### 5.4. O "Deload" Automático (A Proteção do Longevity OS)

A cada 6 ou 8 semanas (calculado via timestamp de performance\_logs), o motor do SOMMA detecta a fadiga acumulada do mesociclo.

* A Lógica do Engine: Em vez de você ter que "adivinhar" que precisa descansar, o generateDeterministicGameplan entra em modo Deload Determinístico.  
* A Execução: Por 5 a 7 dias, o motor mantém os exercícios do catálogo (para não perder o padrão motor), mas corta o target\_sets pela metade e reduz o target\_weight\_kg em 10-15%. O foco muda para Flow (mobilidade articular) e Spirit (recuperação neural).  
* Resultado: Você dissipa a fadiga do SNC, seus tendões se regeneram, e você volta na semana seguinte com um "rebote" de força e hipertrofia (supercompensação).

---

### 5.5. Contrato TypeScript e Arquitetura V8 (lib/gameplan/engine/)

Como o Head Coach local injeta isso no weeklyMicrocycle sem usar LLMs ($0 API):  
// lib/gameplan/engine/generateDeterministicGameplan.ts

export function injectRecoveryProtocols(  
  microcycle: MicrocycleDay\[\],  
  telemetry: TrainingLoadSnapshot,  
  biological: UserBiological  
): MicrocycleDay\[\] {  
    
  return microcycle.map((day, index) \=\> {  
    let spiritBlock: SpiritBlock | null \= null;

    // 1\. Gatilho de Estresse Sistêmico (Cortisol vs TRT)  
    if (biological.baseline\_stress\_level \>= 7 || telemetry.acwr \> 1.4) {  
      spiritBlock \= {  
        pillar: 'spirit',  
        mode: 'breathwork',  
        tempo\_id: 'tempo\_478', // Ativação do Nervo Vago (Parassimpático)  
        duration\_minutes: 12,  
        prescribed\_reason: 'High systemic fatigue detected. Downregulate CNS.'  
      };  
    }

    // 2\. Regra do Deload Automático (Fim do Mesociclo)  
    if (telemetry.is\_deload\_week) {  
      day.iron?.exercises.forEach(ex \=\> {  
        ex.target\_sets \= Math.max(2, Math.floor(ex.target\_sets / 2));  
        ex.target\_weight\_kg \= ex.target\_weight\_kg ? ex.target\_weight\_kg \* 0.85 : null;  
      });  
    }

    // 3\. Injeção do Bloco Spirit no final do dia (ou dia de descanso)  
    if (spiritBlock) {  
      day.blocks.push(spiritBlock);  
    }

    return day;  
  });  
}

### O Resumo da Bíblia do Seu Shape (As 5 Regras Consolidadas)

Com estas 5 regras, o SOMMA V8 deixa de ser um "aplicativo de treino" e se torna o seu Sistema Operacional de Longevidade e Estética:

1. Regra 1 (X-Frame): O catálogo é matematicamente enviesado para ombros 3D, dorsais largas e pernas grossas, com blacklist para exercícios que alargam a cintura.  
2. Regra 2 (Telemetria/TRT): O Portão RIR e o ACWR protegem seu SNC e gerenciam a retenção hídrica da transição Hormus \-\> Durateston, impedindo que o HIIT destrua suas pernas.  
3. Regra 3 (Termodinâmica): A ciclagem de carboidratos sincronizada com o microciclo garante que o superavit calórico vire vasto lateral, e não gordura visceral.  
4. Regra 4 (Text-Only Elite): A ausência de vídeos e o foco em Cues de Cadência (Tempo) forçam a propriocepção e a hipertrofia mediada por estiramento.  
5. Regra 5 (Longevity OS): A Periodização Ondulatória, o Pilar *Spirit* e o *Ascension Flare* garantem que seu corpo sobreviva e prospere na rotina de 6x na semana, mantendo o cortisol baixo e a testosterona (Durateston) trabalhando a seu favor.

