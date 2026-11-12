# IT Control Pro 0.5.0

## Alarmas

Arranca con INICIAR-PYTHON.bat. En Agenda activa las alarmas y los avisos de Windows. La antelación inicial es cero minutos. «Probar programación en 1 minuto» introduce una alarma en la misma cola que una cita real; «Probar ventana» solo comprueba la presentación.

Los avisos nativos permanecen pendientes hasta confirmar o aplazar. El sonido vuelve a sonar cada 30 segundos. Abrir la aplicación no confirma la tarea: aplaza cinco minutos. Cerrar la ventana también aplaza cinco minutos. La confirmación y el aplazamiento se reflejan en el navegador al consultar el servicio. Los vencidos se recuperan tras reiniciar el proceso. El ordenador apagado no emite avisos; los muestra al volver a iniciar el proceso.

ACTIVAR-INICIO-AUTOMATICO.bat registra una tarea para la sesión del usuario, sin solicitar permisos administrativos. Requiere Python y pythonw.exe en PATH y una carpeta estable. DESACTIVAR-INICIO-AUTOMATICO.bat elimina la tarea. El equipo debe estar encendido y la sesión iniciada para mostrar ventanas.

## Correo adicional

En Administración, «Estado del sistema», introduce tu correo y elige el canal. Por defecto está desactivado.

- Thunderbird: abre un mensaje preparado. Debes pulsar Enviar. No envía automáticamente.
- SMTP: envía automáticamente al correo configurado. Requiere variables de entorno de Windows: IT_SMTP_HOST, IT_SMTP_PORT (587 por defecto), IT_SMTP_FROM y, si se requieren, IT_SMTP_USER e IT_SMTP_PASSWORD. Se exige STARTTLS con verificación del certificado. No guardes contraseñas en el repositorio ni en archivos BAT compartidos. La compatibilidad con OAuth o con el correo corporativo debe comprobarse con su configuración concreta.

El canal adicional depende del motor de alarmas, se intenta al entregar el aviso y puede fallar o retrasarse. La ventana permanece como aviso principal. El estado muestra errores del canal adicional. No se envía ningún correo hasta configurar el canal.

## Redes

Cada módulo con IP válidas aparece como grupo. Importa archivos como módulos desde Administración. Una IP compartida por varios módulos se comprueba una sola vez y conserva sus grupos y registros de origen. Centro y ubicación física son datos separados; se reconocen ubicación fina, edificio, planta, servicio, despacho, sala y consulta.

Pulsa el círculo o nombre para abrir el grupo; pulsa un contador para filtrar por estado. La tabla ofrece búsqueda por IP, nombre, centro y ubicación, ficha completa, exportación de la vista y creación de incidencias. La ficha lista los registros que contienen la IP y relaciones explícitas con ellos; los adjuntos se gestionan desde el módulo de origen.

Se admiten hasta 5.000 IP privadas seleccionadas, con seis comprobaciones simultáneas. Define por grupo intervalo, fallos consecutivos, puertos TCP permitidos y horario local; guarda la selección y las políticas. Si una IP está en varios grupos, se aplica la primera política específica. Un intervalo nunca garantiza terminar una lista grande en ese tiempo. Detener cancela los trabajos pendientes; los sondeos ya iniciados terminan con su tiempo límite. «Sin respuesta» no demuestra que un equipo esté apagado.

## Tablas e importaciones

Arrastra los tiradores de los encabezados o utiliza flechas izquierda/derecha con el tirador enfocado. Las barras superior e inferior desplazan horizontalmente; los encabezados permanecen fijos. Puedes ampliar la tabla, ajustar ancho al contenido, fijar columnas, ordenarlas, ocultarlas y envolver texto. La distribución se conserva por tabla y navegador. Se muestran 100 filas por página. Pulsa una fila para abrirla o usa Editar.

La importación admite CSV, ODS y XLSX (10 MB, 10.000 filas y 128 columnas). XLSX lee texto y valores almacenados; no ejecuta fórmulas, macros ni enlaces externos. Los números de fecha de Excel sin texto formateado se conservan como números; revisa las columnas de fecha antes de programar alarmas.

Para actualizar, selecciona una columna identificadora estable y activa actualizar valores distintos, o completar vacíos. Las celdas vacías no borran datos. Revisa las diferencias antes de confirmar. Archivar ausentes es opcional y requiere confirmación. Cada importación conserva procedencia y una instantánea reversible. Se guardan las últimas 20 importaciones. Deshacer se permite cuando no existen cambios posteriores en ese módulo ni referencias externas que quedarían rotas; deshaz primero la importación más reciente.

## Copias externas

El proceso Python recibe una copia completa con adjuntos desde el navegador. El primer estado crea una copia; después aplica el intervalo configurado (1, 6, 12, 24 horas o semanal). Elige una carpeta local o de red accesible a tu sesión y el número de copias a conservar. «Crear y verificar copia ahora» comprueba que el contenido escrito coincide. Los archivos JSON se restauran desde la importación de copias existente. El borrado de copias antiguas afecta únicamente a nombres IT-Control-Pro-*.json de la carpeta elegida.

Con el navegador cerrado se copia el último estado recibido; los datos locales no se pueden leer de IndexedDB desde otro proceso. En modo compartido el servidor actualiza la instantánea tras cada guardado. Un error de copia queda visible sin invalidar un guardado de datos ya completado. Tamaño máximo por petición de copia completa: 100 MB.

## Acceso y repositorio compartido opcional

Se mantiene el almacenamiento original en el navegador. En Administración puedes crear el superusuario (contraseña mínima de diez caracteres), verificarlo y migrar explícitamente datos y adjuntos al servicio Windows. Se conservan los originales en el navegador. Tras migrar se usa el repositorio Windows, con versiones para detectar escrituras concurrentes, y actualización de vistas cada diez segundos cuando no hay formularios abiertos.

Solo hay un superusuario. Puede crear y desactivar usuarios básicos, cambiar contraseñas y activar o desactivar autenticación. Con autenticación desactivada, el acceso abierto sigue siendo básico: cambiar módulos, importar estructuras, eliminar registros o administrar usuarios requiere sesión del superusuario. Las contraseñas se guardan con scrypt y sal aleatoria. Las sesiones duran ocho horas. Los perfiles de color y diseño siguen siendo preferencias del dispositivo y no cuentas.

El servicio sigue escuchando solo en 127.0.0.1 por defecto. El acceso desde móviles u otros equipos requiere configurar IT_CONTROL_HOST con la IP corporativa del Windows y IT_CONTROL_TLS_CERT / IT_CONTROL_TLS_KEY con un certificado y clave existentes para esa dirección, además de activar antes los datos compartidos y la autenticación. No se configura el firewall ni se publica el equipo automáticamente. No puede desactivarse autenticación mientras el proceso escuche por red. Alarmas, monitor y selector de carpetas permanecen reservados al propio equipo. La habilitación corporativa y certificados quedan por configurar en el entorno real.

## Verificación

La comprobación local incluye compilación TypeScript, pruebas Python y Node. El flujo de GitHub «Verificar alarmas, grupos y tablas» comprueba además la interfaz en Chromium. La ventana nativa, la tarea al iniciar sesión, Thunderbird, SMTP y carpetas de red necesitan una comprobación final en el Windows donde se usará.
