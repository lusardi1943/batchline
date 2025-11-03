<#
.SYNOPSIS
    Script para conservar archivos recientes y eliminar o comprimir/eliminar el resto agrupado por mes.
    Si se especifica -Meses, también elimina archivos antiguos y limpia .7z fuera del rango.

.DESCRIPCIÓN
    - Conserva archivos modificados en los N días únicos más recientes.
    - Si se especifica -Meses:
        - Elimina archivos más antiguos que N meses.
        - Comprime los archivos fuera del rango por mes (añadiendo a .7z existentes o creando nuevos).
        - Elimina los originales comprimidos.
        - Elimina archivos .7z fuera del rango de meses.
    - Si NO se especifica -Meses:
        - Solo elimina directamente los archivos fuera del rango de días.
        - No realiza compresión ni limpieza de .7z.
    - Genera un log detallado en la carpeta del script.

USO
    .\LimpiezaArchivos.ps1 -Directorio "C:\Logs" -Mascara "*.log" -Dias 5 -Meses 6
    .\LimpiezaArchivos.ps1 -Directorio "C:\Logs" -Mascara "*.log" -Dias 5
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

# -----------------------#
# VALIDACIONES INICIALES #
# -----------------------#

# Verifica existencia del directorio objetivo
if (!(Test-Path $Directorio)) {
    Write-Host "ERROR 101: El directorio especificado no existe: $Directorio" -ForegroundColor Red
    exit 101
}

# Verifica que -Dias sea positivo
if ($Dias -lt 1) {
    Write-Host "ERROR 102: El parámetro -Dias debe ser un entero positivo mayor que cero." -ForegroundColor Red
    exit 102
}

# Si se proporcionó -Meses, verificar que sea positivo
if ($PSBoundParameters.ContainsKey('Meses') -and $Meses -lt 1) {
    Write-Host "ERROR 103: El parámetro -Meses debe ser un entero positivo mayor que cero." -ForegroundColor Red
    exit 103
}

# Si se va a usar compresión (cuando se pasa -Meses), comprobar existencia de 7z
$7zipExe = "C:\Program Files\7-Zip\7z.exe"
if ($PSBoundParameters.ContainsKey('Meses') -and !(Test-Path $7zipExe)) {
    Write-Host "ERROR 104: No se encontró el ejecutable de 7-Zip en: $7zipExe" -ForegroundColor Red
    exit 104
}

# --------------------------------------------#
# PREPARACIÓN DEL LOG (EN CARPETA DEL SCRIPT) #
# --------------------------------------------#

# Ruta del script y carpeta donde guardar el log
$rutaScript = $MyInvocation.MyCommand.Path
$directorioScript = Split-Path -Path $rutaScript -Parent
$logPath = Join-Path $directorioScript "Historial_Limpieza_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

# Obtener archivos que coincidan con la máscara, ordenados por LastWriteTime descendente
$archivos = Get-ChildItem -Path $Directorio -Filter $Mascara -File | Sort-Object LastWriteTime -Descending

# Inicializar array de log y registrar encabezado y parámetros
$log = @()
$log += "=== HISTORIAL DE LIMPIEZA DE ARCHIVOS ==="
$log += "Fecha de ejecución: $(Get-Date)"
$log += "Script ubicado en: $directorioScript"
$log += "Directorio analizado: $Directorio"
$log += "Máscara utilizada: $Mascara"
$log += "Días únicos de modificación conservados: $Dias"
if ($PSBoundParameters.ContainsKey('Meses')) {
    $log += "Meses (parámetro) especificados: $Meses"
} else {
    $log += "Meses (parámetro) no especificado - modo: eliminación directa sin compresión ni limpieza de .7z"
}
$log += ""

# -----------------------------------------------------------------#
# ELIMINACIÓN PREVIA POR ANTIGÜEDAD (solo si se especifica -Meses) #
# -----------------------------------------------------------------#
# Objetivo: cuando -Meses está presente, eliminar primero archivos cuyo LastWriteTime sea anterior a la fecha de corte.
if ($PSBoundParameters.ContainsKey('Meses')) {
    $fechaCorte = (Get-Date).AddMonths(-$Meses)
    $log += "Eliminación inicial por antigüedad activada. Fecha de corte (excluye archivos anteriores a): $fechaCorte"

    # Identificar archivos (según máscara) anteriores a la fecha de corte
    $archivosFueraMeses = $archivos | Where-Object { $_.LastWriteTime -lt $fechaCorte }
    $log += "Total archivos identificados para eliminación por antigüedad: $($archivosFueraMeses.Count)"

    foreach ($f in $archivosFueraMeses) {
        try {
            Remove-Item -Path $f.FullName -Force
            $log += " - ELIMINADO por antigüedad: $($f.Name) | Fecha modificación: $($f.LastWriteTime) | Ruta: $($f.FullName)"
        } catch {
            $log += " - ERROR al eliminar por antigüedad: $($f.Name) | Ruta: $($f.FullName) | EX: $($_.Exception.Message)"
        }
    }

    # Actualizar lista principal de archivos tras eliminación por antigüedad
    $archivos = $archivos | Where-Object { $_.LastWriteTime -ge $fechaCorte } | Sort-Object LastWriteTime -Descending
    $log += "Archivos restantes tras eliminación por antigüedad: $($archivos.Count)"
    $log += ""
}

# ---------------------------------------#
# SELECCIÓN DE N DÍAS ÚNICOS A CONSERVAR #
# ---------------------------------------#
# Agrupar por día (ignorando hora) y conservar los primeros $Dias grupos más recientes.
$diasSeleccionados = $archivos | Group-Object { $_.LastWriteTime.Date } | Select-Object -First $Dias

# Extraer rutas completas de los archivos a conservar
$archivosConservar = $diasSeleccionados | ForEach-Object { $_.Group } | Select-Object -ExpandProperty FullName

# Archivos candidatos a eliminación/comprimir: aquellos que no están en los días seleccionados
$archivosEliminar = $archivos | Where-Object { $archivosConservar -notcontains $_.FullName }

# Registrar archivos conservados en el log para trazabilidad
$log += "Archivos conservados (listas de los $Dias días más recientes):"
foreach ($archivo in $archivos | Where-Object { $archivosConservar -contains $_.FullName }) {
    $log += " - $($archivo.Name) | Fecha modificación: $($archivo.LastWriteTime) | Tamaño: $([Math]::Round($archivo.Length / 1KB, 2)) KB | Ruta: $($archivo.FullName)"
}
$log += ""

# --------------------------------------------#
# FLUJO PRINCIPAL: COMPRESIÓN Y/O ELIMINACIÓN #
# --------------------------------------------#
# Si -Meses está presente: comprimir por mes y eliminar originales; si no, eliminar directamente sin compresión.
if ($PSBoundParameters.ContainsKey('Meses')) {

    $log += "Iniciando compresión por grupo mensual (modo añadir) para $($archivosEliminar.Count) archivos."

    # Agrupar archivos candidatos por mes/año (formato yyyy_MM)
    $gruposPorMes = $archivosEliminar | Group-Object { $_.LastWriteTime.ToString("yyyy_MM") } | Sort-Object Name -Descending

    foreach ($grupo in $gruposPorMes) {
        # Nombre y ruta del .7z esperado
        $nombreArchivo7z = "$($grupo.Name).7z"
        $rutaArchivo7z = Join-Path $Directorio $nombreArchivo7z

        # Archivo temporal con la lista de rutas a pasar a 7-Zip
        $tempListPath = Join-Path $env:TEMP "lista_7z_$($grupo.Name)_$(Get-Random).txt"

        # Escribir rutas en el archivo temporal (UTF8)
        $grupo.Group | ForEach-Object { $_.FullName } | Set-Content -Path $tempListPath -Encoding UTF8

        # Argumentos para 7-Zip: añadir (-a) al archivo .7z; usar la lista con @file; compresión máxima -mx=9
        $argumentos = "a -t7z `"$rutaArchivo7z`" @`"$tempListPath`" -mx=9"

        try {
            # Ejecuta 7-Zip y espera a que termine
            $proceso = Start-Process -FilePath $7zipExe -ArgumentList $argumentos -NoNewWindow -Wait -PassThru
            Start-Sleep -Milliseconds 300

            # Verificar que el .7z fue creado o actualizado
            if (Test-Path $rutaArchivo7z) {
                foreach ($archivo in $grupo.Group) {
                    $log += " - Añadido a $rutaArchivo7z : $($archivo.Name) | Fecha modificación: $($archivo.LastWriteTime) | Ruta: $($archivo.FullName)"
                }
            } else {
                $exitCode = if ($proceso) { $proceso.ExitCode } else { "N/A" }
                $log += " - ERROR: No se creó/actualizó $rutaArchivo7z. Código de salida: $exitCode"
            }
        } catch {
            $log += " - ERROR crítico al ejecutar 7-Zip para grupo $($grupo.Name): $($_.Exception.Message)"
        } finally {
            # Limpiar archivo temporal de lista
            if (Test-Path $tempListPath) {
                Remove-Item -Path $tempListPath -Force -ErrorAction SilentlyContinue
            }
        }
    }

    $log += ""
    # Tras compresión, eliminar los archivos originales que se comprimieron
    $log += "Eliminando archivos originales que fueron comprimidos:"
    foreach ($archivo in $archivosEliminar) {
        try {
            if (Test-Path $archivo.FullName) {
                Remove-Item -Path $archivo.FullName -Force
                $log += " - ELIMINADO tras compresión: $($archivo.Name) | Fecha modificación: $($archivo.LastWriteTime) | Ruta: $($archivo.FullName)"
            } else {
                $log += " - SKIPPED (no encontrado al intentar eliminar): $($archivo.Name) | Ruta: $($archivo.FullName)"
            }
        } catch {
            $log += " - ERROR al eliminar tras compresión: $($archivo.Name) | Ruta: $($archivo.FullName) | EX: $($_.Exception.Message)"
        }
    }
    $log += ""

} else {
    # Si -Meses NO fue proporcionado: eliminar directamente los archivos fuera del rango sin compresión ni evaluación de .7z existentes.
    $log += "Eliminando directamente archivos fuera del rango de $Dias días (SIN compresión ni evaluación de .7z existentes):"
    foreach ($archivo in $archivosEliminar) {
        try {
            if (Test-Path $archivo.FullName) {
                Remove-Item -Path $archivo.FullName -Force
                $log += " - ELIMINADO: $($archivo.Name) | Fecha modificación: $($archivo.LastWriteTime) | Ruta: $($archivo.FullName)"
            } else {
                $log += " - SKIPPED (no encontrado): $($archivo.Name) | Ruta: $($archivo.FullName)"
            }
        } catch {
            $log += " - ERROR al eliminar: $($archivo.Name) | Ruta: $($archivo.FullName) | EX: $($_.Exception.Message)"
        }
    }
    $log += ""
}

# --------------------------------------------------------#
# LIMPIEZA DE .7z ANTIGUOS (solo si se especifica -Meses) #
# --------------------------------------------------------#
# Conserva solo los N .7z más recientes cuyo BaseName tenga formato yyyy_MM; elimina el resto.
if ($PSBoundParameters.ContainsKey('Meses')) {
    $log += "Evaluación final de archivos .7z para conservar los $Meses meses más recientes."

    # Obtener .7z con BaseName formato yyyy_MM
    $archivos7z = Get-ChildItem -Path $Directorio -Filter "*.7z" -File |
        Where-Object { $_.BaseName -match '^\d{4}_\d{2}$' } |
        Sort-Object Name -Descending

    # Seleccionar nombres (BaseName) de los N meses más recientes
    $nombresMeses = $archivos7z | Select-Object -ExpandProperty BaseName | Select-Object -First $Meses

    # Identificar .7z que están fuera del rango
    $archivos7zEliminar = $archivos7z | Where-Object { $nombresMeses -notcontains $_.BaseName }

    # Eliminar los .7z antiguos
    if ($archivos7zEliminar.Count -gt 0) {
        $log += "Archivos .7z identificados para eliminación por antigüedad de meses: $($archivos7zEliminar.Count)"
        foreach ($archivo in $archivos7zEliminar) {
            try {
                Remove-Item -Path $archivo.FullName -Force
                $log += " - ELIMINADO .7z: $($archivo.Name) | Ruta: $($archivo.FullName)"
            } catch {
                $log += " - ERROR al eliminar .7z: $($archivo.Name) | EX: $($_.Exception.Message)"
            }
        }
    } else {
        $log += "No se encontraron .7z fuera del rango de $Meses meses."
    }
    $log += ""
}

# ------------------#
# GUARDAR LOG FINAL #
# ------------------#
# Escribe todas las líneas del array $log al archivo $logPath (UTF8) en la carpeta del script.
try {
    $log | Out-File -FilePath $logPath -Encoding UTF8
    Write-Host "Proceso finalizado. Log guardado en: $logPath"
} catch {
    Write-Host "ERROR al guardar el log en $logPath : $($_.Exception.Message)" -ForegroundColor Red
    exit 200
}

# ---------------#
# FIN DEL SCRIPT #
# ---------------#