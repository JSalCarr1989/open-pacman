# SPEC 01 — Cuatro fantasmas con personalidad

> **Status:** Approved
> **Depends on:** —
> **Date:** 2026-11-07
> **Objective:** Los 4 fantasmas clásicos (Blinky, Pinky, Inky y Clyde) actúan cada uno con su comportamiento del arcade original, y Blinky persigue agresivamente la casilla de Pac-Man.

## Scope

**In:**

- `GHOST_STARTS` pasa de 2 a 4 fantasmas con `kind` con nombre (`blinky`, `pinky`, `inky`, `clyde`), esquina de scatter y retardo de salida.
- Blinky arranca fuera de la caseta en (13,11); Pinky, Inky y Clyde dentro y salen escalonados por temporizador.
- Targeting clásico en modo chase: Blinky directo a Pac-Man, Pinky 4 celdas delante, Inky vector doblado desde Blinky, Clyde persigue solo a >8 celdas.
- Ciclo global scatter/chase con la tabla del nivel 1: 7, 20, 7, 20, 5, 20, 5, ∞ (segundos), reiniciado al perder una vida.
- Salida escalonada de la caseta también tras perder una vida (respiro al jugador).
- `GHOST_COLORS` reordenado a colores clásicos: rojo, rosa, cian, naranja.

**Out of scope (for future specs):**

- Power pellets, modo asustado, comerse fantasmas y regresar a la caseta al ser comido.
- Cruise Elroy (aceleración de Blinky con pocos dots).
- Frutas, niveles múltiples, highscores.
- Cambios al laberinto (`MAZE_STR`) — la caseta actual ya aloja a los 4.
- Contador de dots para liberar fantasmas (usamos timers de frames).
- Bug del arcade original en Pinky/Inky con dirección `up` (vector lateral) — no se replica.
- Corregir el loop `requestAnimationFrame` a 60 fps fijos (delta time) — riesgo preexistente, no de este spec.

## Data model

```js
// maze.js — reemplaza GHOST_STARTS actual
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'blinky', corner: { x: 26, y: 1 } },               // fuera de la caseta
  { x: 13, y: 14, kind: 'pinky',  corner: { x: 1,  y: 1 }, exitDelay: 90 },   // ~1.5 s
  { x: 12, y: 14, kind: 'inky',   corner: { x: 26, y: 29 }, exitDelay: 240 }, // ~4 s
  { x: 15, y: 14, kind: 'clyde',  corner: { x: 1,  y: 29 }, exitDelay: 420 }, // ~7 s
];

// Tabla scatter/chase del nivel 1, en segundos (scatter, chase, scatter, ...)
const MODE_TIMINGS = [ 7, 20, 7, 20, 5, 20, 5, Infinity ];

// game.js — estado añadido en createGame()
mode: 'scatter', modeIndex: 0, modeFrames: 0,

// cada ghost gana, además de x/y/dir/speed/kind:
corner, inPen (bool), exitDelay (frames restantes; Blinky no tiene)
```

Coordenadas en celdas, origen arriba-izquierda (convención existente). Los targets no tienen por qué ser casillas transitables — solo imanes direccionales para el greedy.

## Implementation plan

1. Datos y colores: reescribir `GHOST_STARTS` en `maze.js` (4 entradas + `corner` + `exitDelay`) y reordenar `GHOST_COLORS` en `render.js` a `['#ff0000', '#ffb8ff', '#00ffff', '#ffb852']`. Prueba manual: cargan 4 fantasmas con colores correctos, sin errores en consola.
2. Caseta: en `game.js`, lógica de `inPen`/`exitDelay` — mientras el retardo no venza, el fantasma no se mueve; al vencer, sale en línea (primero a la columna 13/14, luego sube por la puerta hasta la fila 11) y pasa a IA normal. `resetPositions` restaura starts, retardos y ciclo. Blinky arranca con `dir: 'left'`. Prueba: salen uno a uno; tras perder vida, salen escalonados de nuevo.
3. Motor de targeting y ciclo: refactor de `decideGhost` a `ghostTarget(game, g)` (target según modo y `kind`) + greedy actual sin reversa; timer `mode`/`modeIndex`/`modeFrames` con `MODE_TIMINGS`. En chase, Blinky apunta a Pac-Man; Pinky/Inky/Clyde apuntan provisionalmente también a Pac-Man. Prueba: ritmo scatter/chase visible; Blinky va directo.
4. Pinky e Inky: Pinky apunta a `pacman + 4·DIRS[dir]`; Inky calcula pivote `pacman + 2·DIRS[dir]` y apunta a `2·pivote − blinky` (Blinky se busca por `kind`, no por índice). Prueba: Pinky corta el paso, Inky flanquea.
5. Clyde: si distancia Manhattan a Pac-Man > 8, apunta a Pac-Man; si no, a su esquina. Prueba: Clyde se acerca y se retira cíclicamente.
6. Verificación completa de los criterios de aceptación y ajuste fino de retardos si la dificultad aprieta.

## Acceptance criteria

- [ ] Se ven 4 fantasmas con colores clásicos: Blinky rojo, Pinky rosa, Inky cian, Clyde naranja.
- [ ] Blinky empieza fuera de la caseta; los otros tres dentro y salen escalonados (no a la vez).
- [ ] En chase, Blinky toma de forma sistemática el camino más corto hacia la casilla de Pac-Man.
- [ ] En chase, Pinky apunta 4 celdas delante de la dirección actual de Pac-Man.
- [ ] En chase, Inky apunta al vector calculado desde el pivote y la posición de Blinky.
- [ ] Clyde persigue solo a >8 celdas Manhattan; a ≤8 se retira hacia su esquina.
- [ ] El ciclo scatter/chase sigue la tabla 7,20,7,20,5,20,5,∞ y se reinicia al perder una vida.
- [ ] Los 4 fantasmas van a la misma velocidad (0.1) y ningún fantasma dentro de la caseta puede colisionar con Pac-Man.
- [ ] Túnel, dots, score, ganar (GANASTE) y perder (PERDISTE) funcionan igual que antes.
- [ ] Una partida completa no produce errores en consola.

## Decisions

- **Sí:** fórmulas de targeting del arcade (fidelidad y cada fantasma se siente distinto). **No:** BFS/A* — el greedy actual en intersecciones basta y mantiene el estilo del código.
- **Sí:** timers en frames para salida de caseta y ciclo de modos. **No:** contador de dots del arcade — más difícil de probar.
- **Sí:** misma velocidad para los 4 (la agresividad de Blinky es de targeting, no de velocidad). **No:** Cruise Elroy.
- **Sí:** etiquetas de estado en inglés (`Draft`/`Approved`/`Implemented`), consistente con `AGENTS.md`; `spec-impl` las entiende en cualquier idioma.
- **Sí:** búsqueda de Blinky por `kind`. **No:** por índice de `game.ghosts` — se rompe si se reordena el array.
- **No:** replicar el bug de dirección `up` de Pinky/Inky del arcade original. Se usa el vector recto.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| 4 cazadores pueden hacerlo muy difícil | Scatter inicial de 7 s, salida escalonada y Pac-Man más rápido (0.125 vs 0.1); subir `exitDelay` de Inky/Clyde si aprieta. |
| Inky depende de Blinky | Búsqueda por `kind: 'blinky'`, nunca por índice. |
| `requestAnimationFrame` a >60 Hz acelera todo el juego | Preexistente en `main.js`; fuera de alcance. Los timers quedan en frames, como el resto del juego. |
| Empates en el greedy (dos direcciones a igual distancia) | El orden fijo de `DIRS` lo hace determinista; suficiente para este diseño. |

## What is **not** in this spec

- Power pellets, modo asustado y comerse fantasmas.
- Cruise Elroy / aceleración de Blinky.
- Frutas, niveles múltiples, highscores.
- Cambios al laberinto y al bucle de render/tiempo.

Cada uno de esos, si llega, va en su propio spec.
