# Capturas OCR en Android (prototipo)
Abre `https://carniceriarodri.github.io/IT-Control-Pro/mobile/` en Chrome para Android. Puedes usar «Añadir a pantalla de inicio».

## Uso
1. Abre cámara o galería y elige fotos.
2. Pulsa «Reconocer texto de todas». Se utiliza Tesseract.js con idioma español **dentro del navegador**; los modelos y el motor OCR se descargan inicialmente de un CDN y pueden necesitar conexión.
3. Revisa y corrige el texto editable. Puedes descargar foto JPEG y texto TXT directamente.
4. Si está autorizado, crea **otro repositorio privado** en GitHub, separado del repositorio público IT-Control-Pro.
5. Genera un **fine-grained personal access token** restringido a ese repositorio, con permiso **Contents: Read and write**, de duración corta. No compartas ni pegues el token en ningún otro sitio.
6. Introduce `propietario/repositorio`, pega el token, confirma la autorización y pulsa «Enviar fotos + OCR a GitHub».
7. En Windows, inicia sesión en GitHub, abre ese repositorio privado, carpeta `capturas/FECHA/`, y descarga imágenes y TXT.

El prototipo no incluye aún inicio de sesión corporativo ni sincronización con la base de datos Windows. Los archivos no deben contener información corporativa ni datos personales salvo aprobación formal de la organización para ese almacenamiento, tratamiento y conexión. No publiques un token en el repositorio ni lo guardes en el navegador.

## Privacidad y límites
- El OCR se ejecuta en el teléfono; no se envía la imagen a un servicio externo de reconocimiento. Sin embargo, el navegador carga JavaScript y modelos desde CDN, por lo que la ejecución es dependiente de un tercero y de la conectividad.
- Al preparar JPEG se eliminan metadatos habituales, pero el contenido fotografiado puede seguir mostrando información sensible. La calidad del OCR depende del enfoque, luz y tipografía.
- Las fotos se redimensionan a 2400 píxeles de lado mayor. Máximo 10 MB por imagen de entrada. Las fotos no se suben automáticamente; solo al confirmar envío.
- Se comprueba que el repositorio privado exista antes de subir. Si una subida falla a mitad, algunos ficheros pueden quedar guardados y requerir limpieza manual.
- El token solo se usa en memoria temporal de la página durante el envío y se borra del campo al finalizar. Esto **no** proporciona las garantías de una integración OAuth corporativa; usa un token de alcance mínimo y evita dispositivos o navegadores no autorizados.
- No existe acceso a la carpeta SMB desde Android ni se necesita para este flujo: Windows recupera las fotos desde GitHub.
- Para un uso real corporativo habría que revisar permisos, autenticación, origen de los scripts, políticas de datos y despliegue bajo dominio autorizado.
