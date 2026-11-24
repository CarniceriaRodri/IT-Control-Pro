# Captura local CGES / CA_SIS para IT Control Pro

Complemento de Chrome/Edge, modo desarrollador. Copia el texto **visible** de la pestaña activa al portapapeles sin enviarlo a servicios externos.

1. Solicitar autorización de Sistemas y usar únicamente datos permitidos.
2. Guardar los archivos de esta carpeta en el PC.
3. En Edge abrir edge://extensions, o en Chrome chrome://extensions. Activar modo desarrollador y pulsar «Cargar descomprimida», eligiendo esta carpeta.
4. Abrir la ficha de una tarea CA_SIS o incidencia CGES, pulsar el icono del complemento y «Copiar ficha al portapapeles».
5. En IT Control Pro entrar en Tareas y abrir la edición del registro existente; pegar en «Importar tarea desde CA_SIS / Jira», analizar, revisar y aplicar, y finalmente guardar. Para CGES debe existir el importador específico de incidencias: este complemento únicamente copia.

Limitaciones: la extensión no interpreta adjuntos ni obtiene datos ocultos; no envía datos directamente a IT Control Pro. La captura de texto puede incluir información sensible, por lo que debe evitarse el uso sin autorización corporativa. Una extensión cargada manualmente puede estar bloqueada por políticas del navegador gestionado.
