/*
 * IDENTIFICADOR DEL EMPTY (campo "punto"): dice en qué empty de Blender va cada obra.
 *   punto: "cuadro1"     → Punto_cuadro1
 *   punto: "personaje1"  → Punto_cuadro_personaje1 (o Punto_personaje1)
 *   punto: "video1"      → Punto_video1
 *   También sirve el nombre exacto: punto: "Punto_cuadro_personaje3"
 *   o solo el número: punto: 4  (usa el tipo de la obra → imagen = cuadro4)
 *
 * Sin "punto", la obra va al siguiente empty libre de su tipo, en el orden de esta lista:
 *   tipo: "imagen"    → Punto_cuadro#
 *   tipo: "video"     → Punto_video#       (si ya no hay libres, usa un Punto_cuadro)
 *   tipo: "personaje" → Punto_personaje#   (si ya no hay libres, usa un Punto_cuadro)
 *
 * Personaje: retrato enmarcado + nota de "Semblanza" debajo.
 *   nombre     → nombre de la persona (se usa como título)
 *   vida       → fechas, ej. "1890 – 1965" o "n. 1932"
 *   rol        → a qué se dedicó (opcional)
 *   url        → foto del retrato
 *   semblanza  → texto biográfico. Puede ser largo: separa párrafos con \n\n
 *                o escríbelo como arreglo ["Párrafo 1", "Párrafo 2", ...]
 *   cita       → frase destacada del personaje (opcional, sale resaltada)
 *   origen, nacimiento, autor (de la foto), fuente, audioUrl → opcionales
 */
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
                    punto: "cuadro1",
                    titulo: "Señor y señora Arroyo ",
                    anio: "1920",
                    url: "assets/images/Imagenes/Alejandro/FADIS-FOT-0001.JPG",
                    descripcion: "Pareja, una señora y un señor, captados en uno de los muros de su casa"
                },
                {
                    tipo: "imagen",
                    punto: "cuadro2",
                    titulo: "Gabino Olivares, Cacique",
                    anio: "1912",
                    url: "assets/images/Imagenes/Alejandro/FADIS-FOT-0002.JPG",
                    descripcion: "4 mujeres, una niña entre las piernas del señor con sombrero charro que se encuentra  sentado y otro parado detrás de el igual con sombrero."
                },
                {
                    tipo: "personaje",
                    punto: "personaje1",
                    nombre: "Alejandro Suárez Camargo ",
                    vida: "1890 – 1965",
                    rol: "A qué se dedicó (ej. fotógrafo, cronista, danzante)",
                    url: "assets/images/Imagenes/Alejandro/FADIS-FOT-998.JPG",
                    semblanza: "Destacado antropólogo social egresado de la Universidad Autónoma Metropolitana, unidad Iztapalapa, ha tejido una trayectoria profunda y transformadora consagrada al entendimiento y la defensa de las comunidades a lo largo y ancho del país. Como fundador de Xilu Xahui, ha demostrado que el rigor académico de la disciplina antropológica no pertenece únicamente a los cubículos universitarios, sino que cobra verdadero sentido cuando se traduce en acción viva, escucha activa y proyectos sociales de alto impacto en distintas regiones de México. Su labor con esta fundación refleja un compromiso ético inquebrantable, articulando saberes comunitarios y herramientas metodológicas para impulsar procesos de desarrollo y revalorización cultural desde el respeto absoluto a la autonomía de los pueblos. Lejos de asumir posturas mesiánicas, Alejandro se distingue por caminar a ras de suelo, dialogar de igual a igual y construir puentes sólidos entre la investigación y la transformación social cotidiana. Para las nuevas generaciones de profesionales y estudiantes, su figura representa un faro indispensable: un recordadero viviente de que la antropología social es, antes que nada, un acto de empatía crítica, un ejercicio de congruencia y una vocación incansable por construir un país más justo y consciente de su pluriculturalidad."
                },
                {
                    tipo: "imagen",
                    punto: "cuadro3",
                    titulo: "Vestimenta rural de la epoca",
                    anio: "1925",
                    url: "assets/images/Imagenes/Alejandro/FADIS-FOT-0004.JPG",
                    descripcion: "Una pareja de esposos posa frente a su casa de adobe. El señor viste ropa de trabajo y su esposa lleva falda larga, rebozo al pecho y dos trenzas, características de la época. Ambos sostienen sus sombreros en las manos."
                },
                {
                    tipo: "imagen",
                    punto: "cuadro4",
                    titulo: "Barda de Adobe",
                    anio: "1935",
                    url: "assets/images/Imagenes/Alejandro/FADIS-FOT-0003.JPG",
                    descripcion: "Un señor y una señora, que se encuentran caminando, frente a una barda de adobe, la fotografia fue tomada por un vecino del lugar."
                },
                {
                    tipo: "imagen",
                    punto: "cuadro5",
                    titulo: "Serenata",
                    anio: "1933",
                    url: "assets/images/Imagenes/Alejandro/FADIS-FOT-0007.JPG",
                    descripcion: "Se observa un cuarteto de músicos con sus característicos sombreros, posando junto a un hombre que trabaja en el lugar. El hombre del mandil parece haber cantado para la dama que buscaba conquistar."
                },
                {
                    tipo: "imagen",
                    punto: "cuadro6",
                    titulo: "Elemental Felipe Villanueva",
                    anio: "1931",
                    url: "assets/images/Imagenes/Alejandro/FADIS-FOT-0006.JPG",
                    descripcion: "Los habitantes del pueblo de Tecámac se reúnen para asistir a la inauguración de la escuela, en cuyo edificio ondea la Bandera Nacional."
                },
                {
                    tipo: "imagen",
                    punto: "cuadro7",
                    titulo: "La Iglesia y el jagüey",
                    anio: "1930",
                    url: "assets/images/Imagenes/Alejandro/FADIS-FOT-0005.JPG",
                    descripcion: "Se puede apreciar el jagüey en todo su esplendor, con la iglesia del municipio de Tecámac al fondo."
                },
                {
                    tipo: "video",
                    punto: "video1",
                    titulo: "Una Carta Abierta a las Futuras Generaciones.",
                    anio: "2026",
                    url: "assets/video/Alejandro/FADIS-FILMS-002.MP4",
                    descripcion: "Un testimonio vivo y entrañable de nuestra historia, creado para que quienes vengan mañana sepan de dónde venimos, cuánto amamos nuestra tierra y cómo late el corazón de nuestra cultura en cada rincón de este valle sagrado."
                },
                {
                    tipo: "video",
                    punto: "video2",
                    titulo: "Memoria Histórica y Documental del Valle de Teotihuacán",
                    anio: "Siglo XX",
                    url: "https://www.youtube.com/watch?v=lRNY7u6ETng", // Ejemplo: Documental histórico / INAH
                    descripcion: "Registro audiovisual enfocado en la revalorización del patrimonio cultural, los pueblos y la memoria colectiva de la región."
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