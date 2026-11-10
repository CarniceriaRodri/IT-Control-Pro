# IT Control Pro en Android · aplicación completa

## Instalar desde el móvil
1. Cuando el despliegue haya finalizado, abre **https://carniceriarodri.github.io/IT-Control-Pro/android/** en Chrome.
2. En el menú de los tres puntos de Chrome, elige **Instalar aplicación** o **Añadir a pantalla de inicio**. En algunos dispositivos aparece una opción directa de instalar.
3. Abre la app. Para preparar el funcionamiento sin conexión, mantén la página abierta con Internet hasta completar la descarga de todos los recursos. Una descarga incompleta no garantiza el funcionamiento sin conexión.
4. Comprueba en modo avión que puedes abrir un módulo, ver tus registros de prueba y guardar cambios. Prueba OCR sobre una foto de ejemplo; su primer inicio puede ser más lento.

**No es un APK**. Es una PWA instalable desde Chrome y utiliza el almacenamiento del navegador del teléfono.

## Incluido
- Los mismos módulos, tablas, campos editables, relaciones (únicas, múltiples y con cualquier módulo), búsqueda y creación de registros que la versión Windows.
- Fotografía con cámara, importación múltiple, documentos, biblioteca compartida por registros y descarga de archivos.
- OCR local español e inglés con Tesseract.js y lectura de QR/barras si Android y Chrome admiten BarcodeDetector.
- Datos locales guardados en IndexedDB, historial, restauración y conservación periódica de instantáneas.
- Exportación e importación del paquete JSON que incluye fotografías, archivos y relaciones. Sirve para mover datos de prueba entre Windows y Android, **manualmente**.

## Datos y privacidad
- Los datos en Android y los datos del servidor Windows NO se sincronizan automáticamente. La carpeta compartida de Windows no es accesible directamente desde esta versión.
- La app se sirve inicialmente desde GitHub Pages, pero los registros guardados localmente no se suben por sí solos a GitHub.
- El OCR se ha preparado con JavaScript, WASM y modelos de idioma dentro del paquete, sin enviar fotos a ningún servicio externo de OCR. Los recursos se descargan de proveedores originales en **el proceso de compilación de GitHub Actions**, no desde el teléfono durante el reconocimiento.
- El almacenamiento y las copias automáticas dependen del navegador: no sustituyen una copia externa en un destino autorizado. Exporta habitualmente una copia JSON completa.
- La instalación del PWA, el uso del navegador, GitHub Pages y cualquier fotografía o documento corporativo deben estar autorizados por los responsables de Seguridad y Sistemas de tu organización.
- Para un despliegue corporativo plenamente aislado, se debe alojar la aplicación y sus recursos en infraestructura autorizada, no en GitHub Pages.

## Conexión a GitHub para capturas
La herramienta independiente `/mobile/` permite subir fotos y textos a un repositorio privado con token personal de permisos limitados, exclusivamente para pruebas autorizadas. **No es la sincronización de inventario**.
