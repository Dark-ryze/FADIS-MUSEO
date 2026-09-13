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

    window.renderSalas = function() {
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

    // Exportar Favoritos en TXT
    if (exportFavsBtn) {
        exportFavsBtn.addEventListener('click', () => {
            const favorites = getFavorites();
            const favSalas = museoData.salas.filter(s => favorites.includes(s.id));
            const textContent = `MIS SALAS GUARDADAS - ARCHIVO FOCINE\n\n` + 
                favSalas.map(s => `- [Sala 0${s.id}] ${s.nombre}\n  ${s.descripcion}\n`).join('\n');
            
            const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'salas-favoritas-teotihuacan.txt';
            a.click();
            URL.revokeObjectURL(url);
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

    // Reproductor de Audio Ambiental
    if (audioBtn && ambientAudio) {
        audioBtn.addEventListener('click', () => {
            if (ambientAudio.paused) {
                ambientAudio.play().then(() => {
                    audioBtn.classList.add('playing');
                    audioBtn.setAttribute('aria-pressed', 'true');
                    audioLabel.textContent = 'Reproduciendo';
                }).catch(() => alert('No se pudo cargar el archivo de audio ambiental.'));
            } else {
                ambientAudio.pause();
                audioBtn.classList.remove('playing');
                audioBtn.setAttribute('aria-pressed', 'false');
                audioLabel.textContent = 'Audio guía';
            }
        });
    }

    // Atajos de Teclado Inteligentes (Power Users)
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
        if (e.key === 'Escape') {
            if (modal) modal.classList.remove('is-open');
            if (document.activeElement === searchInput) {
                searchInput.value = '';
                searchQuery = '';
                if (clearBtn) clearBtn.style.display = 'none';
                window.renderSalas();
                searchInput.blur();
            }
        }
    });
});

// ==========================================
// INTEGRACIÓN DE ACCESIBILIDAD PARA LAS NUEVAS FUNCIONES
// ==========================================

// 1. Ampliar el lector por Hover para que lea dinámicamente los nuevos elementos (Vista rápida, Timeline, Audio y Exportar)
document.addEventListener('mouseover', function (event) {
    const modalActive = document.querySelector('.onboarding-overlay.active');
    if (!isAudioSupportEnabled || isReadingMain || modalActive) return;

    // Se añaden los selectores nuevos: .preview-card-btn, .timeline-btn, .audio-ambient-btn, .control-toggle-btn
    const target = event.target.closest('button, a, h1, h2, h3, p, .badge-sala, select, option, .preview-card-btn, .timeline-btn, .audio-ambient-btn, .control-toggle-btn');
    
    if (target) {
        let textToSpeak = '';

        if (target.classList.contains('preview-card-btn')) {
            textToSpeak = `Vista rápida de la sala`;
        } else if (target.classList.contains('timeline-btn')) {
            textToSpeak = `Filtrar por época histórica: ${target.innerText}`;
        } else if (target.classList.contains('audio-ambient-btn')) {
            textToSpeak = `Reproductor de audio guía ambiental`;
        } else if (target.id === 'exportFavsBtn') {
            textToSpeak = `Exportar lista de salas guardadas`;
        } else if (target.id === 'favsToggleBtn') {
            textToSpeak = `Filtrar mis salas favoritas guardadas`;
        } else if (target.tagName === 'SELECT') {
            const selectedOption = target.options[target.selectedIndex];
            textToSpeak = `Selector de opciones: ${selectedOption.text}`;
        } else {
            textToSpeak = target.getAttribute('aria-label') || target.innerText;
        }

        if (textToSpeak && target.dataset.lastSpoken !== textToSpeak) {
            target.dataset.lastSpoken = textToSpeak;
            speakText(textToSpeak);
        }
    }
});

// 2. Anunciar cambios automáticos y aperturas del Modal de Vista Previa (Lightbox)
const observerPreviewModal = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.target.id === 'previewModal') {
            const isOpen = mutation.target.classList.contains('is-open');
            if (isOpen && isAudioSupportEnabled) {
                const title = document.getElementById('modalTitle')?.textContent || '';
                const desc = document.getElementById('modalDesc')?.textContent || '';
                speakText(`Vista previa abierta: ${title}. ${desc}`);
            }
        }
    });
});

const previewModalEl = document.getElementById('previewModal');
if (previewModalEl) {
    observerPreviewModal.observe(previewModalEl, { attributes: true, attributeFilter: ['class'] });
}

// 3. Dar retroalimentación de voz al interactuar con la Línea de Tiempo y los Botones de Control
document.addEventListener('click', (e) => {
    if (!isAudioSupportEnabled) return;

    // Lectura al hacer clic en un botón de la línea de tiempo
    if (e.target.classList.contains('timeline-btn')) {
        speakText(`Época seleccionada: ${e.target.innerText}`);
    }
    
    // Lectura al hacer clic en exportar
    if (e.target.id === 'exportFavsBtn') {
        speakText('Descargando archivo de texto con tus salas favoritas.');
    }
});

document.addEventListener("DOMContentLoaded", () => {
    // Control de la Audioguía Ambiental del Museo
    const audioBtn = document.getElementById("audioAmbientBtn");
    const ambientAudio = document.getElementById("ambientAudio");
    const audioLabel = document.getElementById("audioLabel");

    if (audioBtn && ambientAudio) {
        audioBtn.addEventListener("click", () => {
            const isPlaying = audioBtn.getAttribute("aria-pressed") === "true";
            
            if (isPlaying) {
                ambientAudio.pause();
                audioBtn.setAttribute("aria-pressed", "false");
                audioLabel.textContent = "Audio guía";
                audioBtn.style.background = "rgba(212, 160, 23, 0.1)";
            } else {
                ambientAudio.play().then(() => {
                    audioBtn.setAttribute("aria-pressed", "true");
                    audioLabel.textContent = "Reproduciendo...";
                    audioBtn.style.background = "#d4a017";
                }).catch(e => {
                    console.log("El navegador bloqueó la reproducción automática o falta archivo de audio válido:", e);
                });
            }
        });
    }

    // Efecto de entrada suave para elementos al hacer scroll
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Aplicar a las tarjetas de salas dinámicas cuando se generen
    document.querySelectorAll('.sala-card, .sala-item').forEach(card => {
        card.style.opacity = "0";
        card.style.transform = "translateY(20px)";
        card.style.transition = "opacity 0.6s ease-out, transform 0.6s ease-out";
        observer.observe(card);
    });
});

// JS: Activar sonido sutil al hacer clic en botones de filtro o tarjetas
document.addEventListener("click", (e) => {
    if (e.target.closest("button") || e.target.closest(".filter-btn") || e.target.closest(".timeline-btn")) {
        const sound = document.getElementById("uiClickSound");
        if (sound) {
            sound.currentTime = 0;
            sound.volume = 0.2; // Volumen bajo para que no sea molesto
            sound.play().catch(() => {}); // Ignora restricciones del navegador si no ha habido interacción previa
        }
    }
});

// JS: Sincronización global y gratuita de mensajes
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("globalVisitorForm");
    const wallContainer = document.getElementById("wallMessages");
    const submitBtn = document.getElementById("submitBtn");
    
    // Pega aquí la URL que te genera npoint.io o jsonbin.io
    const API_URL = "https://www.npoint.io/docs/b9b424b5a68d31429525"; 

    // 1. Cargar mensajes desde la nube para que todos los vean
    async function fetchGlobalMessages() {
        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            // Asumiendo que la estructura es { mensajes: [...] }
            const messages = data.mensajes || [];
            
            renderMessages(messages);
        } catch (e) {
            wallContainer.innerHTML = `<p class="loading-text">No se pudieron cargar los mensajes en este momento.</p>`;
        }
    }

    // 2. Dibujar los mensajes en pantalla
    function renderMessages(messages) {
        wallContainer.innerHTML = "";
        
        if (messages.length === 0) {
            wallContainer.innerHTML = `<p class="loading-text">Sé el primero en dejar tu huella en el muro global.</p>`;
            return;
        }

        messages.forEach(item => {
            const card = document.createElement("div");
            card.className = "wall-msg-card";
            card.innerHTML = `
                <div class="msg-meta">
                    <span>👤 ${escapeHtml(item.name)} <small>(${escapeHtml(item.origin)})</small></span>
                    <span>🕒 ${item.date}</span>
                </div>
                <p>${escapeHtml(item.msg)}</p>
            `;
            wallContainer.appendChild(card);
        });
    }

    // 3. Enviar un nuevo mensaje y actualizar la nube
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            submitBtn.textContent = "Publicando...";
            submitBtn.disabled = true;

            const name = document.getElementById("visitorName").value.trim();
            const origin = document.getElementById("visitorOrigin").value.trim();
            const msg = document.getElementById("visitorMsg").value.trim();

            const now = new Date().toLocaleDateString("es-MX", { 
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
            });

            const newMessage = { name, origin, msg, date: now };

            try {
                // Primero obtenemos los mensajes actuales de la nube
                const getRes = await fetch(API_URL);
                const currentData = await getRes.json();
                const messages = currentData.mensajes || [];

                // Agregamos el nuevo al inicio
                messages.unshift(newMessage);

                // Guardamos la lista actualizada de vuelta en la nube via PUT
                const updateRes = await fetch(API_URL, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mensajes: messages })
                });

                if (updateRes.ok) {
                    form.reset();
                    renderMessages(messages); // Actualiza la vista localmente de inmediato
                }
            } catch (e) {
                alert("Hubo un error al enviar tu mensaje. Inténtalo de nuevo.");
            } finally {
                submitBtn.textContent = "Publicar en el Muro Global";
                submitBtn.disabled = false;
            }
        });
    }

    function escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // Cargar al iniciar la página
    fetchGlobalMessages();
});
