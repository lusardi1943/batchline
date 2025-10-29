<#
.SYNOPSIS
    Script para conservar archivos modificados en los últimos N días según orden descendente de modificación.

.DESCRIPCIÓN
    Este script:
    1. Ordena los archivos por fecha de modificación descendente.
    2. Conserva los archivos que pertenecen a los N días más recientes (según orden, no fecha actual).
    3. Comprime los archivos restantes agrupados por mes y año de modificación.
    4. Elimina los archivos comprimidos.
    5. Genera un log detallado en la carpeta "Documentos" del usuario.

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

# Ruta del ejecutable de 7-Zip (ajusta si es necesario)
$7zipExe = "C:\Program Files\7-Zip\7z.exe"
if (!(Test-Path $7zipExe)) {
    Write-Error "No se encontró el ejecutable de 7-Zip en: $7zipExe"
    exit 1
}

# Obtener todos los archivos que coincidan con la máscara
$archivos = Get-ChildItem -Path $Directorio -Filter $Mascara -File | Sort-Object LastWriteTime -Descending

# Agrupar por fecha de modificación (solo fecha, sin hora)
$agrupadosPorFecha = $archivos | Group-Object { $_.LastWriteTime.Date }

# Seleccionar los N días más recientes
$diasSeleccionados = $agrupadosPorFecha | Select-Object -First $Dias

# Obtener lista de archivos a conservar
$archivosConservar = $diasSeleccionados | ForEach-Object { $_.Group } | Select-Object -ExpandProperty FullName

# Obtener lista de archivos a eliminar
$archivosEliminar = $archivos | Where-Object { $archivosConservar -notcontains $_.FullName }

# Crear ruta de log en carpeta Documentos
$documentos = [Environment]::GetFolderPath("MyDocuments")
$logPath = Join-Path $documentos "Historial_Limpieza_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

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

# Comprimir archivos antes de eliminar, agrupados por mes y año
if ($archivosEliminar.Count -gt 0) {
    $log += "Compresión previa a eliminación por mes/año:"

    $gruposPorMes = $archivosEliminar | Group-Object { $_.LastWriteTime.ToString("yyyy_MM") }

    foreach ($grupo in $gruposPorMes) {
        $nombreArchivo7z = "$($grupo.Name).7z"
        $rutaArchivo7z = Join-Path $Directorio $nombreArchivo7z

        foreach ($archivo in $grupo.Group) {
            try {
                & "$7zipExe" a -t7z "`"$rutaArchivo7z`"" "`"$($archivo.FullName)`"" -mx=9 | Out-Null
                $log += " - $($archivo.Name) | Fecha modificación: $($archivo.LastWriteTime) | Ruta: $($archivo.FullName) | Comprimido en: $rutaArchivo7z"
            } catch {
                $log += " - $($archivo.Name) | Ruta: $($archivo.FullName) | ERROR al comprimir: $($_.Exception.Message)"
            }
        }
    }
    $log += ""
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
