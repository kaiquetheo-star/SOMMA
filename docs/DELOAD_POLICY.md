# Política de deload

O SOMMA usa uma progressão linear com uma única descarga automática:

- semanas 4 e 6 do mesociclo ativam o budget de fase `deload`;
- o deload reduz os limites de volume por calendário;
- fadiga subjetiva, readiness, stress, RPE e ACWR não iniciam deload;
- não existe corte automático de carga baseado em percepção de recuperação.

A origem registrada na telemetria do motor é sempre `phase_budget`. Readiness e
ACWR podem existir em dados históricos, mas não governam a prescrição.
