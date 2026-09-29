## ADDED Requirements

### Requirement: Calendario completo del grupo desde la base de datos
El calendario completo de un grupo SHALL servirse desde la base de datos, con el mismo contrato de
hoy, en `GET /calendar` y en los consumidores de un solo grupo (convocatorias, sectores de gol, y
el calendario y el próximo partido de Mobile). La primera consulta de un grupo SHALL descargar las
jornadas que falten. Después, cada consulta SHALL refrescar desde la RFFM solo las jornadas que lo
necesiten según la política de refresco de resultados.

#### Scenario: Primera consulta del calendario de un grupo
- **WHEN** un usuario abre la clasificación de un grupo sin jornadas guardadas
- **THEN** se descargan y se guardan todas sus jornadas una sola vez, y el popup de resultados de cada equipo se construye con ellas

#### Scenario: Consultas posteriores
- **WHEN** se vuelve a pedir el calendario y ninguna jornada necesita refresco
- **THEN** la respuesta sale de la base de datos sin ninguna petición a la RFFM
