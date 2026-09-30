/* ============================================================
           SISTEMA DE ACCESIBILIDAD — idéntico al index.html
           Misma clave de localStorage: los ajustes viajan entre páginas.
           ============================================================ */
(function () {
    "use strict";
    var html = document.documentElement;
    var A11Y_KEY = "focine-a11y";

    var defaultState = {
        audio: false, contrasteAlto: false, contrasteOscuro: false, saturacion: false,
        zoom: false, espaciado: false, resaltado: false, colorBlind: "none",
        font: "default", cursor: "normal", tipografiaOpen: false, cursorOpen: false,
        profiles: { motora: false, ceguera: false, daltonismo: false, dislexia: false }
    };
    var state = loadState();
    function loadState() {
        var s = null;
        try { s = JSON.parse(localStorage.getItem(A11Y_KEY)); } catch (e) { }
        var merged = JSON.parse(JSON.stringify(defaultState));
        if (s && typeof s === "object") {
            for (var k in defaultState) {
                if (k === "profiles" && s.profiles) {
                    for (var p in defaultState.profiles) { if (typeof s.profiles[p] === "boolean") merged.profiles[p] = s.profiles[p]; }
                } else if (k in s) { merged[k] = s[k]; }
            }
        }
        return merged;
    }
    function saveState() { try { localStorage.setItem(A11Y_KEY, JSON.stringify(state)); } catch (e) { } }

    var launcher = document.getElementById("a11yLauncher");
    var panel = document.getElementById("a11yPanel");
    var closeBtn = document.getElementById("a11yClose");
    var statusBox = document.getElementById("a11yStatus");
    var statusText = document.getElementById("a11yStatusText");
    var resetBtn = document.getElementById("a11yReset");

    var toggleCards = {
        audio: document.getElementById("cardAudio"),
        saturacion: document.getElementById("cardSaturacion"),
        zoom: document.getElementById("cardZoom"),
        espaciado: document.getElementById("cardEspaciado"),
        resaltado: document.getElementById("cardResaltado")
    };
    var contrastCards = { alto: document.getElementById("cardContrasteAlto"), oscuro: document.getElementById("cardContrasteOscuro") };
    var expandCards = { tipografia: document.getElementById("cardTipografia"), cursor: document.getElementById("cardCursor") };
    var subpanels = {
        daltonismo: document.getElementById("subpanelDaltonismo"),
        tipografia: document.getElementById("subpanelTipografia"),
        cursor: document.getElementById("subpanelCursor")
    };
    var profileChips = {
        motora: document.getElementById("profileMotora"),
        ceguera: document.getElementById("profileCeguera"),
        daltonismo: document.getElementById("profileDaltonismo"),
        dislexia: document.getElementById("profileDislexia")
    };
    var colorBlindChips = document.querySelectorAll("[data-color-blind]");
    var fontChips = document.querySelectorAll("[data-font]");
    var cursorChips = document.querySelectorAll("[data-cursor]");

    function openPanel() {
        panel.classList.add("open");
        launcher.setAttribute("aria-expanded", "true");
        var firstFocusable = panel.querySelector("button");
        if (firstFocusable) firstFocusable.focus();
        document.addEventListener("keydown", onPanelKeydown);
        document.addEventListener("click", onOutsideClick, true);
    }
    function closePanel() {
        panel.classList.remove("open");
        launcher.setAttribute("aria-expanded", "false");
        document.removeEventListener("keydown", onPanelKeydown);
        document.removeEventListener("click", onOutsideClick, true);
        launcher.focus();
    }
    function onPanelKeydown(e) { if (e.key === "Escape") { closePanel(); } }
    function onOutsideClick(e) {
        if (!panel.contains(e.target) && e.target !== launcher && !launcher.contains(e.target)) { closePanel(); }
    }
    launcher.addEventListener("click", function () { if (panel.classList.contains("open")) closePanel(); else openPanel(); });
    closeBtn.addEventListener("click", closePanel);

    function applyFilters() {
        var filters = [];
        if (state.colorBlind && state.colorBlind !== "none") { filters.push("url(#cb-" + state.colorBlind + ")"); }
        if (state.contrasteAlto) { filters.push("contrast(1.3)"); }
        if (state.saturacion) { filters.push("saturate(1.65)"); }
        html.style.filter = filters.join(" ");
    }
    function applyClass(className, active) { html.classList.toggle(className, !!active); }
    function setPressed(el, pressed) { if (el) el.setAttribute("aria-pressed", pressed ? "true" : "false"); }

    var daltonismoSubpanelForced = false;

    function render() {
        applyClass("a11y-contraste-alto", state.contrasteAlto);
        applyClass("a11y-dark", state.contrasteOscuro);
        applyClass("a11y-zoom", state.zoom);
        applyClass("a11y-espaciado", state.espaciado);
        applyClass("a11y-resaltado", state.resaltado);
        applyClass("a11y-audio-hint", state.audio);
        applyClass("a11y-font-opendyslexic", state.font === "opendyslexic");
        applyClass("a11y-font-sans", state.font === "sans");
        applyClass("a11y-font-serif", state.font === "serif");
        applyClass("a11y-cursor-grande", state.cursor === "grande");
        applyClass("a11y-cursor-extragrande", state.cursor === "extragrande");
        applyFilters();

        setPressed(toggleCards.audio, state.audio);
        setPressed(toggleCards.saturacion, state.saturacion);
        setPressed(toggleCards.zoom, state.zoom);
        setPressed(toggleCards.espaciado, state.espaciado);
        setPressed(toggleCards.resaltado, state.resaltado);
        setPressed(contrastCards.alto, state.contrasteAlto);
        setPressed(contrastCards.oscuro, state.contrasteOscuro);

        colorBlindChips.forEach(function (chip) { chip.setAttribute("aria-pressed", chip.getAttribute("data-color-blind") === state.colorBlind ? "true" : "false"); });
        fontChips.forEach(function (chip) { chip.setAttribute("aria-pressed", chip.getAttribute("data-font") === state.font ? "true" : "false"); });
        cursorChips.forEach(function (chip) { chip.setAttribute("aria-pressed", chip.getAttribute("data-cursor") === state.cursor ? "true" : "false"); });

        expandCards.tipografia.setAttribute("aria-expanded", state.tipografiaOpen ? "true" : "false");
        expandCards.cursor.setAttribute("aria-expanded", state.cursorOpen ? "true" : "false");
        subpanels.tipografia.hidden = !state.tipografiaOpen;
        subpanels.cursor.hidden = !state.cursorOpen;
        subpanels.daltonismo.hidden = !daltonismoSubpanelForced;

        for (var key in profileChips) { setPressed(profileChips[key], state.profiles[key]); }

        var anyActive = state.audio || state.contrasteAlto || state.contrasteOscuro || state.saturacion ||
            state.zoom || state.espaciado || state.resaltado || state.colorBlind !== "none" ||
            state.font !== "default" || state.cursor !== "normal";
        statusBox.classList.toggle("has-active", anyActive);
        statusText.textContent = anyActive ? "Ajustes de accesibilidad activos" : "Ningún perfil activado";
        saveState();
    }

    Object.keys(toggleCards).forEach(function (key) {
        toggleCards[key].addEventListener("click", function () { state[key] = !state[key]; render(); });
    });
    contrastCards.alto.addEventListener("click", function () { state.contrasteAlto = !state.contrasteAlto; render(); });
    contrastCards.oscuro.addEventListener("click", function () { state.contrasteOscuro = !state.contrasteOscuro; render(); });
    expandCards.tipografia.addEventListener("click", function () { state.tipografiaOpen = !state.tipografiaOpen; if (state.tipografiaOpen) state.cursorOpen = false; render(); });
    expandCards.cursor.addEventListener("click", function () { state.cursorOpen = !state.cursorOpen; if (state.cursorOpen) state.tipografiaOpen = false; render(); });
    colorBlindChips.forEach(function (chip) { chip.addEventListener("click", function () { state.colorBlind = chip.getAttribute("data-color-blind"); daltonismoSubpanelForced = true; render(); }); });
    fontChips.forEach(function (chip) { chip.addEventListener("click", function () { state.font = chip.getAttribute("data-font"); render(); }); });
    cursorChips.forEach(function (chip) { chip.addEventListener("click", function () { state.cursor = chip.getAttribute("data-cursor"); render(); }); });

    Object.keys(profileChips).forEach(function (key) {
        profileChips[key].addEventListener("click", function () {
            var turningOn = !state.profiles[key];
            state.profiles[key] = turningOn;
            if (key === "ceguera") { state.audio = turningOn; }
            if (key === "motora") { state.cursor = turningOn ? "grande" : "normal"; if (turningOn) state.espaciado = true; }
            if (key === "daltonismo") { daltonismoSubpanelForced = turningOn; if (!turningOn) { state.colorBlind = "none"; } }
            if (key === "dislexia") { state.font = turningOn ? "opendyslexic" : "default"; if (turningOn) state.espaciado = true; }
            render();
        });
    });

    resetBtn.addEventListener("click", function () { state = JSON.parse(JSON.stringify(defaultState)); daltonismoSubpanelForced = false; render(); });

    daltonismoSubpanelForced = state.colorBlind !== "none";
    render();
})();

/* ============================================================
   RENDERIZADO DE SALAS — tal cual se proporcionó
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const contenedor = document.getElementById('salas-container');
    const searchInput = document.getElementById('searchSalas');
    const clearBtn = document.getElementById('clearSearch');
    const noResultsMsg = document.getElementById('noResults');
    const categoryFiltersContainer = document.getElementById('categoryFilters');
    const timelineContainer = document.getElementById('timelineFilters');
    const favsToggleBtn = document.getElementById('favsToggleBtn');
    const favCountSpan = document.getElementById('favCount');
    const exportFavsBtn = document.getElementById('exportFavsBtn');
    const gridViewBtn = document.getElementById('gridViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    const metricsContainer = document.getElementById('salasMetrics');

    // Elementos del Modal
    const modal = document.getElementById('previewModal');
    const closeModal = document.getElementById('closeModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalDesc = document.getElementById('modalDesc');
    const modalBadge = document.getElementById('modalBadge');
    const modalVisitBtn = document.getElementById('modalVisitBtn');

    // Elementos de Audio
    const audioBtn = document.getElementById('audioAmbientBtn');
    const ambientAudio = document.getElementById('ambientAudio');
    const audioLabel = document.getElementById('audioLabel');

    if (!contenedor || typeof museoData === 'undefined' || !museoData.salas) return;

    let currentFilter = 'all';
    let currentEpoca = 'all';
    let onlyFavorites = false;
    let searchQuery = '';

    const getFavorites = () => JSON.parse(localStorage.getItem('museo_favs') || '[]');
    const getExplored = () => JSON.parse(localStorage.getItem('museo_explored') || '[]');

    const updateFavCount = () => {
        if (favCountSpan) favCountSpan.textContent = getFavorites().length;
    };

    // Renderizar categorías únicas dinámicamente
    const setupCategories = () => {
        const categories = [...new Set(museoData.salas.map(s => s.categoria).filter(Boolean))];
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.dataset.filter = cat;
            btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            categoryFiltersContainer.appendChild(btn);
        });
    };

    window.renderSalas = function () {
        const favorites = getFavorites();
        const explored = getExplored();

        let filtered = museoData.salas.filter(sala => {
            const matchesSearch = sala.nombre.toLowerCase().includes(searchQuery) ||
                sala.descripcion.toLowerCase().includes(searchQuery) ||
                sala.id.toString().includes(searchQuery);
            const matchesCategory = currentFilter === 'all' || sala.categoria === currentFilter;
            const matchesEpoca = currentEpoca === 'all' || sala.epoca === currentEpoca;
            const matchesFav = !onlyFavorites || favorites.includes(sala.id);

            return matchesSearch && matchesCategory && matchesEpoca && matchesFav;
        });

        contenedor.innerHTML = '';
        if (metricsContainer) {
            metricsContainer.textContent = `Mostrando ${filtered.length} de ${museoData.salas.length} salas temáticas indexadas.`;
        }

        if (filtered.length === 0) {
            if (noResultsMsg) noResultsMsg.style.display = 'block';
            return;
        }
        if (noResultsMsg) noResultsMsg.style.display = 'none';

        filtered.forEach(sala => {
            const isFav = favorites.includes(sala.id);
            const isExplored = explored.includes(sala.id);

            const card = document.createElement('div');
            card.className = 'sala-card';
            card.innerHTML = `
                <button class="fav-card-btn ${isFav ? 'is-fav' : ''}" data-id="${sala.id}" title="Favorita">
                    ${isFav ? '⭐' : '☆'}
                </button>
                <div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="badge-sala">Sala 0${sala.id}</span>
                        ${isExplored ? '<span class="badge-explored">Explorada</span>' : ''}
                    </div>
                    <h3>${sala.nombre}</h3>
                    <p>${sala.descripcion}</p>
                </div>
                <div style="display:flex; gap:10px; align-items:center; margin-top:10px;">
                    <button class="preview-card-btn" data-id="${sala.id}">Vista rápida</button>
                    <a href="sala-3d.html?sala=${sala.id}" class="btn-sala" data-id="${sala.id}">Explorar Sala</a>
                </div>
            `;
            contenedor.appendChild(card);
        });

        // Eventos de Favoritos individuales
        contenedor.querySelectorAll('.fav-card-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.dataset.id);
                let favs = getFavorites();
                favs = favs.includes(id) ? favs.filter(i => i !== id) : [...favs, id];
                localStorage.setItem('museo_favs', JSON.stringify(favs));
                updateFavCount();
                window.renderSalas();
            });
        });

        // Eventos de Vista Previa (Modal)
        contenedor.querySelectorAll('.preview-card-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.dataset.id);
                const sala = museoData.salas.find(s => s.id === id);
                if (sala) {
                    modalBadge.textContent = `Sala 0${sala.id}`;
                    modalTitle.textContent = sala.nombre;
                    modalDesc.textContent = sala.descripcion;
                    modalVisitBtn.href = `sala-3d.html?sala=${sala.id}`;
                    modal.classList.add('is-open');
                }
            });
        });

        // Registrar exploración
        contenedor.querySelectorAll('.btn-sala').forEach(link => {
            link.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.dataset.id);
                let explored = getExplored();
                if (!explored.includes(id)) {
                    explored.push(id);
                    localStorage.setItem('museo_explored', JSON.stringify(explored));
                }
            });
        });
    };

    // Inicializaciones
    setupCategories();
    updateFavCount();
    window.renderSalas();

    // Eventos de Búsqueda
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            clearBtn.style.display = searchQuery.length > 0 ? 'block' : 'none';
            window.renderSalas();
        });
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            clearBtn.style.display = 'none';
            window.renderSalas();
        });
    }

    // Filtros por Categoría
    categoryFiltersContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            categoryFiltersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            window.renderSalas();
        }
    });

    // Filtros por Línea de Tiempo (Época)
    timelineContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            timelineContainer.querySelectorAll('.timeline-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentEpoca = e.target.dataset.epoca;
            window.renderSalas();
        }
    });

    // Botón Mis Guardadas
    if (favsToggleBtn) {
        favsToggleBtn.addEventListener('click', () => {
            onlyFavorites = !onlyFavorites;
            favsToggleBtn.setAttribute('aria-pressed', onlyFavorites);
            favsToggleBtn.classList.toggle('active', onlyFavorites);
            window.renderSalas();
        });
    }

    // Alternadores de Vista
    if (gridViewBtn && listViewBtn) {
        gridViewBtn.addEventListener('click', () => {
            contenedor.classList.remove('list-view');
            gridViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
        });
        listViewBtn.addEventListener('click', () => {
            contenedor.classList.add('list-view');
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
        });
    }

    // Cerrar Modal
    if (closeModal && modal) {
        closeModal.addEventListener('click', () => modal.classList.remove('is-open'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('is-open');
        });
    }
});

/* ============================================================
   EXTRAS: ambiente sonoro y exportar favoritos
   (complementan el script principal sin modificarlo)
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const audioBtn = document.getElementById('audioAmbientBtn');
    const ambientAudio = document.getElementById('ambientAudio');
    const audioLabel = document.getElementById('audioLabel');
    const exportFavsBtn = document.getElementById('exportFavsBtn');

    if (audioBtn && ambientAudio && audioLabel) {
        audioBtn.addEventListener('click', () => {
            const isPlaying = audioBtn.getAttribute('aria-pressed') === 'true';
            if (isPlaying) {
                ambientAudio.pause();
                audioBtn.setAttribute('aria-pressed', 'false');
                audioLabel.textContent = 'Ambiente sonoro';
            } else {
                ambientAudio.play().then(() => {
                    audioBtn.setAttribute('aria-pressed', 'true');
                    audioLabel.textContent = 'Pausar ambiente';
                }).catch(() => {
                    audioLabel.textContent = 'Audio no disponible';
                    audioBtn.setAttribute('aria-pressed', 'false');
                });
            }
        });
    }

    if (exportFavsBtn && typeof museoData !== 'undefined') {
        exportFavsBtn.addEventListener('click', () => {
            const favs = JSON.parse(localStorage.getItem('museo_favs') || '[]');
            const salasFavoritas = museoData.salas
                .filter(s => favs.includes(s.id))
                .map(s => ({ id: s.id, nombre: s.nombre, descripcion: s.descripcion }));

            const data = {
                institucion: museoData.institucion,
                exportado: new Date().toISOString(),
                salasFavoritas
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mis-salas-favoritas-focine.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
});