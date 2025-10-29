<#
.SYNOPSIS
    Script para conservar archivos modificados en los últimos N días según orden descendente de modificación.

.DESCRIPCIÓN
    Este script se ejecuta desde línea de comandos y recibe tres parámetros:
    -Directorio: ruta donde buscar los archivos.
    -Mascara: máscara de archivo (ej. *.txt).
    -Dias: número de días únicos de modificación a conservar.

    El script:
    1. Ordena los archivos por fecha de modificación descendente.
    2. Conserva los archivos que pertenecen a los N días más recientes (según orden, no fecha actual).
    3. Elimina el resto.
    4. Genera un log detallado en la carpeta "Documentos" del usuario.

.PARAMETER Directorio
    Ruta del directorio donde buscar los archivos.

.PARAMETER Mascara
    Máscara de archivo (ej. *.log, *.txt).

.PARAMETER Dias
    Número de días únicos de modificación a conservar.

.EJEMPLO
    .\LimpiarArchivos.ps1 -Directorio "C:\Logs" -Mascara "*.txt" -Dias 3
#>

param (
    [Parameter(Mandatory=$true)]
    [string]$Directorio,

    [Parameter(Mandatory=$true)]
    [string]$Mascara,

    [Parameter(Mandatory=$true)]
    [int]$Dias
)

# Validación de existencia del directorio
if (!(Test-Path $Directorio)) {
    Write-Error "El directorio especificado no existe: $Directorio"
    exit 1
}

# Obtener todos los archivos que coincidan con la máscara
$archivos = Get-ChildItem -Path $Directorio -Filter $Mascara -File | Sort-Object LastWriteTime -Descending

# Agrupar por fecha de modificación (solo fecha, sin hora)
$agrupadosPorFecha = $archivos | Group-Object { $_.LastWriteTime.Date }

# Seleccionar los N días más recientes
$diasSeleccionados = $agrupadosPorFecha | Select-Object -First $Dias

# Obtener lista de archivos a conservar
$archivosConservar = $diasSeleccionados | ForEach-Object { $_.Group }

# Convertir a lista plana
$archivosConservar = $archivosConservar | Select-Object -ExpandProperty FullName

# Obtener lista de archivos a eliminar
$archivosEliminar = $archivos | Where-Object { $archivosConservar -notcontains $_.FullName }

# Crear ruta de log en carpeta Documentos
$documentos = [Environment]::GetFolderPath("MyDocuments")
$logPath = Join-Path $documentos "Historial_Limpieza_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

# Ruta del archivo comprimido único en Documentos
$archivo7z = Join-Path $documentos "Archivos_Eliminados.7z"

# Ruta del ejecutable de 7-Zip (ajusta si es necesario)
$7zipExe = "C:\Program Files\7-Zip\7z.exe"



# Inicializar contenido del log
$log = @()
$log += "=== HISTORIAL DE LIMPIEZA DE ARCHIVOS ==="
$log += "Fecha de ejecución: $(Get-Date)"
$log += "Directorio analizado: $Directorio"
$log += "Máscara utilizada: $Mascara"
$log += "Días únicos de modificación conservados: $Dias"
$log += ""

# Registrar archivos conservados
$log += "Archivos conservados:"
foreach ($archivo in $archivos | Where-Object { $archivosConservar -contains $_.FullName }) {
    $log += " - $($archivo.Name) | Fecha modificación: $($archivo.LastWriteTime) | Tamaño: $([Math]::Round($archivo.Length / 1KB, 2)) KB | Ruta: $($archivo.FullName)"
}
$log += ""

if (!(Test-Path $7zipExe)) {
    Write-Error "No se encontró el ejecutable de 7-Zip en: $7zipExe"
    exit 1
}

# Comprimir archivos antes de eliminar
if ($archivosEliminar.Count -gt 0) {
    $log += ""
    $log += "Compresión previa a eliminación:"
    
    foreach ($archivo in $archivosEliminar) {
        try {
            # Comando para agregar al archivo .7z (modo 'a' = add)
            & "$7zipExe" a -t7z "$archivo7z" "`"$($archivo.FullName)`"" -mx=9 | Out-Null
            $log += " - $($archivo.Name) | Ruta: $($archivo.FullName) | Estado: COMPRIMIDO"
        } catch {
            $log += " - $($archivo.Name) | Ruta: $($archivo.FullName) | ERROR al comprimir: $($_.Exception.Message)"
        }
    }
}

# Registrar archivos eliminados
$log += "Archivos eliminados:"
foreach ($archivo in $archivosEliminar) {
    try {
        Remove-Item -Path $archivo.FullName -Force
        $log += " - $($archivo.Name) | Fecha modificación: $($archivo.LastWriteTime) | Ruta: $($archivo.FullName) | Estado: ELIMINADO"
    } catch {
        $log += " - $($archivo.Name) | Ruta: $($archivo.FullName) | ERROR al eliminar: $_"
    }
}

# Guardar log
$log | Out-File -FilePath $logPath -Encoding UTF8

# Mostrar resumen en consola
Write-Host "`nProceso completado. Log guardado en: $logPath" -ForegroundColor Green
