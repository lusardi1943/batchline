<#
.SYNOPSIS
    Script para conservar archivos recientes y comprimir/eliminar el resto agrupado por mes,
    con eliminación previa de archivos más antiguos que N meses (si se especifica -Meses).

.DESCRIPCIÓN
    - Conserva archivos modificados en los N días únicos más recientes.
    - Si se especifica -Meses, primero elimina (definitivamente) los archivos cuya
      LastWriteTime sea anterior a la fecha de corte calculada con -Meses.
    - Comprime los archivos restantes (según la máscara) por mes/año en una sola llamada a 7-Zip por grupo.
    - Añade archivos nuevos a los .7z existentes sin eliminar los anteriores.
    - Si se especifica -Meses, también elimina los .7z antiguos fuera del rango al final.
    - Genera un log detallado con trazabilidad completa de todas las acciones.

USO
    .\LimpiezaArchivos.ps1 -Directorio "C:\Logs" -Mascara "*.log" -Dias 5 -Meses 6

PARÁMETROS
    -Directorio [string] (obligatorio) : Ruta del directorio a procesar.
    -Mascara   [string] (obligatorio) : Filtro de archivos (ej. *.log, *.txt).
    -Dias      [int]    (obligatorio) : Número de días únicos de modificación a conservar.
    -Meses     [int]    (opcional)  : Número de meses; si se especifica, se ejecuta la eliminación previa por antigüedad
                                      y la limpieza de .7z antiguos.
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

# -------------------------
# Validaciones iniciales
# -------------------------

# Comprueba existencia del directorio (Tipo: string => ruta)
if (!(Test-Path $Directorio)) {
    Write-Host "ERROR 101: El directorio especificado no existe: $Directorio" -ForegroundColor Red
    exit 101
}

# Verifica que -Dias sea entero positivo (Tipo: int)
if ($Dias -lt 1) {
    Write-Host "ERROR 102: El parámetro -Dias debe ser un entero positivo mayor que cero." -ForegroundColor Red
    exit 102
}

# Si se pasó -Meses, verificar que sea entero positivo (Tipo: int)
if ($PSBoundParameters.ContainsKey('Meses') -and $Meses -lt 1) {
    Write-Host "ERROR 103: El parámetro -Meses debe ser un entero positivo mayor que cero." -ForegroundColor Red
    exit 103
}

# Validación de existencia de 7-Zip (ruta predeterminada). Cambia si tienes 7z en otra ubicación.
$7zipExe = "C:\Program Files\7-Zip\7z.exe"
if (!(Test-Path $7zipExe)) {
    Write-Host "ERROR 104: No se encontró el ejecutable de 7-Zip en: $7zipExe" -ForegroundColor Red
    exit 104
}

# -------------------------
# Preparación inicial y log
# -------------------------

# Obtener todos los archivos que coincidan con la máscara; tipo de $archivos: [FileInfo[]]
$archivos = Get-ChildItem -Path $Directorio -Filter $Mascara -File | Sort-Object LastWriteTime -Descending

# Preparar ruta del log con timestamp (Tipo: string)
$logPath = Join-Path $Directorio "Historial_Limpieza_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

# Inicializar array de log (Tipo: [string[]])
$log = @()
$log += "=== HISTORIAL DE LIMPIEZA DE ARCHIVOS ==="
$log += "Fecha de ejecución: $(Get-Date)"
$log += "Directorio analizado: $Directorio"
$log += "Máscara utilizada: $Mascara"
$log += "Días únicos de modificación conservados: $Dias"
if ($PSBoundParameters.ContainsKey('Meses')) {
    $log += "Meses (parametro) especificados: $Meses"
}
$log += ""

# -------------------------
# Eliminación previa por antigüedad (si se especificó -Meses)
# -------------------------
# Objetivo: eliminar definitivamente todos los archivos (que coinciden con la máscara)
# cuya LastWriteTime sea anterior a la fecha de corte (Get-Date).AddMonths(-$Meses).
# Esto ocurre ANTES de calcular los N días a conservar y antes de cualquier compresión,
# para evitar compresión innecesaria de archivos que se eliminarán por antigüedad.

if ($PSBoundParameters.ContainsKey('Meses')) {
    # Fecha de corte: cualquier archivo con LastWriteTime < $fechaCorte será eliminado
    $fechaCorte = (Get-Date).AddMonths(-$Meses)
    $log += "Eliminación inicial por antigüedad activada. Fecha de corte (excluye archivos anteriores a): $fechaCorte"

    # Identificar archivos de la máscara más antiguos que la fecha de corte.
    # $archivos ya contiene solo archivos que coinciden con $Mascara.
    $archivosFueraMeses = $archivos | Where-Object { $_.LastWriteTime -lt $fechaCorte }

    # Registrar cantidad y listar en el log (antes de intentar eliminar)
    $log += "Total archivos identificados para eliminación por antigüedad: $($archivosFueraMeses.Count)"

    foreach ($f in $archivosFueraMeses) {
        try {
            # Eliminar el archivo definitivamente
            Remove-Item -Path $f.FullName -Force
            $log += " - ELIMINADO por antiguedad: $($f.Name) | Fecha modificación: $($f.LastWriteTime) | Ruta: $($f.FullName)"
        } catch {
            # Registrar errores al intentar eliminar
            $log += " - ERROR al eliminar por antiguedad: $($f.Name) | Ruta: $($f.FullName) | EX: $($_.Exception.Message)"
        }
    }

    $log += ""

    # Actualizar la colección principal $archivos para que el resto del script opere sobre los archivos restantes
    $archivos = $archivos | Where-Object { $_.LastWriteTime -ge $fechaCorte } | Sort-Object LastWriteTime -Descending
    $log += "Archivos restantes tras eliminación por antigüedad: $($archivos.Count)"
    $log += ""
}

# -------------------------
# Selección de N días únicos a conservar
# -------------------------
# Lógica: agrupar por día (ignorar hora), elegir los primeros $Dias grupos (más recientes),
# y extraer las rutas completas de los archivos a conservar.

# Agrupa archivos por día (Tipo: GroupInfo[]). Cada objeto GroupInfo tiene .Name (fecha) y .Group (FileInfo[]).
$diasSeleccionados = $archivos | Group-Object { $_.LastWriteTime.Date } | Select-Object -First $Dias

# Extrae rutas completas de los archivos a conservar (Tipo: [string[]])
$archivosConservar = $diasSeleccionados | ForEach-Object { $_.Group } | Select-Object -ExpandProperty FullName

# Determina los archivos que no están en los días seleccionados => candidatos a compresión/eliminación (Tipo: FileInfo[])
$archivosEliminar = $archivos | Where-Object { $archivosConservar -notcontains $_.FullName }

# Registrar en el log los archivos conservados para trazabilidad
$log += "Archivos conservados (listas de los $Dias días más recientes):"
foreach ($archivo in $archivos | Where-Object { $archivosConservar -contains $_.FullName }) {
    $log += " - $($archivo.Name) | Fecha modificación: $($archivo.LastWriteTime) | Tamaño: $([Math]::Round($archivo.Length / 1KB, 2)) KB | Ruta: $($archivo.FullName)"
}
$log += ""

# -------------------------
# Compresión por grupo mensual de los archivos candidatos
# -------------------------
# Agrupar por mes/año (formato yyyy_MM) y crear/añadir a .7z por grupo usando un archivo temporal de lista.
if ($archivosEliminar.Count -gt 0) {
    $log += "Iniciando compresión por grupo mensual (modo añadir) para $($archivosEliminar.Count) archivos."

    # Agrupar por mes/año (cada GroupInfo tiene .Name = "yyyy_MM" y .Group = FileInfo[])
    $gruposPorMes = $archivosEliminar | Group-Object { $_.LastWriteTime.ToString("yyyy_MM") } | Sort-Object Name -Descending

    foreach ($grupo in $gruposPorMes) {
        # Nombre esperado del .7z: <yyyy_MM>.7z
        $nombreArchivo7z = "$($grupo.Name).7z"
        $rutaArchivo7z = Join-Path $Directorio $nombreArchivo7z

        # Archivo temporal con la lista de rutas a pasar a 7-Zip (una llamada por grupo)
        $tempListPath = Join-Path $env:TEMP "lista_7z_$($grupo.Name)_$(Get-Random).txt"

        # Escribir cada ruta completa en el archivo temporal (UTF8)
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
                # Registrar problema si 7-Zip no generó el .7z
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
    $log += "No hay archivos candidatos a compresión tras la selección de días y/o eliminación por antigüedad."
    $log += ""
}

# -------------------------
# Limpieza de .7z antiguos (si se especificó -Meses)
# -------------------------
# Conserva solo los N .7z más recientes cuyo BaseName tenga formato yyyy_MM; elimina el resto.
if ($PSBoundParameters.ContainsKey('Meses')) {
    $log += "Evaluación final de archivos .7z para conservar los $Meses meses más recientes."

    # Obtener .7z con BaseName formato yyyy_MM (Tipo: FileInfo[])
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

# -------------------------
# Guardar log final
# -------------------------
# Escribe todas las líneas almacenadas en $log al archivo $logPath (UTF8)
try {
    $log | Out-File -FilePath $logPath -Encoding UTF8
    Write-Host "Proceso finalizado. Log guardado en: $logPath"
} catch {
    Write-Host "ERROR al guardar el log en $logPath : $($_.Exception.Message)" -ForegroundColor Red
    exit 200
}

# -------------------------
# FIN DEL SCRIPT
# -------------------------

