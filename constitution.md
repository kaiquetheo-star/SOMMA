# SOMMA ENGINEERING CONSTITUTION

## Princípios Invioláveis

1. **Single Source of Truth**: cada decisão tem UMA função responsável.
2. **Pipeline Linear**: Biological → Strategy → Tactical → Execution → Validation.
   Camadas inferiores nunca modificam superiores.
3. **Personalização via CoachProfile**: proibido `if (user.X)` espalhado.
4. **Defaults Seguros**: todo parâmetro tem default validado fisiologicamente.
5. **Determinismo**: mesmo input = mesmo output. Zero Math.random().
6. **Feature Flags**: feature nova entra desligada.
7. **Auditabilidade**: toda decisão gera decision_log.

## Garantias Fisiológicas (NUNCA quebrar)

- Compostos: mínimo 2 sets por sessão
- Isoladores: mínimo 1 set por sessão
- Todo sub-grupo atinge MEV semanal
- Push day tem tríceps direto
- Pull day tem bíceps direto
- Shoulder day cobre 3 cabeças
- Idioma do usuário respeitado em 100% do conteúdo visível
- TRT/hormonal: AUMENTA capacidade, nunca reduz

## Processo de Mudança

1. Antes de qualquer mudança: escrever teste de regressão
2. Mudança mínima que resolve o problema
3. Matar código antigo ao adicionar novo (nunca acumular)
4. Rodar suite completa antes de commit
5. Atualizar decision_log se afetar pipeline

## Proibido

- Adicionar módulo que ajuste volume/carga/exercício sem matar os existentes
- Criar "if user.isAdvanced" fora do CoachProfile
- Feature nova sem feature flag
- Quebrar testes de garantia fisiológica
- Conteúdo em idioma errado