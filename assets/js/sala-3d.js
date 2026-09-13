window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const salaId = parseInt(urlParams.get('sala')) || 1;
    
    if (typeof museoData !== 'undefined') {
        const salaActual = museoData.salas.find(s => s.id === salaId);

        if (salaActual) {
            const tituloSalaEl = document.getElementById('titulo-sala');
            const descSalaEl = document.getElementById('desc-sala');
            
            tituloSalaEl.innerText = `Sala 0${salaActual.id}: ${salaActual.nombre}`;
            // Puedes añadir una descripción general si la tienes en tus datos, o dejar una por defecto:
            descSalaEl.innerText = salaActual.descripcion || "Estructura perimetral conectada al domo piramidal central.";

            const contenedor3D = document.getElementById('elementos-exhibicion');
            
            salaActual.elementos.forEach((item, index) => {
                const wallIndex = index % 3; 
                const posInWall = Math.floor(index / 3);
                
                let posX = 0, posZ = 0, rotY = 0;
                const offsetStep = (posInWall - 1) * 5.5;

                if (wallIndex === 0) {
                    posX = offsetStep; posZ = -13.8; rotY = 0;
                } else if (wallIndex === 1) {
                    posX = -13.8; posZ = offsetStep; rotY = 90;
                } else {
                    posX = 13.8; posZ = offsetStep; rotY = -90;
                }

                const cuadroEntity = document.createElement('a-entity');
                cuadroEntity.setAttribute('position', `${posX} 2.5 ${posZ}`);
                cuadroEntity.setAttribute('rotation', `0 ${rotY} 0`);

                const marcoExterno = document.createElement('a-box');
                marcoExterno.setAttribute('position', '0 0 0.05');
                marcoExterno.setAttribute('width', '3.2');
                marcoExterno.setAttribute('height', '2.3');
                marcoExterno.setAttribute('depth', '0.08');
                marcoExterno.setAttribute('color', '#2c1810');

                const marcoInterno = document.createElement('a-box');
                marcoInterno.setAttribute('position', '0 0 0.08');
                marcoInterno.setAttribute('width', '2.9');
                marcoInterno.setAttribute('height', '2.0');
                marcoInterno.setAttribute('depth', '0.04');
                marcoInterno.setAttribute('color', '#d4af37');

                const cuadro = document.createElement('a-image');
                cuadro.setAttribute('src', item.url);
                cuadro.setAttribute('position', '0 0 0.11');
                cuadro.setAttribute('width', '2.7');
                cuadro.setAttribute('height', '1.8');
                // Añadimos atributos accesibles para lectura si es necesario
                cuadro.setAttribute('class', 'obra-interactiva');
                cuadro.addEventListener('click', () => abrirModal(item));

                const placa = document.createElement('a-box');
                placa.setAttribute('position', '0 -1.3 0.08');
                placa.setAttribute('width', '1.3');
                placa.setAttribute('height', '0.35');
                placa.setAttribute('depth', '0.02');
                placa.setAttribute('color', '#f8fafc');

                const textoPlaca = document.createElement('a-text');
                textoPlaca.setAttribute('value', `${item.titulo.substring(0, 16)}...`);
                textoPlaca.setAttribute('position', '0 -1.3 0.10');
                textoPlaca.setAttribute('align', 'center');
                textoPlaca.setAttribute('color', '#0f172a');
                textoPlaca.setAttribute('scale', '0.45 0.45 0.45');

                cuadroEntity.appendChild(marcoExterno);
                cuadroEntity.appendChild(marcoInterno);
                cuadroEntity.appendChild(cuadro);
                cuadroEntity.appendChild(placa);
                cuadroEntity.appendChild(textoPlaca);

                contenedor3D.appendChild(cuadroEntity);
            });
        }
    }
});

function abrirModal(item) {
    document.getElementById('modal-titulo').innerText = item.titulo;
    document.getElementById('modal-anio').innerText = `Año de registro: ${item.anio}`;
    document.getElementById('modal-img').src = item.url;
    document.getElementById('modal-desc').innerText = item.descripcion || "Sin descripción.";
    
    const audioElem = document.getElementById('modal-audio');
    const audioContainer = document.getElementById('modal-audio-container');
    if (item.audioUrl) {
        audioElem.src = item.audioUrl;
        audioContainer.style.display = 'block';
    } else {
        audioElem.src = "";
        audioContainer.style.display = 'none';
    }
    
    document.getElementById('infoModal').style.display = 'flex';

    // CONDICIÓN: Si el Apoyo Auditivo está activo, leer el contenido del modal de inmediato
    if (typeof isAudioSupportEnabled !== 'undefined' && isAudioSupportEnabled) {
        const textoObraModal = `Obra seleccionada: ${item.titulo}. Año de registro: ${item.anio}. Descripción: ${item.descripcion || "Sin descripción."}`;
        speakText(textoObraModal);
    }
}

function cerrarModal() {
    document.getElementById('infoModal').style.display = 'none';
    document.getElementById('modal-audio').pause();
    
    if (typeof isAudioSupportEnabled !== 'undefined' && isAudioSupportEnabled) {
        speakText("Modal cerrado.");
    }
}