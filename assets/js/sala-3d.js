/**
 * @file sala-3d.js
 * @description Cuadros 3D para el museo (A-Frame 1.5 / Three.js):
 *   - Marco de madera con filete dorado, paspartú, lienzo y placa grabada.
 *   - Lámpara de galería con halo de luz falso (sin luces reales = sin lag).
 *   - El lienzo se ajusta a la proporción real de cada foto.
 *   - Hover con realce suave, clic (mouse / mira central) y toque en móvil.
 *   - Modal con la foto grande, ficha, audio, navegación y zoom.
 *   - Videos propios (.mp4) o de YouTube: en la sala se ven como miniatura
 *     pausada con botón de play; en el modal se reproducen con su ficha.
 *
 * No necesita cambios en tu index.html: el modal, sus estilos y el HUD se
 * crean desde aquí. Mantiene las funciones globales abrirModal(item) y
 * cerrarModal() por compatibilidad.
 */
(function () {
  'use strict';

  /* ======================================================================
     CONFIGURACIÓN (medidas en metros, pensadas para tu museo a escala ~3x)
     ====================================================================== */
  var CONFIG = {
    anchoMax: 2.6,          // ancho máximo del lienzo (si el empty no define tamaño)
    altoMax: 2.1,           // alto máximo del lienzo (si el empty no define tamaño)

    // Tamaño tomado del empty: en Blender pon el empty como "Cube" (Display Size 1)
    // y escálalo; el cubo que ves es exactamente el marco completo.
    //   ancho = escala X × 2     alto = escala Z × 2 (la escala Y, profundidad, se ignora)
    tamanoDesdeEmpty: true,
    tamanoMinimo: 0.3,      // (m) por si un empty quedó casi en cero
    marco: 0.16,            // ancho de la moldura de madera
    filete: 0.035,          // ancho del filete dorado
    paspartu: 0.14,         // margen blanco alrededor de la foto
    separacion: 0.9,        // espacio entre cuadros que comparten punto
    alturaSinPuntos: 3.6,   // altura si el GLB no tiene "Punto_cuadro"
    cuadrosPorSeccion: 7,    // recorrido guiado: personaje N → video N → 7 cuadros = sección N
    distanciaInteraccion: 6, // (m) solo se puede abrir una obra a esta distancia o menos
    urlRegreso: 'salas.html', // página a la que lleva el botón "Volver" (cámbiala por la tuya)

    // ---- Protección de las obras ----
    proteger: true,              // bloquea clic derecho, arrastrar, Ctrl+S/U/P, F12 y atajos de captura
    marcaDeAgua: true,           // texto de la institución sobre la foto en la ficha
    detectarDevTools: true,      // tapa las obras si se abren las herramientas de desarrollo (F12)
    volumenPasos: 0.1,        // volumen de los pasos (0 = sin pasos, 1 = normal, 1.5 = más fuerte)
    pasoCada: 2.3,          // (m) distancia entre un paso y otro al caminar
    lampara: true,          // lámpara de galería sobre cada cuadro
    retrasoEntrada: 120,    // ms entre la aparición de cada cuadro

    // ---- Rendimiento ----
    // Lado máximo de la textura de cada obra en 3D (el modal siempre usa el original).
    // Una foto de 4000 px ocupa ~64 MB de memoria de video; a 1280 px, ~6 MB.
    texturaMax: (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 768 : 1280,
    escalaPlaca: (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 0.5 : 0.75,   // resolución del texto de la placa
    cargasSimultaneas: 3,            // descargas de imágenes/videos a la vez
    distanciaVisible: 45             // (m) más lejos que esto el cuadro no se dibuja
  };

  // Profundidad de cada capa del cuadro (m, desde la pared hacia afuera).
  // Separadas lo suficiente para que no "peleen" entre sí a la distancia.
  var CAPAS = {
    sombra: 0.012,
    halo: 0.02,
    placa: 0.03,
    tablero: 0.03,     // grosor del tablero trasero de madera
    paspartu: 0.042,
    filo: 0.052,
    lienzo: 0.062      // el filete dorado (0.075) y la madera (0.09) siguen al frente
  };

  // Agrega ?debug=1 a la URL (ej. sala-3d.html?sala=1&debug=1) para ver
  // sobre cada cuadro su número en data.js y el empty donde quedó.
  var DEPURAR = /[?&]debug=1\b/.test(window.location.search);

  /* ======================================================================
     ACCESIBILIDAD: mismos ajustes que el sitio (app.js)
     Lee "focine-a11y" y "focine-mode" de localStorage, así que lo que el
     visitante activó en el sitio (modo oscuro, contraste alto, daltonismo,
     saturación, texto grande, espaciado, resaltado, tipografía, cursor y
     lector) se aplica igual dentro del museo. Si lo cambia en otra pestaña
     del sitio, el museo se actualiza al momento.
     ====================================================================== */
  var CLAVE_MODO = 'focine-mode';
  var CLAVE_A11Y = 'focine-a11y';

  var A11Y_BASE = {
    audio: false, contrasteAlto: false, contrasteOscuro: false, saturacion: false,
    zoom: false, espaciado: false, resaltado: false,
    colorBlind: 'none', font: 'default', cursor: 'normal'
  };

  function leerA11y() {
    var guardado = null;
    try { guardado = JSON.parse(localStorage.getItem(CLAVE_A11Y)); } catch (e) {}
    var s = {};
    for (var k in A11Y_BASE) s[k] = (guardado && k in guardado) ? guardado[k] : A11Y_BASE[k];
    return s;
  }

  // Filtros de daltonismo: si la página ya tiene los del sitio (#cb-...), se usan esos
  function asegurarFiltrosDaltonismo() {
    if (document.getElementById('cb-protanopia') || !document.body) return;
    var matrices = {
      protanopia:    '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0',
      deuteranopia:  '0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0',
      tritanopia:    '0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0',
      achromatopsia: '0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0'
    };
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>';
    for (var id in matrices) {
      svg += '<filter id="cb-' + id + '" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="' + matrices[id] + '"/></filter>';
    }
    svg += '</defs></svg>';
    var cont = document.createElement('div');
    cont.innerHTML = svg;
    document.body.appendChild(cont.firstChild);
  }

  function aplicarA11y() {
    var s = leerA11y();
    var html = document.documentElement;
    var poner = function (clase, activo) { html.classList.toggle(clase, !!activo); };

    poner('a11y-contraste-alto', s.contrasteAlto);
    poner('a11y-dark', s.contrasteOscuro);
    poner('a11y-zoom', s.zoom);
    poner('a11y-espaciado', s.espaciado);
    poner('a11y-resaltado', s.resaltado);
    poner('a11y-audio-hint', s.audio);
    poner('a11y-font-opendyslexic', s.font === 'opendyslexic');
    poner('a11y-font-sans', s.font === 'sans');
    poner('a11y-font-serif', s.font === 'serif');
    poner('a11y-cursor-grande', s.cursor === 'grande');
    poner('a11y-cursor-extragrande', s.cursor === 'extragrande');

    // Filtros de color (igual que applyFilters() de app.js)
    var filtros = [];
    if (s.colorBlind && s.colorBlind !== 'none') {
      if (document.body) { asegurarFiltrosDaltonismo(); filtros.push('url(#cb-' + s.colorBlind + ')'); }
    }
    if (s.contrasteAlto) filtros.push('contrast(1.3)');
    if (s.saturacion) filtros.push('saturate(1.65)');
    html.style.filter = filtros.join(' ');

    A11Y = s;
    if (typeof aplicarMira === 'function') aplicarMira();
    if (DOM && DOM.leer) DOM.leer.hidden = !s.audio || !('speechSynthesis' in window);
    return s;
  }

  var A11Y = aplicarA11y();

  // Tipografía para los textos dibujados en 3D (placas, miniaturas)
  var FUENTES = (function () {
    if (A11Y.font === 'opendyslexic') return { serif: '"Comic Sans MS", "Comic Sans", sans-serif', sans: '"Comic Sans MS", "Comic Sans", sans-serif' };
    if (A11Y.font === 'sans') return { serif: 'Arial, Helvetica, sans-serif', sans: 'Arial, Helvetica, sans-serif' };
    if (A11Y.font === 'serif') return { serif: 'Georgia, "Times New Roman", serif', sans: 'Georgia, "Times New Roman", serif' };
    return { serif: '"Fraunces", Georgia, serif', sans: '"Inter", "Segoe UI", sans-serif' };
  })();

  /* Modo de color, igual que en tu sitio:
       - Si la página ya trae <html data-mode="digital">, se respeta.
       - ?modo=digital o ?modo=analogico en la URL lo fuerza.
       - Si tu sitio guardó el modo en localStorage, se intenta leer.
     Sin nada de lo anterior se usa el modo analógico (sepia). */
  var MODO = (function () {
    var html = document.documentElement;
    var modo = html.getAttribute('data-mode');
    var enUrl = (window.location.search.match(/[?&]modo=([a-z]+)/i) || [])[1];
    if (enUrl) modo = /dig/i.test(enUrl) ? 'digital' : 'analogico';
    if (!modo) {
      try {
        [CLAVE_MODO, 'museo-modo', 'data-mode', 'mode', 'modo'].some(function (k) {
          var v = localStorage.getItem(k);
          if (v) { modo = /dig|dark|oscuro|noche/i.test(v) ? 'digital' : 'analogico'; return true; }
          return false;
        });
      } catch (e) {}
    }
    html.setAttribute('data-mode', modo === 'digital' ? 'digital' : 'antiguo');   // mismos valores que app.js
    return modo === 'digital' ? 'digital' : 'analogico';
  })();

  window.addEventListener('storage', function (e) {
    if (e.key === CLAVE_A11Y) aplicarA11y();
    if (e.key === CLAVE_MODO) {
      document.documentElement.setAttribute('data-mode', e.newValue === 'digital' ? 'digital' : 'antiguo');
    }
  });
  window.addEventListener('DOMContentLoaded', aplicarA11y);   // para los filtros de daltonismo (necesitan <body>)

  // Al volver a esta página con "Atrás" el navegador la restaura de memoria
  // (sin recargar): se releen los ajustes por si cambiaron en otra página.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    aplicarA11y();
    try {
      var m = localStorage.getItem(CLAVE_MODO);
      if (m) document.documentElement.setAttribute('data-mode', m === 'digital' ? 'digital' : 'antiguo');
    } catch (x) {}
  });

  var OSCURO_A11Y = document.documentElement.classList.contains('a11y-dark');
  var PALETA = MODO === 'digital' ? {
    placaDe: '#0d1526', placaA: '#060a14', placaBorde: 'rgba(56, 230, 212, 0.55)', placaBorde2: 'rgba(56, 230, 212, 0.22)',
    titulo: '#e9f1f8', pie: '#7e93aa', accion: '#38e6d4',
    vacio: '#0a1120', acento: '#38e6d4', claro: '#e9f1f8', circulo: 'rgba(6, 10, 20, 0.62)', insignia: 'rgba(6, 10, 20, 0.8)'
  } : {
    placaDe: '#f4ead0', placaA: '#e3d3a8', placaBorde: 'rgba(74, 56, 35, 0.55)', placaBorde2: 'rgba(74, 56, 35, 0.25)',
    titulo: '#2c2013', pie: '#6b5539', accion: '#a9762f',
    vacio: '#2c2013', acento: '#c9932f', claro: '#f4ead0', circulo: 'rgba(44, 32, 19, 0.62)', insignia: 'rgba(44, 32, 19, 0.82)'
  };
  if (OSCURO_A11Y) {
    PALETA.placaDe = '#121417'; PALETA.placaA = '#08090b';
    PALETA.placaBorde = 'rgba(255, 255, 255, 0.3)'; PALETA.placaBorde2 = 'rgba(255, 255, 255, 0.14)';
    PALETA.titulo = '#f4f2ee'; PALETA.pie = '#a6a196';
  }

  var ESTA_TACTIL = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (ESTA_TACTIL) document.documentElement.classList.add('mm-tactil');

  /* ======================================================================
     ESTADO GLOBAL
     ====================================================================== */
  var Museo = {
    sala: null,
    todos: [],          // todas las obras de la sala (data.js)
    items: [],          // las que sí se colgaron, en orden de recorrido
    obras: [],          // entidades de cuadros, en el mismo orden que items
    hover: null,        // cuadro bajo la mira
    abierto: false,
    indice: -1,
    ultimoBloqueo: 0,   // momento en que se activó el pointer lock
    ultimoCierre: 0,
    focoPrevio: null
  };

  /* ======================================================================
     UTILIDADES
     ====================================================================== */
  function limpiarTexto(t) {
    return String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  }

  // Acepta youtube.com/watch?v=, youtu.be/, /embed/, /shorts/ y /live/
  function datosYouTube(url) {
    var u = String(url || '');
    var m = u.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (!m) return null;
    var inicio = 0, t = u.match(/[?&#](?:t|start)=([0-9hms]+)/);
    if (t) {
      var partes = t[1].match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
      if (partes) inicio = (+partes[1] || 0) * 3600 + (+partes[2] || 0) * 60 + (+partes[3] || 0);
    }
    return { id: m[1], vertical: /\/shorts\//.test(u), inicio: inicio };
  }

  function esPersonaje(item) {
    return !!item && String(item.tipo || '').toLowerCase() === 'personaje';
  }

  // Un personaje puede escribirse con sus propios campos (nombre, vida, rol,
  // semblanza); se copian a los campos comunes para que placa, ficha y lector
  // funcionen igual que con las demás obras.
  function normalizarObra(item) {
    if (esPersonaje(item)) {
      item.titulo = limpiarTexto(item.nombre || item.titulo);
      item.descripcion = item.semblanza || item.descripcion;
      item.anio = item.vida || item.anio;
    }
    return item;
  }

  function tipoDeObra(item) {
    return esPersonaje(item) ? 'personaje' : (esVideo(item) ? 'video' : 'imagen');
  }

  function esVideo(item) {
    if (!item) return false;
    if (datosYouTube(item.url)) return true;
    if (String(item.tipo || '').toLowerCase() === 'video') return true;
    return /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i.test(item.url || '');
  }

  function formatoDuracion(seg) {
    if (typeof seg === 'string') return limpiarTexto(seg);   // "3:25" escrito en data.js
    if (!isFinite(seg) || seg <= 0) return '';
    seg = Math.round(seg);
    var h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
    var mm = h ? String(m).padStart(2, '0') : String(m);
    return (h ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
  }

  function numeroSala(id) {
    return String(id).padStart(2, '0');
  }

  function rectRedondo(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function envolverTexto(ctx, texto, anchoMax, maxLineas) {
    var palabras = texto.split(' ');
    var lineas = [];
    var actual = '';
    for (var i = 0; i < palabras.length; i++) {
      var prueba = actual ? actual + ' ' + palabras[i] : palabras[i];
      if (ctx.measureText(prueba).width > anchoMax && actual) {
        lineas.push(actual);
        actual = palabras[i];
        if (lineas.length === maxLineas) break;
      } else {
        actual = prueba;
      }
    }
    if (lineas.length < maxLineas && actual) lineas.push(actual);
    var usadas = lineas.join(' ').split(' ').length;
    if (usadas < palabras.length) {
      var ultima = lineas[lineas.length - 1];
      while (ultima.length && ctx.measureText(ultima + '…').width > anchoMax) ultima = ultima.slice(0, -1);
      lineas[lineas.length - 1] = ultima.trim() + '…';
    }
    return lineas;
  }

  function esperarFuentes() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var carga = Promise.all([
      document.fonts.load('600 60px "Fraunces"'),
      document.fonts.load('500 30px "Inter"')
    ]);
    var limite = new Promise(function (ok) { setTimeout(ok, 1500); });
    return Promise.race([carga, limite]).catch(function () {});
  }

  /* ======================================================================
     FUENTES Y ESTILOS DEL MODAL / HUD
     ====================================================================== */
  function inyectarEstilos() {
    if (document.getElementById('museo-estilos')) return;

    // Sin esto, en celular la interfaz se ve diminuta
    if (!document.querySelector('meta[name="viewport"]')) {
      var vp = document.createElement('meta');
      vp.name = 'viewport';
      vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
      document.head.appendChild(vp);
    }

    var pre = document.createElement('link');
    pre.rel = 'preconnect';
    pre.href = 'https://fonts.gstatic.com';
    pre.crossOrigin = 'anonymous';
    document.head.appendChild(pre);

    var fuentes = document.createElement('link');
    fuentes.rel = 'stylesheet';
    fuentes.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&display=swap';
    document.head.appendChild(fuentes);

    var css = document.createElement('style');
    css.id = 'museo-estilos';
    css.textContent = `
      /* Paleta del sitio: modo analógico (sepia) por defecto,
         html[data-mode="digital"] y html.a11y-dark como en tu hoja de estilos */
      :root {
        --mm-obsidiana: #f4ead0;          /* fondo de tarjetas (--bg-1) */
        --mm-carbon: #ece0c4;             /* fondo secundario (--bg-0) */
        --mm-hueso: #2c2013;              /* texto principal (--ink-0) */
        --mm-texto-2: #4a3823;            /* --ink-1 */
        --mm-niebla: #6b5539;             /* --ink-2 */
        --mm-linea: rgba(44, 32, 19, 0.22);
        --mm-linea-fuerte: rgba(74, 56, 35, 0.34);
        --mm-ocre: #a9762f;               /* --accent-0 */
        --mm-tezontle: #c9932f;           /* --accent-1 */
        --mm-sobre-acento: #f4ead0;
        --mm-panel: rgba(244, 234, 208, 0.84);
        --mm-panel-fuerte: rgba(244, 234, 208, 0.96);
        --mm-velo: rgba(44, 32, 19, 0.58);
        --mm-media: #2c2013;              /* escenario oscuro para ver la foto */
        --mm-media-borde: #1c140b;
        --mm-sutil: rgba(44, 32, 19, 0.05);
        --mm-sombra: rgba(74, 50, 20, 0.28);
        --mm-serif: "Fraunces", Georgia, serif;
        --mm-sans: "Inter", system-ui, sans-serif;
      }
      html[data-mode="digital"] {
        --mm-obsidiana: #0a1120;
        --mm-carbon: #0d1526;
        --mm-hueso: #e9f1f8;
        --mm-texto-2: #b6c6d8;
        --mm-niebla: #7e93aa;
        --mm-linea: rgba(120, 220, 255, 0.18);
        --mm-linea-fuerte: rgba(56, 230, 212, 0.32);
        --mm-ocre: #38e6d4;
        --mm-tezontle: #d9b24c;
        --mm-sobre-acento: #06121a;
        --mm-panel: rgba(6, 10, 20, 0.74);
        --mm-panel-fuerte: rgba(10, 17, 32, 0.95);
        --mm-velo: rgba(3, 6, 12, 0.8);
        --mm-media: #04070e;
        --mm-media-borde: #02040a;
        --mm-sutil: rgba(233, 241, 248, 0.05);
        --mm-sombra: rgba(0, 0, 0, 0.55);
      }
      html.a11y-dark {
        --mm-obsidiana: #0d0f12;
        --mm-carbon: #121417;
        --mm-hueso: #f4f2ee;
        --mm-texto-2: #d4d0c8;
        --mm-niebla: #a6a196;
        --mm-linea: rgba(255, 255, 255, 0.16);
        --mm-linea-fuerte: rgba(255, 255, 255, 0.28);
        --mm-panel: rgba(8, 9, 11, 0.8);
        --mm-panel-fuerte: rgba(13, 15, 18, 0.95);
        --mm-velo: rgba(0, 0, 0, 0.8);
        --mm-media: #08090b;
        --mm-media-borde: #040506;
        --mm-sutil: rgba(255, 255, 255, 0.05);
        --mm-sombra: rgba(0, 0, 0, 0.6);
      }

      /* ---------- HUD de la sala ---------- */
      .mm-hud {
        position: fixed; top: 20px; left: 20px; z-index: 50;
        max-width: min(420px, calc(100vw - 40px));
        padding: 14px 18px 16px;
        background: var(--mm-panel);
        -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
        border: 1px solid var(--mm-linea);
        border-left: 3px solid var(--mm-ocre);
        border-radius: 4px 12px 12px 4px;
        color: var(--mm-hueso); font-family: var(--mm-sans);
        pointer-events: none;
      }
      .mm-hud__sala { margin: 0 0 4px; font-size: 0.8rem; color: var(--mm-ocre); font-weight: 600; letter-spacing: 0.02em; }
      .mm-hud__nombre { margin: 0; font-family: var(--mm-serif); font-weight: 600; font-size: 1.15rem; line-height: 1.25; }
      .mm-hud__desc { margin: 6px 0 0; font-size: 0.85rem; line-height: 1.45; color: var(--mm-niebla); }

      .mm-ayuda {
        position: fixed; left: 50%; bottom: 24px; z-index: 50;
        transform: translateX(-50%);
        display: flex; gap: 14px; align-items: center; flex-wrap: wrap; justify-content: center;
        max-width: calc(100vw - 32px);
        padding: 10px 16px;
        background: var(--mm-panel);
        -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
        border: 1px solid var(--mm-linea); border-radius: 999px;
        color: var(--mm-hueso); font: 500 0.85rem/1.3 var(--mm-sans);
        pointer-events: none;
        transition: opacity 0.4s ease, transform 0.4s ease;
      }
      .mm-ayuda.is-oculta { opacity: 0; transform: translate(-50%, 8px); }
      .mm-ayuda kbd {
        display: inline-block; min-width: 1.6em; padding: 1px 6px; margin-right: 2px;
        border: 1px solid var(--mm-linea-fuerte); border-bottom-width: 2px; border-radius: 5px;
        font: 600 0.75rem/1.4 var(--mm-sans); text-align: center; color: var(--mm-hueso);
      }
      .mm-ayuda span { white-space: nowrap; color: var(--mm-niebla); }
      .mm-ayuda strong { color: var(--mm-ocre); font-weight: 600; }

      /* ---------- Modal ---------- */
      .mm-overlay {
        position: fixed; inset: 0; z-index: 9999;
        display: none; align-items: center; justify-content: center;
        padding: 24px;
        background: radial-gradient(ellipse at 30% 20%, color-mix(in srgb, var(--mm-ocre) 22%, transparent), transparent 60%),
                    var(--mm-velo);
        -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
        opacity: 0; transition: opacity 0.3s ease;
        font-family: var(--mm-sans); color: var(--mm-hueso);
      }
      .mm-overlay.is-visible { opacity: 1; }

      .mm-card {
        position: relative;
        display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
        width: min(1120px, 100%); max-height: min(88vh, 820px);
        grid-template-rows: minmax(0, 1fr);
        background: var(--mm-obsidiana);
        border: 1px solid var(--mm-linea); border-radius: 18px;
        box-shadow: 0 40px 120px var(--mm-sombra);
        overflow: hidden;
        transform: translateY(28px) scale(0.98); opacity: 0;
        transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.35s ease;
      }
      .mm-overlay.is-visible .mm-card { transform: none; opacity: 1; }

      /* Foto con bordes de película perforada */
      .mm-media {
        position: relative; margin: 0;
        display: flex; align-items: center; justify-content: center;
        min-height: 320px; padding: 34px 20px;
        background: var(--mm-media);
      }
      .mm-media::before, .mm-media::after {
        content: ""; position: absolute; left: 0; right: 0; height: 22px;
        background-color: var(--mm-media-borde);
        background-image: linear-gradient(90deg, rgba(255, 255, 255, 0.16) 55%, transparent 55%);
        background-size: 24px 9px; background-repeat: repeat-x; background-position: 6px center;
      }
      .mm-media::before { top: 0; }
      .mm-media::after { bottom: 0; }

      .mm-img-btn {
        all: unset; cursor: zoom-in; display: block; max-width: 100%; max-height: 100%;
        border-radius: 4px;
      }
      .mm-img-btn:focus-visible { outline: 2px solid var(--mm-ocre); outline-offset: 4px; }
      .mm-img {
        display: block; max-width: 100%; max-height: calc(min(88vh, 820px) - 68px);
        object-fit: contain; border-radius: 3px;
        box-shadow: 0 18px 50px var(--mm-sombra);
        clip-path: inset(0 0 0 0);
        transition: clip-path 0.7s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease;
      }
      .mm-img.is-cargando { clip-path: inset(0 0 100% 0); opacity: 0.2; }

      .mm-video {
        display: block; width: 100%; max-width: 100%;
        max-height: calc(min(88vh, 820px) - 68px);
        background: #000; border-radius: 3px;
        box-shadow: 0 18px 50px var(--mm-sombra);
      }
      .mm-yt {
        width: 100%; aspect-ratio: 16 / 9;
        max-height: calc(min(88vh, 820px) - 68px);
        background: #000; border-radius: 3px; overflow: hidden;
        box-shadow: 0 18px 50px var(--mm-sombra);
      }
      .mm-yt.is-vertical { width: auto; height: calc(min(88vh, 820px) - 68px); aspect-ratio: 9 / 16; }
      .mm-yt iframe { display: block; width: 100%; height: 100%; border: 0; }
      .mm-video[hidden], .mm-yt[hidden], .mm-img-btn[hidden], .mm-zoom-btn[hidden] { display: none; }
      .mm-contador {
        position: absolute; left: 16px; bottom: 32px;
        padding: 4px 10px; border-radius: 999px;
        background: var(--mm-panel); border: 1px solid var(--mm-linea);
        font: 600 0.78rem/1.4 var(--mm-sans); color: var(--mm-niebla);
      }
      .mm-zoom-btn {
        position: absolute; right: 16px; bottom: 32px;
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 12px; border-radius: 999px; cursor: pointer;
        background: var(--mm-panel); border: 1px solid var(--mm-linea);
        color: var(--mm-hueso); font: 500 0.8rem/1.3 var(--mm-sans);
      }
      .mm-zoom-btn:hover { border-color: var(--mm-ocre); }
      .mm-zoom-btn:focus-visible { outline: 2px solid var(--mm-ocre); outline-offset: 2px; }

      /* Ficha */
      .mm-info {
        position: relative;
        display: flex; flex-direction: column; min-height: 0; overflow: hidden;
        background: linear-gradient(180deg, var(--mm-carbon), var(--mm-obsidiana) 70%);
      }
      .mm-cabecera { flex-shrink: 0; padding: 64px 40px 0; }  /* deja libre la esquina de la X */
      .mm-etiquetas { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
      .mm-etiquetas .mm-tipo { margin: 0; }
      .mm-lectura { font: 500 0.78rem/1.3 var(--mm-sans); color: var(--mm-niebla); }
      .mm-lectura::before { content: "◷ "; }
      .mm-lectura[hidden] { display: none; }

      /* Barra de progreso de lectura */
      .mm-progreso { flex-shrink: 0; height: 2px; margin: 0 40px; background: var(--mm-linea); opacity: 0; transition: opacity 0.3s ease; }
      .mm-progreso.is-activo { opacity: 1; }
      .mm-progreso span {
        display: block; height: 100%; transform: scaleX(0); transform-origin: left;
        background: linear-gradient(90deg, var(--mm-ocre), var(--mm-tezontle));
      }

      /* Texto con scroll propio */
      .mm-cuerpo {
        flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
        padding: 22px 40px 26px;
        scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--mm-ocre) 60%, transparent) transparent;
        --fade-arriba: 0px; --fade-abajo: 0px;
        -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 var(--fade-arriba), #000 calc(100% - var(--fade-abajo)), transparent 100%);
                mask-image: linear-gradient(to bottom, transparent 0, #000 var(--fade-arriba), #000 calc(100% - var(--fade-abajo)), transparent 100%);
      }
      .mm-cuerpo.hay-arriba { --fade-arriba: 28px; }
      .mm-cuerpo.hay-abajo { --fade-abajo: 56px; }
      .mm-cuerpo::-webkit-scrollbar { width: 6px; }
      .mm-cuerpo::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--mm-ocre) 60%, transparent); border-radius: 999px; }
      .mm-cuerpo:focus-visible { outline: 2px solid var(--mm-ocre); outline-offset: -4px; border-radius: 8px; }
      .mm-desc p { margin: 0 0 1em; }
      .mm-desc p:last-child { margin-bottom: 0; }
      .mm-fin { display: none; }

      .mm-seguir {
        position: absolute; left: 50%; bottom: 84px; z-index: 2;
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 14px; border-radius: 999px; cursor: pointer;
        background: var(--mm-panel-fuerte); border: 1px solid var(--mm-linea-fuerte);
        color: var(--mm-hueso); font: 600 0.78rem/1 var(--mm-sans);
        box-shadow: 0 8px 24px -10px var(--mm-sombra);
        opacity: 0; pointer-events: none; transform: translate(-50%, 6px);
        transition: opacity 0.25s ease, transform 0.25s ease;
      }
      .mm-seguir.is-visible { opacity: 1; pointer-events: auto; transform: translate(-50%, 0); }
      .mm-seguir svg { animation: mm-rebote 1.6s ease-in-out infinite; }
      @keyframes mm-rebote { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
      .mm-sala { margin: 0 0 14px; padding-right: 8px; font-size: 0.85rem; font-weight: 600; color: var(--mm-ocre); }
      .mm-titulo {
        margin: 0; font-family: var(--mm-serif); font-weight: 600;
        font-size: clamp(1.6rem, 2.6vw, 2.3rem); line-height: 1.12; letter-spacing: -0.01em;
        text-wrap: balance;
      }
      .mm-anio {
        display: flex; align-items: baseline; gap: 10px; margin: 16px 0 16px;
      }
      .mm-anio__num { font-family: var(--mm-serif); font-size: 2.6rem; line-height: 1; color: var(--mm-ocre); }
      .mm-anio__txt { font-size: 0.85rem; color: var(--mm-niebla); }
      .mm-desc { margin: 0; max-width: 60ch; font-size: 1rem; line-height: 1.7; color: var(--mm-texto-2); }

      .mm-datos { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; margin: 22px 0 0; font-size: 0.9rem; }
      .mm-datos dt { color: var(--mm-niebla); }
      .mm-datos dd { margin: 0; }

      .mm-audio { margin-top: 24px; padding: 14px; border-radius: 12px; background: var(--mm-sutil); border: 1px solid var(--mm-linea); }
      .mm-audio p { margin: 0 0 8px; font-size: 0.85rem; color: var(--mm-niebla); }
      .mm-audio audio { width: 100%; color-scheme: dark; }

      .mm-pie {
        flex-shrink: 0; margin-top: auto; padding: 16px 40px 22px;
        border-top: 1px solid var(--mm-linea);
        display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      }
      .mm-institucion { margin: 0; font-size: 0.78rem; line-height: 1.4; color: var(--mm-niebla); max-width: 32ch; }
      .mm-nav { display: flex; gap: 8px; }
      .mm-nav button {
        padding: 9px 14px; border-radius: 10px; cursor: pointer;
        background: transparent; border: 1px solid var(--mm-linea-fuerte);
        color: var(--mm-hueso); font: 500 0.85rem/1 var(--mm-sans);
        transition: border-color 0.2s ease, background 0.2s ease;
      }
      .mm-nav button:hover:not(:disabled) { border-color: var(--mm-ocre); background: color-mix(in srgb, var(--mm-ocre) 12%, transparent); }
      .mm-nav button:disabled { opacity: 0.35; cursor: default; }
      .mm-nav button:focus-visible { outline: 2px solid var(--mm-ocre); outline-offset: 2px; }

      .mm-cerrar {
        position: absolute; top: 14px; right: 14px; z-index: 2;
        width: 42px; height: 42px; border-radius: 50%; cursor: pointer;
        display: grid; place-items: center;
        background: var(--mm-panel); border: 1px solid var(--mm-linea-fuerte);
        color: var(--mm-hueso);
        transition: transform 0.2s ease, border-color 0.2s ease;
      }
      .mm-cerrar:hover { border-color: var(--mm-tezontle); transform: rotate(90deg); }
      .mm-cerrar:focus-visible { outline: 2px solid var(--mm-ocre); outline-offset: 2px; }

      /* Botón para salir de la sala */
      .mm-volver {
        position: fixed; top: 20px; right: 20px; z-index: 60;
        display: inline-flex; align-items: center; gap: 8px;
        padding: 10px 16px 10px 12px; border-radius: 999px;
        background: var(--mm-panel);
        -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
        border: 1px solid var(--mm-linea);
        color: var(--mm-hueso); font: 600 0.88rem/1 var(--mm-sans); text-decoration: none;
        transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
      }
      .mm-volver:hover { border-color: var(--mm-ocre); background: var(--mm-panel-fuerte); }
      .mm-volver:hover svg { transform: translateX(-3px); }
      .mm-volver svg { transition: transform 0.2s ease; }
      .mm-volver:focus-visible { outline: 2px solid var(--mm-ocre); outline-offset: 3px; }

      /* Aviso breve: "Acércate a la obra" */
      .mm-aviso {
        position: fixed; left: 50%; bottom: 84px; z-index: 55;
        transform: translate(-50%, 10px); opacity: 0;
        padding: 10px 18px; border-radius: 999px;
        background: var(--mm-panel); border: 1px solid color-mix(in srgb, var(--mm-ocre) 50%, transparent);
        color: var(--mm-hueso); font: 500 0.9rem/1.3 var(--mm-sans);
        pointer-events: none; transition: opacity 0.25s ease, transform 0.25s ease;
      }
      .mm-aviso.is-visible { opacity: 1; transform: translate(-50%, 0); }


      /* ---------- Botón y panel de accesibilidad (mismo diseño que tu sitio) ----------
         Abajo a la IZQUIERDA: arriba-izq. va la sala, arriba-der. "Volver",
         abajo al centro la ayuda y abajo-der. el botón de pantalla completa de A-Frame. */
      .a11y-launcher {
        position: fixed; left: 22px; bottom: 22px; right: auto; z-index: 9000;
        width: 58px; height: 58px; border-radius: 50%;
        border: 2px solid var(--mm-ocre); background: var(--mm-panel-fuerte);
        display: flex; align-items: center; justify-content: center; cursor: pointer;
        box-shadow: 0 10px 30px -8px var(--mm-sombra);
        transition: transform 240ms ease, background 300ms ease;
      }
      .a11y-launcher:hover { transform: scale(1.06); }
      .a11y-launcher svg { width: 30px; height: 30px; }
      .a11y-launcher:focus-visible { outline: 3px solid var(--mm-ocre); outline-offset: 3px; }

      .a11y-panel {
        position: fixed; left: 22px; bottom: 92px; right: auto; z-index: 9001;
        width: min(360px, calc(100vw - 44px)); max-height: min(640px, calc(100vh - 130px));
        background: var(--mm-obsidiana); color: var(--mm-hueso);
        border: 1px solid var(--mm-linea-fuerte); border-radius: 16px;
        box-shadow: 0 24px 60px -14px var(--mm-sombra);
        display: flex; flex-direction: column;
        font-family: var(--mm-sans); line-height: 1.45;
        transform: translateY(16px) scale(0.98); transform-origin: bottom left;
        opacity: 0; pointer-events: none; visibility: hidden;
        transition: transform 260ms cubic-bezier(.2,.7,.2,1), opacity 220ms ease, visibility 0s linear 260ms;
      }
      .a11y-panel.open { transform: none; opacity: 1; pointer-events: auto; visibility: visible; transition-delay: 0s; }
      .a11y-panel button { font-family: inherit; cursor: pointer; }
      .mm-hud, .mm-ayuda, .mm-volver, .mm-aviso, .a11y-launcher, .a11y-panel, .a11y-panel * { box-sizing: border-box; }
      .a11y-panel :focus-visible { outline: 3px solid var(--mm-ocre); outline-offset: 2px; }
      .a11y-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--mm-linea); flex-shrink: 0; }
      .a11y-header h2 { margin: 0; font-family: var(--mm-serif); font-size: 17px; font-weight: 600; }
      .a11y-close { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--mm-linea-fuerte); background: transparent; color: var(--mm-hueso); font-size: 18px; line-height: 1; }
      .a11y-body { padding: 18px 20px 22px; overflow-y: auto; }
      .a11y-status { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--mm-texto-2); padding: 10px 12px; border-radius: 10px; background: var(--mm-sutil); border: 1px solid var(--mm-linea-fuerte); margin-bottom: 20px; }
      .a11y-status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--mm-niebla); flex-shrink: 0; }
      .a11y-status.has-active .a11y-status-dot { background: var(--mm-ocre); box-shadow: 0 0 8px var(--mm-ocre); }
      .a11y-section-label { font-size: 12px; color: var(--mm-niebla); margin-bottom: 10px; }
      .a11y-profiles, .a11y-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .a11y-profiles { margin-bottom: 18px; }
      .profile-chip, .a11y-card {
        position: relative; display: flex; flex-direction: column; align-items: center; gap: 7px; text-align: center;
        padding: 14px 8px; border-radius: 12px; border: 1px solid var(--mm-linea-fuerte);
        background: var(--mm-sutil); color: var(--mm-texto-2);
      }
      .profile-chip .profile-icon, .a11y-card .card-icon { width: 23px; height: 23px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--mm-texto-2); }
      .profile-chip svg, .a11y-card svg { width: 100%; height: 100%; }
      .profile-label, .card-label { font-size: 12px; }
      .profile-check, .card-check { position: absolute; top: 7px; right: 9px; font-size: 12px; opacity: 0; color: var(--mm-ocre); }
      .card-badge { position: absolute; top: 8px; left: 10px; width: 15px; height: 15px; border-radius: 50%; background: var(--mm-niebla); color: var(--mm-obsidiana); font-size: 10px; display: flex; align-items: center; justify-content: center; }
      .profile-chip[aria-pressed="true"], .a11y-card[aria-pressed="true"], .a11y-card[aria-expanded="true"] {
        border-color: var(--mm-ocre); background: color-mix(in srgb, var(--mm-ocre) 12%, transparent); color: var(--mm-hueso);
      }
      .profile-chip[aria-pressed="true"] .profile-icon, .a11y-card[aria-pressed="true"] .card-icon, .a11y-card[aria-expanded="true"] .card-icon { color: var(--mm-ocre); }
      .profile-chip[aria-pressed="true"] .profile-check, .a11y-card[aria-pressed="true"] .card-check { opacity: 1; }
      .a11y-divider { border: none; border-top: 1px solid var(--mm-linea); margin: 4px 0 18px; }
      .a11y-subpanel { margin-top: 14px; padding: 14px; border-radius: 12px; background: var(--mm-sutil); border: 1px solid var(--mm-linea-fuerte); }
      .a11y-subpanel[hidden] { display: none; }
      .a11y-subpanel-label { font-size: 11.5px; color: var(--mm-niebla); display: block; margin-bottom: 10px; }
      .a11y-chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .a11y-chip { padding: 7px 13px; border-radius: 999px; border: 1px solid var(--mm-linea-fuerte); background: var(--mm-carbon); font-size: 12.5px; color: var(--mm-texto-2); }
      .a11y-chip[aria-pressed="true"] { background: var(--mm-ocre); border-color: var(--mm-ocre); color: var(--mm-sobre-acento); font-weight: 600; }
      .a11y-reset { width: 100%; margin-top: 20px; padding: 12px; border-radius: 10px; border: 1px solid var(--mm-linea-fuerte); background: transparent; color: var(--mm-texto-2); font-size: 13px; }
      .a11y-reset:hover { border-color: var(--mm-ocre); color: var(--mm-ocre); }

      /* La barra de ayuda deja libres las dos esquinas de abajo */
      .mm-ayuda { max-width: calc(100vw - 200px); }
      @media (max-width: 820px) {
        .a11y-launcher { left: 12px; bottom: 12px; width: 48px; height: 48px; }
        .a11y-launcher svg { width: 26px; height: 26px; }
        .a11y-panel { left: 12px; bottom: 70px; width: calc(100vw - 24px); max-height: calc(100vh - 150px); }
        .mm-ayuda { max-width: calc(100vw - 150px); bottom: 14px; border-radius: 16px; gap: 8px 12px; }
        .mm-ayuda span { white-space: normal; text-align: center; }
        .mm-hud { max-width: calc(100vw - 140px); }
      }

      /* ---------- Accesibilidad (mismas clases que app.js) ---------- */
      html.a11y-zoom { font-size: 112.5%; }

      html.a11y-font-opendyslexic { --mm-sans: "Comic Sans MS", "Comic Sans", sans-serif; --mm-serif: "Comic Sans MS", "Comic Sans", sans-serif; }
      html.a11y-font-sans { --mm-sans: Arial, Helvetica, sans-serif; --mm-serif: Arial, Helvetica, sans-serif; }
      html.a11y-font-serif { --mm-sans: Georgia, "Times New Roman", serif; --mm-serif: Georgia, "Times New Roman", serif; }

      html.a11y-espaciado .mm-overlay, html.a11y-espaciado .mm-hud, html.a11y-espaciado .mm-ayuda,
      html.a11y-espaciado .mm-aviso, html.a11y-espaciado .mm-volver, html.a11y-espaciado #carga {
        letter-spacing: 0.03em; word-spacing: 0.14em;
      }
      html.a11y-espaciado .mm-desc, html.a11y-espaciado .mm-hud__desc, html.a11y-espaciado .mm-datos { line-height: 1.9; }

      html.a11y-resaltado .mm-volver { text-decoration: underline; text-underline-offset: 3px; }
      html.a11y-resaltado .mm-desc, html.a11y-resaltado .mm-hud__desc, html.a11y-resaltado .mm-datos dd,
      html.a11y-resaltado .mm-institucion {
        background: color-mix(in srgb, var(--mm-ocre) 10%, transparent);
      }

      html.a11y-contraste-alto { --mm-linea: currentColor; --mm-linea-fuerte: currentColor; --mm-niebla: var(--mm-texto-2); }
      html.a11y-contraste-alto .mm-card, html.a11y-contraste-alto .mm-hud, html.a11y-contraste-alto .mm-ayuda,
      html.a11y-contraste-alto .mm-volver, html.a11y-contraste-alto .mm-cerrar, html.a11y-contraste-alto .mm-nav button,
      html.a11y-contraste-alto .mm-aviso { border-width: 2px; }
      html.a11y-contraste-alto .mm-panel-solido, html.a11y-contraste-alto .mm-hud,
      html.a11y-contraste-alto .mm-ayuda, html.a11y-contraste-alto .mm-volver { background: var(--mm-panel-fuerte); }

      html.a11y-audio-hint .mm-overlay button:hover, html.a11y-audio-hint .mm-volver:hover {
        outline: 2px dashed var(--mm-ocre); outline-offset: 2px;
      }

      html.a11y-cursor-grande, html.a11y-cursor-grande * { cursor: pointer; }
      html.a11y-cursor-grande { cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"><path d="M5 3l14 8.5-6.2.9L16 19l-2.6 1.1-3.2-6.6L5 17V3Z" fill="black" stroke="white" stroke-width="1"/></svg>') 4 4, auto; }
      html.a11y-cursor-extragrande { cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path d="M5 3l14 8.5-6.2.9L16 19l-2.6 1.1-3.2-6.6L5 17V3Z" fill="black" stroke="white" stroke-width="1"/></svg>') 6 6, auto; }

      /* Botón "Escuchar ficha" (lector de pantalla activo) */
      .mm-leer {
        align-self: flex-start; margin-top: 18px;
        display: inline-flex; align-items: center; gap: 8px;
        padding: 9px 14px; border-radius: 10px; cursor: pointer;
        background: color-mix(in srgb, var(--mm-ocre) 14%, transparent);
        border: 1px solid var(--mm-ocre); color: var(--mm-hueso);
        font: 600 0.88rem/1 var(--mm-sans);
      }
      .mm-leer[hidden] { display: none; }
      .mm-leer:focus-visible { outline: 2px solid var(--mm-ocre); outline-offset: 2px; }

      /* Tipo de obra y ficha de personaje */
      .mm-tipo {
        align-self: flex-start; margin: 0 0 12px;
        padding: 4px 10px; border-radius: 999px;
        border: 1px solid var(--mm-linea-fuerte);
        font: 600 0.74rem/1.3 var(--mm-sans); letter-spacing: 0.06em; text-transform: uppercase;
        color: var(--mm-niebla);
      }
      .mm-rol { margin: 10px 0 0; font: 500 1rem/1.4 var(--mm-sans); color: var(--mm-texto-2); font-style: italic; }
      .mm-rol[hidden], .mm-desc-titulo[hidden], .mm-nav[hidden] { display: none; }
      .mm-desc-titulo {
        margin: 0 0 10px; font: 600 0.8rem/1 var(--mm-sans); letter-spacing: 0.08em; text-transform: uppercase;
        color: var(--mm-ocre);
      }

      .mm-card.es-personaje {
        grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.25fr);
        height: min(88vh, 820px);
      }
      .mm-card.es-personaje .mm-info {
        background:
          radial-gradient(120% 60% at 100% 0%, color-mix(in srgb, var(--mm-ocre) 10%, transparent), transparent 60%),
          linear-gradient(180deg, var(--mm-carbon), var(--mm-obsidiana) 60%);
      }
      .mm-card.es-personaje .mm-titulo { font-size: clamp(1.9rem, 3vw, 2.7rem); }
      .mm-card.es-personaje .mm-anio {
        margin: 14px 0 18px; padding: 10px 14px; width: fit-content;
        border-left: 3px solid var(--mm-ocre); background: color-mix(in srgb, var(--mm-ocre) 8%, transparent);
        border-radius: 0 10px 10px 0;
      }
      .mm-card.es-personaje .mm-anio__num { font-size: 1.7rem; }
      .mm-card.es-personaje .mm-cuerpo { padding-top: 26px; }
      .mm-card.es-personaje .mm-desc { max-width: 62ch; }
      .mm-card.es-personaje .mm-desc p { text-align: pretty; hyphens: auto; }
      .mm-cita {
        position: relative; margin: 0 0 24px; padding: 18px 22px 18px 54px;
        border-radius: 14px; background: color-mix(in srgb, var(--mm-ocre) 9%, transparent);
        border: 1px solid color-mix(in srgb, var(--mm-ocre) 30%, transparent);
        font: italic 500 1.12rem/1.55 var(--mm-serif); color: var(--mm-hueso);
      }
      .mm-cita::before {
        content: "“"; position: absolute; left: 16px; top: 2px;
        font: 600 3.4rem/1 var(--mm-serif); color: var(--mm-ocre);
      }
      .mm-cita[hidden] { display: none; }
      .mm-card.es-personaje .mm-fin {
        display: block; margin: 28px 0 4px; text-align: center; letter-spacing: 1.2em;
        color: color-mix(in srgb, var(--mm-ocre) 70%, transparent); font-size: 0.8rem;
      }
      .mm-card.es-personaje .mm-datos {
        margin-top: 22px; padding: 16px 18px; border-radius: 12px;
        background: var(--mm-sutil); border: 1px solid var(--mm-linea);
      }
      .mm-card.es-personaje .mm-media { overflow: hidden; }
      .mm-card.es-personaje .mm-media .mm-img { box-shadow: 0 30px 60px -20px var(--mm-sombra), 0 0 0 8px color-mix(in srgb, var(--mm-ocre) 12%, transparent); }
      .mm-card.es-personaje .mm-tipo {
        background: var(--mm-ocre); border-color: var(--mm-ocre); color: var(--mm-sobre-acento);
      }
      /* Retrato: fondo de papel en vez de película y marco en arco */
      .mm-card.es-personaje .mm-media {
        background:
          radial-gradient(ellipse at 50% 35%, color-mix(in srgb, var(--mm-ocre) 18%, transparent), transparent 70%),
          var(--mm-carbon);
        padding: 34px 28px;
      }
      .mm-card.es-personaje .mm-media::before, .mm-card.es-personaje .mm-media::after { display: none; }
      .mm-card.es-personaje .mm-img {
        border-radius: 999px 999px 10px 10px;
        padding: 10px; background: var(--mm-obsidiana);
        border: 2px solid var(--mm-ocre);
        max-height: calc(min(88vh, 820px) - 90px);
      }
      .mm-card.es-personaje .mm-desc { font-size: 1.05rem; line-height: 1.8; }
      .mm-card.es-personaje .mm-desc p:first-child::first-letter {
        float: left; font-family: var(--mm-serif); font-size: 3.2em; line-height: 0.85;
        margin: 4px 8px 0 0; color: var(--mm-ocre);
      }

      @media (max-width: 820px) {
        .mm-card.es-personaje { grid-template-columns: 1fr; height: 94vh; }
        .mm-card.es-personaje .mm-media { padding: 18px 12px 14px; }
        .mm-card.es-personaje .mm-img { max-height: 24vh; padding: 5px; }
        .mm-card.es-personaje .mm-sala { display: none; }
        .mm-card.es-personaje .mm-titulo { font-size: 1.6rem; }
        .mm-card.es-personaje .mm-rol { margin-top: 6px; font-size: 0.92rem; }
        .mm-card.es-personaje .mm-anio { margin: 10px 0 12px; padding: 6px 12px; }
        .mm-card.es-personaje .mm-anio__num { font-size: 1.3rem; }
        .mm-card.es-personaje .mm-cuerpo { padding-top: 16px; }
      }

      /* Zoom a pantalla completa */
      .mm-zoom {
        position: fixed; inset: 0; z-index: 10000;
        display: none; align-items: center; justify-content: center;
        background: color-mix(in srgb, var(--mm-media) 96%, transparent); cursor: zoom-out; padding: 16px;
      }
      .mm-zoom.is-visible { display: flex; }
      .mm-zoom img { max-width: 100%; max-height: 100%; object-fit: contain; }

      /* Móvil: hoja inferior */
      @media (max-width: 820px) {
        .mm-overlay { padding: 0; align-items: flex-end; }
        .mm-card {
          grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr);
          max-height: 94vh; border-radius: 20px 20px 0 0;
          transform: translateY(100%);
        }
        .mm-media { min-height: 0; padding: 30px 12px; }
        .mm-img, .mm-video, .mm-yt { max-height: 42vh; }
        .mm-yt.is-vertical { height: 42vh; }
        .mm-cabecera { padding: 20px 22px 0; }
        .mm-card .mm-cabecera { padding-right: 64px; }
        .mm-cuerpo { padding: 16px 22px 20px; }
        .mm-progreso { margin: 0 22px; }
        .mm-pie { padding: 10px 22px 14px; }
        .mm-institucion { display: none; }
        .mm-nav { width: 100%; }
        .mm-nav button { flex: 1; }
        .mm-seguir { bottom: 70px; }
        .mm-hud { top: 12px; left: 12px; padding: 10px 14px 12px; max-width: calc(100vw - 130px); }
        .mm-volver { top: 12px; right: 12px; padding: 9px 14px 9px 10px; }
        .mm-hud__desc { display: none; }
      }

      @media (prefers-reduced-motion: reduce) {
        .mm-overlay, .mm-card, .mm-img, .mm-ayuda, .mm-cerrar, .mm-aviso, .mm-volver, .mm-volver svg { transition: none !important; }
      }
      /* =================================================================
         CAPA DE DISEÑO (misma paleta; solo composición, jerarquía y movimiento)
         ================================================================= */
      :root { --mm-curva: cubic-bezier(0.2, 0.8, 0.2, 1); --mm-brillo: color-mix(in srgb, var(--mm-ocre) 55%, transparent); }

      /* Viñeta cinematográfica sobre el 3D */
      .mm-vineta {
        position: fixed; inset: 0; z-index: 40; pointer-events: none;
        background:
          radial-gradient(120% 90% at 50% 45%, transparent 55%, color-mix(in srgb, var(--mm-media) 55%, transparent) 100%),
          linear-gradient(to bottom, color-mix(in srgb, var(--mm-media) 28%, transparent), transparent 18%, transparent 80%, color-mix(in srgb, var(--mm-media) 34%, transparent));
      }

      /* ---------- Portada de entrada ---------- */
      .mm-portada {
        position: fixed; inset: 0; z-index: 8000;
        display: grid; place-items: center; text-align: center; padding: 24px;
        background:
          radial-gradient(60% 50% at 50% 45%, color-mix(in srgb, var(--mm-ocre) 16%, transparent), transparent 70%),
          color-mix(in srgb, var(--mm-media) 72%, transparent);
        color: #f4ead0; pointer-events: none;
        opacity: 0; transition: opacity 0.9s ease;
      }
      html[data-mode="digital"] .mm-portada, html.a11y-dark .mm-portada { color: var(--mm-hueso); }
      .mm-portada.is-visible { opacity: 1; }
      .mm-portada__caja { max-width: 820px; }
      .mm-portada__eyebrow {
        display: inline-flex; align-items: center; gap: 14px; margin: 0 0 18px;
        font: 600 0.82rem/1 var(--mm-sans); letter-spacing: 0.32em; text-transform: uppercase; color: var(--mm-tezontle);
      }
      .mm-portada__eyebrow::before, .mm-portada__eyebrow::after { content: ""; width: 42px; height: 1px; background: currentColor; opacity: 0.7; }
      .mm-portada__num {
        display: block; margin: 0 0 6px;
        font: 600 clamp(4rem, 12vw, 8rem)/0.9 var(--mm-serif); letter-spacing: -0.03em;
        background: linear-gradient(180deg, var(--mm-tezontle), var(--mm-ocre));
        -webkit-background-clip: text; background-clip: text; color: transparent;
      }
      .mm-portada__nombre { margin: 0; font: 600 clamp(1.7rem, 4vw, 3rem)/1.12 var(--mm-serif); text-wrap: balance; }
      .mm-portada__desc { margin: 18px auto 0; max-width: 56ch; font: 400 clamp(0.95rem, 1.4vw, 1.1rem)/1.6 var(--mm-sans); opacity: 0.82; }
      .mm-portada__pista { margin: 30px 0 0; font: 500 0.82rem/1 var(--mm-sans); letter-spacing: 0.08em; opacity: 0.7; }
      .mm-portada.is-visible .mm-portada__caja > * { animation: mm-subir 0.9s var(--mm-curva) both; }
      .mm-portada.is-visible .mm-portada__caja > *:nth-child(2) { animation-delay: 0.12s; }
      .mm-portada.is-visible .mm-portada__caja > *:nth-child(3) { animation-delay: 0.24s; }
      .mm-portada.is-visible .mm-portada__caja > *:nth-child(4) { animation-delay: 0.36s; }
      .mm-portada.is-visible .mm-portada__caja > *:nth-child(5) { animation-delay: 0.6s; }
      @keyframes mm-subir { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }

      /* ---------- HUD de la sala ---------- */
      .mm-hud {
        display: grid; grid-template-columns: auto 1fr; gap: 0 16px; align-items: center;
        top: 22px; left: 22px; max-width: min(460px, calc(100vw - 180px));
        padding: 14px 20px 14px 16px;
        border: 1px solid var(--mm-linea); border-left: 1px solid var(--mm-linea);
        border-radius: 16px;
        box-shadow: 0 18px 40px -22px var(--mm-sombra), inset 0 1px 0 color-mix(in srgb, #fff 18%, transparent);
        animation: mm-entrar-izq 0.8s var(--mm-curva) 0.2s both;
        transition: padding 0.4s var(--mm-curva), max-width 0.4s var(--mm-curva);
      }
      .mm-hud::before {
        content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 3px; border-radius: 0 3px 3px 0;
        background: linear-gradient(180deg, var(--mm-tezontle), var(--mm-ocre));
      }
      .mm-hud__num {
        grid-row: span 3; align-self: stretch; display: flex; flex-direction: column; justify-content: center;
        padding-right: 16px; border-right: 1px solid var(--mm-linea); text-align: center;
      }
      .mm-hud__num small { font: 600 0.62rem/1 var(--mm-sans); letter-spacing: 0.22em; text-transform: uppercase; color: var(--mm-niebla); }
      .mm-hud__num b { font: 600 2.4rem/1 var(--mm-serif); color: var(--mm-ocre); letter-spacing: -0.02em; margin-top: 4px; }
      .mm-hud__sala { display: none; }
      .mm-hud__nombre { font-size: 1.12rem; line-height: 1.22; text-wrap: balance; }
      .mm-hud__desc { margin-top: 4px; font-size: 0.82rem; }
      .mm-hud__stats { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; padding: 0; list-style: none; }
      .mm-hud__stats li {
        padding: 3px 9px; border-radius: 999px; font: 600 0.7rem/1.3 var(--mm-sans);
        background: var(--mm-sutil); border: 1px solid var(--mm-linea); color: var(--mm-texto-2);
      }
      .mm-hud__stats li b { color: var(--mm-ocre); }
      /* Mientras caminas, el HUD se vuelve compacto para no tapar la vista */
      html.mm-caminando .mm-hud { max-width: min(340px, calc(100vw - 180px)); padding-top: 10px; padding-bottom: 10px; }
      html.mm-caminando .mm-hud__desc, html.mm-caminando .mm-hud__stats { display: none; }
      html.mm-caminando .mm-hud__num b { font-size: 1.8rem; }
      @keyframes mm-entrar-izq { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: none; } }
      @keyframes mm-entrar-der { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }

      /* ---------- Volver ---------- */
      .mm-volver {
        top: 22px; right: 22px; padding: 6px 16px 6px 6px; gap: 10px;
        box-shadow: 0 14px 30px -18px var(--mm-sombra), inset 0 1px 0 color-mix(in srgb, #fff 16%, transparent);
        animation: mm-entrar-der 0.8s var(--mm-curva) 0.3s both;
      }
      .mm-volver svg {
        width: 30px; height: 30px; padding: 8px; border-radius: 50%;
        background: var(--mm-ocre); color: var(--mm-sobre-acento);
      }
      .mm-volver:hover { transform: translateY(-1px); }

      /* ---------- Barra de ayuda ---------- */
      .mm-ayuda {
        bottom: 26px; gap: 0; padding: 8px 10px; border-radius: 18px;
        width: max-content; max-width: calc(100vw - 200px);
        box-shadow: 0 18px 40px -22px var(--mm-sombra), inset 0 1px 0 color-mix(in srgb, #fff 16%, transparent);
      }
      .mm-ayuda span { padding: 4px 12px; }
      .mm-ayuda span + span { border-left: 1px solid var(--mm-linea); }
      .mm-ayuda kbd {
        min-width: 1.9em; padding: 3px 6px; margin-right: 3px;
        background: linear-gradient(180deg, var(--mm-obsidiana), var(--mm-carbon));
        box-shadow: 0 1px 0 var(--mm-linea-fuerte);
      }

      /* ---------- Objetivo en la mira ---------- */
      .mm-objetivo {
        position: fixed; left: 50%; top: auto; bottom: 100px; z-index: 45;   /* abajo al centro, fuera de la vista de las obras */
        display: flex; align-items: center; gap: 12px; max-width: min(460px, calc(100vw - 32px));
        padding: 8px 14px 8px 8px; border-radius: 14px;
        background: var(--mm-panel-fuerte); border: 1px solid var(--mm-brillo);
        box-shadow: 0 16px 40px -18px var(--mm-sombra);
        color: var(--mm-hueso); font-family: var(--mm-sans); pointer-events: none;
        opacity: 0; transform: translate(-50%, 6px) scale(0.98);
        transition: opacity 0.2s ease, transform 0.25s var(--mm-curva);
      }
      .mm-objetivo.is-visible { opacity: 1; transform: translate(-50%, 0) scale(1); }
      html.mm-guiado .mm-objetivo { bottom: 150px; }   /* encima de la barra del recorrido guiado */
      .mm-objetivo__tipo {
        flex-shrink: 0; padding: 5px 9px; border-radius: 9px;
        background: var(--mm-ocre); color: var(--mm-sobre-acento);
        font: 700 0.64rem/1 var(--mm-sans); letter-spacing: 0.12em; text-transform: uppercase;
      }
      .mm-objetivo__titulo { min-width: 0; font: 600 0.95rem/1.25 var(--mm-serif); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mm-objetivo__accion { flex-shrink: 0; font: 500 0.75rem/1 var(--mm-sans); color: var(--mm-niebla); }
      .mm-objetivo__accion kbd {
        display: inline-block; padding: 2px 6px; margin-right: 4px; border-radius: 5px;
        border: 1px solid var(--mm-linea-fuerte); border-bottom-width: 2px;
        font: 700 0.7rem/1.2 var(--mm-sans); color: var(--mm-hueso);
      }

      /* ---------- Aviso ---------- */
      .mm-aviso { display: inline-flex; align-items: center; gap: 10px; bottom: 96px; }
      .mm-aviso::before {
        content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--mm-ocre);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--mm-ocre) 25%, transparent);
      }

      /* ---------- Ficha (modal) ---------- */
      .mm-card {
        border-radius: 22px;
        box-shadow: 0 50px 120px -30px var(--mm-sombra), 0 0 0 1px var(--mm-linea),
                    inset 0 1px 0 color-mix(in srgb, #fff 14%, transparent);
      }
      .mm-card::after {
        content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px; z-index: 3; pointer-events: none;
        background: linear-gradient(90deg, transparent, var(--mm-ocre) 20%, var(--mm-tezontle) 50%, var(--mm-ocre) 80%, transparent);
      }
      .mm-overlay.is-visible .mm-cabecera > * { animation: mm-subir 0.6s var(--mm-curva) both; }
      .mm-overlay.is-visible .mm-cabecera > *:nth-child(2) { animation-delay: 0.05s; }
      .mm-overlay.is-visible .mm-cabecera > *:nth-child(3) { animation-delay: 0.1s; }
      .mm-overlay.is-visible .mm-cabecera > *:nth-child(4) { animation-delay: 0.15s; }
      .mm-overlay.is-visible .mm-cabecera > *:nth-child(5) { animation-delay: 0.2s; }
      .mm-overlay.is-visible .mm-cuerpo { animation: mm-subir 0.7s var(--mm-curva) 0.22s both; }
      .mm-sala { letter-spacing: 0.02em; }
      .mm-titulo { font-size: clamp(1.8rem, 2.8vw, 2.5rem); }
      .mm-anio__num {
        background: linear-gradient(180deg, var(--mm-tezontle), var(--mm-ocre));
        -webkit-background-clip: text; background-clip: text; color: transparent;
      }
      .mm-cerrar { width: 44px; height: 44px; box-shadow: 0 10px 24px -14px var(--mm-sombra); }
      .mm-cerrar:hover { background: var(--mm-ocre); color: var(--mm-sobre-acento); border-color: var(--mm-ocre); }
      .mm-nav button {
        display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 12px;
        transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
      }
      .mm-nav .mm-prev::before { content: "←"; }
      .mm-nav .mm-next::after { content: "→"; }
      .mm-nav .mm-next:not(:disabled) {
        background: linear-gradient(120deg, var(--mm-ocre), var(--mm-tezontle));
        border-color: transparent; color: var(--mm-sobre-acento); font-weight: 600;
        box-shadow: 0 10px 22px -12px var(--mm-sombra);
      }
      .mm-nav .mm-next:hover:not(:disabled) { transform: translateY(-1px); background: linear-gradient(120deg, var(--mm-tezontle), var(--mm-ocre)); }
      .mm-contador { font: 600 0.8rem/1.4 var(--mm-serif); letter-spacing: 0.06em; padding: 5px 12px; }
      .mm-zoom-btn:hover { background: var(--mm-ocre); color: var(--mm-sobre-acento); }
      .mm-media .mm-img:not(.is-cargando) { transition: clip-path 0.7s var(--mm-curva), opacity 0.3s ease, transform 0.6s var(--mm-curva); }
      .mm-img-btn:hover .mm-img { transform: scale(1.012); }

      /* ---------- Botón de accesibilidad ---------- */
      .a11y-launcher { animation: mm-entrar-izq 0.8s var(--mm-curva) 0.4s both; }
      .a11y-launcher::after {
        content: ""; position: absolute; inset: -6px; border-radius: 50%;
        border: 1px solid var(--mm-brillo); opacity: 0.6; pointer-events: none;
      }

      @media (max-width: 820px) {
        .mm-hud { top: 12px; left: 12px; padding: 10px 14px 10px 12px; max-width: calc(100vw - 130px); gap: 0 12px; }
        .mm-hud__num { padding-right: 12px; }
        .mm-hud__num b { font-size: 1.7rem; }
        .mm-hud__stats { display: none; }
        .mm-volver { top: 12px; right: 12px; padding: 4px 12px 4px 4px; }
        .mm-volver svg { width: 26px; height: 26px; padding: 7px; }
        .mm-ayuda span + span { border-left: none; }
        .mm-objetivo { display: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .mm-portada, .mm-portada *, .mm-hud, .mm-volver, .a11y-launcher, .mm-objetivo,
        .mm-overlay.is-visible .mm-cabecera > *, .mm-overlay.is-visible .mm-cuerpo { animation: none !important; transition: none !important; }
      }

      /* ---------- Portada interactiva ---------- */
      .mm-portada { pointer-events: auto; }
      .mm-portada__acciones { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; margin-top: 34px; }
      .mm-portada__btn {
        display: inline-flex; align-items: center; gap: 14px; min-width: 250px; text-align: left;
        padding: 14px 22px 14px 16px; border-radius: 16px; cursor: pointer;
        background: color-mix(in srgb, #f4ead0 10%, transparent);
        border: 1px solid color-mix(in srgb, #f4ead0 32%, transparent);
        color: inherit; font-family: var(--mm-sans);
        -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
        transition: transform 0.25s var(--mm-curva), background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
      }
      .mm-portada__btn svg {
        flex-shrink: 0; width: 40px; height: 40px; padding: 11px; border-radius: 50%;
        border: 1px solid currentColor; opacity: 0.9;
      }
      .mm-portada__btn span { display: flex; flex-direction: column; gap: 3px; }
      .mm-portada__btn b { font: 600 1.02rem/1.2 var(--mm-serif); }
      .mm-portada__btn small { font-size: 0.78rem; opacity: 0.75; }
      .mm-portada__btn:hover, .mm-portada__btn:focus-visible { transform: translateY(-3px); border-color: var(--mm-tezontle); outline: none; }
      .mm-portada__btn.is-principal {
        background: linear-gradient(120deg, var(--mm-ocre), var(--mm-tezontle));
        border-color: transparent; color: var(--mm-sobre-acento);
        box-shadow: 0 18px 40px -16px color-mix(in srgb, var(--mm-ocre) 70%, transparent);
      }
      .mm-portada__btn.is-principal svg { background: color-mix(in srgb, var(--mm-sobre-acento) 18%, transparent); border-color: transparent; }
      .mm-portada__btn.is-principal:hover { box-shadow: 0 24px 50px -16px color-mix(in srgb, var(--mm-ocre) 85%, transparent); }
      .mm-portada__btn.is-principal::after {
        content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
        box-shadow: 0 0 0 0 color-mix(in srgb, var(--mm-tezontle) 60%, transparent);
        animation: mm-latido 2.4s ease-out infinite;
      }
      .mm-portada__btn { position: relative; }
      @keyframes mm-latido { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--mm-tezontle) 55%, transparent); } 100% { box-shadow: 0 0 0 16px transparent; } }
      .mm-portada.is-visible .mm-portada__caja > *:nth-child(5) { animation-delay: 0.5s; }
      .mm-portada.is-visible .mm-portada__caja > *:nth-child(6) { animation-delay: 0.75s; }

      /* ---------- Acciones superiores (recorrido y sonido) ---------- */
      .mm-acciones {
        position: fixed; top: 22px; right: 168px; z-index: 60; display: flex; gap: 10px;
        animation: mm-entrar-der 0.8s var(--mm-curva) 0.4s both;
      }
      .mm-accion {
        display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer;
        background: var(--mm-panel); border: 1px solid var(--mm-linea); color: var(--mm-hueso);
        -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
        font: 600 0.86rem/1 var(--mm-sans);
        box-shadow: 0 14px 30px -18px var(--mm-sombra), inset 0 1px 0 color-mix(in srgb, #fff 16%, transparent);
        transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
      }
      .mm-accion:hover { transform: translateY(-1px); border-color: var(--mm-ocre); }
      .mm-accion:focus-visible { outline: 2px solid var(--mm-ocre); outline-offset: 3px; }
      .mm-guiar svg { color: var(--mm-ocre); }
      .mm-sonido { width: 44px; padding: 0; justify-content: center; }
      .mm-sonido .mm-sonido__off { display: none; }
      .mm-sonido.is-mudo .mm-sonido__on { display: none; }
      .mm-sonido.is-mudo .mm-sonido__off { display: block; opacity: 0.7; }
      html.mm-guiado .mm-guiar { display: none; }

      /* ---------- Corte cinematográfico ---------- */
      .mm-corte {
        position: fixed; inset: 0; z-index: 7000; pointer-events: none;
        background: var(--mm-media); opacity: 0; transition: opacity 0.4s ease;
      }
      .mm-corte.is-activo { opacity: 1; }

      /* ---------- Barra del recorrido guiado ---------- */
      .mm-guia {
        position: fixed; left: 50%; bottom: 26px; z-index: 60;
        display: flex; align-items: center; gap: 18px;
        width: min(720px, calc(100vw - 200px)); padding: 12px 12px 12px 22px; border-radius: 20px;
        background: var(--mm-panel-fuerte); border: 1px solid var(--mm-linea-fuerte);
        -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
        box-shadow: 0 24px 60px -24px var(--mm-sombra);
        color: var(--mm-hueso); font-family: var(--mm-sans);
        opacity: 0; pointer-events: none; transform: translate(-50%, 16px);
        transition: opacity 0.35s ease, transform 0.45s var(--mm-curva);
      }
      .mm-guia.is-visible { opacity: 1; pointer-events: auto; transform: translate(-50%, 0); }
      html.mm-guiado .mm-ayuda { opacity: 0; pointer-events: none; }
      .mm-guia__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
      .mm-guia__paso { font: 700 0.7rem/1 var(--mm-sans); letter-spacing: 0.14em; text-transform: uppercase; color: var(--mm-ocre); }
      .mm-guia__titulo { font: 600 1.05rem/1.25 var(--mm-serif); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mm-guia__secciones { display: flex; gap: 5px; margin-top: 8px; }
      .mm-guia .mm-guia__secciones button {
        position: relative; flex: 1; min-width: 0; height: 12px; padding: 0; margin: 0;
        border: 0; border-radius: 0; background: transparent; cursor: pointer; transform: none;
      }
      .mm-guia .mm-guia__secciones button::before,
      .mm-guia .mm-guia__secciones button i {
        content: ""; position: absolute; left: 0; right: 0; top: 4px; height: 4px; border-radius: 4px;
      }
      .mm-guia .mm-guia__secciones button::before { background: var(--mm-linea); }
      .mm-guia .mm-guia__secciones button i {
        display: block; transform-origin: left;
        background: linear-gradient(90deg, var(--mm-ocre), var(--mm-tezontle));
        transition: transform 0.6s var(--mm-curva);
      }
      .mm-guia .mm-guia__secciones button.is-actual::before { background: color-mix(in srgb, var(--mm-ocre) 28%, transparent); }
      .mm-guia .mm-guia__secciones button:hover::before { background: color-mix(in srgb, var(--mm-ocre) 45%, transparent); }
      .mm-guia .mm-guia__secciones button:focus-visible { outline: 2px solid var(--mm-ocre); outline-offset: 2px; }

      /* Intertítulo de sección durante el corte */
      .mm-corte { display: grid; place-items: center; }
      .mm-corte__caja { text-align: center; color: #f4ead0; opacity: 0; transform: translateY(12px); transition: opacity 0.4s ease 0.15s, transform 0.6s var(--mm-curva) 0.15s; }
      html[data-mode="digital"] .mm-corte__caja, html.a11y-dark .mm-corte__caja { color: var(--mm-hueso); }
      .mm-corte.con-titulo.is-activo .mm-corte__caja { opacity: 1; transform: none; }
      .mm-corte__eyebrow { display: block; font: 600 0.82rem/1 var(--mm-sans); letter-spacing: 0.4em; text-transform: uppercase; color: var(--mm-tezontle); }
      .mm-corte__num {
        display: block; margin: 8px 0 10px; font: 600 clamp(4.5rem, 12vw, 8rem)/0.9 var(--mm-serif);
        background: linear-gradient(180deg, var(--mm-tezontle), var(--mm-ocre));
        -webkit-background-clip: text; background-clip: text; color: transparent;
      }
      .mm-corte__detalle { font: 500 0.95rem/1.4 var(--mm-sans); opacity: 0.8; letter-spacing: 0.04em; }
      .mm-guia__botones { display: flex; gap: 8px; flex-shrink: 0; }
      .mm-guia button {
        min-width: 44px; height: 44px; padding: 0 14px; border-radius: 12px; cursor: pointer;
        background: transparent; border: 1px solid var(--mm-linea-fuerte); color: var(--mm-hueso);
        font: 600 0.9rem/1 var(--mm-sans); transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
      }
      .mm-guia button:hover { border-color: var(--mm-ocre); transform: translateY(-1px); }
      .mm-guia button:focus-visible { outline: 2px solid var(--mm-ocre); outline-offset: 2px; }
      .mm-guia button.is-principal {
        background: linear-gradient(120deg, var(--mm-ocre), var(--mm-tezontle)); border-color: transparent;
        color: var(--mm-sobre-acento); padding: 0 20px;
      }
      .mm-guia__salir { color: var(--mm-niebla) !important; }

      @media (max-width: 820px) {
        .mm-acciones { top: 62px; right: 12px; flex-direction: column; align-items: flex-end; gap: 8px; }
        .mm-guiar span { display: none; }
        .mm-guiar { width: 44px; padding: 0; justify-content: center; }
        .mm-guia { width: calc(100vw - 24px); bottom: 70px; flex-direction: column; align-items: stretch; gap: 10px; padding: 12px; }
        .mm-guia__botones { justify-content: space-between; }
        .mm-guia button.is-principal { flex: 1; }
        .mm-portada__btn { min-width: 0; width: 100%; }
        .mm-portada__acciones { flex-direction: column; }
      }
      @media (prefers-reduced-motion: reduce) {
        .mm-portada__btn.is-principal::after { animation: none; }
        .mm-corte, .mm-guia { transition: none; }
      }

      /* =================================================================
         CAPA RESPONSIVA (celulares y tabletas, vertical y horizontal)
         Solo acomoda tamaños y posiciones; colores y funciones no cambian.
         ================================================================= */
      html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
      html.mm-tactil, html.mm-tactil body { overscroll-behavior: none; }
      html.mm-tactil .mm-hud, html.mm-tactil .mm-volver, html.mm-tactil .mm-acciones,
      html.mm-tactil .a11y-launcher, html.mm-tactil .mm-guia { -webkit-tap-highlight-color: transparent; }

      /* Mientras está la portada no se ve nada detrás que se encime con ella */
      html.mm-en-portada .mm-hud, html.mm-en-portada .mm-acciones, html.mm-en-portada .mm-volver,
      html.mm-en-portada .mm-ayuda, html.mm-en-portada .mm-objetivo { visibility: hidden; }

      /* Portada: centrada, pero con scroll si no cabe (nunca se corta) */
      .mm-portada {
        display: flex; overflow-y: auto; overscroll-behavior: contain;
        padding: max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
      }
      .mm-portada__caja { margin: auto; width: 100%; }

      /* Ayuda y avisos en pantallas táctiles */
      html.mm-tactil .mm-ayuda {
        top: calc(env(safe-area-inset-top) + 172px); bottom: auto;
        width: max-content; max-width: calc(100vw - 24px);
        padding: 8px 10px; border-radius: 16px; gap: 2px 4px;
        font-size: 0.8rem; text-align: center;
      }
      html.mm-tactil .mm-ayuda span { white-space: normal; padding: 3px 8px; }
      html.mm-tactil .mm-ayuda span + span { border-left: 1px solid var(--mm-linea); }
      .mm-seguir { white-space: nowrap; }
      html.mm-tactil .mm-aviso {
        top: calc(50% + 34px); bottom: auto; max-width: calc(100vw - 32px);
        text-align: center; font-size: 0.85rem;
      }

      /* ---------- VERTICAL (celular / tableta) ---------- */
      @media (max-width: 820px) and (orientation: portrait) {
        .mm-hud {
          top: calc(env(safe-area-inset-top) + 10px); left: calc(env(safe-area-inset-left) + 10px);
          max-width: calc(100vw - 150px);
        }
        .mm-volver { top: calc(env(safe-area-inset-top) + 10px); right: calc(env(safe-area-inset-right) + 10px); }
        .mm-acciones { top: calc(env(safe-area-inset-top) + 64px); right: calc(env(safe-area-inset-right) + 10px); }
        .mm-hud__nombre {
          display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
          font-size: 1rem;
        }
        .a11y-launcher { left: calc(env(safe-area-inset-left) + 12px); bottom: calc(env(safe-area-inset-bottom) + 12px); }
        .a11y-panel {
          left: calc(env(safe-area-inset-left) + 10px); bottom: calc(env(safe-area-inset-bottom) + 70px);
          width: calc(100vw - 20px - env(safe-area-inset-left) - env(safe-area-inset-right));
          max-height: calc(100vh - 90px); max-height: calc(100dvh - 86px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
        }
        .mm-card { max-height: 94vh; max-height: 94dvh; }
        .mm-card.es-personaje { height: 94vh; height: 94dvh; }
        .mm-img, .mm-video, .mm-yt { max-height: 40vh; max-height: 40dvh; }
        .mm-yt.is-vertical { height: 40vh; height: 40dvh; }
        .mm-pie { padding-bottom: calc(14px + env(safe-area-inset-bottom)); }
        .mm-seguir { bottom: calc(70px + env(safe-area-inset-bottom)); }
        .mm-guia { bottom: calc(env(safe-area-inset-bottom) + 70px); }
      }
      /* Celulares: "Volver" solo con flecha para dejarle espacio al nombre de la sala */
      @media (max-width: 480px) and (orientation: portrait) {
        .mm-volver { padding: 4px; gap: 0; }
        .mm-volver span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .mm-volver svg { width: 40px; height: 40px; padding: 12px; box-sizing: border-box; }
        .mm-hud { max-width: calc(100vw - 86px - env(safe-area-inset-left) - env(safe-area-inset-right)); padding: 9px 12px 9px 10px; gap: 0 10px; }
        .mm-hud__num { padding-right: 10px; }
        .mm-hud__num small { font-size: 0.56rem; letter-spacing: 0.16em; }
        .mm-hud__num b { font-size: 1.5rem; }
        .mm-hud__nombre { font-size: 0.92rem; line-height: 1.2; }
        .mm-acciones { top: calc(env(safe-area-inset-top) + 66px); }

        /* Portada */
        .mm-portada__eyebrow { display: block; margin: 0 auto 12px; max-width: 30ch; font-size: 0.66rem; line-height: 1.5; letter-spacing: 0.2em; text-wrap: balance; }
        .mm-portada__eyebrow::before, .mm-portada__eyebrow::after { display: none; }
        .mm-portada__num { font-size: clamp(3.2rem, 19vw, 5rem); }
        .mm-portada__nombre { font-size: clamp(1.3rem, 6.6vw, 1.8rem); }
        .mm-portada__desc { margin-top: 12px; font-size: 0.9rem; }
        .mm-portada__acciones { margin-top: 22px; gap: 10px; }
        .mm-portada__btn { padding: 12px 16px 12px 12px; gap: 12px; }
        .mm-portada__btn svg { width: 36px; height: 36px; padding: 10px; }
        .mm-portada__pista { margin-top: 18px; font-size: 0.74rem; }

        /* Ficha */
        .mm-cabecera, .mm-card .mm-cabecera { padding: 18px 60px 0 18px; }
        .mm-cuerpo { padding: 14px 18px 18px; }
        .mm-progreso { margin: 0 18px; }
        .mm-pie { padding-left: 14px; padding-right: 14px; }
        .mm-titulo { font-size: 1.55rem; }
        .mm-anio { margin: 10px 0 12px; }
        .mm-anio__num { font-size: 2.1rem; }
        .mm-cerrar { top: 10px; right: 10px; width: 40px; height: 40px; }
        .mm-contador { left: 12px; bottom: 28px; }
        .mm-zoom-btn { right: 12px; bottom: 28px; }
        .mm-cita { padding: 14px 16px 14px 44px; font-size: 1rem; }
        .mm-cita::before { left: 12px; font-size: 2.8rem; }
        .mm-card.es-personaje .mm-desc { font-size: 1rem; line-height: 1.72; }
      }
      /* Celulares muy pequeños o de poca altura (SE, mini, 320 px) */
      @media (max-width: 360px) and (orientation: portrait), (max-height: 640px) and (orientation: portrait) {
        .mm-hud__nombre { -webkit-line-clamp: 2; }
        .mm-img, .mm-video, .mm-yt { max-height: 32vh; max-height: 32dvh; }
        .mm-yt.is-vertical { height: 32vh; height: 32dvh; }
        .mm-card.es-personaje .mm-img { max-height: 19vh; max-height: 19dvh; }
        .mm-card.es-personaje .mm-titulo, .mm-titulo { font-size: 1.35rem; }
        .mm-anio__num { font-size: 1.8rem; }
        .mm-sala { font-size: 0.78rem; margin-bottom: 10px; }
        .mm-nav button { padding: 9px 10px; font-size: 0.8rem; }
        .mm-portada__num { font-size: clamp(2.8rem, 16vw, 4rem); }
        .mm-portada__desc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
        .mm-portada__btn small { font-size: 0.72rem; }
        .a11y-profiles, .a11y-grid { gap: 8px; }
        .profile-chip, .a11y-card { padding: 10px 6px; }
      }


      /* ---------- Ficha en VERTICAL: toda la tarjeta hace scroll ----------
         Foto, título y descripción se desplazan juntos con el dedo; los botones
         Anterior/Siguiente quedan fijos abajo y la X siempre visible arriba. */
      @media (max-width: 820px) and (orientation: portrait) {
        .mm-overlay { align-items: flex-end; }
        .mm-card, .mm-card.es-personaje {
          display: flex; flex-direction: column; height: 94vh; height: 94dvh; max-height: none;
          overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch; touch-action: pan-y;
          scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--mm-ocre) 60%, transparent) transparent;
        }
        .mm-media { min-height: 0; flex: 0 0 auto; }
        .mm-info { flex: 1 0 auto; display: flex; flex-direction: column; overflow: visible; min-height: 0; }
        .mm-cuerpo, .mm-card.es-personaje .mm-cuerpo {
          flex: 1 0 auto; overflow: visible; min-height: 0;
          -webkit-mask-image: none; mask-image: none;
        }
        .mm-pie {
          position: sticky; bottom: 0; z-index: 3; margin-top: auto;
          background: var(--mm-obsidiana);
          box-shadow: 0 -12px 24px -12px var(--mm-sombra);
        }
        .mm-progreso { position: sticky; top: 0; z-index: 3; margin: 0; }
        .mm-cerrar { position: fixed; top: calc(6vh + 10px); top: calc(6dvh + 10px); right: 10px; z-index: 5; }
        .mm-seguir { position: sticky; display: flex; width: max-content; left: auto; bottom: 76px; margin: -44px auto 8px; transform: translateY(6px); }
        .mm-seguir.is-visible { transform: none; }
      }

      /* ---------- HORIZONTAL (celular acostado) ---------- */
      @media (max-height: 520px) and (orientation: landscape) {
        /* Barra superior: sala a la izquierda; recorrido, sonido y Volver a la derecha */
        .mm-hud {
          top: calc(env(safe-area-inset-top) + 8px); left: calc(env(safe-area-inset-left) + 10px);
          max-width: calc(100vw - 260px - env(safe-area-inset-left) - env(safe-area-inset-right));
          padding: 6px 14px 6px 10px; gap: 0 10px;
        }
        .mm-hud__num { padding-right: 10px; }
        .mm-hud__num small { font-size: 0.54rem; letter-spacing: 0.16em; }
        .mm-hud__num b { font-size: 1.35rem; margin-top: 2px; }
        .mm-hud__nombre {
          display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
          font-size: 0.9rem; line-height: 1.2;
        }
        .mm-hud__desc, .mm-hud__stats { display: none; }
        .mm-volver {
          top: calc(env(safe-area-inset-top) + 8px); right: calc(env(safe-area-inset-right) + 10px);
          height: 40px; padding: 4px 14px 4px 4px; gap: 8px; font-size: 0.82rem; box-sizing: border-box;
        }
        .mm-volver svg { width: 30px; height: 30px; padding: 8px; box-sizing: border-box; }
        .mm-acciones {
          top: calc(env(safe-area-inset-top) + 8px); right: calc(env(safe-area-inset-right) + 128px);
          flex-direction: row; align-items: center; gap: 8px;
        }
        .mm-accion { height: 40px; }
        .mm-guiar span { display: none; }
        .mm-guiar, .mm-sonido { width: 40px; padding: 0; justify-content: center; }

        html.mm-tactil .mm-ayuda { top: calc(env(safe-area-inset-top) + 80px); max-width: calc(100vw - 32px); }

        .a11y-launcher { left: calc(env(safe-area-inset-left) + 12px); bottom: calc(env(safe-area-inset-bottom) + 12px); width: 48px; height: 48px; }
        .a11y-launcher svg { width: 26px; height: 26px; }
        .a11y-panel {
          left: calc(env(safe-area-inset-left) + 72px); right: auto;
          top: calc(env(safe-area-inset-top) + 8px); bottom: calc(env(safe-area-inset-bottom) + 8px);
          width: min(440px, calc(100vw - 84px - env(safe-area-inset-left) - env(safe-area-inset-right)));
          max-height: none; transform-origin: left center;
        }
        .a11y-header { padding: 10px 16px; }
        .a11y-body { padding: 12px 16px 16px; }
        .a11y-status { margin-bottom: 12px; }
        .profile-chip, .a11y-card { padding: 10px 6px; }

        /* Portada en dos columnas: título a la izquierda, botones a la derecha */
        .mm-portada { padding: calc(env(safe-area-inset-top) + 14px) calc(env(safe-area-inset-right) + 24px) calc(env(safe-area-inset-bottom) + 14px) calc(env(safe-area-inset-left) + 24px); }
        .mm-portada__caja {
          max-width: 900px; display: grid; text-align: left; align-items: center;
          grid-template-columns: minmax(0, 1.15fr) minmax(220px, 0.85fr); column-gap: 32px;
        }
        .mm-portada__caja > * { grid-column: 1; }
        .mm-portada__eyebrow { display: block; justify-self: start; margin: 0 0 8px; font-size: 0.66rem; line-height: 1.5; letter-spacing: 0.2em; }
        .mm-portada__eyebrow::before, .mm-portada__eyebrow::after { display: none; }
        .mm-portada__num { font-size: clamp(2.4rem, 15vh, 4.2rem); margin: 0 0 2px; }
        .mm-portada__nombre { font-size: clamp(1.15rem, 6.2vh, 1.75rem); }
        .mm-portada__desc {
          margin: 8px 0 0; font-size: 0.85rem; line-height: 1.5; max-width: none;
          display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
        }
        .mm-portada__acciones {
          grid-column: 2; grid-row: 1 / span 4; align-self: center;
          flex-direction: column; flex-wrap: nowrap; gap: 10px; margin: 0;
        }
        .mm-portada__btn { width: 100%; min-width: 0; padding: 10px 14px 10px 10px; gap: 12px; }
        .mm-portada__btn svg { width: 34px; height: 34px; padding: 9px; }
        .mm-portada__btn b { font-size: 0.95rem; }
        .mm-portada__btn small { font-size: 0.72rem; }
        .mm-portada__pista { grid-column: 2; grid-row: 5; margin: 10px 0 0; text-align: center; font-size: 0.72rem; }

        /* Ficha: foto a la izquierda y texto a la derecha, a pantalla completa */
        .mm-overlay {
          padding: calc(env(safe-area-inset-top) + 8px) calc(env(safe-area-inset-right) + 10px) calc(env(safe-area-inset-bottom) + 8px) calc(env(safe-area-inset-left) + 10px);
          align-items: stretch;
        }
        .mm-card, .mm-card.es-personaje {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); grid-template-rows: minmax(0, 1fr);
          width: 100%; height: 100%; max-height: none; border-radius: 16px;
          transform: translateY(20px) scale(0.98);
        }
        .mm-media { min-height: 0; padding: 18px 10px; }
        .mm-media::before, .mm-media::after { height: 14px; background-size: 18px 6px; }
        .mm-img, .mm-video, .mm-yt { max-height: calc(100vh - 56px); max-height: calc(100dvh - 56px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
        .mm-yt { width: 100%; }
        .mm-yt.is-vertical { height: calc(100vh - 56px); height: calc(100dvh - 56px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
        .mm-contador { left: 10px; bottom: 20px; font-size: 0.72rem; padding: 3px 9px; }
        .mm-zoom-btn { right: 10px; bottom: 20px; padding: 5px 10px; font-size: 0.74rem; }
        .mm-cerrar { top: 8px; right: 8px; width: 38px; height: 38px; }
        .mm-cabecera, .mm-card .mm-cabecera { padding: 14px 56px 0 18px; }
        .mm-etiquetas { margin-bottom: 6px; }
        .mm-sala { display: none; }
        .mm-titulo, .mm-card.es-personaje .mm-titulo { font-size: clamp(1.15rem, 6vh, 1.6rem); }
        .mm-anio { margin: 8px 0 6px; }
        .mm-anio__num { font-size: 1.6rem; }
        .mm-cuerpo, .mm-card.es-personaje .mm-cuerpo { padding: 10px 18px 14px; }
        .mm-desc { font-size: 0.92rem; line-height: 1.6; }
        .mm-progreso { margin: 0 18px; }
        .mm-pie { padding: 8px 14px 10px; }
        .mm-institucion { display: none; }
        .mm-nav { width: 100%; }
        .mm-nav button { flex: 1; justify-content: center; padding: 8px 12px; font-size: 0.8rem; }
        .mm-seguir { bottom: 56px; }
        .mm-card.es-personaje .mm-media { padding: 12px; }
        .mm-card.es-personaje .mm-img { max-height: calc(100vh - 60px); max-height: calc(100dvh - 60px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); padding: 5px; }
        .mm-card.es-personaje .mm-rol { margin-top: 4px; font-size: 0.85rem; }
        .mm-card.es-personaje .mm-anio { margin: 8px 0 8px; padding: 4px 10px; }
        .mm-card.es-personaje .mm-anio__num { font-size: 1.1rem; }
        .mm-card.es-personaje .mm-desc { font-size: 0.95rem; line-height: 1.7; }
        .mm-cita { padding: 12px 14px 12px 42px; font-size: 0.95rem; margin-bottom: 16px; }
        .mm-cita::before { left: 12px; font-size: 2.6rem; }

        /* Recorrido guiado en una sola fila, abajo */
        .mm-guia {
          flex-direction: row; align-items: center; gap: 12px;
          width: calc(100vw - 150px - env(safe-area-inset-left) - env(safe-area-inset-right));
          bottom: calc(env(safe-area-inset-bottom) + 10px); padding: 8px 8px 8px 16px; border-radius: 16px;
        }
        .mm-guia__titulo { font-size: 0.92rem; }
        .mm-guia__secciones { margin-top: 4px; }
        .mm-guia__botones { justify-content: flex-end; }
        .mm-guia button { height: 40px; min-width: 40px; padding: 0 12px; font-size: 0.82rem; }
        .mm-guia button.is-principal { flex: 0 0 auto; padding: 0 16px; }
        html.mm-guiado .mm-objetivo { bottom: 80px; }
      }
      /* Horizontal muy bajito (celulares chicos acostados) */
      @media (max-height: 360px) and (orientation: landscape) {
        .mm-portada__num { font-size: 2.3rem; }
        .mm-portada__desc { -webkit-line-clamp: 2; }
        .mm-portada__btn { padding: 8px 12px 8px 8px; }
        .mm-portada__btn svg { width: 30px; height: 30px; padding: 8px; }
        .mm-anio__num { font-size: 1.35rem; }
      }
      /* Tabletas horizontales táctiles: más aire para los pulgares */
      @media (min-width: 821px) and (min-height: 521px) {
        html.mm-tactil .mm-ayuda { top: auto; bottom: calc(env(safe-area-inset-bottom) + 30px); max-width: calc(100vw - 480px); }
        html.mm-tactil .mt-joy { bottom: calc(100px + env(safe-area-inset-bottom)); left: calc(24px + env(safe-area-inset-left)); }
        html.mm-tactil .mt-ver { bottom: calc(120px + env(safe-area-inset-bottom)); right: calc(24px + env(safe-area-inset-right)); }
      }

    `;
    document.head.appendChild(css);
  }

  /* ======================================================================
     HUD: nombre de la sala + ayuda de controles
     ====================================================================== */
  function crearHud(sala) {
    var titulo = document.getElementById('titulo-sala');
    var desc = document.getElementById('desc-sala');
    var nombre = limpiarTexto(sala.nombre);
    var descripcion = limpiarTexto(sala.descripcion) || 'Estructura perimetral conectada al domo piramidal central.';

    // Si tu página ya tiene estos elementos, se usan; si no, se crea el HUD
    if (titulo || desc) {
      if (titulo) titulo.innerText = 'Sala ' + numeroSala(sala.id) + ': ' + nombre;
      if (desc) desc.innerText = descripcion;
    } else {
      var hud = document.createElement('div');
      hud.className = 'mm-hud';
      hud.innerHTML = '<div class="mm-hud__num"><small>Sala</small><b></b></div>' +
        '<p class="mm-hud__sala"></p><h1 class="mm-hud__nombre"></h1><p class="mm-hud__desc"></p><ul class="mm-hud__stats"></ul>';
      hud.querySelector('.mm-hud__num b').textContent = numeroSala(sala.id);
      hud.querySelector('.mm-hud__sala').textContent = 'Sala ' + numeroSala(sala.id);
      hud.querySelector('.mm-hud__nombre').textContent = nombre;
      hud.querySelector('.mm-hud__desc').textContent = sala.elementos.length
        ? descripcion
        : 'Esta sala todavía no tiene obras publicadas.';
      var conteo = { imagen: 0, video: 0, personaje: 0 };
      (Museo.todos || []).forEach(function (it) { conteo[tipoDeObra(it)]++; });
      var etiquetas = [['imagen', 'fotografía', 'fotografías'], ['video', 'video', 'videos'], ['personaje', 'personaje', 'personajes']];
      var lista = hud.querySelector('.mm-hud__stats');
      etiquetas.forEach(function (e) {
        var n = conteo[e[0]];
        if (!n) return;
        var li = document.createElement('li');
        li.innerHTML = '<b></b> ';
        li.querySelector('b').textContent = n;
        li.appendChild(document.createTextNode(n === 1 ? e[1] : e[2]));
        lista.appendChild(li);
      });
      if (!lista.children.length) lista.remove();
      document.body.appendChild(hud);
    }

    crearBotonVolver();

    var barraSup = document.createElement('div');
    barraSup.className = 'mm-acciones';
    barraSup.innerHTML =
      ((Museo.todos || []).length ? '<button type="button" class="mm-accion mm-guiar" aria-label="Iniciar recorrido guiado">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>' +
        '<span>Recorrido guiado</span></button>' : '') +
      '<button type="button" class="mm-accion mm-sonido" aria-pressed="true" aria-label="Silenciar sonido ambiental">' +
        '<svg class="mm-sonido__on" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10v4h3l4 4V6l-4 4H4Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
        '<svg class="mm-sonido__off" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10v4h3l4 4V6l-4 4H4Z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
      '</button>';
    document.body.appendChild(barraSup);
    barraSup.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    barraSup.querySelector('.mm-sonido').addEventListener('click', function () { Sonido.alternar(); });
    var guiar = barraSup.querySelector('.mm-guiar');
    if (guiar) guiar.addEventListener('click', function () { Sonido.iniciar(); Recorrido.iniciar(0); });
    Sonido.actualizarBoton();
    window.addEventListener('keydown', function (e) {
      if (e.code === 'KeyM' && !Museo.abierto) Sonido.alternar();
    });
    // Cualquier primer gesto activa el audio
    window.addEventListener('pointerdown', function () { Sonido.iniciar(); }, { once: true });

    var vineta = document.createElement('div');
    vineta.className = 'mm-vineta';
    vineta.setAttribute('aria-hidden', 'true');
    document.body.appendChild(vineta);

    if (!ESTA_TACTIL) {
      var objetivo = document.createElement('div');
      objetivo.className = 'mm-objetivo';
      objetivo.setAttribute('role', 'status');
      objetivo.innerHTML = '<span class="mm-objetivo__tipo"></span><span class="mm-objetivo__titulo"></span>' +
        '<span class="mm-objetivo__accion"><kbd>E</kbd>o clic</span>';
      document.body.appendChild(objetivo);
      document.addEventListener('pointerlockchange', function () {
        document.documentElement.classList.toggle('mm-caminando', !!document.pointerLockElement);
      });
    }

    var ayuda = document.createElement('div');
    ayuda.className = 'mm-ayuda';
    if (ESTA_TACTIL) {
      ayuda.innerHTML = '<span><strong>Joystick</strong> caminar (al tope corre)</span><span><strong>Arrastra</strong> para mirar</span><span><strong>Ver obra</strong> o toca una obra cercana</span>';
    } else {
      ayuda.innerHTML =
        '<span class="mm-ayuda__bloqueo"><strong>Clic</strong> mirar</span>' +
        '<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> caminar</span>' +
        '<span><kbd>Shift</kbd> correr</span>' +
        '<span><kbd>E</kbd> ver obra cercana</span>' +
        '<span><kbd>Esc</kbd> soltar mouse</span>';
    }
    document.body.appendChild(ayuda);

    // En escritorio: visible mientras el mouse no esté capturado
    if (!ESTA_TACTIL) {
      var actualizar = function () {
        ayuda.classList.toggle('is-oculta', !!document.pointerLockElement);
      };
      document.addEventListener('pointerlockchange', actualizar);
      actualizar();
    } else {
      // Si la portada está abierta, la ayuda se muestra al cerrarla (ver mostrarPortada)
      setTimeout(function () { if (!Museo.enPortada) ayuda.classList.add('is-oculta'); }, 7000);
    }
  }

  function crearBotonVolver() {
    var destino = (window.museoData && museoData.urlRegreso) || CONFIG.urlRegreso;
    var boton = document.createElement('a');
    boton.className = 'mm-volver';
    boton.href = destino;
    boton.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">' +
      '<path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span>Volver</span>';
    boton.setAttribute('aria-label', 'Salir de la sala y volver');

    // Regresa a la página de donde viniste CARGÁNDOLA DE NUEVO (no con
    // history.back(), que la restaura de memoria sin leer los ajustes
    // nuevos). Así el modo y la accesibilidad elegidos en el museo se ven
    // al instante, sin que el visitante tenga que recargar.
    var ref = document.referrer;
    var mismaWeb = ref && ref.indexOf(location.origin) === 0 &&
                   ref.split('#')[0] !== location.href.split('#')[0];
    if (mismaWeb) boton.href = ref;
    boton.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.assign(boton.href);
    });
    document.body.appendChild(boton);
  }

  // Tarjeta junto a la mira cuando una obra está al alcance
  function mostrarObjetivo(el) {
    var caja = document.querySelector('.mm-objetivo');
    if (!caja) return;
    if (!el || !el.__obra || Museo.abierto) { caja.classList.remove('is-visible'); return; }
    var item = el.__obra.item, tipo = tipoDeObra(item);
    caja.querySelector('.mm-objetivo__tipo').textContent = tipo === 'personaje' ? 'Personaje' : tipo === 'video' ? 'Video' : 'Fotografía';
    caja.querySelector('.mm-objetivo__titulo').textContent = limpiarTexto(item.titulo) || 'Sin título';
    caja.classList.add('is-visible');
  }

  // Portada cinematográfica al entrar a la sala
  function mostrarPortada(sala, escena) {
    var p = document.createElement('div');
    p.className = 'mm-portada';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-modal', 'true');
    p.setAttribute('aria-label', 'Bienvenida a la sala');
    var hayObras = (Museo.todos || []).length > 0;
    p.innerHTML = '<div class="mm-portada__caja">' +
      '<p class="mm-portada__eyebrow"></p><span class="mm-portada__num"></span>' +
      '<h2 class="mm-portada__nombre"></h2><p class="mm-portada__desc"></p>' +
      '<div class="mm-portada__acciones">' +
        (hayObras ? '<button type="button" class="mm-portada__btn is-principal" data-accion="guiado">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>' +
          '<span><b>Recorrido guiado</b><small>Te llevamos obra por obra</small></span></button>' : '') +
        '<button type="button" class="mm-portada__btn" data-accion="libre">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor"/></svg>' +
          '<span><b>Explorar libremente</b><small>' + (ESTA_TACTIL ? 'Arrastra para mirar' : 'Camina con W A S D') + '</small></span></button>' +
      '</div>' +
      '<p class="mm-portada__pista">Se recomienda usar audífonos</p></div>';
    p.querySelector('.mm-portada__eyebrow').textContent = limpiarTexto((window.museoData || {}).institucion) || 'Museo virtual';
    p.querySelector('.mm-portada__num').textContent = numeroSala(sala.id);
    p.querySelector('.mm-portada__nombre').textContent = limpiarTexto(sala.nombre);
    p.querySelector('.mm-portada__desc').textContent = limpiarTexto(sala.descripcion);
    document.body.appendChild(p);
    Museo.enPortada = true;
    document.documentElement.classList.add('mm-en-portada');
    pausarJugador(true);

    var elegir = function (accion) {
      Sonido.iniciar();                       // el clic es el gesto que permite el audio
      Sonido.ui();
      p.classList.remove('is-visible');
      Museo.enPortada = false;
      document.documentElement.classList.remove('mm-en-portada');
      pausarJugador(false);
      // En celular la ayuda de controles aparece justo al empezar a explorar
      var ayudaTactil = document.querySelector('.mm-ayuda');
      if (ESTA_TACTIL && ayudaTactil && accion !== 'guiado') {
        ayudaTactil.classList.remove('is-oculta');
        setTimeout(function () { ayudaTactil.classList.add('is-oculta'); }, 8000);
      }
      setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 950);
      document.removeEventListener('keydown', teclas, true);
      if (accion === 'guiado') setTimeout(function () { Recorrido.iniciar(0); }, 450);
    };
    var teclas = function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); elegir('libre'); }
    };
    p.addEventListener('click', function (e) {
      var b = e.target.closest('[data-accion]');
      if (b) elegir(b.getAttribute('data-accion'));
    });
    p.addEventListener('mousedown', function (e) { e.stopPropagation(); });

    var mostrar = function () {
      requestAnimationFrame(function () {
        p.classList.add('is-visible');
        var primero = p.querySelector('.mm-portada__btn');
        if (primero) primero.focus({ preventScroll: true });
      });
      document.addEventListener('keydown', teclas, true);
    };
    var col = escena && escena.systems && escena.systems.colisiones;
    if (col && col.listo) mostrar();
    else if (escena) escena.addEventListener('colisiones-listas', function () { setTimeout(mostrar, 300); }, { once: true });
    else mostrar();
  }

  /* ======================================================================
     SONIDO AMBIENTAL (sintetizado, sin archivos): murmullo de sala,
     pasos al caminar, un tono suave al acercarte a una obra y sonidos de
     interfaz. Se activa con el primer clic (regla de los navegadores).
     Tecla M o botón de bocina para silenciar; la preferencia se guarda.
     ====================================================================== */
  var Sonido = (function () {
    var ctx = null, maestro = null, ambiente = null, ruido = null;
    var activo = true;
    try { activo = localStorage.getItem('focine-museo-sonido') !== 'off'; } catch (e) {}

    function crearRuido() {
      var n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0), ult = 0;
      for (var i = 0; i < n; i++) {           // ruido café: grave y suave
        var b = Math.random() * 2 - 1;
        ult = (ult + 0.02 * b) / 1.02;
        d[i] = ult * 3.5;
      }
      return buf;
    }
    function iniciar() {
      if (ctx || !(window.AudioContext || window.webkitAudioContext)) { if (ctx && ctx.state === 'suspended') ctx.resume(); return; }
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      maestro = ctx.createGain(); maestro.gain.value = activo ? 1 : 0; maestro.connect(ctx.destination);
      ruido = crearRuido();
      // Murmullo de sala grande
      var fuente = ctx.createBufferSource(); fuente.buffer = ruido; fuente.loop = true;
      var filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 380;
      ambiente = ctx.createGain(); ambiente.gain.value = 0;
      fuente.connect(filtro); filtro.connect(ambiente); ambiente.connect(maestro);
      fuente.start();
      ambiente.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 3);
      actualizarBoton();
    }
    function listo() { return ctx && activo && ctx.state === 'running'; }
    // Paso sobre piso de loseta: golpe grave del talón + roce del zapato.
    // (Antes usaba solo un filtro sobre ruido grave y quedaba casi inaudible.)
    var ruidoBlanco = null, pie = 0;
    function paso(intensidad) {
      if (!listo()) return;
      var vol = Math.max(0, CONFIG.volumenPasos) * (intensidad || 1);
      if (!vol) return;
      if (!ruidoBlanco) {
        var n = Math.floor(ctx.sampleRate * 0.3);
        ruidoBlanco = ctx.createBuffer(1, n, ctx.sampleRate);
        var d = ruidoBlanco.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      var t = ctx.currentTime + 0.005;
      pie = 1 - pie;                                   // izquierdo / derecho suenan un poco distinto
      var tono = (pie ? 1 : 0.9) * (0.94 + Math.random() * 0.12);

      // Talón: golpe grave corto
      var o = ctx.createOscillator(), go = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(110 * tono, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
      go.gain.setValueAtTime(0.0001, t);
      go.gain.exponentialRampToValueAtTime(0.55 * vol, t + 0.006);
      go.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(go); go.connect(maestro);
      o.start(t); o.stop(t + 0.14);

      // Suela: chasquido de ruido filtrado
      var src = ctx.createBufferSource(); src.buffer = ruidoBlanco;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500 * tono;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35 * vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(maestro);
      src.start(t, Math.random() * 0.15, 0.12);
    }
    function tono(frecs, vol, dur) {
      if (!listo()) return;
      var t = ctx.currentTime;
      frecs.forEach(function (f, i) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t + i * 0.06);
        g.gain.linearRampToValueAtTime(vol, t + i * 0.06 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + dur);
        o.connect(g); g.connect(maestro);
        o.start(t + i * 0.06); o.stop(t + i * 0.06 + dur + 0.05);
      });
    }
    function barrido() {                      // "whoosh" al abrir una ficha o cambiar de obra
      if (!listo()) return;
      var t = ctx.currentTime;
      var src = ctx.createBufferSource(); src.buffer = ruido;
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      src.connect(f); f.connect(g); g.connect(maestro);
      src.start(t, 0, 0.5);
    }
    function alternar() {
      iniciar();
      activo = !activo;
      try { localStorage.setItem('focine-museo-sonido', activo ? 'on' : 'off'); } catch (e) {}
      if (maestro) maestro.gain.setTargetAtTime(activo ? 1 : 0, ctx.currentTime, 0.1);
      actualizarBoton();
      if (activo) tono([660, 880], 0.05, 0.6);
    }
    function actualizarBoton() {
      var b = document.querySelector('.mm-sonido');
      if (!b) return;
      b.setAttribute('aria-pressed', activo ? 'true' : 'false');
      b.setAttribute('aria-label', activo ? 'Silenciar sonido ambiental' : 'Activar sonido ambiental');
      b.classList.toggle('is-mudo', !activo);
    }
    // Pausa el ambiente mientras se ve un video en la ficha
    function atenuar(si) {
      if (ambiente && ctx) ambiente.gain.setTargetAtTime(si ? 0.005 : 0.05, ctx.currentTime, 0.3);
    }
    return {
      iniciar: iniciar, paso: paso, barrido: barrido, alternar: alternar, atenuar: atenuar,
      actualizarBoton: actualizarBoton,
      acercarse: function () { tono([523.25, 783.99, 1046.5], 0.035, 1.4); },
      ui: function () { tono([880], 0.03, 0.25); }
    };
  })();

  /* ======================================================================
     RECORRIDO GUIADO: lleva al visitante de obra en obra con un corte
     cinematográfico, lo deja mirando la obra y muestra una barra con
     "Ver ficha", Anterior, Siguiente y Salir.
     ====================================================================== */
  var Recorrido = (function () {
    var activo = false, indice = 0, barra = null, corte = null, auto = null, v = null;
    var lista = [], seccionActual = 0;

    // Orden del recorrido: por sección; dentro de cada una, personaje → video → cuadros
    var prioridad = { personaje: 0, video: 1, cuadro: 2 };
    function ordenar() {
      lista = Museo.obras.filter(function (el) { return el.__obra; }).slice().sort(function (a, b) {
        var x = a.__obra, y = b.__obra;
        return x.seccion - y.seccion ||
               prioridad[x.tipoPunto] - prioridad[y.tipoPunto] ||
               x.ordenPunto - y.ordenPunto;
      });
      if (console.table) {
        console.table(lista.map(function (el, i) {
          return { 'Paso': i + 1, 'Sección': el.__obra.seccion, 'Empty': el.__obra.punto, 'Obra': limpiarTexto(el.__obra.item.titulo) };
        }));
      }
    }
    function totalSecciones() {
      return lista.reduce(function (m, el) { return Math.max(m, el.__obra.seccion); }, 1);
    }

    function crearUI() {
      if (barra) return;
      corte = document.createElement('div');
      corte.className = 'mm-corte';
      corte.innerHTML = '<div class="mm-corte__caja"><span class="mm-corte__eyebrow"></span>' +
        '<span class="mm-corte__num"></span><span class="mm-corte__detalle"></span></div>';
      document.body.appendChild(corte);

      barra = document.createElement('div');
      barra.className = 'mm-guia';
      barra.setAttribute('role', 'region');
      barra.setAttribute('aria-label', 'Recorrido guiado');
      barra.innerHTML =
        '<div class="mm-guia__info"><span class="mm-guia__paso"></span><span class="mm-guia__titulo"></span>' +
        '<span class="mm-guia__secciones"></span></div>' +
        '<div class="mm-guia__botones">' +
          '<button type="button" data-g="prev" aria-label="Obra anterior">←</button>' +
          '<button type="button" data-g="ficha" class="is-principal">Ver ficha</button>' +
          '<button type="button" data-g="next" aria-label="Obra siguiente">→</button>' +
          '<button type="button" data-g="salir" class="mm-guia__salir" aria-label="Salir del recorrido guiado">Salir</button>' +
        '</div>';
      document.body.appendChild(barra);
      barra.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      barra.addEventListener('click', function (e) {
        var b = e.target.closest('[data-g]');
        if (!b) return;
        var a = b.getAttribute('data-g');
        if (a === 'prev') ir(indice - 1);
        else if (a === 'next') ir(indice + 1);
        else if (a === 'ficha') abrirActual();
        else if (a === 'salir') salir();
      });
      barra.addEventListener('click', function (e) {
        var s = e.target.closest('[data-sec]');
        if (s) irASeccion(parseInt(s.getAttribute('data-sec'), 10));
      });
    }

    function abrirActual() {
      if (Museo.abierto) return;
      var el = lista[indice];
      if (el && el.__obra) abrirModal(el.__obra.item);
    }

    function colocar(el) {
      var escena = Museo.escena || document.querySelector('a-scene');
      var jugador = document.getElementById('player');
      var cam = escena && escena.camera && escena.camera.el;
      if (!jugador || !el) return;
      var o = el.object3D;
      var n = new THREE.Vector3(0, 0, 1).applyQuaternion(o.quaternion);
      n.y = 0; if (n.lengthSq() < 1e-6) n.set(0, 0, 1); n.normalize();

      var caja = el.__obra && el.__obra.caja;
      var alto = caja ? caja.h : CONFIG.altoMax + 0.8;
      var distancia = Math.max(3.4, alto * 1.35 + 1.2);
      distancia = Math.min(distancia, CONFIG.distanciaInteraccion - 0.4);

      jugador.object3D.position.x = o.position.x + n.x * distancia;
      jugador.object3D.position.z = o.position.z + n.z * distancia;

      var lc = cam && cam.components['look-controls'];
      if (lc && lc.yawObject && lc.pitchObject) {
        v = v || new THREE.Vector3();
        jugador.object3D.getWorldPosition(v);
        var ojos = v.y;
        lc.yawObject.rotation.y = Math.atan2(n.x, n.z);
        lc.pitchObject.rotation.x = Math.max(-0.6, Math.min(0.6, Math.atan2(o.position.y - ojos, distancia)));
      }
    }

    function ir(i) {
      var total = lista.length;
      if (!total) return;
      indice = (i + total) % total;
      clearTimeout(auto);
      Sonido.barrido();
      var el = lista[indice];
      var nuevaSeccion = el.__obra.seccion !== seccionActual;
      seccionActual = el.__obra.seccion;

      // Al entrar a una sección nueva: intertítulo "Sección 2 de 5"
      corte.classList.toggle('con-titulo', nuevaSeccion);
      if (nuevaSeccion) {
        var enSeccion = lista.filter(function (x) { return x.__obra.seccion === seccionActual; });
        var c = { personaje: 0, video: 0, cuadro: 0 };
        enSeccion.forEach(function (x) { c[x.__obra.tipoPunto]++; });
        var partes = [];
        if (c.personaje) partes.push(c.personaje + (c.personaje === 1 ? ' personaje' : ' personajes'));
        if (c.video) partes.push(c.video + (c.video === 1 ? ' video' : ' videos'));
        if (c.cuadro) partes.push(c.cuadro + (c.cuadro === 1 ? ' fotografía' : ' fotografías'));
        corte.querySelector('.mm-corte__eyebrow').textContent = 'Sección';
        corte.querySelector('.mm-corte__num').textContent = String(seccionActual).padStart(2, '0');
        corte.querySelector('.mm-corte__detalle').textContent =
          'de ' + String(totalSecciones()).padStart(2, '0') + (partes.length ? '  ·  ' + partes.join(' · ') : '');
        Sonido.acercarse();
      }
      corte.classList.add('is-activo');
      setTimeout(function () {
        colocar(el);
        actualizar();
        corte.classList.remove('is-activo');
      }, nuevaSeccion ? 1500 : 420);
    }

    function actualizar() {
      var el = lista[indice];
      if (!el || !el.__obra) return;
      var item = el.__obra.item, tipo = tipoDeObra(item), sec = el.__obra.seccion;
      var enSeccion = lista.filter(function (x) { return x.__obra.seccion === sec; });
      var pos = enSeccion.indexOf(el);
      barra.querySelector('.mm-guia__paso').textContent =
        'Sección ' + sec + ' · ' + (tipo === 'personaje' ? 'Personaje' : tipo === 'video' ? 'Video' : 'Fotografía') +
        ' · ' + (pos + 1) + ' de ' + enSeccion.length;
      barra.querySelector('.mm-guia__titulo').textContent = limpiarTexto(item.titulo) || 'Sin título';

      // Segmentos: uno por sección; el actual muestra el avance dentro de ella
      var cont = barra.querySelector('.mm-guia__secciones'), n = totalSecciones();
      if (cont.children.length !== n) {
        cont.innerHTML = '';
        for (var s = 1; s <= n; s++) {
          var b = document.createElement('button');
          b.type = 'button'; b.setAttribute('data-sec', s);
          b.setAttribute('aria-label', 'Ir a la sección ' + s);
          b.innerHTML = '<i></i>';
          cont.appendChild(b);
        }
      }
      Array.prototype.forEach.call(cont.children, function (b, k) {
        var s = k + 1, relleno = s < sec ? 1 : s > sec ? 0 : (pos + 1) / enSeccion.length;
        b.classList.toggle('is-actual', s === sec);
        b.querySelector('i').style.transform = 'scaleX(' + relleno + ')';
      });
    }

    function irASeccion(s) {
      for (var i = 0; i < lista.length; i++) if (lista[i].__obra.seccion === s) { ir(i); return; }
    }

    function iniciar(i) {
      ordenar();
      if (!lista.length) return;
      seccionActual = 0;
      crearUI();
      activo = true;
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
      document.documentElement.classList.add('mm-guiado');
      barra.classList.add('is-visible');
      ir(i || 0);
    }

    function salir() {
      activo = false;
      clearTimeout(auto);
      document.documentElement.classList.remove('mm-guiado');
      if (barra) barra.classList.remove('is-visible');
      Sonido.ui();
    }

    // Teclas del recorrido (sin chocar con WASD ni con la ficha)
    window.addEventListener('keydown', function (e) {
      if (!activo || Museo.abierto || Museo.enPortada) return;
      if (e.code === 'KeyN' || e.code === 'PageDown') { ir(indice + 1); }
      else if (e.code === 'KeyB' || e.code === 'PageUp') { ir(indice - 1); }
      else if ((e.code === 'Enter' || e.code === 'Space') && !Museo.hover) { e.preventDefault(); abrirActual(); }
    });

    return { iniciar: iniciar, salir: salir, activo: function () { return activo; } };
  })();

  var temporizadorAviso = null;
  function mostrarAviso(texto) {
    var aviso = document.querySelector('.mm-aviso');
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.className = 'mm-aviso';
      aviso.setAttribute('role', 'status');
      document.body.appendChild(aviso);
    }
    aviso.textContent = texto;
    aviso.classList.add('is-visible');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () { aviso.classList.remove('is-visible'); }, 1800);
  }

  /* ======================================================================
     RECURSOS 3D COMPARTIDOS (se crean una sola vez)
     ====================================================================== */
  var RECURSOS = null;

  function texturaCanvas(canvas) {
    var tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function crearRecursos() {
    if (RECURSOS) return RECURSOS;

    // Veta de madera procedural
    var cm = document.createElement('canvas');
    cm.width = 256; cm.height = 256;
    var c = cm.getContext('2d');
    var grad = c.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#3b2215'); grad.addColorStop(0.5, '#4a2c1b'); grad.addColorStop(1, '#321c11');
    c.fillStyle = grad; c.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 70; i++) {
      c.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '20,10,5' : '110,70,40') + ',' + (0.08 + Math.random() * 0.18) + ')';
      c.lineWidth = 0.5 + Math.random() * 2;
      c.beginPath();
      var y = Math.random() * 256;
      c.moveTo(0, y);
      for (var x = 0; x <= 256; x += 32) c.lineTo(x, y + Math.sin(x * 0.03 + i) * 3 + (Math.random() - 0.5) * 2);
      c.stroke();
    }
    var texMadera = texturaCanvas(cm);
    texMadera.wrapS = texMadera.wrapT = THREE.RepeatWrapping;

    // Halo cálido (simula el foco de la lámpara sobre la pared)
    var ch = document.createElement('canvas');
    ch.width = ch.height = 256;
    c = ch.getContext('2d');
    var rad = c.createRadialGradient(128, 96, 8, 128, 128, 128);
    rad.addColorStop(0, 'rgba(255, 222, 170, 1)');
    rad.addColorStop(0.45, 'rgba(255, 200, 140, 0.45)');
    rad.addColorStop(1, 'rgba(255, 190, 120, 0)');
    c.fillStyle = rad; c.fillRect(0, 0, 256, 256);
    var texHalo = texturaCanvas(ch);

    // Sombra suave del marco sobre la pared
    var cs = document.createElement('canvas');
    cs.width = cs.height = 256;
    c = cs.getContext('2d');
    c.shadowColor = 'rgba(0,0,0,1)'; c.shadowBlur = 34;
    c.fillStyle = 'rgba(0,0,0,1)';
    rectRedondo(c, 44, 44, 168, 168, 6); c.fill();
    var texSombra = texturaCanvas(cs);

    var desfase = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };

    RECURSOS = {
      madera: new THREE.MeshStandardMaterial({ map: texMadera, color: 0xffffff, roughness: 0.55, metalness: 0.05 }),
      oro: new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.32, metalness: 0.55, emissive: 0x3a2a08, emissiveIntensity: 0.35 }),
      paspartu: new THREE.MeshStandardMaterial({ color: 0xf1ebdf, roughness: 0.92, metalness: 0 }),
      filo: new THREE.MeshBasicMaterial({ color: 0x0d0907 }),
      laton: new THREE.MeshStandardMaterial({ color: 0xb08d4a, roughness: 0.35, metalness: 0.6, emissive: 0x2a1d06, emissiveIntensity: 0.4 }),
      bombilla: new THREE.MeshBasicMaterial({ color: 0xffe2ad, toneMapped: false }),
      texHalo: texHalo,
      sombra: new THREE.MeshBasicMaterial(Object.assign({
        map: texSombra, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false
      }, desfase)),
      desfase: desfase,
      plano: new THREE.PlaneGeometry(1, 1),
      maxAniso: 4
    };
    return RECURSOS;
  }

  // Une varias cajas en UNA geometría → un solo draw call por material
  function unirCajas(partes) {
    var geos = partes.map(function (p) {
      return new THREE.BoxGeometry(p[0], p[1], p[2]).translate(p[3], p[4], p[5]).toNonIndexed();
    });
    var total = 0;
    geos.forEach(function (g) { total += g.attributes.position.count; });
    var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    var o = 0;
    geos.forEach(function (g) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count;
      g.dispose();
    });
    var r = new THREE.BufferGeometry();
    r.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    r.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    r.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    r.computeBoundingBox();
    r.computeBoundingSphere();
    return r;
  }

  function sinRaycast(mesh) { mesh.raycast = function () {}; return mesh; }

  /* ======================================================================
     PLACA GRABADA (texto en canvas: soporta acentos y ñ)
     ====================================================================== */
  function crearTexturaPlaca(item) {
    var W = 1024, H = 300, k = CONFIG.escalaPlaca;
    var cv = document.createElement('canvas');
    cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    var c = cv.getContext('2d');
    c.scale(k, k);                      // se dibuja igual, a menor resolución

    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PALETA.placaDe); g.addColorStop(1, PALETA.placaA);
    rectRedondo(c, 6, 6, W - 12, H - 12, 22);
    c.fillStyle = g; c.fill();
    c.lineWidth = 4; c.strokeStyle = PALETA.placaBorde; c.stroke();
    rectRedondo(c, 20, 20, W - 40, H - 40, 14);
    c.lineWidth = 2; c.strokeStyle = PALETA.placaBorde2; c.stroke();

    var pad = 56;
    c.fillStyle = PALETA.titulo;
    c.font = '600 58px ' + FUENTES.serif;
    c.textBaseline = 'top';
    var lineas = envolverTexto(c, limpiarTexto(item.titulo) || 'Sin título', W - pad * 2, 2);
    var y = lineas.length === 1 ? 56 : 36;
    lineas.forEach(function (l) { c.fillText(l, pad, y); y += 66; });

    c.font = '500 34px ' + FUENTES.sans;
    c.fillStyle = PALETA.pie;
    var video = esVideo(item);
    var partesPie = [];
    if (limpiarTexto(item.anio)) partesPie.push(String(item.anio));
    if (video) partesPie.push('Video' + (item.__duracion ? ' ' + item.__duracion : ''));
    if (partesPie.length) c.fillText(partesPie.join('  ·  '), pad, y + 8);

    c.fillStyle = PALETA.accion;
    c.textAlign = 'right';
    var accion = ESTA_TACTIL ? 'Acércate y toca para ' : 'Acércate y haz clic para ';
    c.fillText(accion + (video ? 'verlo' : 'verla'), W - pad, y + 8);

    var tex = texturaCanvas(cv);
    tex.anisotropy = RECURSOS.maxAniso;
    return tex;
  }

  // Nota de semblanza que va debajo del retrato de un personaje
  var NOTA = { W: 1024, H: 620 };
  function crearTexturaNota(item) {
    var W = NOTA.W, H = NOTA.H, k = CONFIG.escalaPlaca;
    var cv = document.createElement('canvas');
    cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    var c = cv.getContext('2d');
    c.scale(k, k);

    // Papel
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PALETA.placaDe); g.addColorStop(1, PALETA.placaA);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = PALETA.placaBorde2; c.lineWidth = 3;
    c.strokeRect(24, 24, W - 48, H - 48);

    var pad = 64, y = 60;
    c.textBaseline = 'top';

    // Encabezado
    c.fillStyle = PALETA.accion;
    c.font = '600 30px ' + FUENTES.sans;
    c.fillText('SEMBLANZA', pad, y);
    c.fillRect(pad, y + 44, 70, 4);
    y += 70;

    // Nombre
    c.fillStyle = PALETA.titulo;
    c.font = '600 60px ' + FUENTES.serif;
    envolverTexto(c, limpiarTexto(item.titulo) || 'Sin nombre', W - pad * 2, 2).forEach(function (l) {
      c.fillText(l, pad, y); y += 68;
    });

    // Vida · rol
    var sub = [limpiarTexto(item.anio), limpiarTexto(item.rol)].filter(Boolean).join('  ·  ');
    if (sub) {
      c.fillStyle = PALETA.pie;
      c.font = '500 32px ' + FUENTES.sans;
      envolverTexto(c, sub, W - pad * 2, 1).forEach(function (l) { c.fillText(l, pad, y + 4); });
      y += 50;
    }

    // Extracto
    c.fillStyle = PALETA.titulo;
    c.globalAlpha = 0.85;
    c.font = '400 30px ' + FUENTES.sans;
    var libres = Math.max(1, Math.floor((H - 120 - y) / 42));
    envolverTexto(c, limpiarTexto(item.descripcion), W - pad * 2, Math.min(4, libres)).forEach(function (l) {
      c.fillText(l, pad, y + 14); y += 42;
    });
    c.globalAlpha = 1;

    // Acción
    c.fillStyle = PALETA.accion;
    c.font = '600 30px ' + FUENTES.sans;
    c.textAlign = 'right';
    c.fillText((ESTA_TACTIL ? 'Acércate y toca' : 'Acércate y haz clic') + ' para leer su semblanza  →', W - pad, H - 82);

    var tex = texturaCanvas(cv);
    tex.anisotropy = RECURSOS.maxAniso;
    return tex;
  }

  function texturaNoDisponible() {
    var cv = document.createElement('canvas');
    cv.width = 800; cv.height = 600;
    var c = cv.getContext('2d');
    c.fillStyle = PALETA.vacio; c.fillRect(0, 0, 800, 600);
    c.fillStyle = PALETA.acento;
    c.font = '600 44px ' + FUENTES.serif;
    c.textAlign = 'center';
    c.fillText('Imagen no disponible', 400, 310);
    return texturaCanvas(cv);
  }

  /* ======================================================================
     CONSTRUCCIÓN DE UN CUADRO (≈10 draw calls, geometrías fusionadas)
     ====================================================================== */
  function construirCuadro(el, item, textura, ratio, caja) {
    var R = crearRecursos();

    // k escala molduras, placa y lámpara para que un cuadro chico no quede
    // "todo marco" y uno grande no quede con molduras delgaditas.
    var k = 1, anchoMax = CONFIG.anchoMax, altoMax = CONFIG.altoMax;
    var m = CONFIG.marco, f = CONFIG.filete, p = CONFIG.paspartu;
    if (caja) {
      k = Math.max(0.25, Math.min(1.6, Math.min(caja.w, caja.h) / 2.8));
      m *= k; f *= k; p *= k;
      var borde = m + f + p;
      // El marco completo cabe en la caja del empty; la foto conserva su proporción
      anchoMax = Math.max(0.05, caja.w - borde * 2);
      altoMax = Math.max(0.05, caja.h - borde * 2);
    }
    var ancho = anchoMax, alto = ancho / ratio;
    if (alto > altoMax) { alto = altoMax; ancho = alto * ratio; }

    var aP = ancho + p * 2, hP = alto + p * 2;        // paspartú
    var aO = aP + f * 2, hO = hP + f * 2;             // filete dorado
    var aT = aO + m * 2, hT = hO + m * 2;             // marco completo
    var profM = 0.09, profO = 0.075;

    var cuerpo = new THREE.Group();

    // Madera: tablero trasero + 4 molduras
    var madera = new THREE.Mesh(unirCajas([
      [aT, hT, CAPAS.tablero, 0, 0, CAPAS.tablero / 2],
      [aT, m, profM, 0, hT / 2 - m / 2, profM / 2],
      [aT, m, profM, 0, -hT / 2 + m / 2, profM / 2],
      [m, hT - m * 2, profM, -aT / 2 + m / 2, 0, profM / 2],
      [m, hT - m * 2, profM, aT / 2 - m / 2, 0, profM / 2]
    ]), R.madera);
    cuerpo.add(madera);

    // Filete dorado interior
    cuerpo.add(new THREE.Mesh(unirCajas([
      [aO, f, profO, 0, hO / 2 - f / 2, profO / 2],
      [aO, f, profO, 0, -hO / 2 + f / 2, profO / 2],
      [f, hO - f * 2, profO, -aO / 2 + f / 2, 0, profO / 2],
      [f, hO - f * 2, profO, aO / 2 - f / 2, 0, profO / 2]
    ]), R.oro));

    // Paspartú, filo oscuro y lienzo (hundidos respecto al marco)
    // Capas separadas ~1 cm (antes 1.5 mm): así la tarjeta de video
    // no las confunde de lejos y no aparece el parpadeo negro.
    var pas = new THREE.Mesh(R.plano, R.paspartu);
    pas.scale.set(aP, hP, 1); pas.position.z = CAPAS.paspartu;
    cuerpo.add(pas);

    var filo = new THREE.Mesh(R.plano, R.filo);
    filo.scale.set(ancho + 0.03, alto + 0.03, 1); filo.position.z = CAPAS.filo;
    cuerpo.add(filo);

    var lienzo = new THREE.Mesh(R.plano, new THREE.MeshBasicMaterial({
      map: textura, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    }));
    lienzo.scale.set(ancho, alto, 1); lienzo.position.z = CAPAS.lienzo;
    lienzo.renderOrder = 2;
    cuerpo.add(lienzo);

    var placa;
    if (esPersonaje(item)) {
      // Nota de semblanza enmarcada debajo del retrato
      var anchoN = Math.max(aT, 1.2 * k), altoN = anchoN * NOTA.H / NOTA.W;
      var mN = 0.05 * k, yN = -hT / 2 - 0.18 * k - altoN / 2 - mN;
      var aNT = anchoN + mN * 2, hNT = altoN + mN * 2;
      cuerpo.add(new THREE.Mesh(unirCajas([
        [aNT, hNT, CAPAS.tablero, 0, yN, CAPAS.tablero / 2],
        [aNT, mN, 0.06, 0, yN + hNT / 2 - mN / 2, 0.03],
        [aNT, mN, 0.06, 0, yN - hNT / 2 + mN / 2, 0.03],
        [mN, hNT - mN * 2, 0.06, -aNT / 2 + mN / 2, yN, 0.03],
        [mN, hNT - mN * 2, 0.06, aNT / 2 - mN / 2, yN, 0.03]
      ]), R.madera));
      placa = new THREE.Mesh(R.plano, new THREE.MeshBasicMaterial({
        map: crearTexturaNota(item), toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      }));
      placa.scale.set(anchoN, altoN, 1);
      placa.position.set(0, yN, CAPAS.paspartu);
      cuerpo.add(placa);
      var sombraN = sinRaycast(new THREE.Mesh(R.plano, R.sombra));
      sombraN.scale.set(aNT * 1.4, hNT * 1.5, 1); sombraN.position.set(0.03, yN - 0.05, CAPAS.sombra);
      cuerpo.add(sombraN);
    } else {
      // Placa
      var anchoPlaca = Math.min(1.7 * k, aT * 0.78), altoPlaca = anchoPlaca * 300 / 1024;
      placa = new THREE.Mesh(R.plano, new THREE.MeshBasicMaterial({
        map: crearTexturaPlaca(item), transparent: true, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      }));
      placa.scale.set(anchoPlaca, altoPlaca, 1);
      placa.position.set(0, -hT / 2 - 0.14 * k - altoPlaca / 2, CAPAS.placa);
      cuerpo.add(placa);
    }

    // Sombra y halo en la pared (no reciben clics)
    var sombra = sinRaycast(new THREE.Mesh(R.plano, R.sombra));
    sombra.scale.set(aT * 1.5, hT * 1.5, 1); sombra.position.set(0.04, -0.08, CAPAS.sombra);
    cuerpo.add(sombra);

    var halo = sinRaycast(new THREE.Mesh(R.plano, new THREE.MeshBasicMaterial(Object.assign({
      map: R.texHalo, transparent: true, opacity: 0.28, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false
    }, R.desfase))));
    halo.scale.set(aT * 1.9, hT * 1.75, 1); halo.position.set(0, hT * 0.1, CAPAS.halo);
    cuerpo.add(halo);

    // Lámpara de galería
    if (CONFIG.lampara) {
      var kl = Math.max(0.45, k);   // la lámpara no se hace diminuta
      var barra = aT * 0.55, yL = hT / 2 + 0.2 * kl, zL = 0.38 * kl;
      cuerpo.add(new THREE.Mesh(unirCajas([
        [barra, 0.08 * kl, 0.1 * kl, 0, yL, zL],
        [0.22 * kl, 0.1 * kl, 0.03, 0, hT / 2 + 0.06 * kl, 0.02],
        [0.035 * kl, 0.035 * kl, zL, -barra * 0.3, yL - 0.02 * kl, zL / 2],
        [0.035 * kl, 0.035 * kl, zL, barra * 0.3, yL - 0.02 * kl, zL / 2]
      ]), R.laton));
      var bombilla = new THREE.Mesh(R.plano, R.bombilla);
      bombilla.scale.set(barra * 0.92, 0.04 * kl, 1);
      bombilla.rotation.x = Math.PI / 2;
      bombilla.position.set(0, yL - 0.041 * kl, zL);
      cuerpo.add(bombilla);
    }

    // Todo es estático dentro del cuadro: no recalcular matrices cada frame
    cuerpo.children.forEach(function (h) { h.updateMatrix(); h.matrixAutoUpdate = false; });

    el.setObject3D('mesh', cuerpo);
    el.components['obra-cuadro'].partes = {
      cuerpo: cuerpo, halo: halo,
      texturas: [textura, placa.material.map]
    };
  }

  /* ======================================================================
     COMPONENTE: interacción de cada cuadro (hover, clic)
     ====================================================================== */
  // Libera geometrías, materiales y texturas propias del cuadro (no las compartidas)
  function liberarCuadro(partes) {
    if (!partes || !RECURSOS) return;
    var compartidos = new Set([RECURSOS.plano, RECURSOS.madera, RECURSOS.oro, RECURSOS.paspartu,
      RECURSOS.filo, RECURSOS.laton, RECURSOS.bombilla, RECURSOS.sombra, RECURSOS.texHalo]);
    partes.cuerpo.traverse(function (o) {
      if (!o.isMesh) return;
      if (!compartidos.has(o.geometry)) o.geometry.dispose();
      if (!compartidos.has(o.material)) {
        if (o.material.map && !compartidos.has(o.material.map)) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }

  /* ======================================================================
     SISTEMA: no dibujar cuadros lejanos (menos trabajo por frame)
     ====================================================================== */
  AFRAME.registerSystem('obras-visibles', {
    init: function () { this.t = 0; this.pos = new THREE.Vector3(); },
    tick: function (t, dt) {
      this.t += dt || 0;
      if (this.t < 300 || !Museo.obras.length || !this.el.camera) return;   // ~3 veces por segundo
      this.t = 0;
      this.el.camera.getWorldPosition(this.pos);
      var lim2 = CONFIG.distanciaVisible * CONFIG.distanciaVisible;
      var cerca = CONFIG.distanciaInteraccion, lejos = cerca * 2.6;
      for (var i = 0; i < Museo.obras.length; i++) {
        var el = Museo.obras[i], o = el.object3D;
        var d2 = o.position.distanceToSquared(this.pos);
        o.visible = d2 < lim2;
        var comp = el.components && el.components['obra-cuadro'];
        if (!comp) continue;
        var d = Math.sqrt(d2);
        comp.cercania = Math.max(0, Math.min(1, (lejos - d) / (lejos - cerca)));
        var alAlcance = d <= cerca;
        if (alAlcance && !comp.alAlcance) Sonido.acercarse();
        comp.alAlcance = alAlcance;
      }
    }
  });

  AFRAME.registerComponent('obra-cuadro', {
    init: function () {
      this.partes = null;
      this.objetivo = 0;       // 1 = en la mira
      this.cercania = 0;       // 0..1 según la distancia
      this.valor = 0;
      var self = this;
      this.alEntrar = function () { self.objetivo = 1; Museo.hover = self.el; mostrarObjetivo(self.el); };
      this.alSalir = function () {
        self.objetivo = 0;
        if (Museo.hover === self.el) { Museo.hover = null; mostrarObjetivo(null); }
      };
      this.alClic = function () { intentarAbrir(self.el, 'cursor'); };
      this.el.addEventListener('mouseenter', this.alEntrar);
      this.el.addEventListener('mouseleave', this.alSalir);
      this.el.addEventListener('click', this.alClic);
    },

    remove: function () {
      liberarCuadro(this.partes);
      this.partes = null;
      this.el.removeEventListener('mouseenter', this.alEntrar);
      this.el.removeEventListener('mouseleave', this.alSalir);
      this.el.removeEventListener('click', this.alClic);
      if (Museo.hover === this.el) Museo.hover = null;
    },

    tick: function (t, dt) {
      if (!this.partes) return;
      var meta = Math.max(this.objetivo, this.cercania * 0.45);
      var dif = meta - this.valor;
      if (Math.abs(dif) < 0.002) {
        if (this.valor !== meta) { this.valor = meta; this.aplicar(); }
        return;                       // quieto: no hace nada
      }
      this.valor += dif * Math.min(1, (dt || 16) * 0.012);
      this.aplicar();
    },

    aplicar: function () {
      var v = this.valor;
      this.partes.cuerpo.scale.setScalar(1 + 0.03 * v);
      this.partes.halo.material.opacity = 0.16 + 0.6 * v;
    }
  });

  /* ======================================================================
     ABRIR CON MIRA / CLIC / TOQUE
     ====================================================================== */
  function intentarAbrir(el, origen) {
    if (Museo.abierto || !el || !el.__obra) return;
    var ahora = performance.now();
    if (ahora - Museo.ultimoCierre < 350) return;
    // En escritorio el primer clic solo captura el mouse; no debe abrir la ficha
    if (origen === 'cursor' && !ESTA_TACTIL) {
      if (!document.pointerLockElement) return;
      if (ahora - Museo.ultimoBloqueo < 450) return;
    }
    abrirModal(el.__obra.item);
  }

  // A-Frame usa near 0.005 y far 10000 por defecto: con eso la precisión de
  // profundidad a 10-20 m es de milímetros y las capas finas parpadean.
  // Con near 0.1 y far 400 la precisión mejora ~20 veces (el museo mide ~60 m).
  function ajustarCamara(escena) {
    var LEJOS = 400;
    var cam = escena.querySelector('[camera]');
    if (cam) {
      cam.setAttribute('camera', 'near', 0.1);
      cam.setAttribute('camera', 'far', LEJOS);
    }

    // El <a-sky> mide 500 m de radio por defecto: con "far" en 400 la cámara
    // lo recortaba y por el hueco se veía el fondo blanco de la página (el
    // círculo blanco). Se achica el cielo para que quede siempre dentro.
    var cielo = escena.querySelector('a-sky');
    var color = '#111111';
    if (cielo) {
      cielo.setAttribute('radius', LEJOS * 0.75);
      color = cielo.getAttribute('color') || color;
    }
    // Respaldo: aunque algo quede fuera de alcance, el fondo nunca será blanco
    escena.setAttribute('background', 'color', color);
  }

  // Tamaño de la mira según el ajuste "Cursor" del sitio
  function aplicarMira() {
    if (!Museo || !A11Y) return;   // aún no existe el estado (primera llamada, en el <head>)
    var mira = Museo.mira;
    if (!mira) return;
    var k = A11Y.cursor === 'extragrande' ? 2.6 : (A11Y.cursor === 'grande' ? 1.8 : 1);
    var g = function (n) { return (n * k).toFixed(3); };
    mira.setAttribute('scale', g(1) + ' ' + g(1) + ' ' + g(1));
    mira.setAttribute('animation__crecer', 'property: scale; to: ' + g(1.8) + ' ' + g(1.8) + ' ' + g(1.8) + '; dur: 180; easing: easeOutQuad; startEvents: mouseenter');
    mira.setAttribute('animation__volver', 'property: scale; to: ' + g(1) + ' ' + g(1) + ' ' + g(1) + '; dur: 180; easing: easeOutQuad; startEvents: mouseleave');
  }

  /* ======================================================================
     ATMÓSFERA: motas de polvo en la luz y balanceo natural al caminar
     (con pasos sonoros). Muy ligero: un solo dibujo para todo el polvo.
     ====================================================================== */
  function iniciarAtmosfera(escena) {
    var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var camEl = escena.camera && escena.camera.el;
    var jugador = document.getElementById('player');
    if (!camEl || !jugador) return;

    // --- Polvo ---
    var N = ESTA_TACTIL ? 160 : 320, R = 9, H = 7;
    var pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * R * 2;
      pos[i * 3 + 1] = Math.random() * H;
      pos[i * 3 + 2] = (Math.random() - 0.5) * R * 2;
      vel[i * 3] = (Math.random() - 0.5) * 0.05;
      vel[i * 3 + 1] = (Math.random() - 0.3) * 0.03;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    var mat = new THREE.PointsMaterial({
      size: 0.06, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false,
      opacity: 0.55, blending: THREE.AdditiveBlending,
      color: new THREE.Color(MODO === 'digital' ? '#7fe9df' : '#ffdcae'), sizeAttenuation: true
    });
    var polvo = new THREE.Points(geo, mat);
    polvo.frustumCulled = false;
    polvo.raycast = function () {};
    escena.object3D.add(polvo);

    // --- Balanceo y pasos ---
    var anterior = new THREE.Vector3(), actual = new THREE.Vector3(), centro = new THREE.Vector3();
    jugador.object3D.getWorldPosition(anterior);
    var fase = 0, amplitud = 0, ultimoSigno = 1, suelo = 0;

    if (AFRAME.components['mm-atmosfera']) return;
    AFRAME.registerComponent('mm-atmosfera', {
      tick: function (t, dt) {
        if (!dt) return;
        var s = Math.min(dt, 50) / 1000;
        jugador.object3D.getWorldPosition(actual);
        var dx = actual.x - anterior.x, dz = actual.z - anterior.z;
        var saltoGrande = dx * dx + dz * dz > 1;          // teletransporte del recorrido guiado
        var rapidez = saltoGrande ? 0 : Math.sqrt(dx * dx + dz * dz) / s;
        anterior.copy(actual);

        // Balanceo: sube y baja con cada paso, se detiene suave
        var meta = Math.min(1, rapidez / 5);
        amplitud += (meta - amplitud) * Math.min(1, s * 6);
        if (!reducido && amplitud > 0.02) {
          fase += s * (5.2 + rapidez * 0.55);
          var y = Math.sin(fase * 2) * 0.045 * amplitud;
          camEl.object3D.position.y = y;
          camEl.object3D.position.x = Math.cos(fase) * 0.025 * amplitud;
        } else if (camEl.object3D.position.y !== 0) {
          camEl.object3D.position.y *= 0.85; camEl.object3D.position.x *= 0.85;
          if (Math.abs(camEl.object3D.position.y) < 1e-4) { camEl.object3D.position.set(0, 0, 0); }
        }

        // Pasos: uno cada "pasoCada" metros recorridos (no suena al teletransportarse
        // en el recorrido guiado ni al quedarse frente a una pared)
        if (!saltoGrande && rapidez > 0.3) {
          suelo += rapidez * s;
          if (suelo >= CONFIG.pasoCada) { suelo = 0; Sonido.paso(Math.min(1.2, 0.8 + rapidez / 25)); }
        } else if (rapidez < 0.05) {
          suelo = CONFIG.pasoCada * 0.7;       // al volver a caminar, el primer paso suena pronto
        }

        // Polvo: flota lento y siempre rodea al visitante
        if (!polvo.visible) return;
        centro.set(actual.x, 0, actual.z);
        var k = reducido ? 0.3 : 1;
        for (var i = 0; i < N; i++) {
          var o = i * 3;
          pos[o] += vel[o] * s * k + Math.sin(t * 0.0003 + i) * 0.0008;
          pos[o + 1] += vel[o + 1] * s * k;
          pos[o + 2] += vel[o + 2] * s * k;
          var rx = pos[o] - centro.x, rz = pos[o + 2] - centro.z;
          if (rx > R) pos[o] -= R * 2; else if (rx < -R) pos[o] += R * 2;
          if (rz > R) pos[o + 2] -= R * 2; else if (rz < -R) pos[o + 2] += R * 2;
          if (pos[o + 1] > H) pos[o + 1] = 0.1; else if (pos[o + 1] < 0) pos[o + 1] = H;
        }
        geo.attributes.position.needsUpdate = true;
      }
    });
    jugador.setAttribute('mm-atmosfera', '');
  }

  function configurarEntrada(escena) {
    var limite = CONFIG.distanciaInteraccion;
    var raycaster = new THREE.Raycaster();
    var ndc = new THREE.Vector2();
    var canvas = escena.canvas;

    // Obra bajo un punto de la pantalla (sin límite de distancia) → { el, distancia }
    function obraEnPantalla(x, y) {
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, escena.camera);
      raycaster.far = 60;
      var golpes = raycaster.intersectObjects(Museo.obras.map(function (o) { return o.object3D; }), true);
      if (!golpes.length) return null;
      var nodo = golpes[0].object;
      while (nodo && !(nodo.el && nodo.el.__obra)) nodo = nodo.parent;
      return nodo ? { el: nodo.el, distancia: golpes[0].distance } : null;
    }

    document.addEventListener('pointerlockchange', function () {
      if (document.pointerLockElement) Museo.ultimoBloqueo = performance.now();
    });

    // Tecla E / Enter sobre la obra en la mira (la mira solo alcanza obras cercanas)
    window.addEventListener('keydown', function (e) {
      if (Museo.abierto || (e.code !== 'KeyE' && e.code !== 'Enter')) return;
      if (Museo.hover) intentarAbrir(Museo.hover, 'teclado');
      else if (document.pointerLockElement) {
        var o = obraEnPantalla(0, 0);
        if (o && o.distancia > limite) mostrarAviso('Acércate a la obra para verla');
      }
    });

    var cursor = escena.querySelector('a-cursor, [cursor]');
    if (cursor) {
      if (ESTA_TACTIL) {
        // En móvil manda el toque; la mira no debe disparar clics
        cursor.setAttribute('raycaster', 'objects', '.mm-sin-objetivo');
      } else {
        // El rayo de la mira nace donde está el cursor (1 m delante de la cámara),
        // así que se descuenta ese tramo para medir desde los ojos del jugador.
        var adelanto = Math.abs(cursor.object3D.position.z) || 0;
        cursor.setAttribute('raycaster', 'far', Math.max(0.5, limite - adelanto));
        cursor.setAttribute('raycaster', 'interval', 60);
        Museo.mira = cursor;
        aplicarMira();
      }
    }

    // Escritorio: clic a una obra lejana → aviso "Acércate"
    if (!ESTA_TACTIL) {
      canvas.addEventListener('mousedown', function () {
        if (Museo.abierto || Museo.hover || !document.pointerLockElement) return;
        if (performance.now() - Museo.ultimoBloqueo < 450) return;
        var o = obraEnPantalla(0, 0);
        if (o && o.distancia > limite) mostrarAviso('Acércate a la obra para verla');
      });
      return;
    }

    // Móvil: controles tipo videojuego (joystick + arrastrar para mirar + botón Ver)
    controlesTactiles(escena, obraEnPantalla, limite);

    // Móvil: distingue un "tap" de un arrastre para mirar
    var inicio = null;
    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { inicio = null; return; }
      inicio = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
    }, { passive: true });

    canvas.addEventListener('touchend', function (e) {
      if (!inicio || Museo.abierto) return;
      var toque = e.changedTouches[0];
      var dx = toque.clientX - inicio.x, dy = toque.clientY - inicio.y;
      var rapido = performance.now() - inicio.t < 350;
      inicio = null;
      if (!rapido || dx * dx + dy * dy > 144) return;

      var rect = canvas.getBoundingClientRect();
      var o = obraEnPantalla(((toque.clientX - rect.left) / rect.width) * 2 - 1,
                             -((toque.clientY - rect.top) / rect.height) * 2 + 1);
      if (!o) return;
      if (o.distancia > limite) { mostrarAviso('Acércate a la obra para verla'); return; }
      intentarAbrir(o.el, 'toque');
    }, { passive: true });
  }


  /* ======================================================================
     CONTROLES TÁCTILES (celular / tableta) — como en los videojuegos
       - Joystick abajo a la izquierda: caminar. Llevarlo al tope = correr.
       - Arrastrar el dedo en la pantalla: mirar alrededor (arriba/abajo también).
       - Botón "Ver obra" abajo a la derecha: se enciende cuando la mira del
         centro apunta a una obra cercana y abre su ficha.
       - Tocar directo una obra cercana sigue funcionando igual.
     Se apaga el giroscopio (el efecto "realidad virtual" al mover el celular).
     Requiere que el componente "caminante" tenga la propiedad joy (index.html).
     ====================================================================== */
  function controlesTactiles(escena, obraEnPantalla, limite) {
    if (document.querySelector('.mt-joy')) return;
    var html = document.documentElement;
    html.classList.add('mm-tactil');

    var camEl = escena.querySelector('[camera]');
    var jugador = document.getElementById('player') || (camEl && camEl.parentNode);
    if (camEl) {
      camEl.setAttribute('look-controls', 'magicWindowTrackingEnabled', false);
      camEl.setAttribute('look-controls', 'touchEnabled', false);
    }
    var caminante = function () { return jugador && jugador.components && jugador.components.caminante; };

    var css = document.createElement('style');
    css.id = 'museo-controles-tactiles';
    css.textContent = `
      .mt-joy, .mt-ver { display: none; }
      html.mm-tactil .mt-joy, html.mm-tactil .mt-ver { display: flex; }
      html.mm-guiado .mt-joy, html.mm-guiado .mt-ver,
      html.mm-tactil.mt-oculto .mt-joy, html.mm-tactil.mt-oculto .mt-ver { display: none !important; }
      .mt-joy {
        position: fixed; left: calc(20px + env(safe-area-inset-left)); bottom: calc(104px + env(safe-area-inset-bottom)); z-index: 55;
        width: 132px; height: 132px; border-radius: 50%;
        align-items: center; justify-content: center; touch-action: none;
        background: radial-gradient(circle, color-mix(in srgb, var(--mm-panel) 55%, transparent) 0 60%, color-mix(in srgb, var(--mm-panel) 80%, transparent) 62%);
        border: 2px solid color-mix(in srgb, var(--mm-ocre) 55%, transparent);
        box-shadow: 0 12px 30px -12px rgba(0,0,0,.45);
        -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
        -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
        transition: border-color .2s ease, box-shadow .2s ease;
      }
      .mt-joy::before {
        content: ""; position: absolute; inset: 16px; border-radius: 50%;
        border: 1px dashed color-mix(in srgb, var(--mm-ocre) 40%, transparent); pointer-events: none;
      }
      .mt-joy__flecha { position: absolute; width: 0; height: 0; border: 6px solid transparent; opacity: .55; pointer-events: none; }
      .mt-joy__flecha--n { top: 6px; left: 50%; margin-left: -6px; border-bottom-color: var(--mm-ocre); }
      .mt-joy__flecha--s { bottom: 6px; left: 50%; margin-left: -6px; border-top-color: var(--mm-ocre); }
      .mt-joy__flecha--o { left: 6px; top: 50%; margin-top: -6px; border-right-color: var(--mm-ocre); }
      .mt-joy__flecha--e { right: 6px; top: 50%; margin-top: -6px; border-left-color: var(--mm-ocre); }
      .mt-joy__bola {
        width: 58px; height: 58px; border-radius: 50%; pointer-events: none;
        background: linear-gradient(145deg, var(--mm-tezontle), var(--mm-ocre));
        box-shadow: 0 8px 18px -6px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.25);
        transition: transform .14s ease; will-change: transform;
      }
      .mt-joy.is-activo .mt-joy__bola { transition: none; }
      .mt-joy.is-corriendo { border-color: var(--mm-tezontle); box-shadow: 0 0 0 5px color-mix(in srgb, var(--mm-tezontle) 30%, transparent), 0 12px 30px -12px rgba(0,0,0,.45); }
      .mt-ver {
        position: fixed; right: calc(20px + env(safe-area-inset-right)); bottom: calc(124px + env(safe-area-inset-bottom)); z-index: 55;
        min-width: 92px; max-width: 170px; height: 92px; padding: 0 16px; border-radius: 46px;
        flex-direction: column; align-items: center; justify-content: center; gap: 2px;
        border: 2px solid color-mix(in srgb, var(--mm-ocre) 50%, transparent);
        background: color-mix(in srgb, var(--mm-panel) 85%, transparent);
        color: var(--mm-texto-2); font: 700 .8rem/1.1 var(--mm-sans);
        -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
        box-shadow: 0 12px 30px -12px rgba(0,0,0,.45);
        opacity: .6; transition: opacity .2s ease, transform .2s ease;
        touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;
        cursor: pointer;
      }
      .mt-ver svg { width: 26px; height: 26px; }
      .mt-ver small { max-width: 138px; font: 600 .68rem/1.2 var(--mm-serif); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: .92; }
      .mt-ver.is-listo {
        opacity: 1;
        background: linear-gradient(135deg, var(--mm-ocre), var(--mm-tezontle));
        color: var(--mm-sobre-acento, #fff); border-color: transparent;
        animation: mt-latido 1.8s ease-out infinite;
      }
      .mt-ver:active { transform: scale(.93); }
      .mt-mira {
        position: fixed; left: 50%; top: 50%; z-index: 44; width: 14px; height: 14px; margin: -7px 0 0 -7px;
        border-radius: 50%; border: 2px solid rgba(255,255,255,.85); box-shadow: 0 0 0 1px rgba(0,0,0,.35);
        pointer-events: none; display: none; transition: transform .2s ease, border-color .2s ease;
      }
      html.mm-tactil .mt-mira { display: block; }
      html.mm-guiado .mt-mira, html.mm-tactil.mt-oculto .mt-mira { display: none; }
      .mt-mira.is-listo { transform: scale(1.5); border-color: var(--mm-tezontle); }
      @keyframes mt-latido {
        0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--mm-tezontle) 55%, transparent); }
        100% { box-shadow: 0 0 0 18px transparent; }
      }
      /* Vertical: joystick y botón en la misma línea, encima del botón de accesibilidad */
      .mt-joy { bottom: calc(76px + env(safe-area-inset-bottom)); }
      .mt-ver { bottom: calc(96px + env(safe-area-inset-bottom)); }
      @media (max-width: 360px) and (orientation: portrait), (max-height: 640px) and (orientation: portrait) {
        .mt-joy { width: 116px; height: 116px; left: calc(16px + env(safe-area-inset-left)); bottom: calc(72px + env(safe-area-inset-bottom)); }
        .mt-joy__bola { width: 50px; height: 50px; }
        .mt-ver { min-width: 80px; height: 80px; border-radius: 40px; padding: 0 12px; right: calc(16px + env(safe-area-inset-right)); bottom: calc(90px + env(safe-area-inset-bottom)); }
        .mt-ver small { max-width: 110px; }
      }
      /* Horizontal: joystick a la derecha del botón de accesibilidad, "Ver obra" enfrente */
      @media (orientation: landscape) and (max-height: 520px) {
        .mt-joy { width: 116px; height: 116px; left: calc(76px + env(safe-area-inset-left)); bottom: calc(14px + env(safe-area-inset-bottom)); }
        .mt-joy__bola { width: 50px; height: 50px; }
        .mt-ver { height: 80px; min-width: 80px; border-radius: 40px; padding: 0 14px; right: calc(18px + env(safe-area-inset-right)); bottom: calc(32px + env(safe-area-inset-bottom)); }
      }
      @media (orientation: landscape) and (max-height: 360px) {
        .mt-joy { width: 104px; height: 104px; }
        .mt-joy__bola { width: 46px; height: 46px; }
        .mt-ver { height: 72px; min-width: 72px; bottom: calc(30px + env(safe-area-inset-bottom)); }
        .mt-ver small { display: none; }
      }
      @media (prefers-reduced-motion: reduce) { .mt-ver.is-listo { animation: none; } }
      html.a11y-contrast .mt-joy, html.a11y-contrast .mt-ver { border-width: 3px; border-color: currentColor; }
    `;
    document.head.appendChild(css);

    // ---- Joystick ----
    var joy = document.createElement('div');
    joy.className = 'mt-joy';
    joy.setAttribute('role', 'application');
    joy.setAttribute('aria-label', 'Joystick: arrastra para caminar, al tope para correr');
    joy.innerHTML = '<span class="mt-joy__flecha mt-joy__flecha--n"></span><span class="mt-joy__flecha mt-joy__flecha--s"></span>' +
      '<span class="mt-joy__flecha mt-joy__flecha--o"></span><span class="mt-joy__flecha mt-joy__flecha--e"></span>' +
      '<div class="mt-joy__bola"></div>';
    document.body.appendChild(joy);
    var bola = joy.querySelector('.mt-joy__bola');

    var toqueJoy = null, cx = 0, cy = 0, radio = 1;
    function moverJoy(x, y) {
      var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > radio) { dx *= radio / d; dy *= radio / d; d = radio; }
      bola.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      var c = caminante();
      if (c && c.joy) { c.joy.x = dx / radio; c.joy.y = dy / radio; c.joy.m = d / radio; }
      joy.classList.toggle('is-corriendo', d / radio > 0.95);
    }
    function soltarJoy() {
      toqueJoy = null;
      joy.classList.remove('is-activo', 'is-corriendo');
      bola.style.transform = '';
      var c = caminante();
      if (c && c.joy) { c.joy.x = 0; c.joy.y = 0; c.joy.m = 0; }
    }
    joy.addEventListener('touchstart', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (toqueJoy !== null) return;
      var t = e.changedTouches[0], r = joy.getBoundingClientRect();
      toqueJoy = t.identifier; cx = r.left + r.width / 2; cy = r.top + r.height / 2; radio = r.width * 0.36;
      joy.classList.add('is-activo');
      try { Sonido.iniciar(); } catch (err) {}
      moverJoy(t.clientX, t.clientY);
    }, { passive: false });
    joy.addEventListener('touchmove', function (e) {
      e.preventDefault(); e.stopPropagation();
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === toqueJoy) moverJoy(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
      }
    }, { passive: false });
    var finJoy = function (e) {
      e.stopPropagation();
      for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === toqueJoy) soltarJoy();
    };
    joy.addEventListener('touchend', finJoy);
    joy.addEventListener('touchcancel', finJoy);
    joy.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('blur', soltarJoy);
    document.addEventListener('visibilitychange', function () { if (document.hidden) soltarJoy(); });

    // ---- Mirar arrastrando el dedo (un dedo en el resto de la pantalla) ----
    var canvas = escena.canvas, toqueVista = null, px = 0, py = 0, SENS = 0.0042;
    function girar(dx, dy) {
      var lc = camEl && camEl.components['look-controls'];
      if (!lc || !lc.yawObject || !lc.pitchObject) return;
      lc.yawObject.rotation.y -= dx * SENS;
      var p = lc.pitchObject.rotation.x - dy * SENS, tope = Math.PI / 2 * 0.95;
      lc.pitchObject.rotation.x = Math.max(-tope, Math.min(tope, p));
    }
    if (canvas) {
      canvas.style.touchAction = 'none';
      canvas.addEventListener('touchstart', function (e) {
        if (toqueVista !== null) return;
        var t = e.changedTouches[0];
        toqueVista = t.identifier; px = t.clientX; py = t.clientY;
      }, { passive: true });
      canvas.addEventListener('touchmove', function (e) {
        if (e.cancelable) e.preventDefault();
        if (Museo.abierto || html.classList.contains('mm-guiado')) return;
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.identifier !== toqueVista) continue;
          girar(t.clientX - px, t.clientY - py);
          px = t.clientX; py = t.clientY;
        }
      }, { passive: false });
      var finVista = function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === toqueVista) toqueVista = null;
      };
      canvas.addEventListener('touchend', finVista, { passive: true });
      canvas.addEventListener('touchcancel', finVista, { passive: true });
    }

    // ---- Mira central + botón "Ver obra" ----
    var mira = document.createElement('div');
    mira.className = 'mt-mira';
    mira.setAttribute('aria-hidden', 'true');
    document.body.appendChild(mira);

    var ver = document.createElement('button');
    ver.type = 'button';
    ver.className = 'mt-ver';
    ver.setAttribute('aria-label', 'Ver la obra que está en la mira');
    ver.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>' +
      '<span>Ver obra</span><small hidden></small>';
    document.body.appendChild(ver);
    var nombre = ver.querySelector('small');

    var enMira = null, lejos = false;
    ver.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
    ver.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (enMira) { soltarJoy(); intentarAbrir(enMira, 'toque'); }
      else if (lejos) mostrarAviso('Acércate a la obra para verla');
      else mostrarAviso('Apunta la mira del centro a una obra');
    });

    // Revisa ~7 veces por segundo qué obra hay al centro
    setInterval(function () {
      html.classList.toggle('mt-oculto', !!Museo.abierto || !!document.querySelector('.mm-portada.is-visible'));
      if (Museo.abierto || document.hidden || !escena.camera) return;
      var o = obraEnPantalla(0, 0);
      var el = o && o.distancia <= limite ? o.el : null;
      lejos = !!(o && o.distancia > limite);
      if (el === enMira) return;
      enMira = el;
      ver.classList.toggle('is-listo', !!el);
      mira.classList.toggle('is-listo', !!el);
      if (el) {
        var item = el.__obra.item;
        nombre.textContent = limpiarTexto(item.titulo || item.nombre) || '';
        nombre.hidden = !nombre.textContent;
        ver.setAttribute('aria-label', 'Ver ficha: ' + (nombre.textContent || 'obra'));
      } else {
        nombre.hidden = true;
        ver.setAttribute('aria-label', 'Ver la obra que está en la mira');
      }
    }, 140);
  }

  /* ======================================================================
     COLOCAR CUADROS EN LOS "Punto_cuadro" DEL GLB
     ====================================================================== */
  // "Punto_cuadro.003" (Blender) llega a Three.js como "Punto_cuadro003":
  // se compara sin puntos, guiones ni mayúsculas para que ambos coincidan.
  function claveNombre(texto) {
    return String(texto == null ? '' : texto).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function numeroDePunto(nombre) {
    var m = String(nombre).match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : 0;          // "Punto_cuadro" sin número = 0
  }

  function buscarPuntos(obj3D) {
    var puntos = [], vistos = {};
    obj3D.updateMatrixWorld(true);
    obj3D.traverse(function (node) {
      if (node.isMesh || vistos[node.uuid]) return;
      var original = (node.userData && node.userData.name) || node.name || '';
      var clave = claveNombre(original);
      // Acepta Punto_personaje1, Punto_cuadro_personaje1, Punto_video1, Punto_cuadro1...
      var esPunto = clave.indexOf('punto') === 0 || clave.indexOf('soportecuadro') === 0;
      var tipo = !esPunto ? null
               : clave.indexOf('personaje') !== -1 ? 'personaje'
               : clave.indexOf('video') !== -1 ? 'video'
               : clave.indexOf('cuadro') !== -1 ? 'cuadro'
               : null;
      if (!tipo) return;
      vistos[node.uuid] = true;

      var pos = new THREE.Vector3(), quat = new THREE.Quaternion(), esc = new THREE.Vector3();
      node.getWorldPosition(pos);
      node.getWorldQuaternion(quat);
      node.getWorldScale(esc);
      // Empty de Blender con Display Size 1 = cubo de -1 a 1 → mide 2 × escala
      var caja = null;
      if (CONFIG.tamanoDesdeEmpty) {
        caja = {
          w: Math.max(CONFIG.tamanoMinimo, Math.abs(esc.x) * 2),
          h: Math.max(CONFIG.tamanoMinimo, Math.abs(esc.y) * 2)
        };
      }
      puntos.push({
        tipo: tipo,
        caja: caja,
        nombre: original,
        clave: clave,
        numero: numeroDePunto(original),
        // Nombra el empty "Punto_cuadro_ocupado" o "..._reservado" para que no se use
        reservado: /ocupado|reservado/.test(clave),
        position: pos,
        quaternion: quat
      });
    });
    var orden = { cuadro: 0, personaje: 1, video: 2 };
    puntos.sort(function (x, y) {
      return orden[x.tipo] - orden[y.tipo] || x.numero - y.numero || x.clave.localeCompare(y.clave);
    });
    // Sección del recorrido guiado:
    //   Punto_cuadro_personaje N y Punto_video N → sección N (por su posición en orden)
    //   Punto_cuadro: los 7 primeros → sección 1, los 7 siguientes → sección 2, ...
    var cuenta = { cuadro: 0, personaje: 0, video: 0 };
    var porSeccion = Math.max(1, CONFIG.cuadrosPorSeccion);
    puntos.forEach(function (p) {
      var i = cuenta[p.tipo]++;
      p.orden = i;
      p.seccion = p.tipo === 'cuadro' ? Math.floor(i / porSeccion) + 1 : i + 1;
    });
    return puntos;
  }

  /**
   * Una obra por punto. Primero se respetan las obras que piden un punto
   * concreto (campo "punto" en data.js); después cada obra va al siguiente
   * punto LIBRE. Si ya no quedan puntos libres, la obra no se cuelga.
   * Orden: el 1.er elemento de data.js va a Punto_cuadro, el 2.º al siguiente
   * número (Punto_cuadro.001 o Punto_cuadro2), y así sucesivamente.
   * Devuelve [{ item, punto, numero }] en el MISMO orden que data.js.
   */
  function asignarPuntos(items, puntos) {
    var ocupado = puntos.map(function (p) { return p.reservado; });
    var destino = items.map(function () { return -1; });

    // Identificador del empty en data.js (campo "punto"):
    //   punto: "cuadro1" | "personaje1" | "video1"   → tipo + número
    //   punto: 1                                      → número, del tipo de la obra
    //   punto: "Punto_cuadro_personaje1"              → nombre exacto del empty
    var tipoPropio = { imagen: 'cuadro', video: 'video', personaje: 'personaje' };
    function buscarPedido(pedido, item) {
      if (pedido == null || pedido === '') return -1;
      var clave = claveNombre(pedido), i;
      // 1) Nombre exacto (con o sin "Punto_")
      for (i = 0; i < puntos.length; i++) {
        if (puntos[i].clave === clave || puntos[i].clave === 'punto' + clave) return i;
      }
      // 2) Tipo + número
      var m = clave.match(/(\d+)$/);
      if (!m) return -2;
      var numero = parseInt(m[1], 10);
      var tipo = clave.indexOf('personaje') !== -1 ? 'personaje'
               : clave.indexOf('video') !== -1 ? 'video'
               : clave.indexOf('cuadro') !== -1 ? 'cuadro'
               : tipoPropio[tipoDeObra(item)];
      for (i = 0; i < puntos.length; i++) {
        if (puntos[i].tipo === tipo && puntos[i].numero === numero) return i;
      }
      return -2;
    }

    // 1) Obras con punto fijo
    items.forEach(function (item, k) {
      var i = buscarPedido(item.punto, item);
      if (i === -1) return;
      if (i === -2) {
        console.warn('[Sala 3D] No existe el punto "' + item.punto + '" pedido por "' + limpiarTexto(item.titulo) + '"; se usará uno libre.');
      } else if (ocupado[i]) {
        console.warn('[Sala 3D] El punto "' + puntos[i].nombre + '" ya está ocupado; "' + limpiarTexto(item.titulo) + '" irá a uno libre.');
      } else {
        ocupado[i] = true;
        destino[k] = i;
      }
    });

    // 2) El resto, en el orden de data.js, al siguiente punto libre DE SU TIPO:
    //    personaje → Punto_personaje (si no hay libres, Punto_cuadro)
    //    video     → Punto_video     (si no hay libres, Punto_cuadro)
    //    imagen    → Punto_cuadro
    var preferencia = { personaje: ['personaje', 'cuadro'], video: ['video', 'cuadro'], imagen: ['cuadro'] };
    var sinLugar = [];
    items.forEach(function (item, k) {
      if (destino[k] !== -1) return;
      var tipos = preferencia[tipoDeObra(item)];
      for (var t = 0; t < tipos.length && destino[k] === -1; t++) {
        for (var i = 0; i < puntos.length; i++) {
          if (!ocupado[i] && puntos[i].tipo === tipos[t]) { ocupado[i] = true; destino[k] = i; break; }
        }
      }
      if (destino[k] === -1) sinLugar.push('[' + tipoDeObra(item) + '] ' + (limpiarTexto(item.titulo) || item.url));
    });

    if (sinLugar.length) {
      console.warn('[Sala 3D] Faltan ' + sinLugar.length + ' punto(s) libres. Estas obras no se colgaron: ' +
        sinLugar.join(', ') + '. Duplica en Blender el empty de ese tipo (Punto_cuadro, Punto_personaje o Punto_video) para agregar lugares.');
    }
    var cuenta = {};
    puntos.forEach(function (p, i) {
      var c = cuenta[p.tipo] || (cuenta[p.tipo] = { total: 0, libres: 0 });
      c.total++; if (!ocupado[i]) c.libres++;
    });
    console.info('[Sala 3D] Puntos por tipo: ' + Object.keys(cuenta).map(function (t) {
      return t + ' ' + cuenta[t].total + ' (' + cuenta[t].libres + ' libres)';
    }).join(' | '));

    var colocadas = [];
    items.forEach(function (item, k) {
      if (destino[k] >= 0) colocadas.push({ item: item, punto: puntos[destino[k]], numero: k + 1 });
    });
    // Tabla en la consola (F12) para comprobar qué obra quedó en qué empty
    if (console.table) {
      console.table(items.map(function (item, k) {
        return {
          'N.º en data.js': k + 1,
          'Obra': limpiarTexto(item.titulo) || item.url,
          'Tipo': tipoDeObra(item),
          'Empty': destino[k] >= 0 ? puntos[destino[k]].nombre : '— sin lugar —'
        };
      }));
    }
    return colocadas;
  }

  // Sin empties en el GLB: fila automática como respaldo
  function ubicacionesDeRespaldo(items) {
    return items.map(function (item, i) {
      return {
        item: item,
        punto: {
          nombre: 'automático ' + (i + 1),
          position: new THREE.Vector3(i % 2 === 0 ? -3 : 3, CONFIG.alturaSinPuntos, -Math.floor(i / 2) * 4.5 - 2),
          quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2, 0))
        }
      };
    });
  }

  // Dibuja la miniatura con un botón de "play" y la duración encima
  function componerMiniatura(fuente, anchoOrig, altoOrig, duracion) {
    var escala = Math.min(1, CONFIG.texturaMax / Math.max(anchoOrig, altoOrig));
    var W = Math.max(2, Math.round(anchoOrig * escala)), H = Math.max(2, Math.round(altoOrig * escala));
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    if (fuente) c.drawImage(fuente, 0, 0, W, H);
    else { c.fillStyle = PALETA.vacio; c.fillRect(0, 0, W, H); }

    // Viñeta y degradado inferior (se lee como "video pausado")
    var vin = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    vin.addColorStop(0, 'rgba(0,0,0,0)'); vin.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = vin; c.fillRect(0, 0, W, H);

    // Botón play
    var r = Math.min(W, H) * 0.13, cx = W / 2, cy = H / 2;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fillStyle = PALETA.circulo; c.fill();
    c.lineWidth = Math.max(3, r * 0.08); c.strokeStyle = PALETA.acento; c.stroke();
    c.beginPath();
    c.moveTo(cx - r * 0.3, cy - r * 0.42);
    c.lineTo(cx + r * 0.48, cy);
    c.lineTo(cx - r * 0.3, cy + r * 0.42);
    c.closePath();
    c.fillStyle = PALETA.claro; c.fill();

    // Duración
    var texto = formatoDuracion(duracion);
    if (texto) {
      var fs = Math.max(18, Math.round(H * 0.055));
      c.font = '600 ' + fs + 'px ' + FUENTES.sans;
      var tw = c.measureText(texto).width, bp = fs * 0.5;
      var bw = tw + bp * 2, bh = fs * 1.6, bx = W - bw - fs * 0.8, by = H - bh - fs * 0.8;
      rectRedondo(c, bx, by, bw, bh, bh / 2);
      c.fillStyle = PALETA.insignia; c.fill();
      c.fillStyle = PALETA.claro; c.textBaseline = 'middle';
      c.fillText(texto, bx + bp, by + bh / 2 + 1);
    }
    return cv;
  }

  function cargarImagen(url) {
    return new Promise(function (ok, mal) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { ok(img); };
      img.onerror = mal;
      img.src = url;
    });
  }

  // Lee duración y (si no hay miniatura) un cuadro del video, sin reproducirlo
  function leerVideo(url, necesitaCuadro) {
    return new Promise(function (ok) {
      var v = document.createElement('video');
      var listo = false;
      var terminar = function (res) {
        if (listo) return;
        listo = true;
        clearTimeout(limite);
        ok(res);
        v.removeAttribute('src'); v.load();   // libera la conexión y la memoria
      };
      var limite = setTimeout(function () { terminar(null); }, 10000);
      v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous';
      v.preload = necesitaCuadro ? 'auto' : 'metadata';
      v.addEventListener('error', function () { terminar(null); });
      v.addEventListener('loadedmetadata', function () {
        if (!necesitaCuadro) { terminar({ duracion: v.duration, video: null }); return; }
        // Un cuadro al 10 % (máx. 2 s) suele evitar la pantalla negra inicial
        v.currentTime = Math.min(2, (v.duration || 1) * 0.1);
      });
      v.addEventListener('seeked', function () {
        terminar({ duracion: v.duration, video: v, ancho: v.videoWidth, alto: v.videoHeight, cv: dibujarCuadro(v) });
      });
      v.src = url;
    });
  }

  function dibujarCuadro(v) {
    var cv = document.createElement('canvas');
    cv.width = v.videoWidth || 1280; cv.height = v.videoHeight || 720;
    cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
    return cv;
  }

  // Recorta al centro para quitar las franjas negras de las miniaturas 4:3
  function recortarA(img, ratio) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var sw = w, sh = h;
    if (w / h > ratio) sw = h * ratio; else sh = w / ratio;
    var cv = document.createElement('canvas');
    cv.width = Math.round(sw); cv.height = Math.round(sh);
    var c = cv.getContext('2d');
    c.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
    c.getImageData(0, 0, 1, 1);            // lanza error si la imagen no permite usarse en WebGL
    return cv;
  }

  function cargarMiniaturaYouTube(item) {
    var yt = datosYouTube(item.url);
    var ratio = yt.vertical ? 9 / 16 : 16 / 9;
    item.__duracion = formatoDuracion(item.duracion || '');

    var candidatos = item.miniatura
      ? [item.miniatura]
      : ['https://i.ytimg.com/vi/' + yt.id + '/maxresdefault.jpg',
         'https://i.ytimg.com/vi/' + yt.id + '/hqdefault.jpg'];

    function probar(i) {
      if (i >= candidatos.length) return Promise.resolve(null);
      return cargarImagen(candidatos[i]).then(function (img) {
        // YouTube responde con una imagen gris de 120 px cuando no existe la versión HD
        return (img.naturalWidth > 120) ? img : probar(i + 1);
      }, function () { return probar(i + 1); });
    }

    return probar(0).then(function (img) {
      var fuente = null;
      if (img) {
        try { fuente = recortarA(img, ratio); }
        catch (e) { console.warn('[Sala 3D] La miniatura de YouTube no se pudo usar en 3D:', item.url); }
      } else {
        console.warn('[Sala 3D] Sin miniatura para el video de YouTube:', item.url);
      }
      var W = yt.vertical ? 720 : 1280, H = yt.vertical ? 1280 : 720;
      var cv = componerMiniatura(fuente, W, H, item.__duracion);
      var tex = texturaCanvas(cv);
      tex.anisotropy = RECURSOS.maxAniso;
      return { tex: tex, ratio: ratio };
    });
  }

  function cargarMiniaturaVideo(item) {
    if (datosYouTube(item.url)) return cargarMiniaturaYouTube(item);
    var conMiniatura = !!item.miniatura;
    var promesaImg = conMiniatura ? cargarImagen(item.miniatura).catch(function () { return null; }) : Promise.resolve(null);
    return Promise.all([promesaImg, leerVideo(item.url, !conMiniatura)]).then(function (r) {
      var img = r[0], info = r[1];
      var duracion = info ? info.duracion : 0;
      item.__duracion = formatoDuracion(duracion);

      var fuente = null, w = 1280, hgt = 720;
      if (img) { fuente = img; w = img.naturalWidth; hgt = img.naturalHeight; }
      else if (info && info.cv) { fuente = info.cv; w = info.ancho || 1280; hgt = info.alto || 720; }
      else console.warn('[Sala 3D] Sin miniatura para el video:', item.url);

      var cv;
      try { cv = componerMiniatura(fuente, w, hgt, duracion); }
      catch (e) { cv = componerMiniatura(null, 1280, 720, duracion); } // video de otro dominio sin CORS

      // Póster para el modal (si no diste una miniatura)
      if (!conMiniatura && fuente) {
        try { item.__poster = (info.cv).toDataURL('image/jpeg', 0.82); } catch (e) {}
      }
      var tex = texturaCanvas(cv);
      tex.anisotropy = RECURSOS.maxAniso;
      return { tex: tex, ratio: w / hgt || 16 / 9 };
    });
  }

  // Cola: como máximo N descargas a la vez (evita picos de red y de memoria)
  var colaCargas = [], cargasActivas = 0;
  function enCola(tarea) {
    return new Promise(function (ok, mal) {
      colaCargas.push({ tarea: tarea, ok: ok, mal: mal });
      siguienteCarga();
    });
  }
  function siguienteCarga() {
    while (cargasActivas < CONFIG.cargasSimultaneas && colaCargas.length) {
      var t = colaCargas.shift();
      cargasActivas++;
      Promise.resolve().then(t.tarea).then(t.ok, t.mal).then(function () {
        cargasActivas--;
        siguienteCarga();
      });
    }
  }

  // Sube UNA textura a la tarjeta de video por frame (sin tirones al aparecer)
  var colaGPU = [];
  function subirGPU(texturas) {
    return new Promise(function (ok) {
      colaGPU.push({ texturas: texturas, ok: ok });
      if (colaGPU.length === 1) requestAnimationFrame(procesarGPU);
    });
  }
  function procesarGPU() {
    var tarea = colaGPU[0];
    var r = Museo.escena && Museo.escena.renderer;
    var tex = tarea.texturas.shift();
    if (tex && r && r.initTexture) { try { r.initTexture(tex); } catch (e) {} }
    if (!tarea.texturas.length) { colaGPU.shift(); tarea.ok(); }
    if (colaGPU.length) requestAnimationFrame(procesarGPU);
  }

  // Reduce la imagen al tamaño útil en 3D y la decodifica fuera del frame
  function reducirImagen(img) {
    var w = img.naturalWidth, h = img.naturalHeight, max = CONFIG.texturaMax;
    if (Math.max(w, h) <= max) return img;
    var k = max / Math.max(w, h);
    var cv = document.createElement('canvas');
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    var c = cv.getContext('2d');
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(img, 0, 0, cv.width, cv.height);
    return cv;
  }

  function cargarTextura(url) {
    return cargarImagen(url).then(function (img) {
      var decodificar = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
      return decodificar.then(function () {
        var fuente = reducirImagen(img);
        var tex = fuente === img ? new THREE.Texture(img) : new THREE.CanvasTexture(fuente);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = RECURSOS.maxAniso;
        tex.needsUpdate = true;
        return { tex: tex, ratio: img.naturalWidth / img.naturalHeight || 4 / 3 };
      });
    }).catch(function () {
      console.warn('[Sala 3D] No se pudo cargar la imagen:', url);
      return { tex: texturaNoDisponible(), ratio: 4 / 3 };
    });
  }

  function crearCuadros(modeloEl) {
    var escena = modeloEl.sceneEl;
    Museo.escena = escena;
    var contenedor = document.getElementById('elementos-exhibicion');
    if (!contenedor) return;

    crearRecursos();
    if (escena.renderer) RECURSOS.maxAniso = Math.min(8, escena.renderer.capabilities.getMaxAnisotropy());

    while (contenedor.firstChild) contenedor.removeChild(contenedor.firstChild);
    Museo.obras = [];

    var puntos = buscarPuntos(modeloEl.object3D);
    var colocadas = puntos.length ? asignarPuntos(Museo.todos, puntos) : ubicacionesDeRespaldo(Museo.todos);

    // El modal navega por las obras colgadas en el mismo orden de data.js
    Museo.items = colocadas.map(function (c) { return c.item; });
    var fuentesListas = esperarFuentes();

    colocadas.forEach(function (colocada, index) {
      var item = colocada.item;
      var ub = colocada.punto;
      var el = document.createElement('a-entity');
      el.classList.add('interactuable', 'obra-interactiva');
      el.setAttribute('position', ub.position.x + ' ' + ub.position.y + ' ' + ub.position.z);
      var e = new THREE.Euler().setFromQuaternion(ub.quaternion, 'YXZ');
      el.setAttribute('rotation',
        THREE.MathUtils.radToDeg(e.x) + ' ' + THREE.MathUtils.radToDeg(e.y) + ' ' + THREE.MathUtils.radToDeg(e.z));
      el.setAttribute('scale', '0.001 0.001 0.001');
      el.setAttribute('obra-cuadro', '');
      el.__obra = {
        item: item, indice: index, punto: ub.nombre, caja: ub.caja || null,
        seccion: ub.seccion || 1, tipoPunto: ub.tipo || 'cuadro', ordenPunto: ub.orden != null ? ub.orden : index
      };
      el.dataset.punto = ub.nombre;
      if (DEPURAR) {
        var etiqueta = document.createElement('a-text');
        var altoCaja = ub.caja ? ub.caja.h : CONFIG.altoMax + 0.7;
        etiqueta.setAttribute('value', '#' + (colocada.numero || index + 1) + '  ' + claveNombre(ub.nombre));
        etiqueta.setAttribute('align', 'center');
        etiqueta.setAttribute('color', PALETA.acento);
        etiqueta.setAttribute('width', 6);
        etiqueta.setAttribute('position', '0 ' + (altoCaja / 2 + 0.9) + ' 0.1');
        el.appendChild(etiqueta);
      }
      contenedor.appendChild(el);
      Museo.obras.push(el);

      var promesa = enCola(function () {
        return esVideo(item) ? cargarMiniaturaVideo(item) : cargarTextura(item.url);
      });
      Promise.all([promesa, fuentesListas]).then(function (res) {
        if (!el.parentNode) return;
        var construir = function () {
          construirCuadro(el, item, res[0].tex, res[0].ratio, ub.caja || null);
          var partes = el.components['obra-cuadro'] && el.components['obra-cuadro'].partes;
          subirGPU(partes ? partes.texturas.slice() : []).then(function () {
            el.setAttribute('animation__entrada', {
              property: 'scale', from: '0.001 0.001 0.001', to: '1 1 1',
              dur: 900, delay: Math.min(index, 8) * CONFIG.retrasoEntrada, easing: 'easeOutBack'
            });
          });
        };
        if (el.hasLoaded) construir(); else el.addEventListener('loaded', construir, { once: true });
      });
    });
  }

  /* ======================================================================
     MODAL
     ====================================================================== */
  var DOM = null;

  function crearModal() {
    if (DOM) return DOM;
    var overlay = document.createElement('div');
    overlay.className = 'mm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'mm-titulo');
    overlay.innerHTML = `
      <article class="mm-card">
        <button class="mm-cerrar" type="button" aria-label="Cerrar ficha">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <figure class="mm-media">
          <button class="mm-img-btn" type="button" aria-label="Ver imagen en pantalla completa">
            <img class="mm-img is-cargando" alt="">
          </button>
          <video class="mm-video" controls playsinline preload="metadata" hidden></video>
          <div class="mm-yt" hidden></div>
          <span class="mm-contador"></span>
          <button class="mm-zoom-btn" type="button">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M1 5V1h4M13 5V1H9M1 9v4h4M13 9v4H9" fill="none" stroke="currentColor" stroke-width="1.6"/>
            </svg>
            Ampliar
          </button>
        </figure>
        <div class="mm-info">
          <header class="mm-cabecera">
            <p class="mm-sala"></p>
            <div class="mm-etiquetas"><span class="mm-tipo"></span><span class="mm-lectura" hidden></span></div>
            <h2 class="mm-titulo" id="mm-titulo"></h2>
            <p class="mm-rol" hidden></p>
            <div class="mm-anio"><span class="mm-anio__num"></span><span class="mm-anio__txt">Año de registro</span></div>
          </header>
          <div class="mm-progreso" aria-hidden="true"><span></span></div>
          <div class="mm-cuerpo" tabindex="0" aria-label="Texto de la ficha">
          <h3 class="mm-desc-titulo" hidden>Semblanza</h3>
          <blockquote class="mm-cita" hidden></blockquote>
          <div class="mm-desc"></div>
          <button type="button" class="mm-leer" hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 10v4h3l4 4V6l-4 4H4Z" fill="currentColor"/>
              <path d="M15.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            <span>Escuchar ficha</span>
          </button>
          <dl class="mm-datos"></dl>
          <div class="mm-audio">
            <p>Escucha el testimonio</p>
            <audio controls preload="none"></audio>
          </div>
          <p class="mm-fin" aria-hidden="true">✦</p>
          </div>
          <button type="button" class="mm-seguir" tabindex="-1" aria-hidden="true">
            Sigue leyendo
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="mm-pie">
            <p class="mm-institucion"></p>
            <div class="mm-nav">
              <button type="button" class="mm-prev">Anterior</button>
              <button type="button" class="mm-next">Siguiente</button>
            </div>
          </div>
        </div>
      </article>`;
    document.body.appendChild(overlay);

    var zoom = document.createElement('div');
    zoom.className = 'mm-zoom';
    zoom.setAttribute('role', 'dialog');
    zoom.setAttribute('aria-label', 'Imagen ampliada');
    zoom.innerHTML = '<img alt="">';
    document.body.appendChild(zoom);

    DOM = {
      overlay: overlay, card: overlay.querySelector('.mm-card'),
      img: overlay.querySelector('.mm-img'), imgBtn: overlay.querySelector('.mm-img-btn'),
      video: overlay.querySelector('.mm-video'),
      yt: overlay.querySelector('.mm-yt'),
      contador: overlay.querySelector('.mm-contador'), zoomBtn: overlay.querySelector('.mm-zoom-btn'),
      sala: overlay.querySelector('.mm-sala'), titulo: overlay.querySelector('.mm-titulo'),
      anioBox: overlay.querySelector('.mm-anio'), anio: overlay.querySelector('.mm-anio__num'),
      desc: overlay.querySelector('.mm-desc'), datos: overlay.querySelector('.mm-datos'),
      audioBox: overlay.querySelector('.mm-audio'), audio: overlay.querySelector('audio'),
      institucion: overlay.querySelector('.mm-institucion'),
      prev: overlay.querySelector('.mm-prev'), next: overlay.querySelector('.mm-next'),
      cerrar: overlay.querySelector('.mm-cerrar'),
      leer: overlay.querySelector('.mm-leer'),
      tipo: overlay.querySelector('.mm-tipo'),
      rol: overlay.querySelector('.mm-rol'),
      descTitulo: overlay.querySelector('.mm-desc-titulo'),
      cuerpo: overlay.querySelector('.mm-cuerpo'),
      progreso: overlay.querySelector('.mm-progreso span'),
      seguir: overlay.querySelector('.mm-seguir'),
      cita: overlay.querySelector('.mm-cita'),
      lectura: overlay.querySelector('.mm-lectura'),
      zoom: zoom, zoomImg: zoom.querySelector('img')
    };

    DOM.cerrar.addEventListener('click', cerrarModal);
    DOM.cuerpo.addEventListener('scroll', actualizarScroll, { passive: true });
    DOM.card.addEventListener('scroll', actualizarScroll, { passive: true });
    window.addEventListener('resize', function () { if (Museo.abierto) actualizarScroll(); });
    DOM.seguir.addEventListener('click', function () {
      var s = scrollFicha();
      s.scrollBy({ top: s.clientHeight * 0.7, behavior: 'smooth' });
    });
    DOM.leer.hidden = !A11Y.audio || !('speechSynthesis' in window);
    DOM.leer.addEventListener('click', function () {
      if (window.speechSynthesis && speechSynthesis.speaking) callarFicha();
      else leerFicha(Museo.items[Museo.indice]);
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) cerrarModal(); });
    DOM.prev.addEventListener('click', function () { navegar(-1); });
    DOM.next.addEventListener('click', function () { navegar(1); });
    DOM.imgBtn.addEventListener('click', abrirZoom);
    DOM.zoomBtn.addEventListener('click', abrirZoom);
    zoom.addEventListener('click', cerrarZoom);

    // Deslizar en la foto para cambiar de obra (móvil)
    var x0 = null;
    DOM.card.querySelector('.mm-media').addEventListener('touchstart', function (e) {
      x0 = e.target.closest('video') ? null : e.touches[0].clientX;
    }, { passive: true });
    DOM.card.querySelector('.mm-media').addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 60) navegar(dx < 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      if (!Museo.abierto) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (DOM.zoom.classList.contains('is-visible')) cerrarZoom(); else cerrarModal();
      } else if (e.key === 'ArrowRight') { navegar(1); }
      else if (e.key === 'ArrowLeft') { navegar(-1); }
      else if (e.key === 'Tab') { atraparFoco(e); }
    });
    return DOM;
  }

  function atraparFoco(e) {
    var foco = Array.prototype.filter.call(
      DOM.card.querySelectorAll('button, audio, video, iframe, [href], [tabindex]:not([tabindex="-1"])'),
      function (n) { return !n.disabled && n.offsetParent !== null; });
    if (!foco.length) return;
    var primero = foco[0], ultimo = foco[foco.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }

  function agregarDato(etiqueta, valor) {
    if (!limpiarTexto(valor)) return;
    var dt = document.createElement('dt'); dt.textContent = etiqueta;
    var dd = document.createElement('dd'); dd.textContent = limpiarTexto(valor);
    DOM.datos.appendChild(dt); DOM.datos.appendChild(dd);
  }

  // En celular vertical toda la tarjeta hace scroll; en lo demás, solo el texto
  function scrollFicha() {
    return getComputedStyle(DOM.cuerpo).overflowY === 'visible' ? DOM.card : DOM.cuerpo;
  }

  // Indicadores de lectura: barra de progreso, desvanecidos y "Sigue leyendo"
  var rafScroll = 0;
  function actualizarScroll() {
    if (rafScroll) return;
    rafScroll = requestAnimationFrame(function () {
      rafScroll = 0;
      var c = scrollFicha(), max = c.scrollHeight - c.clientHeight;
      var hay = max > 8, p = hay ? Math.min(1, c.scrollTop / max) : 1;
      DOM.progreso.style.transform = 'scaleX(' + p + ')';
      DOM.progreso.parentNode.classList.toggle('is-activo', hay);
      DOM.cuerpo.classList.toggle('hay-arriba', hay && c === DOM.cuerpo && c.scrollTop > 4);
      DOM.cuerpo.classList.toggle('hay-abajo', hay && c === DOM.cuerpo && c.scrollTop < max - 4);
      DOM.seguir.classList.toggle('is-visible', hay && c.scrollTop < 40);
    });
  }

  // Divide el texto en párrafos (línea en blanco o salto de línea) o acepta un arreglo
  function pintarParrafos(contenedor, texto, vacio) {
    contenedor.innerHTML = '';
    var partes = Array.isArray(texto) ? texto : String(texto || '').split(/\n+/);
    partes = partes.map(limpiarTexto).filter(Boolean);
    if (!partes.length) partes = [vacio];
    partes.forEach(function (t) {
      var p = document.createElement('p');
      p.textContent = t;
      contenedor.appendChild(p);
    });
    return partes.join(' ');
  }

  function mostrarObra(indice) {
    var item = Museo.items[indice];
    if (!item) return;
    Museo.indice = indice;

    detenerVideo();
    var personaje = esPersonaje(item);
    var video = !personaje && esVideo(item);
    DOM.card.classList.toggle('es-personaje', personaje);
    DOM.tipo.textContent = personaje ? 'Personaje' : (video ? 'Video' : 'Fotografía');
    DOM.rol.textContent = personaje ? limpiarTexto(item.rol) : '';
    DOM.rol.hidden = !DOM.rol.textContent;
    DOM.descTitulo.hidden = !personaje;
    DOM.imgBtn.setAttribute('aria-label', personaje ? 'Ver retrato en pantalla completa' : 'Ver imagen en pantalla completa');
    DOM.imgBtn.hidden = video;
    DOM.zoomBtn.hidden = video;          // el video ya trae su botón de pantalla completa
    var yt = video ? datosYouTube(item.url) : null;
    DOM.video.hidden = !video || !!yt;
    DOM.yt.hidden = !yt;

    if (yt) {
      var params = 'autoplay=1&rel=0&modestbranding=1&playsinline=1' + (yt.inicio ? '&start=' + yt.inicio : '');
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + yt.id + '?' + params;
      iframe.title = limpiarTexto(item.titulo) || 'Video';
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';   // YouTube lo exige (evita el error 153)
      DOM.yt.classList.toggle('is-vertical', yt.vertical);
      DOM.yt.appendChild(iframe);
    } else if (video) {
      var poster = item.miniatura || item.__poster || '';
      if (poster) DOM.video.poster = poster; else DOM.video.removeAttribute('poster');
      DOM.video.src = item.url;
      DOM.video.setAttribute('aria-label', limpiarTexto(item.titulo));
      // Se abrió con un clic/toque, así que el navegador permite reproducir con sonido
      var reproducir = DOM.video.play();
      if (reproducir && reproducir.catch) reproducir.catch(function () {});
    } else {
      DOM.img.classList.add('is-cargando');
      DOM.img.onload = function () { DOM.img.classList.remove('is-cargando'); };
      DOM.img.onerror = function () { DOM.img.classList.remove('is-cargando'); };
      DOM.img.src = item.url;
      DOM.img.alt = limpiarTexto(item.titulo);
      if (DOM.img.complete && DOM.img.naturalWidth) requestAnimationFrame(function () { DOM.img.classList.remove('is-cargando'); });
    }

    var sala = Museo.sala;
    DOM.sala.textContent = sala ? 'Sala ' + numeroSala(sala.id) + ', ' + limpiarTexto(sala.nombre) : '';
    DOM.titulo.textContent = limpiarTexto(item.titulo) || 'Sin título';

    var anio = limpiarTexto(item.anio);
    DOM.anioBox.hidden = !anio;
    DOM.anio.textContent = anio;

    var textoPlano = pintarParrafos(DOM.desc, item.descripcion,
      personaje ? 'Semblanza en preparación.' : 'Sin descripción disponible para esta obra.');
    var palabras = textoPlano.split(/\s+/).length;
    DOM.lectura.hidden = !personaje || palabras < 60;
    DOM.lectura.textContent = 'Lectura de ' + Math.max(1, Math.round(palabras / 200)) + ' min';
    DOM.cita.hidden = !personaje || !limpiarTexto(item.cita);
    DOM.cita.textContent = limpiarTexto(item.cita);
    DOM.cuerpo.scrollTop = 0;
    DOM.card.scrollTop = 0;
    requestAnimationFrame(actualizarScroll);
    DOM.anioBox.querySelector('.mm-anio__txt').textContent = personaje ? 'Vida'
      : video ? 'Año de registro' + (item.__duracion ? ', duración ' + item.__duracion : '') : 'Año de registro';

    DOM.datos.innerHTML = '';
    if (personaje) {
      agregarDato('Nacimiento', item.nacimiento);
      agregarDato('Origen', item.origen);
      agregarDato('Autor de la foto', item.autor);
    } else {
      agregarDato('Autor', item.autor);
    }
    agregarDato('Lugar', item.lugar);
    agregarDato('Técnica', item.tecnica);
    agregarDato('Fuente', item.fuente);
    DOM.datos.hidden = !DOM.datos.children.length;

    DOM.audio.pause();
    if (item.audioUrl) {
      DOM.audio.src = item.audioUrl;
      DOM.audioBox.hidden = false;
    } else {
      DOM.audio.removeAttribute('src');
      DOM.audioBox.hidden = true;
    }

    var total = Museo.items.length;
    DOM.contador.textContent = String(indice + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
    DOM.contador.hidden = total < 2;
    DOM.prev.disabled = indice <= 0;
    DOM.next.disabled = indice >= total - 1;
    DOM.prev.parentNode.hidden = total < 2;

    var datos = window.museoData || {};
    DOM.institucion.textContent = limpiarTexto(datos.institucion);

    callarFicha();
    if (A11Y.audio && !video) leerFicha(item);

    // Precargar la siguiente
    var sig = Museo.items[indice + 1];
    if (sig) {
      var src = esVideo(sig) ? (sig.miniatura || '') : sig.url;
      if (src) { var pre = new Image(); pre.src = src; }
    }
  }

  function callarFicha() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (DOM && DOM.leer) DOM.leer.querySelector('span').textContent = 'Escuchar ficha';
  }

  function leerFicha(item) {
    if (!item || !window.speechSynthesis) return;
    callarFicha();
    var personaje = esPersonaje(item);
    var partes = [(personaje ? 'Semblanza de ' : '') + limpiarTexto(item.titulo)];
    if (personaje && limpiarTexto(item.rol)) partes.push(limpiarTexto(item.rol));
    if (limpiarTexto(item.anio)) partes.push((personaje ? 'Vida: ' : 'Año: ') + limpiarTexto(item.anio));
    if (esVideo(item)) partes.push('Video' + (item.__duracion ? ', duración ' + item.__duracion : ''));
    if (limpiarTexto(item.cita)) partes.push(limpiarTexto(item.cita));
    partes.push(limpiarTexto(Array.isArray(item.descripcion) ? item.descripcion.join(' ') : item.descripcion));
    ['autor', 'lugar', 'tecnica', 'fuente'].forEach(function (k) {
      if (limpiarTexto(item[k])) partes.push(({ autor: 'Autor', lugar: 'Lugar', tecnica: 'Técnica', fuente: 'Fuente' })[k] + ': ' + limpiarTexto(item[k]));
    });
    var voz = new SpeechSynthesisUtterance(partes.filter(Boolean).join('. '));
    voz.lang = 'es-MX';
    voz.rate = 0.95;
    voz.onend = function () { if (DOM && DOM.leer) DOM.leer.querySelector('span').textContent = 'Escuchar ficha'; };
    speechSynthesis.speak(voz);
    if (DOM && DOM.leer) DOM.leer.querySelector('span').textContent = 'Detener lectura';
  }

  function detenerVideo() {
    if (!DOM || !DOM.video) return;
    if (DOM.yt) DOM.yt.innerHTML = '';     // quitar el iframe detiene el video de YouTube
    DOM.video.pause();
    if (DOM.video.getAttribute('src')) {
      DOM.video.removeAttribute('src');
      DOM.video.load();                  // corta la descarga del video anterior
    }
  }

  function navegar(paso) {
    var nuevo = Museo.indice + paso;
    if (nuevo < 0 || nuevo >= Museo.items.length) return;
    cerrarZoom();
    mostrarObra(nuevo);
  }

  function abrirZoom() {
    DOM.zoomImg.src = DOM.img.src;
    DOM.zoomImg.alt = DOM.img.alt;
    DOM.zoom.classList.add('is-visible');
  }

  function cerrarZoom() {
    if (DOM) DOM.zoom.classList.remove('is-visible');
  }

  // La escena queda congelada detrás del modal: la GPU se dedica al video
  function pausarRender(pausar) {
    var escena = document.querySelector('a-scene');
    if (!escena || !escena.renderer) return;
    if (escena.systems.rendimiento) {
      escena.emit('museo-render', { pausado: pausar });
    } else if (!escena.is('vr-mode')) {
      escena.renderer.setAnimationLoop(pausar ? null : escena.render);
    }
  }

  /* ======================================================================
     PANEL DE ACCESIBILIDAD DENTRO DEL MUSEO
     Mismo botón, mismo menú y misma lógica que tu app.js, guardando en la
     misma clave ("focine-a11y"): lo que se cambie aquí también queda
     activado al volver al sitio, y al revés.
     Si ya pegaste el HTML del panel en la página, se usa ese; si no, se crea.
     ====================================================================== */
  var PANEL_A11Y_HTML = `<button class="a11y-launcher" id="a11yLauncher" aria-haspopup="true" aria-expanded="false" aria-controls="a11yPanel"
    aria-label="Abrir herramientas de accesibilidad">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="5" r="2.1" fill="#D4A017" />
      <path d="M12 8.2c-3.2 0-5.8.9-5.8 2v1.1c0 .5.4.9.9.9h2.2l.6 8.3c.05.6.55 1 1.1 1s1.05-.4 1.1-1l.4-5.6h.6l.4 5.6c.05.6.55 1 1.1 1s1.05-.4 1.1-1l.6-8.3h2.2c.5 0 .9-.4.9-.9V10.2c0-1.1-2.6-2-5.8-2Z" fill="#BDBDBD" />
    </svg>
  </button>
  <div class="a11y-panel" id="a11yPanel" role="dialog" aria-modal="true" aria-label="Menú de accesibilidad">
    <div class="a11y-header">
      <h2>Menú de accesibilidad</h2>
      <button class="a11y-close" id="a11yClose" aria-label="Cerrar menú de accesibilidad">&times;</button>
    </div>
    <div class="a11y-body">
      <div class="a11y-status" id="a11yStatus">
        <span class="a11y-status-dot" aria-hidden="true"></span>
        <span id="a11yStatusText">Ningún perfil activado</span>
      </div>
      <div class="a11y-section-label">Perfiles rápidos</div>
      <div class="a11y-profiles" role="group" aria-label="Perfiles rápidos de accesibilidad">
        <button type="button" class="profile-chip" id="profileMotora" data-profile="motora">
          <span class="profile-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="4.5" r="2" fill="currentColor" /><path d="M12 8c-2.6 0-5 .7-5 1.7v1c0 .4.3.7.7.7h1.9l.5 7.3c0 .5.5.9 1 .9s.9-.4.9-.9l.3-5h.4l.3 5c0 .5.5.9 1 .9s.9-.4.9-.9l.5-7.3H16c.4 0 .7-.3.7-.7v-1C16.7 8.7 14.6 8 12 8Z" fill="currentColor" /></svg></span>
          <span class="profile-label">Discapacidad motora</span>
          <span class="profile-check" aria-hidden="true">&check;</span>
        </button>
        <button type="button" class="profile-chip" id="profileCeguera" data-profile="ceguera">
          <span class="profile-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M3 12c1.8-3.6 5.2-6 9-6s7.2 2.4 9 6c-1.8 3.6-5.2 6-9 6s-7.2-2.4-9-6Z" stroke="currentColor" stroke-width="1.6" /><circle cx="12" cy="12" r="2.4" fill="currentColor" /></svg></span>
          <span class="profile-label">Ceguera</span>
          <span class="profile-check" aria-hidden="true">&check;</span>
        </button>
        <button type="button" class="profile-chip" id="profileDaltonismo" data-profile="daltonismo">
          <span class="profile-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3c3 4 6 7.2 6 10.5A6 6 0 0 1 6 13.5C6 10.2 9 7 12 3Z" stroke="currentColor" stroke-width="1.6" /></svg></span>
          <span class="profile-label">Daltonismo</span>
          <span class="profile-check" aria-hidden="true">&check;</span>
        </button>
        <button type="button" class="profile-chip" id="profileDislexia" data-profile="dislexia">
          <span class="profile-icon" aria-hidden="true">Df</span>
          <span class="profile-label">Dislexia</span>
          <span class="profile-check" aria-hidden="true">&check;</span>
        </button>
      </div>
      <hr class="a11y-divider">
      <div class="a11y-section-label">Ajustes individuales</div>
      <div class="a11y-grid">
        <button type="button" class="a11y-card" id="cardAudio" data-toggle="audio" aria-pressed="false">
          <span class="card-badge" aria-hidden="true">i</span><span class="card-check" aria-hidden="true">&check;</span>
          <span class="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 10v4h3l4 4V6l-4 4H4Z" fill="currentColor" /><path d="M15.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /><path d="M18 6.5a8.5 8.5 0 0 1 0 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".6" /></svg></span>
          <span class="card-label">Lector de pantalla</span>
        </button>
        <button type="button" class="a11y-card" id="cardContrasteAlto" data-contrast-option="alto" aria-pressed="false">
          <span class="card-check" aria-hidden="true">&check;</span>
          <span class="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" /><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" /></svg></span>
          <span class="card-label">Contraste +</span>
        </button>
        <button type="button" class="a11y-card" id="cardContrasteOscuro" data-contrast-option="oscuro" aria-pressed="false">
          <span class="card-check" aria-hidden="true">&check;</span>
          <span class="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" fill="currentColor" /></svg></span>
          <span class="card-label">Modo oscuro</span>
        </button>
        <button type="button" class="a11y-card" id="cardSaturacion" data-toggle="saturacion" aria-pressed="false">
          <span class="card-check" aria-hidden="true">&check;</span>
          <span class="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3c2.8 3.8 5.5 6.9 5.5 10a5.5 5.5 0 1 1-11 0C6.5 9.9 9.2 6.8 12 3Z" stroke="currentColor" stroke-width="1.6" /></svg></span>
          <span class="card-label">Saturación</span>
        </button>
        <button type="button" class="a11y-card" id="cardTipografia" data-expand="tipografia" aria-expanded="false">
          <span class="card-check" aria-hidden="true">&check;</span>
          <span class="card-icon" aria-hidden="true">T T</span>
          <span class="card-label">Tipografía</span>
        </button>
        <button type="button" class="a11y-card" id="cardZoom" data-toggle="zoom" aria-pressed="false">
          <span class="card-check" aria-hidden="true">&check;</span>
          <span class="card-icon" aria-hidden="true">A+</span>
          <span class="card-label">Texto más grande</span>
        </button>
        <button type="button" class="a11y-card" id="cardEspaciado" data-toggle="espaciado" aria-pressed="false">
          <span class="card-check" aria-hidden="true">&check;</span>
          <span class="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
          <span class="card-label">Espaciado de texto</span>
        </button>
        <button type="button" class="a11y-card" id="cardCursor" data-expand="cursor" aria-expanded="false">
          <span class="card-check" aria-hidden="true">&check;</span>
          <span class="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 8.5-6.2.9L16 19l-2.6 1.1-3.2-6.6L5 17V3Z" /></svg></span>
          <span class="card-label">Cursor</span>
        </button>
        <button type="button" class="a11y-card" id="cardResaltado" data-toggle="resaltado" aria-pressed="false">
          <span class="card-check" aria-hidden="true">&check;</span>
          <span class="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="14" width="16" height="6" rx="1" fill="currentColor" opacity=".35" /><path d="M8 14l6-9 3 2-6 9-4 1 1-3Z" fill="currentColor" /></svg></span>
          <span class="card-label">Resaltado de texto</span>
        </button>
      </div>
      <div class="a11y-subpanel" id="subpanelDaltonismo" data-subpanel="daltonismo" hidden>
        <span class="a11y-subpanel-label">Tipo de daltonismo</span>
        <div class="a11y-chip-row" role="group" aria-label="Tipo de ajuste de color">
          <button type="button" class="a11y-chip" data-color-blind="none">Estándar</button>
          <button type="button" class="a11y-chip" data-color-blind="protanopia">Protanopia</button>
          <button type="button" class="a11y-chip" data-color-blind="deuteranopia">Deuteranopia</button>
          <button type="button" class="a11y-chip" data-color-blind="tritanopia">Tritanopia</button>
          <button type="button" class="a11y-chip" data-color-blind="achromatopsia">Monocromía</button>
        </div>
      </div>
      <div class="a11y-subpanel" id="subpanelTipografia" data-subpanel="tipografia" hidden>
        <span class="a11y-subpanel-label">Familia tipográfica</span>
        <div class="a11y-chip-row" role="group" aria-label="Familia tipográfica">
          <button type="button" class="a11y-chip" data-font="default">Estándar</button>
          <button type="button" class="a11y-chip" data-font="opendyslexic">OpenDyslexic</button>
          <button type="button" class="a11y-chip" data-font="sans">Sans-serif</button>
          <button type="button" class="a11y-chip" data-font="serif">Serif clásica</button>
        </div>
      </div>
      <div class="a11y-subpanel" id="subpanelCursor" data-subpanel="cursor" hidden>
        <span class="a11y-subpanel-label">Tamaño de la flecha</span>
        <div class="a11y-chip-row" role="group" aria-label="Tamaño del cursor">
          <button type="button" class="a11y-chip" data-cursor="normal">Normal</button>
          <button type="button" class="a11y-chip" data-cursor="grande">Grande</button>
          <button type="button" class="a11y-chip" data-cursor="extragrande">Extragrande</button>
        </div>
      </div>
      <button type="button" class="a11y-reset" id="a11yReset">Restablecer todos los ajustes</button>
    </div>
  </div>
`;

  function crearPanelA11y() {
    if (!document.getElementById('a11yLauncher')) {
      var cont = document.createElement('div');
      cont.innerHTML = PANEL_A11Y_HTML;
      while (cont.firstChild) document.body.appendChild(cont.firstChild);
    }
    var $ = function (id) { return document.getElementById(id); };
    var launcher = $('a11yLauncher'), panel = $('a11yPanel');
    if (!launcher || !panel) return;

    var base = {
      audio: false, contrasteAlto: false, contrasteOscuro: false, saturacion: false,
      zoom: false, espaciado: false, resaltado: false,
      colorBlind: 'none', font: 'default', cursor: 'normal',
      tipografiaOpen: false, cursorOpen: false,
      profiles: { motora: false, ceguera: false, daltonismo: false, dislexia: false }
    };
    function cargar() {
      var s = null, m = JSON.parse(JSON.stringify(base));
      try { s = JSON.parse(localStorage.getItem(CLAVE_A11Y)); } catch (e) {}
      if (s && typeof s === 'object') {
        for (var k in base) {
          if (k === 'profiles' && s.profiles) {
            for (var p in base.profiles) if (typeof s.profiles[p] === 'boolean') m.profiles[p] = s.profiles[p];
          } else if (k in s) m[k] = s[k];
        }
      }
      return m;
    }
    var estado = cargar();
    var daltonismoAbierto = estado.colorBlind !== 'none';

    var tarjetas = { audio: $('cardAudio'), saturacion: $('cardSaturacion'), zoom: $('cardZoom'), espaciado: $('cardEspaciado'), resaltado: $('cardResaltado') };
    var contraste = { alto: $('cardContrasteAlto'), oscuro: $('cardContrasteOscuro') };
    var expandir = { tipografia: $('cardTipografia'), cursor: $('cardCursor') };
    var subpaneles = { daltonismo: $('subpanelDaltonismo'), tipografia: $('subpanelTipografia'), cursor: $('subpanelCursor') };
    var perfiles = { motora: $('profileMotora'), ceguera: $('profileCeguera'), daltonismo: $('profileDaltonismo'), dislexia: $('profileDislexia') };
    var chipsColor = panel.querySelectorAll('[data-color-blind]');
    var chipsFuente = panel.querySelectorAll('[data-font]');
    var chipsCursor = panel.querySelectorAll('[data-cursor]');
    var presionado = function (el, si) { if (el) el.setAttribute('aria-pressed', si ? 'true' : 'false'); };

    function pintar(guardar) {
      for (var k in tarjetas) presionado(tarjetas[k], estado[k]);
      presionado(contraste.alto, estado.contrasteAlto);
      presionado(contraste.oscuro, estado.contrasteOscuro);
      chipsColor.forEach(function (c) { presionado(c, c.getAttribute('data-color-blind') === estado.colorBlind); });
      chipsFuente.forEach(function (c) { presionado(c, c.getAttribute('data-font') === estado.font); });
      chipsCursor.forEach(function (c) { presionado(c, c.getAttribute('data-cursor') === estado.cursor); });
      expandir.tipografia.setAttribute('aria-expanded', estado.tipografiaOpen ? 'true' : 'false');
      expandir.cursor.setAttribute('aria-expanded', estado.cursorOpen ? 'true' : 'false');
      subpaneles.tipografia.hidden = !estado.tipografiaOpen;
      subpaneles.cursor.hidden = !estado.cursorOpen;
      subpaneles.daltonismo.hidden = !daltonismoAbierto;
      for (var p in perfiles) presionado(perfiles[p], estado.profiles[p]);

      var activo = estado.audio || estado.contrasteAlto || estado.contrasteOscuro || estado.saturacion ||
        estado.zoom || estado.espaciado || estado.resaltado || estado.colorBlind !== 'none' ||
        estado.font !== 'default' || estado.cursor !== 'normal';
      $('a11yStatus').classList.toggle('has-active', activo);
      $('a11yStatusText').textContent = activo ? 'Ajustes de accesibilidad activos' : 'Ningún perfil activado';

      if (guardar !== false) {
        try { localStorage.setItem(CLAVE_A11Y, JSON.stringify(estado)); } catch (e) {}
        aplicarA11y();          // aplica clases, filtros, mira 3D y lector en el museo
      }
    }

    // Abrir / cerrar (el recorrido se pausa mientras el menú está abierto)
    function abrir() {
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
      panel.classList.add('open');
      launcher.setAttribute('aria-expanded', 'true');
      pausarJugador(true);
      var primero = panel.querySelector('button');
      if (primero) primero.focus();
    }
    function cerrar() {
      if (!panel.classList.contains('open')) return;
      panel.classList.remove('open');
      launcher.setAttribute('aria-expanded', 'false');
      if (!Museo.abierto) pausarJugador(false);
      launcher.focus();
    }
    launcher.addEventListener('click', function () { panel.classList.contains('open') ? cerrar() : abrir(); });
    $('a11yClose').addEventListener('click', cerrar);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) { e.stopPropagation(); cerrar(); }
    }, true);
    document.addEventListener('click', function (e) {
      if (panel.classList.contains('open') && !panel.contains(e.target) && !launcher.contains(e.target)) cerrar();
    }, true);
    // Que los clics del menú no lleguen al 3D (no capturan el mouse ni abren obras)
    [launcher, panel].forEach(function (el) {
      el.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      el.addEventListener('touchend', function (e) { e.stopPropagation(); });
    });

    Object.keys(tarjetas).forEach(function (k) {
      tarjetas[k].addEventListener('click', function () { estado[k] = !estado[k]; pintar(); });
    });
    contraste.alto.addEventListener('click', function () { estado.contrasteAlto = !estado.contrasteAlto; pintar(); });
    contraste.oscuro.addEventListener('click', function () { estado.contrasteOscuro = !estado.contrasteOscuro; pintar(); });
    expandir.tipografia.addEventListener('click', function () {
      estado.tipografiaOpen = !estado.tipografiaOpen;
      if (estado.tipografiaOpen) estado.cursorOpen = false;
      pintar();
    });
    expandir.cursor.addEventListener('click', function () {
      estado.cursorOpen = !estado.cursorOpen;
      if (estado.cursorOpen) estado.tipografiaOpen = false;
      pintar();
    });
    chipsColor.forEach(function (c) { c.addEventListener('click', function () { estado.colorBlind = c.getAttribute('data-color-blind'); daltonismoAbierto = true; pintar(); }); });
    chipsFuente.forEach(function (c) { c.addEventListener('click', function () { estado.font = c.getAttribute('data-font'); pintar(); }); });
    chipsCursor.forEach(function (c) { c.addEventListener('click', function () { estado.cursor = c.getAttribute('data-cursor'); pintar(); }); });

    Object.keys(perfiles).forEach(function (k) {
      perfiles[k].addEventListener('click', function () {
        var encender = !estado.profiles[k];
        estado.profiles[k] = encender;
        if (k === 'ceguera') estado.audio = encender;
        if (k === 'motora') { estado.cursor = encender ? 'grande' : 'normal'; if (encender) estado.espaciado = true; }
        if (k === 'daltonismo') { daltonismoAbierto = encender; if (!encender) estado.colorBlind = 'none'; }
        if (k === 'dislexia') { estado.font = encender ? 'opendyslexic' : 'default'; if (encender) estado.espaciado = true; }
        pintar();
      });
    });

    $('a11yReset').addEventListener('click', function () {
      estado = JSON.parse(JSON.stringify(base));
      daltonismoAbierto = false;
      pintar();
    });

    // Si el sitio cambia los ajustes en otra pestaña, o se vuelve a esta página
    // con "Atrás", el menú muestra lo que está guardado
    var releer = function () { estado = cargar(); daltonismoAbierto = estado.colorBlind !== 'none'; pintar(false); };
    window.addEventListener('storage', function (e) { if (e.key === CLAVE_A11Y) releer(); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) releer(); });

    pintar(false);
  }

  /* ======================================================================
     PROTECCIÓN DE LAS OBRAS
     Dificulta copiar, guardar o capturar las fotos del acervo:
       - Sin clic derecho ("Guardar imagen como", "Copiar imagen"), sin
         arrastrar la imagen y sin menú de pulsación larga en celular.
       - Bloquea Ctrl/Cmd + S, U, P, C (sobre obras) y F12, Ctrl+Shift+I/J/C.
       - Tecla Impr Pant: borra el portapapeles y cubre las obras un instante.
       - Si la ventana pierde el foco (herramienta Recortes, Win+Shift+S,
         cambio de app), las obras de la ficha se difuminan.
       - Al imprimir, la página sale en blanco.
       - Marca de agua con el nombre de la institución sobre la foto.
       - Si se detectan las herramientas de desarrollo abiertas, se cubren
         las obras con un aviso.
     IMPORTANTE: ningún sitio web puede impedir al 100 % una captura (el
     sistema operativo o un celular pueden tomarla igual). Todo esto hace
     que copiar sea difícil y deja claro que el material está protegido.
     ====================================================================== */
  function activarProteccion() {
    if (!CONFIG.proteger) return;
    var html = document.documentElement;

    // --- Estilos ---
    var css = document.createElement('style');
    css.id = 'museo-proteccion';
    css.textContent = `
      .mm-media, .mm-media *, .mm-zoom, .mm-zoom *, a-scene, a-scene canvas, canvas.a-canvas {
        -webkit-user-select: none; user-select: none;
        -webkit-touch-callout: none; -webkit-user-drag: none;
      }
      /* La imagen no recibe el clic: el botón que la envuelve sí (zoom sigue funcionando) */
      .mm-img, .mm-zoom img { pointer-events: none; }
      .mm-img-btn { position: relative; }

      /* Marca de agua */
      .mm-marca {
        position: absolute; inset: 0; pointer-events: none; overflow: hidden; border-radius: inherit; z-index: 2;
        display: flex; align-items: center; justify-content: center;
      }
      .mm-marca span {
        transform: rotate(-24deg); white-space: nowrap;
        font: 600 clamp(0.9rem, 2.2vw, 1.4rem)/1.8 var(--mm-sans, sans-serif); letter-spacing: 0.3em; text-transform: uppercase;
        color: rgba(255, 255, 255, 0.18); text-shadow: 0 0 2px rgba(0, 0, 0, 0.25);
        mix-blend-mode: overlay;
      }
      .mm-marca span + span { display: none; }
      .mm-zoom .mm-marca span { font-size: clamp(1.2rem, 3vw, 2rem); }

      /* Velo: foco perdido, Impr Pant o herramientas de desarrollo */
      html.mm-velo .mm-media img, html.mm-velo .mm-zoom img,
      html.mm-velo .mm-media video, html.mm-velo a-scene canvas {
        filter: blur(28px) brightness(0.6) !important; transition: filter 0.05s linear;
      }
      .mm-bloqueo {
        position: fixed; inset: 0; z-index: 2147483000; display: none;
        align-items: center; justify-content: center; text-align: center; padding: 24px;
        background: var(--mm-media, #1c140b); color: #f4ead0;
        font: 500 1rem/1.5 var(--mm-sans, sans-serif);
      }
      .mm-bloqueo b { display: block; margin-bottom: 8px; font: 600 1.5rem/1.2 var(--mm-serif, serif); color: var(--mm-tezontle, #c9932f); }
      html.mm-devtools .mm-bloqueo { display: flex; }

      @media print {
        html, body { background: #fff !important; }
        body > * { display: none !important; }
        body::after {
          content: "Contenido protegido. La impresión del acervo no está permitida.";
          display: block !important; padding: 40px; font: 16px/1.5 sans-serif; color: #000;
        }
      }
    `;
    document.head.appendChild(css);

    var bloqueo = document.createElement('div');
    bloqueo.className = 'mm-bloqueo';
    bloqueo.setAttribute('role', 'alert');
    bloqueo.innerHTML = '<div><b>Contenido protegido</b>Cierra las herramientas de desarrollo para continuar el recorrido.</div>';
    document.body.appendChild(bloqueo);

    // --- Marca de agua en la ficha y en el zoom ---
    if (CONFIG.marcaDeAgua) {
      var texto = limpiarTexto((window.museoData || {}).institucion) || 'Contenido protegido';
      var marca = function () {
        var m = document.createElement('div');
        m.className = 'mm-marca'; m.setAttribute('aria-hidden', 'true');
        m.innerHTML = '<span></span>';
        m.firstChild.textContent = texto;
        return m;
      };
      var btn = document.querySelector('.mm-img-btn');
      if (btn) btn.appendChild(marca());
      var zoom = document.querySelector('.mm-zoom');
      if (zoom) { zoom.style.position = 'fixed'; zoom.appendChild(marca()); }
    }

    // --- Velo temporal ---
    var tVelo = null;
    function velo(ms) {
      html.classList.add('mm-velo');
      clearTimeout(tVelo);
      if (ms) tVelo = setTimeout(function () { html.classList.remove('mm-velo'); }, ms);
    }
    function quitarVelo() { clearTimeout(tVelo); html.classList.remove('mm-velo'); }

    // --- Clic derecho, arrastrar, copiar ---
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); }, true);
    document.addEventListener('dragstart', function (e) {
      if (e.target && (e.target.tagName === 'IMG' || e.target.tagName === 'CANVAS' || e.target.tagName === 'VIDEO')) e.preventDefault();
    }, true);
    document.addEventListener('copy', function (e) {
      var sel = window.getSelection && String(window.getSelection());
      if (!sel || Museo.abierto) { e.preventDefault(); if (e.clipboardData) e.clipboardData.setData('text/plain', ''); }
    }, true);

    // --- Teclas ---
    document.addEventListener('keydown', function (e) {
      var k = (e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey;
      var bloquear =
        e.key === 'F12' ||
        (mod && e.shiftKey && (k === 'i' || k === 'j' || k === 'c' || k === 'k')) ||   // herramientas de desarrollo
        (e.metaKey && e.altKey && (k === 'i' || k === 'j' || k === 'c' || k === 'u')) || // Mac
        (mod && (k === 'u' || k === 's' || k === 'p')) ||                              // ver código, guardar, imprimir
        (mod && k === 'c' && Museo.abierto) ||
        (e.metaKey && e.shiftKey && (k === '3' || k === '4' || k === '5' || k === 's')); // capturas en Mac / Win+Shift+S
      if (bloquear) {
        e.preventDefault(); e.stopPropagation();
        if (k === 's' && e.shiftKey) velo(3000);
        mostrarAviso('Contenido protegido');
      }
    }, true);

    // Impr Pant: el navegador solo avisa al soltar la tecla
    document.addEventListener('keyup', function (e) {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        velo(2500);
        try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(''); } catch (x) {}
        mostrarAviso('Las capturas de pantalla no están permitidas');
      }
    }, true);

    // --- Pérdida de foco (Recortes, Win+Shift+S, cambiar de ventana) ---
    // No se activa si el foco se fue al reproductor de YouTube o si el visitante
    // está caminando con el mouse capturado.
    window.addEventListener('blur', function () {
      setTimeout(function () {
        var act = document.activeElement;
        if (act && act.tagName === 'IFRAME') return;
        if (document.hasFocus()) return;
        if (Museo.abierto) velo(0);
      }, 0);
    });
    window.addEventListener('focus', quitarVelo);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) velo(0); else quitarVelo();
    });

    // --- Herramientas de desarrollo abiertas (acopladas a la ventana) ---
    if (CONFIG.detectarDevTools && !ESTA_TACTIL) {
      var revisar = function () {
        if (!window.outerWidth || !window.innerWidth || !window.innerHeight) return;
        // Se comparan proporciones y no píxeles: el zoom del navegador cambia
        // ancho y alto por igual, en cambio las herramientas acopladas solo
        // "roban" espacio de un lado. Umbrales amplios para no confundir la
        // barra lateral de Edge u otras barras del navegador.
        var rw = window.outerWidth / window.innerWidth;
        var rh = window.outerHeight / window.innerHeight;
        var abiertas = (rw - rh > 0.35) || (rh - rw > 0.5);
        if (abiertas !== html.classList.contains('mm-devtools')) {
          html.classList.toggle('mm-devtools', abiertas);
          if (abiertas) {
            if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
            if (Museo.abierto) cerrarModal();
          }
        }
      };
      window.addEventListener('resize', revisar);
      setInterval(revisar, 1500);
      revisar();
    }
  }

  function pausarJugador(pausar) {
    var jugador = document.getElementById('player');
    if (!jugador) return;
    if (pausar) jugador.pause(); else jugador.play();
  }

  /**
   * Abre la ficha de una obra. Se mantiene la firma original abrirModal(item).
   */
  function abrirModal(item) {
    crearModal();
    var indice = Museo.items.indexOf(item);
    if (indice < 0) { Museo.items = [item]; indice = 0; }

    Museo.abierto = true;
    Museo.focoPrevio = document.activeElement;
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    pausarJugador(true);
    pausarRender(true);
    mostrarObjetivo(null);
    Sonido.barrido();
    Sonido.atenuar(true);

    mostrarObra(indice);
    DOM.overlay.style.display = 'flex';
    DOM.card.scrollTop = 0;                 // ya visible: la ficha empieza desde arriba
    DOM.cuerpo.scrollTop = 0;
    actualizarScroll();
    requestAnimationFrame(function () {
      DOM.overlay.classList.add('is-visible');
      DOM.cerrar.focus({ preventScroll: true });
    });
  }

  /**
   * Cierra la ficha, detiene el audio y devuelve el control al recorrido.
   */
  function cerrarModal() {
    if (!DOM || !Museo.abierto) return;
    Museo.abierto = false;
    Museo.ultimoCierre = performance.now();
    cerrarZoom();
    detenerVideo();
    callarFicha();
    DOM.audio.pause();
    DOM.audio.currentTime = 0;
    DOM.overlay.classList.remove('is-visible');
    pausarRender(false);
    pausarJugador(false);
    Sonido.atenuar(false);
    setTimeout(function () {
      if (!Museo.abierto) DOM.overlay.style.display = 'none';
    }, 320);
    if (Museo.focoPrevio && Museo.focoPrevio.focus) Museo.focoPrevio.focus({ preventScroll: true });
  }

  // Compatibilidad con tu código anterior
  window.abrirModal = abrirModal;
  window.cerrarModal = cerrarModal;

  /* ======================================================================
     ARRANQUE
     ====================================================================== */
  window.addEventListener('DOMContentLoaded', function () {
    var params = new URLSearchParams(window.location.search);
    var salaId = parseInt(params.get('sala'), 10) || 1;

    if (typeof museoData === 'undefined') {
      console.warn('[Museo 3D] La variable global "museoData" no está definida.');
      return;
    }
    var sala = museoData.salas.find(function (s) { return s.id === salaId; });
    if (!sala) {
      console.error('[Museo 3D] No se encontró la sala con ID ' + salaId);
      return;
    }

    Museo.sala = sala;
    Museo.todos = (sala.elementos || []).filter(function (it) { return it && it.url; }).map(normalizarObra);
    Museo.items = Museo.todos.slice();

    inyectarEstilos();
    crearHud(sala);
    crearModal();
    crearPanelA11y();
    activarProteccion();

    var modeloEl = document.getElementById('museo-modelo');
    var escena = document.querySelector('a-scene');
    if (!modeloEl || !escena) return;

    var arrancar = function () {
      mostrarPortada(sala, escena);
      ajustarCamara(escena);
      var atmosfera = function () { try { iniciarAtmosfera(escena); } catch (e) { console.warn('[Museo 3D] Atmósfera no disponible:', e); } };
      if (escena.camera) atmosfera(); else escena.addEventListener('camera-set-active', atmosfera, { once: true });
      configurarEntrada(escena);
      var procesar = function () {
        try { crearCuadros(modeloEl); }
        catch (error) { console.error('[Museo 3D] Error al crear los cuadros:', error); }
      };
      if (modeloEl.getObject3D('mesh')) procesar();
      else modeloEl.addEventListener('model-loaded', procesar, { once: true });
    };
    if (escena.hasLoaded) arrancar(); else escena.addEventListener('loaded', arrancar, { once: true });
  });
})();