# SPEC 03 — Power pellets y modo asustado

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-23
> **Objective:** Pac-Man recoge los cuatro power pellets clásicos para asustar temporalmente a los fantasmas, comérselos y sumar puntos.

## Why this spec exists

SPEC 01 dejó los power pellets y el modo asustado fuera de alcance. Esta spec incorpora la mecánica en el laberinto actual y define cómo los fantasmas comidos vuelven a la caseta sin permitir que la IA normal cruce la puerta.

## Scope

**In:**

- Añadir cuatro power pellets en las coordenadas clásicas `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)` (origen arriba a la izquierda).
- Dibujar los power pellets de forma distinta a los dots y consumirlos al pasar Pac-Man por su celda.
- Contar los power pellets como coleccionables necesarios para ganar. Cada uno suma 50 puntos.
- Al comer un power pellet, invertir la dirección de los fantasmas activos y activar el modo asustado durante 360 frames (6 segundos a 60 fps). Si se come otro durante el modo, el temporizador vuelve a 360 frames.
- Durante el modo asustado, los fantasmas activos se ven azules, eligen direcciones legales al azar en las intersecciones y pueden ser comidos. Los fantasmas en la caseta no se mueven por el modo; si salen mientras sigue activo, aparecen asustados.
- Comer fantasmas durante una misma activación suma 200, 400, 800 y 1600 puntos, en ese orden. Comer otro power pellet reinicia esta secuencia.
- Un fantasma comido deja de colisionar con Pac-Man, vuelve al centro de la caseta `(13,14)` y sale de nuevo mediante la salida guionizada de SPEC 02. Mientras regresa, no se ve asustado ni puede dañar a Pac-Man.
- Al agotarse el temporizador, los fantasmas activos que no hayan sido comidos vuelven a su comportamiento normal. Los fantasmas que ya estén regresando completan el regreso.
- Perder una vida cancela el modo asustado y su secuencia de puntuación; los coleccionables ya comidos permanecen consumidos.

**Out of scope (for future specs):**

- Replicar todos los detalles de temporización, destellos, velocidades y patrones aleatorios del arcade original.
- Cambiar la puntuación de los dots, los tiempos scatter/chase, la velocidad base o la IA de los fantasmas normales.
- Frutas, niveles adicionales, persistencia de puntuaciones y cambios al bucle de `requestAnimationFrame`.

## Data model

```js
// maze.js: MAZE_STR admite 'o' para un power pellet (valor numérico 4).
// game.js: estado nuevo de partida
powerFrames: 0,       // frames restantes; 0 significa modo inactivo
ghostCombo: 0,        // fantasmas comidos en la activación actual

// Cada fantasma distingue su estado normal, asustado o de regreso.
state: 'normal',      // 'normal' | 'frightened' | 'returning'
```

Las cuatro celdas de `MAZE_STR` pasan de `.` a `o`. `game.grid` sigue siendo una copia mutable de `MAZE`. `dotsRemaining` cuenta tanto celdas `2` como celdas `4`, para que la condición de victoria incluya ambos coleccionables.

## Implementation plan

1. **Datos y coleccionables:** en `src/js/maze.js`, admitir `o` como valor `4` y marcar las cuatro coordenadas. En `src/js/game.js`, contar valores `2` y `4` y consumir ambos; el power pellet suma 50 puntos. Prueba manual: iniciar partida y comprobar cuatro pellets en las celdas indicadas; recorrer una celda de cada tipo los elimina y actualiza la puntuación y el contador de victoria.
2. **Representación y temporizador:** en `src/js/render.js`, dibujar el valor `4` como pellet grande y mostrar los fantasmas asustados en azul. En `src/js/game.js`, implementar `powerFrames`, su reinicio al recoger otro pellet y la cancelación al perder una vida. Prueba manual: recoger un pellet, observar el aspecto asustado y confirmar que el efecto termina tras 360 frames.
3. **Conducta y colisiones asustadas:** en `src/js/game.js`, invertir la dirección de los fantasmas activos al activar el modo, elegir una dirección transitable al azar en intersecciones y distinguir una colisión con fantasma asustado de una colisión normal. Añadir la puntuación encadenada 200/400/800/1600. Prueba manual: durante el modo, Pac-Man puede comer fantasmas sin perder una vida; fuera del modo, una colisión sigue quitando una vida.
4. **Regreso a la caseta:** añadir el estado `returning`, hacer que un fantasma comido se dirija a `(13,14)` y permitirle cruzar la puerta solo durante el regreso mediante la excepción de actor de SPEC 02. Al llegar, reiniciar su salida guionizada sin retardo adicional. Prueba manual: un fantasma comido regresa, sale de nuevo y nunca daña a Pac-Man durante el trayecto.
5. **Integración de partida:** verificar el reinicio del modo al perder una vida, la persistencia de coleccionables, el caso de recoger un pellet durante otro modo asustado y la victoria al consumir los dots y los cuatro pellets. Prueba manual: jugar hasta `GANASTE` y comprobar una partida sin errores en consola.

## Acceptance criteria

- [ ] Hay exactamente cuatro power pellets, ubicados en `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`.
- [ ] Los power pellets se distinguen visualmente de los dots y desaparecen al ser consumidos.
- [ ] Cada power pellet suma 50 puntos y cuenta para completar el nivel.
- [ ] Comer un power pellet invierte la dirección de los fantasmas activos y activa el modo asustado durante 360 frames.
- [ ] Comer otro power pellet durante el modo reinicia el temporizador a 360 frames y la secuencia de puntuación de fantasmas.
- [ ] Los fantasmas asustados se muestran azules, eligen direcciones legales al azar en las intersecciones y pueden ser comidos.
- [ ] Comer fantasmas en una misma activación suma 200, 400, 800 y 1600 puntos, en ese orden.
- [ ] Un fantasma comido no daña a Pac-Man, vuelve a `(13,14)` y sale de nuevo por la ruta guionizada.
- [ ] Solo el regreso y la salida guionizada pueden cruzar la puerta; los fantasmas en estado normal no pueden reentrar a la caseta.
- [ ] Al terminar el modo, los fantasmas activos no comidos vuelven a su comportamiento normal y los que regresan terminan el trayecto.
- [ ] Perder una vida cancela el modo asustado y reinicia su secuencia de puntos sin restaurar los pellets consumidos.
- [ ] Comer todos los dots y los cuatro power pellets muestra `GANASTE`; el comportamiento normal de perder vidas y llegar a `PERDISTE` sigue funcionando.
- [ ] Una partida no produce errores en consola.

## Decisions

- **Sí:** usar `o` en `MAZE_STR` y el valor `4` en la matriz, conservando los valores existentes para pared, dot, espacio y puerta.
- **Sí:** mantener `dotsRemaining` como contador de todos los coleccionables. Evita introducir un segundo contador para la condición de victoria.
- **Sí:** usar 360 frames para los 6 segundos, consistente con los temporizadores existentes en frames. **No:** modificar el bucle de tiempo para fijar 60 fps; es un asunto independiente.
- **Sí:** usar direcciones aleatorias legales durante el modo asustado como simplificación del arcade. **No:** reproducir sus patrones y temporizaciones exactos.
- **Sí:** devolver los fantasmas comidos a la caseta y reutilizar la salida guionizada. **No:** dejarlos desaparecer ni permitir que la IA normal cruce la puerta.
- **Sí:** sumar 50 puntos por power pellet y reiniciar el multiplicador de fantasmas al recoger otro. **No:** cambiar la puntuación de los dots.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| El estado asustado se solapa con scatter/chase | Mantener un temporizador de poder separado; al terminar, `ghostTarget` vuelve al modo global existente. |
| Un fantasma comido queda bloqueado al entrar a la caseta | Usar la excepción de regreso prevista para extender el actor de paso especial de SPEC 02 y verificar la ruta hasta `(13,14)`. |
| La elección aleatoria dificulta reproducir una partida exacta | Validar que cada paso elegido sea transitable y comprobar manualmente el comportamiento general, no una secuencia de direcciones concreta. |
| El bucle existente no garantiza 60 actualizaciones por segundo | Definir la duración como 360 frames, siguiendo la convención de temporizadores existente; no ampliar esta spec para cambiar el bucle. |

## What is **not** in this spec

- Reproducir fielmente los patrones, velocidades, destellos y temporizaciones originales del arcade.
- Cambiar la IA normal, las velocidades base o el ciclo scatter/chase.
- Frutas, niveles adicionales, persistencia de puntuaciones o cambios al bucle de tiempo.

Cada uno de esos puntos, si se aborda, tendrá su propia spec.
