# Fotografías y reconocimiento en IT Control Pro

La sección **Documentos y fotografías** de cada registro o módulo ofrece cuatro entradas inspiradas en la experiencia de Carnicería Rodri: **Cámara**, **Dispositivo**, **Biblioteca** y **Archivos**.

- **Cámara:** intenta abrir la cámara trasera del móvil (dependiendo del navegador). 
- **Dispositivo:** permite elegir varias fotografías simultáneamente; si exceden el tamaño permitido o su formato no está admitido directamente, se intentan optimizar como JPG.
- **Biblioteca:** muestra fotos que ya están asociadas a módulos o registros en el mismo espacio de trabajo, permite buscarlas por nombre, previsualizarlas y asociarlas a otro registro sin duplicar los datos binarios.
- **Archivos:** adjunta otros tipos de documento.
- **OCR:** bajo petición, reconoce texto en español e inglés mediante Tesseract.js ejecutado en el navegador; ofrece revisión y exportación a TXT que puede adjuntarse al registro.
- **Código:** detecta QR y códigos de barras mediante la API BarcodeDetector cuando el navegador la admite. Permite revisar los resultados y guardarlos como TXT.

**Importante:** detectar un código o extraer texto no equivale a identificar automáticamente el objeto fotografiado. El reconocimiento visual semántico de un modelo de impresora o una avería no está implementado.

**Privacidad:** la imagen no se envía a una API OCR, pero la primera ejecución **descarga el motor de Tesseract desde un CDN de terceros**, por lo que para un despliegue corporativo habrá que sustituir esa dependencia por archivos revisados y hospedados internamente. No usar datos reales ni fotografías corporativas hasta autorización. El OCR del navegador puede fallar sin conexión a Internet.

**Persistencia:** los ficheros y los TXT se adjuntan solo al pulsar **Guardar registro**, como cualquier otro documento. El texto de los TXT no está todavía incorporado al índice global de búsqueda. La biblioteca reutiliza exclusivamente fotografías almacenadas y no es una copia externa en GitHub.
