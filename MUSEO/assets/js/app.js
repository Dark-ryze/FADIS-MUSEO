// ==========================================
// CONFIGURACIÓN DE SÍNTESIS DE VOZ Y ESTADOS
// ==========================================
let speechSynth = window.speechSynthesis;
let currentUtterance = null;
let isAudioSupportEnabled = false;
let isReadingMain = false;

// Único punto de entrada al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    loadUserPreferences();
    initAccessibilityUI();
    initCRTAndModeSwitch();
    initOnboardingModal();
    initMobileAudioUnlock();
});

// Solución para móviles: desbloquear la síntesis de voz con el primer toque en pantalla (iOS/Android)
function initMobileAudioUnlock() {
    const unlockAudio = () => {
        if (speechSynth && speechSynth.paused) {
            speechSynth.resume();
        }
        if (speechSynth && !speechSynth.speaking) {
            const emptyUtterance = new SpeechSynthesisUtterance('');
            speechSynth.speak(emptyUtterance);
        }
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('click', unlockAudio);
    };
    window.addEventListener('touchstart', unlockAudio, { once: true });
    window.addEventListener('click', unlockAudio, { once: true });
}

// ==========================================
// CARGA DE PREFERENCIAS GUARDADAS
// ==========================================
function loadUserPreferences() {
    // 1. Color blind mode
    const savedColorBlindMode = localStorage.getItem('colorBlindMode') || 'none';
    document.body.setAttribute('data-color-blind-mode', savedColorBlindMode);

    // 2. Tipografía / Fuente
    const savedFont = localStorage.getItem('siteFont') || 'default';
    if (savedFont !== 'default') {
        document.body.setAttribute('data-font', savedFont);
    } else {
        document.body.removeAttribute('data-font');
    }

    // 3. Tamaño del cursor / flecha
    const savedCursor = localStorage.getItem('cursorSize') || 'normal';
    document.body.setAttribute('data-cursor-size', savedCursor);

    // 4. Contraste (alto / oscuro / normal)
    const savedContrast = localStorage.getItem('siteContrast') || 'normal';
    document.body.setAttribute('data-contrast', savedContrast);

    // 5. Resaltado del texto
    const savedHighlight = localStorage.getItem('textHighlight') === 'true';
    if (savedHighlight) {
        document.body.setAttribute('data-highlight', 'true');
    }

    // 6. Zoom de texto tradicional
    const savedFontSizeZoom = localStorage.getItem('fontSizeZoom') === 'true';
    if (savedFontSizeZoom) {
        document.body.setAttribute('data-text-size', 'grande');
    }

    // 7. Espaciado de texto
    const savedLetterSpacing = localStorage.getItem('letterSpacing') === 'true';
    if (savedLetterSpacing) {
        document.body.setAttribute('data-letter-spacing', 'true');
    }

    // 8. Saturación
    const savedSaturacion = localStorage.getItem('saturacionBaja') === 'true';
    if (savedSaturacion) {
        document.body.setAttribute('data-saturacion', 'baja');
    }

    // 9. Apoyo auditivo
    const savedAudioSupport = localStorage.getItem('audioSupportActive') === 'true';
    if (savedAudioSupport) {
        document.body.classList.add('audio-support-active');
        isAudioSupportEnabled = true;
    }

    // 10. Modo del sitio (archivo / actual)
    const savedMode = localStorage.getItem('siteMode') || 'archivo';
    document.body.setAttribute('data-mode', savedMode);
    syncModeUI(savedMode);

    // 11. Tema (niño o estándar)
    const savedTheme = localStorage.getItem('siteTheme');
    if (savedTheme === 'kids') {
        document.body.setAttribute('data-theme', 'kids');
        const ageInput = document.getElementById('ageRangeInput');
        if (ageInput) ageInput.value = 10;
    } else {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('siteTheme', 'standard');
    }

    // Reflejar todo en la interfaz del panel una vez montada
    syncPanelUI();
}

function syncModeUI(mode) {
    const modeSwitch = document.getElementById('modeSwitch');
    const modeLabel = document.getElementById('modeLabel');
    const crtStatusText = document.getElementById('crtStatusText');
    const crtCaptionText = document.getElementById('crtCaptionText');
    const isActual = (mode === 'actual');

    if (modeSwitch && modeLabel) {
        modeSwitch.setAttribute('aria-pressed', String(isActual));
        modeLabel.textContent = isActual ? 'Modo actual' : 'Modo archivo';
    }
    if (isActual) {
        if (crtStatusText) crtStatusText.textContent = 'DIGITAL · STREAMING 4K';
        if (crtCaptionText) crtCaptionText.innerHTML = 'Acervo digitalizado &middot; Catálogo Web';
    } else {
        if (crtStatusText) crtStatusText.textContent = 'REC · 1997';
        if (crtCaptionText) crtCaptionText.innerHTML = 'Fragmento sin catalogar &middot; Bobina 14';
    }
}

// ==========================================
// FUNCIONES DE ACCESIBILIDAD Y VOZ
// ==========================================
function changeColorBlindMode(mode, label) {
    document.body.setAttribute('data-color-blind-mode', mode);
    localStorage.setItem('colorBlindMode', mode);

    if (isAudioSupportEnabled && !isReadingMain) {
        speakText(`Ajuste de color cambiado a: ${label}`);
    }
}

function changeFontFamily(font, label) {
    if (font === 'default') {
        document.body.removeAttribute('data-font');
    } else {
        document.body.setAttribute('data-font', font);
    }
    localStorage.setItem('siteFont', font);

    if (isAudioSupportEnabled && !isReadingMain) {
        speakText(`Tipografía cambiada a: ${label}`);
    }
}

function changeCursorSize(size, label) {
    document.body.setAttribute('data-cursor-size', size);
    localStorage.setItem('cursorSize', size);

    if (isAudioSupportEnabled && !isReadingMain) {
        speakText(`Tamaño de la flecha cambiado a: ${label}`);
    }
}

function setContrastOption(option) {
    // option: 'alto' | 'oscuro'. Volver a pulsar el mismo lo desactiva.
    const current = document.body.getAttribute('data-contrast') || 'normal';
    const newValue = (current === option) ? 'normal' : option;
    document.body.setAttribute('data-contrast', newValue);
    localStorage.setItem('siteContrast', newValue);

    if (isAudioSupportEnabled && !isReadingMain) {
        const labels = { alto: 'Contraste alto', oscuro: 'Modo oscuro', normal: 'Contraste estándar' };
        speakText(`${labels[newValue] || 'Contraste'} ${newValue === 'normal' ? 'desactivado' : 'activado'}`);
    }
}

function toggleTextHighlight() {
    const active = document.body.getAttribute('data-highlight') === 'true';
    if (active) {
        document.body.removeAttribute('data-highlight');
        localStorage.setItem('textHighlight', 'false');
    } else {
        document.body.setAttribute('data-highlight', 'true');
        localStorage.setItem('textHighlight', 'true');
    }
    if (isAudioSupportEnabled && !isReadingMain) {
        speakText(active ? 'Resaltado del texto desactivado' : 'Resaltado del texto activado');
    }
}

function toggleFontSize() {
    const active = document.body.getAttribute('data-text-size') === 'grande';
    document.body.setAttribute('data-text-size', active ? 'normal' : 'grande');
    localStorage.setItem('fontSizeZoom', String(!active));

    if (isAudioSupportEnabled && !isReadingMain) {
        speakText(active ? 'Tamaño de texto normal' : 'Texto grande activado');
    }
}

function toggleLetterSpacing() {
    const active = document.body.getAttribute('data-letter-spacing') === 'true';
    if (active) {
        document.body.removeAttribute('data-letter-spacing');
        localStorage.setItem('letterSpacing', 'false');
    } else {
        document.body.setAttribute('data-letter-spacing', 'true');
        localStorage.setItem('letterSpacing', 'true');
    }
    if (isAudioSupportEnabled && !isReadingMain) {
        speakText(active ? 'Espaciado de texto desactivado' : 'Espaciado de texto activado');
    }
}

function toggleSaturacion() {
    const active = document.body.getAttribute('data-saturacion') === 'baja';
    if (active) {
        document.body.removeAttribute('data-saturacion');
        localStorage.setItem('saturacionBaja', 'false');
    } else {
        document.body.setAttribute('data-saturacion', 'baja');
        localStorage.setItem('saturacionBaja', 'true');
    }
    if (isAudioSupportEnabled && !isReadingMain) {
        speakText(active ? 'Saturación de color restablecida' : 'Saturación de color reducida');
    }
}

function toggleAudioDescMode() {
    isAudioSupportEnabled = !isAudioSupportEnabled;
    document.body.classList.toggle('audio-support-active', isAudioSupportEnabled);
    localStorage.setItem('audioSupportActive', isAudioSupportEnabled);

    if (speechSynth) {
        speechSynth.cancel();
    }

    syncPanelUI();

    if (isAudioSupportEnabled) {
        isReadingMain = true;

        const activeModal = document.querySelector('.onboarding-overlay.active');
        if (activeModal) {
            readCurrentOnboardingStep();
            return;
        }

        const pageTitle = document.querySelector('h1')?.textContent || '';
        const pageDesc = document.querySelector('.lede')?.textContent || document.querySelector('p')?.textContent || '';
        const salaTitle3D = document.getElementById('titulo-sala')?.textContent || '';
        const salaDesc3D = document.getElementById('desc-sala')?.textContent || '';

        let fullTextToRead = "";
        if (salaTitle3D) {
            fullTextToRead = `${salaTitle3D}. ${salaDesc3D}.`;
        } else {
            fullTextToRead = `${pageTitle}. ${pageDesc}.`;
        }

        const missionItems = document.querySelectorAll('.mission-item');
        if (missionItems.length > 0) {
            fullTextToRead += " Secciones del proyecto: ";
            missionItems.forEach((item) => {
                const yr = item.querySelector('.yr')?.textContent || '';
                const h3 = item.querySelector('h3')?.textContent || '';
                const p = item.querySelector('p')?.textContent || '';
                fullTextToRead += `Año ${yr}, ${h3}: ${p}. `;
            });
        }

        speakText(fullTextToRead, () => { isReadingMain = false; });
    } else {
        isReadingMain = false;
    }
}

function speakText(text, onEndCallback) {
    if (!speechSynth) return;

    speechSynth.cancel();

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'es-MX';
    currentUtterance.rate = 1.0;
    currentUtterance.pitch = 1.05;

    const voices = speechSynth.getVoices();
    const spanishVoice = voices.find(v => v.lang.startsWith('es') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Sabina')));
    if (spanishVoice) {
        currentUtterance.voice = spanishVoice;
    }

    currentUtterance.onend = () => {
        isReadingMain = false;
        if (typeof onEndCallback === 'function') onEndCallback();
    };
    currentUtterance.onerror = () => {
        isReadingMain = false;
    };

    speechSynth.speak(currentUtterance);
}

// ==========================================
// PERFILES RÁPIDOS
// ==========================================
function applyProfile(profile) {
    switch (profile) {
        case 'motora':
            changeCursorSize('grande', 'Grande');
            toggleFontSizeOn();
            break;
        case 'ceguera':
            if (!isAudioSupportEnabled) toggleAudioDescMode();
            break;
        case 'daltonismo':
            openSubpanel('daltonismo');
            break;
        case 'dislexia':
            changeFontFamily('opendyslexic', 'OpenDyslexic');
            break;
    }
    syncPanelUI();
}

function toggleFontSizeOn() {
    if (document.body.getAttribute('data-text-size') !== 'grande') {
        toggleFontSize();
    }
}

// ==========================================
// INTERFAZ DEL PANEL (TARJETAS)
// ==========================================
function initAccessibilityUI() {
    const launcher = document.getElementById('a11yLauncher');
    const panel = document.getElementById('a11yPanel');
    const closeBtn = document.getElementById('a11yClose');

    if (launcher && panel) {
        launcher.addEventListener('click', () => {
            const isOpen = panel.classList.toggle('open');
            launcher.setAttribute('aria-expanded', String(isOpen));
            if (isOpen) syncPanelUI();
        });

        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && !launcher.contains(e.target)) {
                panel.classList.remove('open');
                launcher.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (closeBtn && panel && launcher) {
        closeBtn.addEventListener('click', () => {
            panel.classList.remove('open');
            launcher.setAttribute('aria-expanded', 'false');
        });
    }

    // Perfiles rápidos
    document.querySelectorAll('.profile-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            applyProfile(chip.getAttribute('data-profile'));
        });
    });

    // Tarjetas booleanas (data-toggle)
    document.querySelectorAll('.a11y-card[data-toggle]').forEach(card => {
        card.addEventListener('click', () => {
            const action = card.getAttribute('data-toggle');
            if (action === 'audio') toggleAudioDescMode();
            if (action === 'zoom') toggleFontSize();
            if (action === 'espaciado') toggleLetterSpacing();
            if (action === 'saturacion') toggleSaturacion();
            if (action === 'resaltado') toggleTextHighlight();
            syncPanelUI();
        });
    });

    // Tarjetas de contraste
    document.querySelectorAll('.a11y-card[data-contrast-option]').forEach(card => {
        card.addEventListener('click', () => {
            setContrastOption(card.getAttribute('data-contrast-option'));
            syncPanelUI();
        });
    });

    // Tarjetas expandibles (submenús)
    document.querySelectorAll('.a11y-card[data-expand]').forEach(card => {
        card.addEventListener('click', () => {
            openSubpanel(card.getAttribute('data-expand'));
        });
    });

    // Chips de submenú: daltonismo
    document.querySelectorAll('#subpanelDaltonismo .a11y-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const mode = chip.getAttribute('data-color-blind');
            changeColorBlindMode(mode, chip.textContent.trim());
            syncPanelUI();
        });
    });

    // Chips de submenú: tipografía
    document.querySelectorAll('#subpanelTipografia .a11y-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const font = chip.getAttribute('data-font');
            changeFontFamily(font, chip.textContent.trim());
            syncPanelUI();
        });
    });

    // Chips de submenú: cursor
    document.querySelectorAll('#subpanelCursor .a11y-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const size = chip.getAttribute('data-cursor');
            changeCursorSize(size, chip.textContent.trim());
            syncPanelUI();
        });
    });

    // Restablecer todo
    const resetBtn = document.getElementById('a11yReset');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetAllAccessibility);
    }

    const scrollMission = document.getElementById('scrollMission');
    const missionSection = document.getElementById('mission');
    if (scrollMission && missionSection) {
        scrollMission.addEventListener('click', () => {
            missionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
}

function openSubpanel(name) {
    const allSubpanels = document.querySelectorAll('.a11y-subpanel');
    const allExpandCards = document.querySelectorAll('.a11y-card[data-expand]');
    const target = document.querySelector(`.a11y-subpanel[data-subpanel="${name}"]`);
    const targetCard = document.querySelector(`.a11y-card[data-expand="${name}"]`);
    const alreadyOpen = target && !target.hidden;

    allSubpanels.forEach(sp => sp.hidden = true);
    allExpandCards.forEach(c => c.setAttribute('aria-expanded', 'false'));

    if (target && !alreadyOpen) {
        target.hidden = false;
        if (targetCard) targetCard.setAttribute('aria-expanded', 'true');
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Refleja el estado real (localStorage / atributos del body) en las tarjetas y perfiles
function syncPanelUI() {
    const body = document.body;

    // Tarjetas booleanas
    setPressed('cardAudio', isAudioSupportEnabled);
    setPressed('cardZoom', body.getAttribute('data-text-size') === 'grande');
    setPressed('cardEspaciado', body.getAttribute('data-letter-spacing') === 'true');
    setPressed('cardSaturacion', body.getAttribute('data-saturacion') === 'baja');
    setPressed('cardResaltado', body.getAttribute('data-highlight') === 'true');
    setPressed('cardContrasteAlto', body.getAttribute('data-contrast') === 'alto');
    setPressed('cardContrasteOscuro', body.getAttribute('data-contrast') === 'oscuro');

    // Chips activos dentro de submenús
    const colorBlindMode = body.getAttribute('data-color-blind-mode') || 'none';
    setActiveChip('#subpanelDaltonismo .a11y-chip', 'data-color-blind', colorBlindMode);

    const font = body.getAttribute('data-font') || 'default';
    setActiveChip('#subpanelTipografia .a11y-chip', 'data-font', font);

    const cursorSize = body.getAttribute('data-cursor-size') || 'normal';
    setActiveChip('#subpanelCursor .a11y-chip', 'data-cursor', cursorSize);

    // Marcar tarjeta "Tipografía" si hay una fuente especial activa
    setPressed('cardTipografia', font !== 'default', 'aria-expanded');

    // Perfiles: se marcan como activos si su condición representativa se cumple
    setProfileActive('profileMotora', cursorSize === 'grande' && body.getAttribute('data-text-size') === 'grande');
    setProfileActive('profileCeguera', isAudioSupportEnabled);
    setProfileActive('profileDaltonismo', colorBlindMode !== 'none');
    setProfileActive('profileDislexia', font === 'opendyslexic');

    // Estado general
    const anyActive = isAudioSupportEnabled || body.getAttribute('data-text-size') === 'grande' ||
        body.getAttribute('data-letter-spacing') === 'true' || body.getAttribute('data-saturacion') === 'baja' ||
        body.getAttribute('data-highlight') === 'true' || body.getAttribute('data-contrast') !== 'normal' ||
        colorBlindMode !== 'none' || font !== 'default' || cursorSize !== 'normal';

    const statusEl = document.getElementById('a11yStatus');
    const statusText = document.getElementById('a11yStatusText');
    if (statusEl && statusText) {
        statusEl.classList.toggle('is-active', anyActive);
        statusText.textContent = anyActive ? 'Ajustes de accesibilidad activados' : 'Ningún perfil activado';
    }
}

function setPressed(id, isOn, attr) {
    const el = document.getElementById(id);
    if (el) el.setAttribute(attr || 'aria-pressed', String(!!isOn));
}

function setProfileActive(id, isOn) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', !!isOn);
}

function setActiveChip(selector, attr, value) {
    document.querySelectorAll(selector).forEach(chip => {
        chip.classList.toggle('active', chip.getAttribute(attr) === value);
    });
}

function resetAllAccessibility() {
    document.body.removeAttribute('data-color-blind-mode');
    document.body.setAttribute('data-color-blind-mode', 'none');
    document.body.removeAttribute('data-font');
    document.body.setAttribute('data-cursor-size', 'normal');
    document.body.setAttribute('data-contrast', 'normal');
    document.body.removeAttribute('data-highlight');
    document.body.setAttribute('data-text-size', 'normal');
    document.body.removeAttribute('data-letter-spacing');
    document.body.removeAttribute('data-saturacion');

    localStorage.setItem('colorBlindMode', 'none');
    localStorage.setItem('siteFont', 'default');
    localStorage.setItem('cursorSize', 'normal');
    localStorage.setItem('siteContrast', 'normal');
    localStorage.setItem('textHighlight', 'false');
    localStorage.setItem('fontSizeZoom', 'false');
    localStorage.setItem('letterSpacing', 'false');
    localStorage.setItem('saturacionBaja', 'false');

    if (isAudioSupportEnabled) {
        toggleAudioDescMode();
    }

    document.querySelectorAll('.a11y-subpanel').forEach(sp => sp.hidden = true);
    document.querySelectorAll('.a11y-card[data-expand]').forEach(c => c.setAttribute('aria-expanded', 'false'));

    syncPanelUI();
}

// ==========================================
// CRT / CAMBIO DE MODO ARCHIVO-ACTUAL
// ==========================================
function initCRTAndModeSwitch() {
    const crtFrame = document.getElementById('crtFrame');
    const modeSwitch = document.getElementById('modeSwitch');
    const body = document.body;

    if (crtFrame) {
        crtFrame.classList.add('power-on');
        setTimeout(() => { crtFrame.classList.remove('power-on'); }, 600);
    }

    if (modeSwitch) {
        modeSwitch.addEventListener('click', () => {
            const currentMode = body.getAttribute('data-mode');
            const newMode = (currentMode !== 'actual') ? 'actual' : 'archivo';

            body.setAttribute('data-mode', newMode);
            localStorage.setItem('siteMode', newMode);
            syncModeUI(newMode);

            if (crtFrame) {
                crtFrame.classList.add('power-on');
                setTimeout(() => crtFrame.classList.remove('power-on'), 600);
            }
        });
    }
}

// Lector al pasar el ratón (Hover) - Solo activo si la encuesta NO está abierta
document.addEventListener('mouseover', function (event) {
    const modalActive = document.querySelector('.onboarding-overlay.active');
    if (!isAudioSupportEnabled || isReadingMain || modalActive) return;

    const target = event.target.closest('button, a, h1, h2, h3, p, .badge, .mission-item, .bridge-past, .bridge-future, .a11y-card, .profile-chip, .a11y-chip');
    if (target) {
        let textToSpeak = '';

        if (target.classList.contains('mission-item')) {
            const yr = target.querySelector('.yr')?.textContent || '';
            const h3 = target.querySelector('h3')?.textContent || '';
            const desc = target.querySelector('p')?.textContent || '';
            textToSpeak = `Año ${yr}. ${h3}. ${desc}`;
        } else {
            textToSpeak = target.getAttribute('aria-label') || target.innerText;
        }

        if (textToSpeak && target.dataset.lastSpoken !== textToSpeak) {
            target.dataset.lastSpoken = textToSpeak;
            speakText(textToSpeak);
        }
    }
});

if (typeof speechSynth !== 'undefined' && speechSynth.onvoiceschanged !== undefined) {
    speechSynth.onvoiceschanged = () => { speechSynth.getVoices(); };
}

// ==========================================
// ONBOARDING
// ==========================================
function initOnboardingModal() {
    const modal = document.getElementById('onboardingModal');

    const path = window.location.pathname;
    const isIndexPage = path.endsWith('/') || path.endsWith('index.html') || path === '';
    const onboardingAlreadyDone = localStorage.getItem('onboardingCompleted') === 'true';

    if (!modal || !isIndexPage || onboardingAlreadyDone) {
        if (modal) modal.style.display = 'none';
        return;
    }

    const progressBar = document.getElementById('onboardingProgressBar');
    const steps = document.querySelectorAll('.onboarding-step');
    const skipBtn = document.getElementById('skipOnboarding');
    const finishBtn = document.getElementById('finishOnboardingBtn');

    if (modal) {
        modal.classList.add('active');

        if (!isAudioSupportEnabled) {
            isAudioSupportEnabled = true;
            document.body.classList.add('audio-support-active');
            localStorage.setItem('audioSupportActive', 'true');
        }
        isReadingMain = true;
        setTimeout(() => readCurrentOnboardingStep(), 400);
    }

    let currentStep = 1;
    const totalSteps = steps.length;

    const ageInput = document.getElementById('ageRangeInput');
    const ageNumber = document.getElementById('ageNumber');
    const ageCategory = document.getElementById('ageCategory');
    const nextFromAgeBtn = document.getElementById('nextFromAgeBtn');

    function getAgeCategoryText(val) {
        if (val <= 11) return '👶 Niño / Infante';
        if (val <= 17) return '🛹 Adolescente';
        if (val <= 29) return '⚡ Adulto joven';
        if (val <= 59) return '🏛️ Adulto';
        return '📜 Adulto mayor';
    }

    if (ageInput && ageNumber && ageCategory) {
        ageInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            ageNumber.textContent = val;
            const categoryText = getAgeCategoryText(val);
            ageCategory.textContent = categoryText;
            localStorage.setItem('userAge', val);
            localStorage.setItem('userGenerationCategory', categoryText);

            if (val >= 8 && val <= 11) {
                document.body.setAttribute('data-theme', 'kids');
                localStorage.setItem('siteTheme', 'kids');
            } else {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('siteTheme', 'standard');
            }
        });

        const initialVal = parseInt(ageInput.value);
        localStorage.setItem('userAge', initialVal);
        localStorage.setItem('userGenerationCategory', getAgeCategoryText(initialVal));
        if (initialVal >= 8 && initialVal <= 11) {
            document.body.setAttribute('data-theme', 'kids');
            localStorage.setItem('siteTheme', 'kids');
        } else {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('siteTheme', 'standard');
        }
    }

    if (nextFromAgeBtn) {
        nextFromAgeBtn.addEventListener('click', () => {
            if (currentStep < totalSteps) {
                goToStep(currentStep + 1);
            }
        });
    }

    function goToStep(stepNum) {
        currentStep = stepNum;
        steps.forEach(s => s.classList.remove('active'));

        const targetStep = document.querySelector(`.onboarding-step[data-step="${stepNum}"]`);
        if (targetStep) {
            targetStep.classList.add('active');
        }

        const progressPercentage = (stepNum / totalSteps) * 100;
        if (progressBar) {
            progressBar.style.width = `${progressPercentage}%`;
        }

        if (isAudioSupportEnabled) {
            isReadingMain = true;
            setTimeout(() => readCurrentOnboardingStep(), 300);
        }
    }

    const options = document.querySelectorAll('.onboarding-option');
    options.forEach(option => {
        option.addEventListener('click', () => {
            const answer = option.getAttribute('data-answer');

            if (currentStep === 1) {
                const shouldBeActive = (answer === 'true');
                if (isAudioSupportEnabled !== shouldBeActive) {
                    isAudioSupportEnabled = shouldBeActive;
                    document.body.classList.toggle('audio-support-active', isAudioSupportEnabled);
                    localStorage.setItem('audioSupportActive', isAudioSupportEnabled);
                }
            } else if (currentStep === 2) {
                document.body.setAttribute('data-mode', answer);
                localStorage.setItem('siteMode', answer);
                syncModeUI(answer);
            }

            if (currentStep < totalSteps && currentStep !== 3) {
                goToStep(currentStep + 1);
            }
        });
    });

    if (finishBtn) {
        finishBtn.addEventListener('click', closeOnboarding);
    }

    if (skipBtn) {
        skipBtn.addEventListener('click', closeOnboarding);
    }

    function closeOnboarding() {
        if (modal) {
            modal.classList.remove('active');
            if (speechSynth) speechSynth.cancel();
            isReadingMain = false;
            localStorage.setItem('onboardingCompleted', 'true');
            syncPanelUI();
        }
    }
}

function readCurrentOnboardingStep() {
    const activeStepEl = document.querySelector('.onboarding-step.active');
    if (!activeStepEl) return;

    const stepTag = activeStepEl.querySelector('.step-tag')?.textContent || '';
    const heading = activeStepEl.querySelector('h2')?.textContent || '';
    const paragraph = activeStepEl.querySelector('p')?.textContent || '';

    let extraInfo = "";
    if (activeStepEl.dataset.step === "3") {
        const currentAge = document.getElementById('ageRangeInput')?.value || '25';
        const currentCat = document.getElementById('ageCategory')?.textContent || 'Adulto joven';
        extraInfo = ` Edad seleccionada actualmente: ${currentAge} años, categoría ${currentCat}. Desliza la barra para cambiarla.`;
    } else {
        const options = activeStepEl.querySelectorAll('.onboarding-option');
        options.forEach((opt, index) => {
            extraInfo += ` Opción ${index + 1}: ${opt.innerText.replace(/\n/g, ' ')}. `;
        });
        extraInfo = " Opciones disponibles: " + extraInfo;
    }

    const textToRead = `${stepTag}. ${heading}. ${paragraph}.${extraInfo}`;
    speakText(textToRead, () => { isReadingMain = false; });
}

/* ==========================================================================
   INTERACTIVIDAD Y DINÁMICA DE IMPACTO - ARCHIVO FOCINE
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Manejo dinámico del Slider de Edad en el Onboarding
  const ageRangeInput = document.getElementById("ageRangeInput");
  const ageNumber = document.getElementById("ageNumber");
  const ageCategory = document.getElementById("ageCategory");

  if (ageRangeInput && ageNumber && ageCategory) {
    ageRangeInput.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      ageNumber.textContent = val;

      if (val < 14) {
        ageCategory.textContent = "Infantil / Explorador";
      } else if (val < 25) {
        ageCategory.textContent = "Jóvenes creadores e investigadores";
      } else if (val < 60) {
        ageCategory.textContent = "Adulto / Comunidad general";
      } else {
        ageCategory.textContent = "Adulto mayor / Memoria viva";
      }
    });
  }

  // 2. Efecto de sonido analógico sutil al hacer clic en botones principales (Opcional y amigable)
  const playClickSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.05);
      
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
      // Navegadores que bloquean AudioContext sin interacción previa
    }
  };

  document.querySelectorAll('.btn-primary, .mode-switch, .profile-chip').forEach(btn => {
    btn.addEventListener('click', playClickSound);
  });

  // 3. Lectura por voz integrada sencilla (Web Speech API) para el modo de accesibilidad de audio
  window.speakText = function(text) {
    if ('speechSynthesis' in window && document.body.classList.contains('audio-reader-active')) {
      window.speechSynthesis.cancel(); // Detener locuciones anteriores
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-MX';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Añadir eventos de locución al pasar el cursor si el lector está activo
  document.querySelectorAll('h1, h2, h3, .btn-primary').forEach(element => {
    element.addEventListener('mouseenter', () => {
      if (document.body.getAttribute('data-audio-reader') === 'true') {
        window.speakText(element.innerText);
      }
    });
  });

  // 4. Desplazamiento suave para el botón "Conocer el proyecto"
  const scrollMissionBtn = document.getElementById("scrollMission");
  if (scrollMissionBtn) {
    scrollMissionBtn.addEventListener("click", () => {
      const missionSection = document.getElementById("mission");
      if (missionSection) {
        missionSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const decadeButtons = document.querySelectorAll(".decade-btn");
  const exhibitImage = document.getElementById("exhibitImage");
  const stampYearText = document.getElementById("stampYearText");
  const exhibitTitle = document.getElementById("exhibitTitle");
  const exhibitDesc = document.getElementById("exhibitDesc");

  // Base de datos histórica integrada (1905 - 1990)
  const historicalData = {
    "1905": {
      title: "Exploración y Primeros Registros Científicos",
      desc: "Las primeras misiones fotográficas y arqueológicas bajo la dirección de Leopoldo Batres documentaron la inmensidad de las pirámides antes de las grandes restauraciones.",
      image: "assets/images/Imagenes/1905/teotihuacan.jpg", // Puedes cambiar por rutas específicas de fotos de época
      tag: "EXPEDICIÓN 1905"
    },
    "1930": {
      title: "La Época de las Grandes Excavaciones",
      desc: "El Valle comienza a recibir caravanas de investigadores y cineastas nacionales fascinados por la monumentalidad descubierta del Sol y la Luna.",
      image: "assets/images/Imagenes/1930/imagen.jpg",
      tag: "ARCHIVO 1930"
    },
    "1960": {
      title: "Modernización y Comunidad Local",
      desc: "La vida comunitaria se entrelaza con el turismo incipiente; las festividades patronales y las faenas diarias quedan registradas en rollos de 8mm y 16mm.",
      image: "assets/images/Imagenes/1960/imagen.jpg",
      tag: "MEMORIA 1960"
    },
    "1990": {
      title: "Consolidación del Archivo Audiovisual",
      desc: "Cierre del siglo con el rescate formal de noticiarios locales, cortometrajes independientes y testimonios directos de los pobladores más longevos del valle.",
      image: "assets/images/Imagenes/1990/imagen.jpg",
      tag: "CRónica 1990"
    }
  };

  decadeButtons.forEach(button => {
    button.addEventListener("click", () => {
      // Remover clase activa de todos
      decadeButtons.forEach(btn => btn.classList.remove("active"));
      // Activar el seleccionado
      button.classList.add("active");

      const decade = button.getAttribute("data-decade");
      const data = historicalData[decade];

      if (data) {
        // Efecto visual sutil de transición
        exhibitImage.style.opacity = "0.3";
        
        setTimeout(() => {
          exhibitImage.src = data.image;
          stampYearText.textContent = data.tag;
          exhibitTitle.textContent = data.title;
          exhibitDesc.textContent = data.desc;
          exhibitImage.style.opacity = "0.9";
        }, 200);
      }
    });
  });
});
