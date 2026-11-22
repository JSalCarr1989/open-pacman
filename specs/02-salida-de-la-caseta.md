# SPEC 02 — Salida de la caseta: puerta de un solo sentido

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-11-22
> **Objective:** Los cuatro fantasmas salen de la caseta con los retardos de SPEC 01 y, una vez fuera, la IA nunca puede reintroducirlos por la puerta, de modo que recorren el mapa sin quedar atrapados.

## Por qué existe este spec

El diagnóstico (simulación de 1500 frames sobre la lógica actual de `game.js`) mostró que la salida guionizada de `exitPen` **ya funciona**: Pinky queda libre en el frame ~121, Inky ~281 y Clyde ~461. El defecto real es otro: `isWall` deja que cualquier fantasma cruce la puerta (celda `3`) en ambos sentidos, así que en modo chase el greedy elige «down» en (13-14, 11) cuando Pac-Man está debajo de la caseta y el fantasma entra por la puerta; la regla de no-reversa y la geometría del pasillo lo mantienen dando vueltas dentro. La simulación registró 4 re-entradas en 25 s (Blinky y Clyde, dos cada una, todas entrando por (13,12)). Lo que se percibe como «quedan atrapados en su jaula» es esa re-entrada, no un fallo del script de salida.

## Scope

**In:**

- En `src/js/game.js`, la puerta (celda `3`) pasa a bloquear también a los fantasmas libres: `isWall` la trata como muro para el actor `'ghost'`.
- La salida guionizada de `exitPen` cruza la puerta con un actor especial `'ghostExit'`, única excepción autorizada a pasar por la celda 3.
- Los retardos de SPEC 01 se mantienen intactos: Pinky 90, Inky 240, Clyde 420 frames (Blinky ya nace fuera).
- La garantía cubre también el respiro tras perder una vida: `resetPositions` re-programa la salida escalonada y ningún fantasma re-entra después.

**Out of scope (for future specs):**

- Modo asustado, comerse fantasmas y su regreso guionizado a la caseta al ser comido (necesitará re-entrar por la puerta; el actor especial está pensado para extenderse a eso).
- Cruise Elroy, contador de dots del arcade para liberar fantasmas, cambios de velocidad.
- Cambios a `MAZE_STR`, `render.js` o al bucle de `main.js`.
- Ajustes de dificultad: los retardos actuales quedan validados con el usuario.

## Data model

Este spec no introduce datos nuevos; reutiliza el modelo de SPEC 01 (`kind`, `corner`, `inPen`, `exitDelay`). El único cambio es un nuevo valor de actor en las funciones de colisión:

```js
// game.js — actores aceptados por isWall/canMove tras el cambio:
//   'pacman'     → bloqueado por pared (1) y puerta (3)
//   'ghost'      → bloqueado por pared (1) y puerta (3)   [antes cruzaba la puerta]
//   'ghostExit'  → bloqueado solo por pared (1)           [solo lo usa exitPen]
```

## Implementation plan

1. **Puerta bloqueante para la IA libre**: en `isWall` (game.js) la celda `3` bloquea a todo actor salvo `'ghostExit'`; en `exitPen`, la validación de ruta cambia de `'ghost'` a `'ghostExit'`. Prueba manual: Pinky sale a los ~1.5 s, Inky ~4 s, Clyde ~7 s cruzando la puerta; Blinky circula normal y ya no entra por la puerta.
2. **No re-entrada en partida larga**: jugar (o simular) un tramo de chase con Pac-Man debajo de la caseta y comprobar que ningún fantasma libre entra al interior (cols 11-16, filas 12-15) y que los sueltos reparten por el mapa.
3. **Respiro tras perder una vida**: provocar una colisión y verificar que los tres interiores re-salen escalonados, que ninguno re-entra después, y pasada completa de los criterios de aceptación.

## Acceptance criteria

- [ ] Pinky queda libre en la fila 11 a los ~1.5 s del inicio, Inky a los ~4 s y Clyde a los ~7 s (retardos 90/240/420 de SPEC 01, sin cambios).
- [ ] Ningún fantasma libre entra jamás al interior de la caseta (cols 11-16, filas 12-15) ni cruza la puerta hacia abajo, en scatter ni en chase, con Pac-Man arriba, abajo o en el túnel.
- [ ] Blinky no entra por la puerta cuando Pac-Man está debajo de la caseta (caso reproducido en el diagnóstico: entradas en los frames 631 y 1408 de la simulación).
- [ ] Tras perder una vida, los tres fantasmas interiores vuelven a salir escalonados y ningún fantasma re-entra después.
- [ ] Pac-Man sigue sin poder cruzar la puerta (la celda 3 lo bloquea igual que antes).
- [ ] Comer todos los dots da `GANASTE` y el tercer golpe da `PERDISTE`, igual que antes.
- [ ] Una partida completa no produce errores en consola.

## Decisions

- **Sí:** puerta de un solo sentido, como el arcade: la IA nunca elige entrar; solo la salida guionizada cruza hacia arriba. **No:** penalizar la puerta en el greedy — no elimina el atrapamiento y añade lógica frágil.
- **Sí:** actor especial `'ghostExit'` como única excepción en `isWall`. **No:** eximir a `exitPen` de validar colisiones — se mantiene una sola vía de bloqueo y la salida sigue comprobando muros.
- **Sí:** mantener los retardos 90/240/420; la molestia reportada venía de la re-entrada, no de los timers (confirmado con el usuario). **No:** salida inmediata de los 4 — rompe el respiro aprobado en SPEC 01.
- **Sí:** fix confinado a `game.js` (`isWall` + `exitPen`). **No:** tocar `maze.js`, `render.js` ni `main.js`.
- **Nota de futuro:** cuando llegue el modo asustado, el regreso a la caseta del fantasma comido reutilizará el actor especial para cruzar la puerta de forma guionizada.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Bloquear la puerta a `'ghost'` cambia las opciones del greedy en (13-14, 11) | Deseado: es justo la opción que causaba la re-entrada; la fila 11 sigue transitable a izquierda y derecha. |
| Un fantasma atascado frente a la puerta tras el cambio | En (13,11) y (14,11) siempre quedan ≥2 salidas abiertas (izquierda/derecha), así que nunca aplican ni el callejón ni la reversa forzosa. |
| Una futura spec de fantasmas comidos necesitará re-entrar | El mecanismo de actor especial está diseñado para extenderse; queda documentado en Decisiones. |

## What is **not** in this spec

- Modo asustado, comerse fantasmas y regreso a la caseta.
- Cruise Elroy y contador de dots para liberar fantasmas.
- Cambios al laberinto, render, tiempos o velocidades.

Cada uno de esos, si llega, va en su propio spec.
