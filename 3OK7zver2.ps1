<#
.SYNOPSIS
    Script optimizado para conservar archivos recientes y comprimir/eliminar el resto agrupado por mes.

.DESCRIPCIÓN
    - Conserva archivos modificados en los N días únicos más recientes.
    - Comprime los archivos restantes por mes/año en una sola llamada a 7-Zip por grupo.
    - Añade archivos nuevos a los .7z existentes sin eliminar los anteriores.
    - Si se especifica -Meses, conserva solo los .7z de los N meses más recientes.
    - Genera un log detallado con trazabilidad completa.

.PARAMETER Directorio
    Ruta del directorio donde buscar los archivos y guardar el log.

.PARAMETER Mascara
    Máscara de archivo (ej. *.log, *.txt).

.PARAMETER Dias
    Número de días únicos de modificación a conservar.

.PARAMETER Meses
    (Opcional) Número de meses únicos a conservar en archivos .7z
#>

# Definición de parámetros obligatorios y opcionales
param (
    [Parameter(Mandatory=$true)]
    [string]$Directorio,  # Ruta del directorio a procesar

    [Parameter(Mandatory=$true)]
    [string]$Mascara,     # Filtro de archivos (ej. *.log)

    [Parameter(Mandatory=$true)]
    [int]$Dias,           # Número de días únicos a conservar

    [Parameter(Mandatory=$false)]
    [int]$Meses           # Número de meses únicos a conservar (opcional)
)

# Validación: existencia del directorio
if (!(Test-Path $Directorio)) {
    Write-Host "ERROR 101: El directorio especificado no existe: $Directorio" -ForegroundColor Red
    exit 101
}

# Validación: el parámetro -Dias debe ser positivo
if ($Dias -lt 1) {
    Write-Host "ERROR 102: El parámetro -Dias debe ser un entero positivo mayor que cero." -ForegroundColor Red
    exit 102
}

# Validación: si se especifica -Meses, debe ser positivo
if ($PSBoundParameters.ContainsKey('Meses') -and $Meses -lt 1) {
    Write-Host "ERROR 103: El parámetro -Meses debe ser un entero positivo mayor que cero." -ForegroundColor Red
    exit 103
}

# Validación: existencia del ejecutable de 7-Zip
$7zipExe = "C:\Program Files\7-Zip\7z.exe"
if (!(Test-Path $7zipExe)) {
    Write-Host "ERROR 104: No se encontró el ejecutable de 7-Zip en: $7zipExe" -ForegroundColor Red
    exit 104
}

# Obtener todos los archivos que coincidan con la máscara, ordenados por fecha de modificación descendente
$archivos = Get-ChildItem -Path $Directorio -Filter $Mascara -File | Sort-Object LastWriteTime -Descending

# Agrupar archivos por día (sin hora) y seleccionar los N días más recientes
$diasSeleccionados = $archivos | Group-Object { $_.LastWriteTime.Date } | Select-Object -First $Dias

# Extraer rutas completas de los archivos a conservar
$archivosConservar = $diasSeleccionados | ForEach-Object { $_.Group } | Select-Object -ExpandProperty FullName

# Determinar archivos que no están en los días seleccionados (candidatos a compresión/eliminación)
$archivosEliminar = $archivos | Where-Object { $archivosConservar -notcontains $_.FullName }

# Preparar ruta del log con timestamp
$logPath = Join-Path $Directorio "Historial_Limpieza_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
$log = @()  # Inicializar array de log

# Encabezado del log con metadatos
$log += "=== HISTORIAL DE LIMPIEZA DE ARCHIVOS ==="
$log += "Fecha de ejecución: $(Get-Date)"
$log += "Directorio analizado: $Directorio"
$log += "Máscara utilizada: $Mascara"
$log += "Días únicos de modificación conservados: $Dias"
if ($PSBoundParameters.ContainsKey('Meses')) {
    $log += "Meses únicos de archivos comprimidos conservados: $Meses"
}
$log += ""

# Registrar archivos conservados en el log
$log += "Archivos conservados:"
foreach ($archivo in $archivos | Where-Object { $archivosConservar -contains $_.FullName }) {
    $log += " - $($archivo.Name) | Fecha modificación: $($archivo.LastWriteTime) | Tamaño: $([Math]::Round($archivo.Length / 1KB, 2)) KB | Ruta: $($archivo.FullName)"
}
$log += ""

# Si hay archivos para eliminar, se procede a comprimirlos por grupo mensual
if ($archivosEliminar.Count -gt 0) {
    $log += "Compresión por grupo mensual (modo añadir):"

    # Agrupar archivos por mes/año (formato yyyy_MM)
    $gruposPorMes = $archivosEliminar | Group-Object { $_.LastWriteTime.ToString("yyyy_MM") }

    foreach ($grupo in $gruposPorMes) {
        $nombreArchivo7z = "$($grupo.Name).7z"
        $rutaArchivo7z = Join-Path $Directorio $nombreArchivo7z

        # Crear archivo temporal con lista de rutas de archivos a comprimir
        $tempListPath = Join-Path $env:TEMP "lista_7z_$($grupo.Name)_$(Get-Random).txt"
        $grupo.Group | ForEach-Object { $_.FullName } | Set-Content -Path $tempListPath -Encoding UTF8

        # Construir argumentos para 7-Zip usando lista de archivos
        $argumentos = "a -t7z `"$rutaArchivo7z`" @`"$tempListPath`" -mx=9"

        try {
            # Ejecutar 7-Zip en modo silencioso y esperar a que termine
            $proceso = Start-Process -FilePath $7zipExe -ArgumentList $argumentos -NoNewWindow -Wait -PassThru
            Start-Sleep -Milliseconds 500  # Pausa breve para asegurar finalización

            # Verificar si se creó el archivo .7z correctamente
            if (Test-Path $rutaArchivo7z) {
                foreach ($archivo in $grupo.Group) {
                    $log += " - $($archivo.Name) | Fecha modificación: $($archivo.LastWriteTime) | Ruta: $($archivo.FullName) | Añadido a: $rutaArchivo7z"
                }
            } else {
                $log += " - ERROR: No se creó el archivo $rutaArchivo7z. Código de salida: $($proceso.ExitCode)"
            }
        } catch {
            # Captura de errores críticos al ejecutar 7-Zip
            $log += " - ERROR crítico al ejecutar 7-Zip: $($_.Exception.Message)"
        } finally {
            # Eliminar archivo temporal de lista
            if (Test-Path $tempListPath) {
                Remove-Item $tempListPath -Force
            }
        }
    }

    $log += ""
    $log += "Archivos eliminados:"

    # Eliminar archivos originales tras compresión
    foreach ($archivo in $archivosEliminar) {
        try {
            Remove-Item -Path $archivo.FullName -Force
            $log += " - $($archivo.Name) | Fecha modificación: $($archivo.LastWriteTime) | Ruta: $($archivo.FullName) | Estado: ELIMINADO"
        } catch {
            $log += " - $($archivo.Name) | Ruta: $($archivo.FullName) | ERROR al eliminar: $_"
        }
    }
    $log += ""
}

# Si se especificó -Meses, eliminar archivos .7z fuera del rango
if ($PSBoundParameters.ContainsKey('Meses')) {
    $log += "Evaluación de archivos .7z por mes/año:"

    # Obtener archivos .7z con nombre tipo yyyy_MM
    $archivos7z = Get-ChildItem -Path $Directorio -Filter "*.7z" -File | Where-Object { $_.BaseName -match '^\d{4}_\d{2}$' } | Sort-Object Name -Descending

    # Seleccionar los N meses más recientes
    $nombresMeses = $archivos7z | Select-Object -ExpandProperty BaseName | Select-Object -First $Meses

    # Determinar archivos .7z fuera del rango
    $archivos7zEliminar = $archivos7z | Where-Object { $nombresMeses -notcontains $_.BaseName }

    # Eliminar archivos .7z antiguos
    foreach ($archivo in $archivos7zEliminar) {
        try {
            Remove-Item -Path $archivo.FullName -Force
            $log += " - $($archivo.Name) | Estado: ELIMINADO (fuera de los $Meses meses más recientes)"
        } catch {
            $log += " - $($archivo.Name) | ERROR al eliminar: $_"
        }
    }
    $log += ""
}

# Guardar log
$log | Out-File -FilePath $logPath -Encoding UTF8
