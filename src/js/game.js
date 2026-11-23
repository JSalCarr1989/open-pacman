// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame
const GHOST_EAT_SCORES = [ 200, 400, 800, 1600 ];

// Tabla scatter/chase del nivel 1, en segundos (scatter, chase, scatter, ...)
const MODE_TIMINGS = [ 7, 20, 7, 20, 5, 20, 5, Infinity ];

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// coleccionables sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) {
    for ( const v of row ) if ( v === 2 || v === 4 ) dots++;
  }

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    mode: 'scatter',
    modeIndex: 0,
    modeFrames: 0,
    powerFrames: 0,
    ghostCombo: 0,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      // Blinky arranca fuera de la pen, mirando a la izquierda.
      dir: g.kind === 'blinky' ? 'left' : 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      corner: g.corner,
      state: 'normal',
      // En la pen hasta que venza su exitDelay (Blinky no tiene retardo).
      inPen: g.exitDelay !== undefined,
      exitDelay: g.exitDelay !== undefined ? g.exitDelay : null,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman/ghost: bloqueados por pared (1) y puerta (3)
//   ghostExit/ghostReturn: pueden cruzar la puerta durante su ruta guionizada
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor !== 'ghostExit' && actor !== 'ghostReturn' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function activatePowerMode( game ) {
  game.powerFrames = 360;
  game.ghostCombo = 0;
  game.ghosts.forEach( ( g ) => {
    if ( !g.inPen && g.state !== 'returning' ) {
      g.state = 'frightened';
      g.dir = OPPOSITE[ g.dir ];
    }
  } );
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    const tile = grid[ p.y ][ p.x ];
    if ( tile === 2 || tile === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += tile === 4 ? 50 : 10;
      game.dotsRemaining--;
      if ( tile === 4 ) activatePowerMode( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Celda a la que apunta el fantasma segun el modo actual.
// En scatter va a su esquina; en chase a su personalidad del arcade.
function ghostTarget( game, g ) {
  if ( game.mode === 'scatter' ) return g.corner;

  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const d = DIRS[ p.dir ];

  if ( g.kind === 'pinky' ) {
    // 4 celdas delante de la direccion actual de Pac-Man.
    return { x: px + d.x * 4, y: py + d.y * 4 };
  }

  if ( g.kind === 'inky' ) {
    // Pivote 2 celdas delante de Pac-Man; vector doblado desde Blinky.
    const blinky = game.ghosts.find( ( gh ) => gh.kind === 'blinky' );
    const pivX = px + d.x * 2;
    const pivY = py + d.y * 2;
    return { x: 2 * pivX - Math.round( blinky.x ), y: 2 * pivY - Math.round( blinky.y ) };
  }

  if ( g.kind === 'clyde' ) {
    // Clyde persigue solo a mas de 8 celdas; si no, se retira a su esquina.
    const dist = Math.abs( px - Math.round( g.x ) ) + Math.abs( py - Math.round( g.y ) );
    if ( dist > 8 ) return { x: px, y: py };
    return g.corner;
  }

  // Blinky: directo a Pac-Man.
  return { x: px, y: py };
}

function returningDirection( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;
  const target = { x: 13, y: 14 };
  const start = { x: Math.round( g.x ), y: Math.round( g.y ) };
  const queue = [ { ...start, firstDir: null } ];
  const visited = new Set( [ `${ start.x },${ start.y }` ] );

  for ( let i = 0; i < queue.length; i++ ) {
    const node = queue[ i ];
    if ( node.x === target.x && node.y === target.y ) return node.firstDir;

    for ( const dir of Object.keys( DIRS ) ) {
      if ( !canMove( grid, node.x, node.y, dir, 'ghostReturn' ) ) continue;
      const d = DIRS[ dir ];
      let nx = node.x + d.x;
      const ny = node.y + d.y;
      if ( ny === TUNNEL_ROW && ( nx < 0 || nx >= width ) ) {
        nx = ( nx + width ) % width;
      }
      const key = `${ nx },${ ny }`;
      if ( visited.has( key ) ) continue;
      visited.add( key );
      queue.push( { x: nx, y: ny, firstDir: node.firstDir || dir } );
    }
  }
  return null;
}

function decideGhost( game, g ) {
  const grid = game.grid;

  if ( g.state === 'returning' ) {
    const dir = returningDirection( game, g );
    if ( dir ) g.dir = dir;
    return;
  }

  if ( g.state === 'frightened' ) {
    const options = Object.keys( DIRS ).filter(
      ( dir ) => canMove( grid, g.x, g.y, dir, 'ghost' )
    );
    if ( !options.length ) return;
    if ( options.length > 2 || !options.includes( g.dir ) ) {
      g.dir = options[ Math.floor( Math.random() * options.length ) ];
    }
    return;
  }

  const target = ghostTarget( game, g );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Greedy: elegir la direccion que mas acerca al target (sin reversa).
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Fantasma en la pen: espera su retardo y luego sale en linea hacia fuera.
  if ( g.inPen ) {
    if ( g.exitDelay > 0 ) {
      g.exitDelay--;
      return;
    }
    exitPen( game, g );
    return;
  }

  if ( g.state === 'returning' && aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.x === 13 && g.y === 14 ) {
      g.inPen = true;
      g.exitDelay = 0;
      return;
    }
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, g.state === 'returning' ? 'ghostReturn' : 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

const PEN_EXIT_ROW = 11; // fila encima de la puerta (fuera de la pen)

// Salida escalonada de la pen: primero a la columna de salida (13/14),
// luego sube por la puerta hasta la fila 11 y queda libre para la IA.
function exitPen( game, g ) {
  const grid = game.grid;
  const exitCol = g.x <= 13 ? 13 : 14;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.x !== exitCol ) g.dir = g.x < exitCol ? 'right' : 'left';
    else g.dir = 'up';
    // Ya en la columna y en la fila de salida: pasa a IA normal.
    if ( g.x === exitCol && g.y === PEN_EXIT_ROW ) {
      g.inPen = false;
      g.state = game.powerFrames > 0 ? 'frightened' : 'normal';
      return;
    }
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghostExit' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // Restaura posiciones, retardos de salida y estado de pen de cada fantasma.
  game.ghosts.forEach( ( g, i ) => {
    const s = GHOST_STARTS[ i ];
    g.x = s.x;
    g.y = s.y;
    g.dir = s.kind === 'blinky' ? 'left' : 'up';
    g.state = 'normal';
    g.inPen = s.exitDelay !== undefined;
    g.exitDelay = s.exitDelay !== undefined ? s.exitDelay : null;
  } );
  // Reinicia el ciclo scatter/chase al perder una vida.
  game.mode = 'scatter';
  game.modeIndex = 0;
  game.modeFrames = 0;
  clearPowerMode( game );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

// Ciclo global scatter/chase segun MODE_TIMINGS (segundos -> frames).
function updateMode( game ) {
  const limit = MODE_TIMINGS[ game.modeIndex ] * 60;
  game.modeFrames++;
  if ( game.modeFrames >= limit ) {
    game.modeFrames = 0;
    // La ultima entrada es Infinity: el indice queda ahi (chase eterno).
    if ( game.modeIndex < MODE_TIMINGS.length - 1 ) game.modeIndex++;
    game.mode = game.modeIndex % 2 === 0 ? 'scatter' : 'chase';
  }
}

function updatePowerMode( game ) {
  if ( game.powerFrames <= 0 ) return;

  game.powerFrames--;
  if ( game.powerFrames === 0 ) clearPowerMode( game );
}

function clearPowerMode( game ) {
  game.powerFrames = 0;
  game.ghostCombo = 0;
  game.ghosts.forEach( ( g ) => {
    if ( g.state === 'frightened' ) g.state = 'normal';
  } );
}

function update( game ) {
  updatePowerMode( game );
  updateMode( game );
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( g.state === 'returning' || !collides( game.pacman, g ) ) continue;
    if ( g.state === 'frightened' && game.powerFrames > 0 ) {
      const scoreIndex = Math.min( game.ghostCombo, GHOST_EAT_SCORES.length - 1 );
      game.score += GHOST_EAT_SCORES[ scoreIndex ];
      game.ghostCombo++;
      g.state = 'returning';
      continue;
    }

    game.lives--;
    if ( game.lives <= 0 ) {
      clearPowerMode( game );
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
