const museoData = {
    institucion: "Fundación FADIS - FOCINE 2026",
    tituloProyecto: "Preservación de la Memoria Cinematográfica y Audiovisual del Valle de Teotihuacán",
    salas: [
        {
            id: 1,
            nombre: "  Hitos  y  personajes  históricos  del  Valle  de  Teotihuacán.",
            descripcion: "Registros audiovisuales y fotográficos de principios del siglo XX.",
            elementos: [
                {
                    tipo: "imagen",
                    titulo: "Procesión tradicional en San Martín",
                    anio: "1935",
                    url: "assets/images/foto_ejemplo1.webp",
                    descripcion: "Fotografía de archivo familiar rescatada."
                },
                {
                    tipo: "video",
                    titulo: "Fiesta patronal antigua (16mm)",
                    anio: "1945",
                    url: "https://www.youtube.com/embed/TU_VIDEO_ID", // Video incrustado para ahorrar espacio
                    descripcion: "Fragmento restaurado de cine doméstico."
                },
            ]
        },
        {
            id: 2,
            nombre: "Elementos culturales  en  peligro  de  extinción",
            descripcion: "Oficios tradicionales, rituales y prácticas comunitarias amenazadas.",
            elementos: [
                // Aquí se agregarán más registros de la base de datos de los 500+ archivos
            ]
        },

        {
            id: 3,
            nombre: "Participación  histórica  de  las  mujeres.",
            descripcion: "Oficios tradicionales, rituales y prácticas comunitarias amenazadas.",
            elementos: [
                // Aquí se agregarán más registros de la base de datos de los 500+ archivos
            ]
        }

        // ... Repetir hasta las 7 salas del proyecto ...
    ]
};