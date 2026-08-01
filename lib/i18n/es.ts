import type { Dict } from "./types";

export const es: Dict = {
  nav: { howItWorks: "Cómo funciona", language: "Idioma" },
  landing: {
    badge: "IA en tu dispositivo · No se sube nada durante el escaneo gratuito",
    headline: "Descubre dónde estás",
    headlineAccent: "realmente.",
    sub: "Análisis de geometría facial de precisión clínica que se ejecuta íntegramente en tu navegador. 478 puntos de referencia. 16 medidas reales. Un plan que puedes aplicar hoy.",
    cta: "Iniciar escaneo gratis",
    ctaNote:
      "Escaneo gratuito · No necesitas cuenta para empezar · Pago único para el informe completo",
    expired:
      "Tu sesión ha expirado — como prometimos, tus fotos y tu escaneo se eliminaron de la memoria. Puedes empezar de nuevo cuando quieras.",
    trust: [
      {
        title: "Las fotos nunca se suben",
        text: "El escaneo gratuito se ejecuta 100 % en tu dispositivo — tus fotos permanecen en esta pestaña y caducan solas.",
      },
      {
        title: "Geometría de 478 puntos",
        text: "Medidas reales: desviación de simetría, inclinación cantal en grados, ángulos mandibulares. Nada de suposiciones.",
      },
      {
        title: "Pago único",
        text: "Sin suscripción ni renovación automática. Paga una vez y conserva tu informe para siempre.",
      },
    ],
    stepsTitle: "Cómo funciona",
    steps: [
      { title: "Responde 6 preguntas", text: "60 segundos — calibra tu análisis." },
      { title: "Dos fotos", text: "Frontal y perfil. Nunca salen de tu navegador." },
      { title: "Escaneo en tu dispositivo", text: "478 puntos mapeados y medidos localmente." },
      { title: "Tu informe", text: "16 medidas, puntuaciones por categoría y un plan de acción real." },
    ],
    disclaimer:
      "FaceScan ofrece estimaciones geométricas como orientación para la mejora personal. No es un producto sanitario y ningún resultado constituye una valoración médica o dermatológica.",
  },
  quiz: {
    progress: "Pregunta {n} de {total}",
    back: "Atrás",
    home: "Inicio",
    minorTitle: "FaceScan es para mayores de 18",
    minorBody:
      "Tu estructura facial todavía está cambiando: cualquier puntuación que te diéramos hoy estaría equivocada en un año, y por principio no analizamos rostros de menores. Vuelve cuando tengas 18.",
    minorCta: "Volver al inicio",
    questions: [
      {
        title: "¿Cómo calibramos tu escaneo?",
        sub: "Los rangos de referencia difieren — esto fija la base correcta.",
        options: ["Hombre", "Mujer"],
      },
      { title: "¿Cuántos años tienes?", options: ["Menos de 18", "18–24", "25–34", "35+"] },
      {
        title: "¿Qué es lo que más te molesta de tu cara?",
        options: ["Asimetría", "Mandíbula poco marcada", "Zona de los ojos", "Calidad de la piel", "Pérdida de pelo"],
      },
      {
        title: "¿Porcentaje estimado de grasa corporal?",
        sub: "La definición facial depende mucho de la grasa corporal.",
        options: ["Menos del 12 %", "12–18 %", "19–25 %", "Más del 25 %", "No lo sé"],
      },
      {
        title: "¿Practicas la postura lingual (mewing)?",
        options: ["Nunca", "A veces", "A diario"],
      },
      {
        title: "¿Cuál es tu objetivo final?",
        options: ["Nivel modelo", "Confianza al ligar", "Mejora personal general", "Solo curiosidad"],
      },
    ],
  },
  upload: {
    title: "Dos fotos. Nada más.",
    sub: "El escaneo mapea 478 puntos faciales desde tu foto frontal; el perfil afina la geometría.",
    tips: [
      "Luz natural uniforme — colócate frente a una ventana",
      "Expresión neutra, boca cerrada",
      "Sin gafas, pelo retirado de la cara",
    ],
    front: "Foto frontal",
    frontHint: "Mira de frente a la cámara, cabeza nivelada.",
    side: "Foto de perfil",
    sideHint: "Gírate 90° — oreja hacia la cámara.",
    added: "añadida",
    replace: "Cambiar foto",
    privacy:
      "Las fotos permanecen en esta pestaña — no se sube nada durante el escaneo gratuito.",
    cta: "Iniciar análisis",
    errType: "Elige un archivo de imagen (JPG, PNG, WebP).",
    errSize: "La imagen supera los 10 MB — elige una más pequeña.",
  },
  scan: {
    lines: [
      "Cargando el modelo FaceLandmarker…",
      "Detectando la región facial…",
      "Mapeando 478 puntos faciales…",
      "Corrigiendo la inclinación de la cabeza…",
      "Midiendo la inclinación cantal…",
      "Analizando el contorno mandibular…",
      "Calculando la simetría bilateral…",
      "Evaluando las proporciones faciales…",
      "Preparando tu plan de acción…",
    ],
    running: "Se ejecuta localmente en tu navegador — no se sube nada.",
    keepOpen: "Mantén esta pestaña abierta hasta que termine el análisis.",
    failedTitle: "Escaneo fallido",
    errNoFace:
      "No hemos detectado ninguna cara en tu foto frontal. Usa luz uniforme, mira directamente a la cámara y asegúrate de que se vea toda tu cara.",
    errModel:
      "No se ha podido cargar el modelo de análisis. Comprueba tu conexión (el modelo se descarga una vez) e inténtalo de nuevo.",
    backToPhotos: "Volver a las fotos",
    retry: "Reintentar",
    front: "Foto frontal",
    side: "Foto de perfil",
  },
  results: {
    overall: "Puntuación global",
    outOf: "sobre 10",
    demoData: "Datos de demo",
    landmarks: "Puntos",
    measured: "Medidas",
    inRange: "En rango",
    breakdown: "Desglose biométrico",
    breakdownSub: "Puntuaciones por categoría a partir del conjunto completo de medidas.",
    symmetry: "Simetría",
    eyes: "Ojos",
    jaw: "Mandíbula",
    ratios: "Proporciones",
    midface: "Tercio medio",
    allMeasurements: "Todas las medidas",
    allMeasurementsSub: "La tabla completa detrás de los gráficos circulares.",
    skinTitle: "Piel y pelo",
    skinSub:
      "No se puede deducir de la geometría de puntos — se evalúa desde tu foto con el modelo de visión en tu informe de IA.",
    planTitle: "Tu plan de mejora",
    planSub: "Ordenado por impacto previsto para tus medidas concretas.",
    completed: "Completado",
    inCategoryRange: "{n}/{total} en rango",
    unlockTitle: "{n} medidas están listas",
    unlockBody: "Tus tres mayores oportunidades:",
    unlockCta: "Desbloquear todo",
    unlockNote: "Pago único · Sin suscripción · Acceso de por vida",
    unlockChips: ["👁️ Zona ocular", "🗿 Mandíbula", "📐 Proporciones", "👃 Tercio medio", "✨ Plan de mejora"],
    unlocked: "Análisis completo desbloqueado",
    disclaimer:
      "Cada cifra es una medida geométrica calculada en tu dispositivo a partir de puntos faciales y comparada con rangos de referencia poblacionales publicados. Orientación para la mejora personal — no es una valoración médica, dermatológica ni psicológica, ni un juicio sobre el aspecto de nadie.",
    reference: "ref.",
    tableHead: ["Medida", "Valor", "Referencia", "Estado", "Puntos"],
  },
  checkout: {
    eyebrow: "Desbloqueo único",
    product: "Análisis biométrico completo",
    once: "pago único · sin suscripción",
    features: [
      "Las 16 medidas biométricas desbloqueadas",
      "Simetría, inclinación cantal y mandíbula en cifras exactas",
      "Plan de acción personalizado",
      "Informe de IA a partir de tus fotos",
      "Acceso de por vida — pago único",
    ],
    emailPlaceholder: "Email para tu recibo",
    cardNote: "Los datos de la tarjeta se introducen en la página de pago",
    pay: "Pagar {price} y desbloquear",
    processing: "Procesando…",
    secure: "Pago cifrado",
    noCardData: "Los datos de tarjeta nunca tocan nuestros servidores",
    mockWarning:
      "Versión de desarrollo — esto es una simulación de pago. No se cobra nada ni se recogen datos de tarjeta. Conecta Stripe antes del lanzamiento.",
    close: "Cerrar",
  },
  report: {
    title: "Informe detallado de IA",
    body: "Tu informe completo lo genera Claude Vision a partir de tus dos fotos, tus medidas y tus respuestas.",
    consent:
      "Acepto que mis dos fotos se transmitan una sola vez, de forma segura, para su procesamiento por IA y la generación de este informe. No se almacenan en el servidor después del procesamiento.",
    generate: "Generar mi informe completo",
    generating: "Generando tu informe…",
    oneTime: "Transmisión única, nada se almacena",
    errNoPhotos:
      "Tus fotos ya no están en esta sesión del navegador (nunca se almacenan). Haz un nuevo escaneo para generar el informe.",
    errNetwork: "Error de red — inténtalo de nuevo.",
  },
  session: {
    notice:
      "Sesión privada — tus fotos y tu escaneo solo están en este navegador y se descartarán en",
  },
  status: {
    in: "Dentro del rango de referencia",
    below: "Por debajo del rango",
    above: "Por encima del rango",
  },
  statusShort: { in: "En rango", below: "Debajo", above: "Encima" },
  categories: {
    eyes: {
      label: "Zona ocular",
      blurb: "Inclinación, separación y apertura — la zona más determinante del rostro.",
    },
    jaw: {
      label: "Mandíbula y mentón",
      blurb: "Estructura del tercio inferior. La zona que más responde a la grasa corporal.",
    },
    proportions: {
      label: "Proporciones",
      blurb: "Cómo se divide el rostro en vertical y en horizontal.",
    },
    midface: {
      label: "Nariz y boca",
      blurb: "Relaciones del tercio central y equilibrio de los labios.",
    },
  },
  metrics: {
    canthalTilt: {
      label: "Inclinación cantal",
      note: "Ángulo del canto interno al externo. Positivo significa que la esquina externa está más alta.",
    },
    esr: {
      label: "Índice de separación ocular",
      note: "Distancia entre los cantos internos respecto al ancho facial. El canon neoclásico ronda 0,45.",
    },
    eyeSpacing: {
      label: "Separación de los ojos",
      note: "Hueco entre los ojos medido en anchos de ojo. El canon clásico es exactamente uno.",
    },
    eyeAspect: {
      label: "Apertura ocular",
      note: "Altura de la apertura respecto a su ancho. Un valor bajo puede significar simplemente que parpadeaste — repite la foto.",
    },
    browPosition: {
      label: "Posición de la ceja",
      note: "Distancia ceja-párpado en alturas de ojo. Menor se lee como una ceja más encapotada y hundida.",
    },
    gonialAngle: {
      label: "Ángulo goníaco",
      note: "Ángulo en el que gira la mandíbula en el gonion. Los ángulos cerrados se leen más marcados, aunque la grasa lo enmascara mucho.",
    },
    jawWidth: {
      label: "Ancho mandíbula-pómulo",
      note: "Ancho mandibular respecto al de los pómulos. Muy alto pierde el afilado; muy bajo se ve estrecho.",
    },
    chinRatio: {
      label: "Mentón-filtrum",
      note: "Altura del mentón frente al filtrum. El objetivo clásico ronda el dos a uno.",
    },
    thirds: {
      label: "Tercios faciales",
      note: "Cómo de uniformemente se divide la cara en tercios superior, medio e inferior. Menos desviación es más cercano al canon.",
    },
    fifths: {
      label: "Quintos faciales",
      note: "Ancho facial medido en anchos de ojo. El canon divide la cara en cinco quintos verticales iguales.",
    },
    fwhr: {
      label: "fWHR",
      note: "Relación ancho-alto facial: la medida individual más estudiada en la investigación morfológica.",
    },
    facialIndex: {
      label: "Índice facial",
      note: "Altura total frente al ancho. Más alto se lee largo y estrecho; más bajo, corto y ancho.",
    },
    mouthNose: {
      label: "Ancho boca-nariz",
      note: "Ancho de boca en anchos de nariz. El canon clásico sitúa la boca en torno a 1,5 veces la nariz.",
    },
    noseWidth: {
      label: "Ancho de la nariz",
      note: "Ancho nasal respecto al facial — uno de los quintos horizontales clásicos.",
    },
    lipRatio: {
      label: "Proporción labial",
      note: "Altura del labio inferior frente al superior. Alrededor de 1,6 : 1 es el objetivo estético más citado.",
    },
    midface: {
      label: "Proporción del tercio medio",
      note: "Distancia línea ocular-labio frente a la separación de los ojos. Los tercios medios compactos se leen como más juveniles.",
    },
  },
  bands: {
    exceptional: {
      label: "Excepcional",
      blurb:
        "Geometría de primer nivel en casi todas las medidas. Tus palancas están en el refinamiento, no en la corrección.",
    },
    strong: {
      label: "Fuerte",
      blurb:
        "Cómodamente por encima del rango de referencia. Unos pocos ajustes concretos rinden mucho desde aquí.",
    },
    solid: {
      label: "Sólido",
      blurb: "Buena base con un margen de mejora claro y abordable.",
    },
    reference: {
      label: "Rango de referencia",
      blurb:
        "Plenamente en la media — que es justo donde están las mayores mejoras visibles.",
    },
    developing: {
      label: "En desarrollo",
      blurb:
        "Mucho margen. Empieza por lo primero de tu plan y baja — los primeros puntos son los que más mueven.",
    },
  },
  plan: {
    bodyFat: {
      title: "Baja la grasa corporal hacia el 12–18 %",
      detail:
        "La definición facial es sobre todo cuestión de grasa corporal. Acercarte al 12–18 % hará más por tu mandíbula y tus pómulos que cualquier aparato o truco del mercado.",
      tag: "Mandíbula",
      cadence: "Continuo",
    },
    guaSha: {
      title: "Gua sha en la mandíbula y bajo los ojos",
      detail:
        "Dos sesiones por semana, poco aceite, pasadas suaves del mentón a la oreja. Moviliza linfa: espera un efecto descongestivo de horas, no una remodelación ósea.",
      tag: "Mandíbula",
      cadence: "2× / semana",
    },
    tonguePosture: {
      title: "Hábito diario de postura lingual",
      detail:
        "Lengua completa contra el paladar, labios cerrados, respiración nasal. La evidencia de cambio óseo en adultos es débil: trátalo como trabajo postural. Mastica por igual en ambos lados.",
      tag: "Mandíbula",
      cadence: "A diario",
    },
    retinoid: {
      title: "Retinoide de noche, 3 noches por semana",
      detail:
        "Empieza con adapaleno 0,1 % o retinol 0,3 % sobre piel seca tras la limpieza, hidratante encima. Sube a diario en 8–12 semanas. Ir más fuerte y más rápido solo compra irritación.",
      tag: "Piel",
      cadence: "3 noches / semana",
    },
    spf: {
      title: "SPF 30+ todas las mañanas",
      detail:
        "La intervención cutánea con mayor retorno, y la que todo el mundo se salta. Protege todo lo demás que hagas, incluido el retinoide, que vuelve la piel sensible al sol.",
      tag: "Piel",
      cadence: "A diario",
    },
    asymmetry: {
      title: "Revisa las causas de tu asimetría",
      detail:
        "Alterna el lado de masticación, deja de dormir boca abajo sobre la misma mejilla y ajusta la altura de la pantalla para no inclinar la cabeza ocho horas al día. Palancas pequeñas, pero las que controlas.",
      tag: "Simetría",
      cadence: "Continuo",
    },
    depuff: {
      title: "Rutina antihinchazón para la zona ocular",
      detail:
        "Menos sodio por la noche, 7,5 h o más de sueño, alcohol moderado y dormir con la cabeza algo elevada. La mayoría de quejas de la zona ocular son retención de líquidos, no estructura ósea.",
      tag: "Ojos",
      cadence: "A diario",
    },
    proportions: {
      title: "Peina según tus proporciones, no contra ellas",
      detail:
        "Las proporciones verticales son hueso y no cambian. Un corte con la altura adecuada y una línea de barba que alargue o ensanche el tercio inferior cambian la lectura mucho más que cualquier ejercicio.",
      tag: "Proporciones",
      cadence: "Próximo corte",
    },
    hair: {
      title: "Caída del pelo: actúa pronto, consulta a un médico",
      detail:
        "Minoxidil y finasterida son las únicas intervenciones con evidencia sólida, y ambas funcionan mejor antes de que la pérdida sea visible. Pide cita en vez de experimentar con suplementos.",
      tag: "Pelo",
      cadence: "Este mes",
    },
    grooming: {
      title: "Sesión con un buen barbero",
      detail:
        "Un corte acorde a tu forma de cara, cejas aseadas en vez de esculpidas y una línea de barba constante. El cambio más barato, rápido y visible de esta lista.",
      tag: "Cuidado",
      cadence: "Cada 4 semanas",
    },
    sleep: {
      title: "El sueño es el multiplicador",
      detail:
        "7,5–9 horas con horario constante. La reparación de la piel, el equilibrio de líquidos y la frescura facial dependen más del sueño que de cualquier producto de tu armario.",
      tag: "Estilo de vida",
      cadence: "Cada noche",
    },
  },
};
