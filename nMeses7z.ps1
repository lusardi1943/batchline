<#
.SYNOPSIS
    Script para conservar archivos modificados en los últimos N días y N meses según orden descendente de modificación.

.DESCRIPCIÓN
    Este script:
    1. Ordena los archivos por fecha de modificación descendente.
    2. Conserva los archivos que pertenecen a los N días únicos más recientes.
    3. Comprime los archivos restantes agrupados por mes y año de modificación.
    4. Elimina los archivos comprimidos.
    5. Si se especifica el parámetro -Meses, conserva solo los archivos .7z correspondientes a los N meses más recientes.
    6. Genera un log detallado en el mismo directorio analizado, con nombre basado en la fecha de ejecución.

.PARAMETER Directorio
    Ruta del directorio donde buscar los archivos y donde se guardará el log.

.PARAMETER Mascara
    Máscara de archivo (ej. *.log, *.txt).

.PARAMETER Dias
    Número de días únicos de modificación a conservar.

.PARAMETER Meses
    (Opcional) Número de meses únicos a conservar en archivos .7z

.EJEMPLO
    .\LimpiarArchivos.ps1 -Directorio "C:\Logs" -Mascara "*.txt" -Dias 3 -Meses 2
#>

param (
    [Parameter(Mandatory=$true)]
    [string]$Directorio,

    [Parameter(Mandatory=$true)]
    [string]$Mascara,

    [Parameter(Mandatory=$true)]
    [int]$Dias,

    [Parameter(Mandatory=$false)]
    [int]$Meses
)

# Validación de existencia del directorio
if (!(Test-Path $Directorio)) {
    Write-Host "ERROR 101: El directorio especificado no existe: $Directorio" -ForegroundColor Red
    exit 101
}

# Validación estricta del parámetro -Dias
if (-not ($Dias -is [int]) -or $Dias -lt 1) {
    Write-Host "ERROR 102: El parámetro -Dias debe ser un entero positivo mayor que cero." -ForegroundColor Red
    exit 102
}

# Validación estricta del parámetro -Meses (si se especifica)
if ($PSBoundParameters.ContainsKey('Meses')) {
    if (-not ($Meses -is [int]) -or $Meses -lt 1) {
        Write-Host "ERROR 103: El parámetro -Meses debe ser un entero positivo mayor que cero." -ForegroundColor Red
        exit 103
    }
}

# Validación de existencia de 7-Zip
$7zipExe = "C:\Program Files\7-Zip\7z.exe"
if (!(Test-Path $7zipExe)) {
    Write-Host "ERROR 104: No se encontró el ejecutable de 7-Zip en: $7zipExe" -ForegroundColor Red
    exit 104
}


# Obtener todos los archivos que coincidan con la máscara y ordenarlos por fecha de modificación descendente
$archivos = Get-ChildItem -Path $Directorio -Filter $Mascara -File | Sort-Object LastWriteTime -Descending

# Agrupar archivos por fecha de modificación (solo fecha, sin hora)
$agrupadosPorFecha = $archivos | Group-Object { $_.LastWriteTime.Date }

# Seleccionar los N días únicos más recientes
$diasSeleccionados = $agrupadosPorFecha | Select-Object -First $Dias

# Obtener lista de archivos a conservar
$archivosConservar = $diasSeleccionados | ForEach-Object { $_.Group } | Select-Object -ExpandProperty FullName

# Obtener lista de archivos a eliminar (los que no están en la lista de conservación)
$archivosEliminar = $archivos | Where-Object { $archivosConservar -notcontains $_.FullName }

# Crear ruta del log en el mismo directorio analizado, con nombre basado en fecha y hora
$logPath = Join-Path $Directorio "Historial_Limpieza_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

# Inicializar contenido del log
$log = @()
$log += "=== HISTORIAL DE LIMPIEZA DE ARCHIVOS ==="
$log += "Fecha de ejecución: $(Get-Date)"
$log += "Directorio analizado: $Directorio"
$log += "Máscara utilizada: $Mascara"
$log += "Días únicos de modificación conservados: $Dias"
if ($PSBoundParameters.ContainsKey('Meses')) {
    $log += "Meses únicos de archivos comprimidos conservados: $Meses"
}
$log += ""

# Registrar archivos conservados
$log += "Archivos conservados:"
foreach ($archivo in $archivos | Where-Object { $archivosConservar -contains $_.FullName }) {
    $log += " - $($archivo.Name) | Fecha modificación: $($archivo.LastWriteTime) | Tamaño: $([Math]::Round($archivo.Length / 1KB, 2)) KB | Ruta: $($archivo.FullName)"
}
$log += ""

# Solo comprimir y eliminar si hay archivos fuera del rango de días
if ($archivosEliminar.Count -gt 0) {
    $log += "Compresión previa a eliminación por mes/año:"

    # Agrupar archivos a eliminar por mes y año de modificación
    $gruposPorMes = $archivosEliminar | Group-Object { $_.LastWriteTime.ToString("yyyy_MM") }

    foreach ($grupo in $gruposPorMes) {
        $nombreArchivo7z = "$($grupo.Name).7z"
        $rutaArchivo7z = Join-Path $Directorio $nombreArchivo7z

        foreach ($archivo in $grupo.Group) {
            try {
                # Comprimir archivo en su grupo correspondiente
                & "$7zipExe" a -t7z "`"$rutaArchivo7z`"" "`"$($archivo.FullName)`"" -mx=9 | Out-Null
                $log += " - $($archivo.Name) | Fecha modificación: $($archivo.LastWriteTime) | Ruta: $($archivo.FullName) | Comprimido en: $rutaArchivo7z"
            } catch {
                $log += " - $($archivo.Name) | Ruta: $($archivo.FullName) | ERROR al comprimir: $($_.Exception.Message)"
            }
        }
    }

    $log += ""
    $log += "Archivos eliminados:"
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

# Si se especificó el parámetro Meses, eliminar archivos .7z fuera del rango
if ($PSBoundParameters.ContainsKey('Meses')) {
    $log += "Evaluación de archivos .7z por mes/año:"
    
    # Obtener todos los archivos .7z válidos en el directorio
    $archivos7z = Get-ChildItem -Path $Directorio -Filter "*.7z" -File | Sort-Object Name -Descending
    $gruposValidos = $archivos7z | Where-Object { $_.BaseName -match '^\d{4}_\d{2}$' }

    # Seleccionar los N meses más recientes por nombre
    $nombresMeses = $gruposValidos | Select-Object -ExpandProperty BaseName | Sort-Object -Descending | Select-Object -First $Meses

    # Identificar archivos .7z fuera del rango
    $archivos7zEliminar = $gruposValidos | Where-Object { $nombresMeses -notcontains $_.BaseName }

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

# Guardar log en el directorio analizado
$log | Out-File -FilePath $logPath -Encoding UTF8
