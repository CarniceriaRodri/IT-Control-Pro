import { useState } from "react";

type Topic = { title: string; summary: string; steps: string[] };
const topics: Topic[] = [
  {title:"Primeros pasos",summary:"Crear, localizar y modificar registros.",steps:[
    "En el Panel principal aparecen los módulos activos y sus contadores.",
    "Abre un módulo y pulsa «Nuevo registro»; rellena los campos y guarda.",
    "Busca en la tabla mientras escribes. El buscador general encuentra registros de otros módulos.",
    "Edita o archiva un registro desde la tabla. Archivar no significa borrarlo.",
    "La aplicación funciona en ordenador y móvil; el lugar donde se guardan los datos depende del modo de conexión."
  ]},
  {title:"Módulos y formularios",summary:"Diseña tus propias pequeñas aplicaciones sin tocar código.",steps:[
    "Abre Administración → Módulos y formularios → «Crear módulo».",
    "Selecciona el nuevo módulo y pulsa «Añadir campo». Puedes añadir texto, fechas, estados, opciones, fotos y relaciones.",
    "Ordena los campos con las flechas. «Mostrar según otro campo» permite que un formulario se adapte al valor elegido.",
    "Para quitar un campo sin perder datos utiliza «Ocultar»; para un campo vacío, «Quitar» permite eliminarlo de la definición.",
    "El campo «Marca» es texto editable; no existe un módulo Fabricantes obligatorio."
  ]},
  {title:"Relaciones y altas encadenadas",summary:"Busca, selecciona o crea registros de otros módulos sin abandonar el formulario.",steps:[
    "En Administración configura un campo como «relación» o «relación múltiple» y elige el módulo de destino.",
    "Al editar una incidencia, por ejemplo, escribe el nombre de un equipo en su relación; las coincidencias aparecen inmediatamente.",
    "Si el equipo no existe, usa «+ Nuevo». Mientras creas el equipo puedes crear su centro y después regresar al formulario inicial.",
    "Las relaciones utilizan identificadores internos estables. Cambiar el nombre visible no altera las conexiones.",
    "Las altas relacionadas se preparan como borradores y se confirman con el registro principal para evitar registros huérfanos.",
    "Las relaciones se pueden configurar individualmente y desactivar sin borrar los datos vinculados."
  ]},
  {title:"Identificadores y coincidencias",summary:"Reconocer que dos archivos hablan del mismo dispositivo.",steps:[
    "Todo registro tiene un identificador interno que no debes sustituir por el hostname o la dirección IP.",
    "Un identificador de negocio puede ser el nombre de equipo, el número de serie o una etiqueta de inventario.",
    "Un identificador alternativo ayuda a reconocer registros cuando falta el principal.",
    "Una IP puede cambiar o reutilizarse: no es una clave permanente recomendable por sí sola.",
    "Verifica las coincidencias dudosas antes de unificar: diferentes equipos pueden compartir datos por errores de importación.",
    "Conserva la fuente original y las copias cuando se modifiquen datos importados."
  ]},
  {title:"CSV y LibreOffice Calc",summary:"Importa tablas conservando los encabezados y el contenido.",steps:[
    "En Administración selecciona «Crear módulo desde una tabla», o dentro de un módulo pulsa «Importar tabla».",
    "Elige un archivo CSV o ODS; si es ODS selecciona la hoja deseada.",
    "La primera fila contiene los encabezados. La importación crea los campos nuevos automáticamente y reutiliza los antiguos solo cuando coinciden y son compatibles.",
    "No hace falta adaptar el archivo a los campos antiguos ni seleccionar correspondencias: los datos son el punto de partida.",
    "En las opciones avanzadas puedes excluir columnas, forzar campos nuevos o elegir correspondencias manuales si lo necesitas.",
    "Puedes conservar todos los campos antiguos u ocultar los que no estén en el archivo, sin borrar sus datos.",
    "Revisa las primeras filas y los posibles errores. Por defecto se conservan las filas con contenido repetido.",
    "El archivo de origen no cambia. Se prepara un punto de recuperación al confirmar la importación.",
    "Puedes añadir, reorganizar, ocultar o quitar campos más adelante; los campos con datos se ocultan para no perder información."
  ]},
  {title:"Agenda, tareas y contactos",summary:"Llamadas, citas, seguimientos e incidencias vinculadas.",steps:[
    "Agenda permite registrar fecha, hora, teléfono, estado y relaciones con otros módulos.",
    "Tareas e Incidencias pueden vincularse con equipos o contactos existentes.",
    "Desde el selector relacional puedes dar de alta un contacto que falte.",
    "Los estados pueden ampliarse en Administración desde la configuración de campos.",
    "Los avisos nativos de Windows y las notificaciones sincronizadas entre dispositivos necesitan un servicio específico; no se activan desde la web pública."
  ]},
  {title:"Inventario, almacén y movimientos",summary:"Equipos, ubicación, préstamos y salidas.",steps:[
    "Inventario permite guardar datos de equipos y usar un número de serie o hostname como referencia de negocio.",
    "Almacén recoge artículos y existencias registradas; la conciliación automática de entradas, salidas y devoluciones sigue en desarrollo.",
    "Movimientos permite registrar entradas, salidas, traslados, préstamos y devoluciones, asociando equipos, centros, incidencias y responsables. La conciliación automática de existencias sigue pendiente.",
    "Los centros y contactos se vinculan desde campos de relación, sin copiarlos manualmente en varios módulos.",
    "Los documentos, fotografías y archivos pueden adjuntarse a módulos y registros."
  ]},
  {title:"Redes y monitorización",summary:"Diagnósticos disponibles y límites del control continuo.",steps:[
    "El módulo Redes permite almacenar dispositivos y direcciones y consultar sus datos.",
    "Las comprobaciones de red disponibles dependen de la plataforma y de un servicio Windows local autorizado.",
    "En Windows con el servicio local puedes añadir hasta diez IP privadas autorizadas y activar su comprobación periódica cada dos minutos; se detiene al reiniciar el servidor.",
    "Una web de GitHub Pages no puede ejecutar ping ICMP continuamente ni explorar redes corporativas por sí sola.",
    "Los umbrales configurables, el mantenimiento horario y las notificaciones del sistema todavía no están incorporados al monitor de prueba.",
    "Realiza exclusivamente verificaciones de sistemas para los que tengas autorización."
  ]},
  {title:"Archivos, OCR y documentos",summary:"Fotografías, ficheros y extracción de texto.",steps:[
    "En cada módulo encontrarás «Archivos y fotos» para gestionar adjuntos.",
    "Cuando el dispositivo y navegador lo permiten, «Tomar foto» puede abrir la cámara.",
    "La extracción OCR depende de la función y dispositivo disponibles; revisa los resultados antes de guardarlos.",
    "No cargues documentación corporativa sensible en un repositorio público.",
    "Los adjuntos se mantienen separados de los campos del formulario."
  ]},
  {title:"Copias, recuperación y almacenamiento",summary:"Evita perder información al cambiar de navegador o equipo.",steps:[
    "En Administración → Copias y restauración puedes exportar e importar una copia JSON.",
    "El almacenamiento local del navegador no se sincroniza con los otros equipos ni teléfonos automáticamente.",
    "Hay rotación configurable de copias locales; conviene descargar copias externas periódicamente.",
    "Para compartir datos entre equipos necesitas el servicio Windows autorizado o un servidor con autenticación y permisos.",
    "GitHub Pages aloja la interfaz; no sustituye una base de datos de uso compartido.",
    "Antes de importar una copia, revisa el resumen y confirma expresamente la sustitución de los datos."
  ]},
  {title:"Configuración y seguridad",summary:"Qué se puede hacer desde Administración.",steps:[
    "Activa o desactiva módulos y decide sus campos, opciones, relaciones y visibilidad.",
    "Evita borrar o reutilizar identificadores internos de registros.",
    "Los permisos corporativos, el registro de auditoría seguro y el acceso concurrente requieren un backend autenticado.",
    "Usa solo datos ficticios al probar la versión pública; no publiques IP internas ni datos personales en GitHub."
  ]}
];
const glossary: [string,string][] = [
  ["Alta","Creación de un registro nuevo."],
  ["Archivo CSV","Tabla de texto con filas y columnas, que puede abrirse con Calc."],
  ["Baja lógica / archivar","Ocultar un registro de los activos sin borrarlo."],
  ["Campo","Dato o columna configurable dentro de un módulo."],
  ["Campo obligatorio","Campo que debe rellenarse para guardar."],
  ["Clave alternativa","Identificador adicional para reconocer una entidad."],
  ["Clave compuesta","Identificación que depende de varios campos combinados."],
  ["Coincidencia / correspondencia","Detección de registros que parecen representar la misma entidad."],
  ["Contacto","Ficha que guarda nombre, teléfono u otros datos de relación."],
  ["Copia de seguridad","Versión recuperable de los datos y archivos."],
  ["Desvincular","Quitar una relación sin borrar los registros de origen y destino."],
  ["Entidad / registro","Una fila de información, como una impresora o incidencia."],
  ["Formulario dinámico","Pantalla cuyos campos pueden configurarse sin cambiar código."],
  ["Hostname","Nombre de un equipo o dispositivo en una red."],
  ["Identificador interno (UUID)","Código permanente utilizado para enlazar los registros."],
  ["Identificador de negocio","Valor reconocible, como número de serie o nombre de equipo."],
  ["Importación","Lectura de datos de un archivo para incorporarlos a un módulo."],
  ["Módulo","Conjunto configurable de registros, campos y funcionalidades."],
  ["Módulo maestro","Módulo que ofrece datos compartidos, como Centros o Contactos."],
  ["Multimodularidad","Capacidad de crear módulos independientes que se relacionan entre sí."],
  ["OCR","Reconocimiento de texto contenido en fotografías o documentos."],
  ["ODS","Formato de hoja de cálculo de LibreOffice Calc."],
  ["Relación","Vínculo entre un registro y otro de uno o varios módulos."],
  ["Relación múltiple","Campo que permite vincular varios registros."],
  ["Selector inteligente","Buscador desplegable para encontrar, elegir o crear un registro vinculado."],
  ["Sincronización","Mantenimiento de los mismos datos actualizados entre varios dispositivos."],
  ["Vista previa","Comprobación de datos y columnas antes de importar o modificar."],
];
export function Help() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("es");
  const filtered = topics.filter(item => (item.title+" "+item.summary+" "+item.steps.join(" ")).toLocaleLowerCase("es").includes(q));
  const terms = glossary.filter(item => item.join(" ").toLocaleLowerCase("es").includes(q));
  return <div className="helpScreen">
    <section className="helpIntro">
      <h2>Ayuda de IT Control Pro</h2>
      <p>Guía de uso, ejemplos y glosario. La información diferencia las funciones disponibles de las previstas para futuras versiones.</p>
      <label>Buscar en la ayuda
        <input type="search" aria-label="Buscar en la ayuda" placeholder="Ej. importar, relación, copias…" value={query} onChange={e=>setQuery(e.target.value)}/>
      </label>
    </section>
    <section>
      <h2>Guías de uso</h2>
      <div className="helpTopics">{filtered.map((item,i)=><details key={item.title} open={q.length>0 && i<3}>
        <summary>{item.title}<small>{item.summary}</small></summary>
        <ol>{item.steps.map((step,j)=><li key={j}>{step}</li>)}</ol>
      </details>)}</div>
      {!filtered.length && <p>Sin guías coincidentes.</p>}
    </section>
    <section>
      <h2>Glosario de términos</h2>
      <div className="helpGlossary">{terms.map(([term,desc])=><div key={term}>
        <strong>{term}</strong><p>{desc}</p>
      </div>)}</div>
      {!terms.length && <p>Sin términos coincidentes.</p>}
    </section>
    <section className="helpFoot">
      <h2>¿Dónde están los datos?</h2>
      <p>Si usas la web sin servidor, los datos se guardan en el navegador de este dispositivo. Las funciones de almacenamiento compartido, avisos de Windows y monitorización continua requieren servicios adicionales y permisos adecuados.</p>
      <p>Antes de cualquier cambio importante, entra en Administración y exporta una copia de seguridad.</p>
    </section>
  </div>;
}
