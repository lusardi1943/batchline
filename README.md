<<<<<<< HEAD
Repositorio de proyectos docker para BATCHLINE
=======
Este script automatiza la gestión de archivos en un directorio determinado, aplicando criterios de conservación, compresión y eliminación basados en fechas de modificación. Su propósito principal es optimizar el espacio y mantener solo los archivos relevantes más recientes.
⚙️ Funciones principales
Conservación por días Conserva todos los archivos que hayan sido modificados en los últimos N días únicos, ordenados por fecha descendente. Esto se basa en la fecha de modificación, no en la fecha actual.

Compresión por mes Los archivos que no están dentro del rango de días se agrupan por mes y año de modificación (yyyy_MM) y se comprimen en un único archivo .7z por grupo. La compresión se realiza por lote, es decir, todos los archivos del mismo grupo se comprimen en una sola operación para maximizar la eficiencia.

Eliminación de originales Una vez comprimidos, los archivos originales fuera del rango de días son eliminados del sistema.

Conservación por meses (archivos .7z) Si se especifica el parámetro -Meses, el script conserva únicamente los archivos .7z correspondientes a los N meses más recientes, eliminando los más antiguos.

Registro de actividad Se genera un archivo de log detallado en el mismo directorio analizado, con nombre basado en la fecha y hora de ejecución. Este log documenta:

Archivos conservados

Archivos comprimidos

Archivos eliminados

Archivos .7z eliminados por antigüedad

Validaciones robustas El script incluye validaciones estrictas:

Verifica que el directorio exista.

Asegura que los parámetros -Dias y -Meses sean enteros positivos mayores que cero.

Comprueba que el ejecutable de 7-Zip esté disponible.

Muestra códigos de error específicos si alguna validación falla.
>>>>>>> 6abaf2e31d862a6f803def3311c042a946b48b35
