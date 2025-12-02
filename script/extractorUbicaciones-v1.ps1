param(
    [Parameter(Mandatory=$true)]
    [string]$Directorio,
    
    [Parameter(Mandatory=$true)]
    [string]$ActivoSource,
    
    [Parameter(Mandatory=$true)]
    [string]$UbicacionSource
)

# Template embebido
$Template = @('ID','Name','Address','Parent Location','Assigned To','Teams','Vendors','Contractors')

# Palabras predeterminadas para COSA
$PalabrasCosa = @('DAP', 'EDAR', 'EBAR', 'Sondeo', 'Rebombeo', 'Presión')

# Función para normalizar texto (mantener ortografía original)
function Normalizar-Texto {
    param([string]$Texto)
    return $Texto.Trim()
}

# Función para extraer información de la cabecera según las reglas especificadas
function Extraer-InformacionCabecera {
    param([string]$Cabecera)
    
    $resultado = @{
        Nombre1 = ""
        Cosa = ""
        Nombre2 = ""
        Tipo = 0
        Name = $Cabecera
        Address = ""
        ParentLocation = ""
    }
    
    # Buscar cualquiera de las palabras COSA en la cabecera
    foreach ($palabra in $PalabrasCosa) {
        $patron = [regex]::Escape($palabra)
        if ($Cabecera -match $patron) {
            $resultado.Cosa = $palabra
            
            # Dividir la cadena usando la palabra COSA como separador
            $partes = $Cabecera -split $patron, 2
            $resultado.Nombre1 = Normalizar-Texto $partes[0]
            $resultado.Nombre2 = Normalizar-Texto $partes[1]
            
            # REGLA 1: Si CABECERA = nombre1 solamente
            if ($resultado.Nombre2 -eq "" -and $resultado.Nombre1 -eq $Cabecera.Replace($palabra, "").Trim()) {
                $resultado.Tipo = 1
                $resultado.Name = $resultado.Nombre1
                $resultado.Address = $resultado.Nombre1
                $resultado.ParentLocation = ""
            }
            # REGLA 2: Si CABECERA = nombre1 + . + cosa
            elseif ($Cabecera -match "^$([regex]::Escape($resultado.Nombre1))\.$patron$") {
                $resultado.Tipo = 2
                $resultado.Name = $Cabecera
                $resultado.Address = $resultado.Nombre1
                $resultado.ParentLocation = $resultado.Nombre1
            }
            # REGLA 3: Si CABECERA = nombre1 + espacio + cosa + espacio + nombre2
            elseif ($resultado.Nombre1 -ne "" -and $resultado.Nombre2 -ne "" -and $Cabecera -match " ") {
                $resultado.Tipo = 3
                $resultado.Name = $Cabecera
                $resultado.Address = $resultado.Nombre1
                $resultado.ParentLocation = "$($resultado.Nombre1).$($resultado.Cosa)"
            }
            # REGLA 4: Si CABECERA = nombre1 + espacio + cosa
            elseif ($resultado.Nombre1 -ne "" -and $resultado.Nombre2 -eq "" -and $Cabecera -match " " -and $Cabecera.EndsWith($palabra)) {
                $resultado.Tipo = 4
                $resultado.Name = $Cabecera
                $resultado.Address = $resultado.Nombre1
                $resultado.ParentLocation = "$($resultado.Nombre1).$($resultado.Cosa)"
            }
            else {
                # Patrón no reconocido, usar valores por defecto
                $resultado.Tipo = 0
                $resultado.Name = $Cabecera
                $resultado.Address = $Cabecera
                $resultado.ParentLocation = ""
            }
            break
        }
    }
    
    # Si no se encontró COSA, es el caso 1 (solo nombre1)
    if ($resultado.Cosa -eq "") {
        $resultado.Tipo = 1
        $resultado.Name = $Cabecera
        $resultado.Address = $Cabecera
        $resultado.ParentLocation = ""
        $resultado.Nombre1 = $Cabecera
    }
    
    return $resultado
}

# Función para procesar archivo Excel/CSV
function Importar-Archivo {
    param([string]$Archivo)
    
    $extension = [System.IO.Path]::GetExtension($Archivo).ToLower()
    
    try {
        if ($extension -eq ".csv") {
            return Import-Csv -Path $Archivo -Encoding UTF8
        }
        else {
            # Para archivos Excel (requiere ImportExcel module)
            try {
                if (Get-Module -ListAvailable -Name ImportExcel) {
                    Import-Module ImportExcel
                    return Import-Excel -Path $Archivo
                }
                else {
                    Write-Warning "El módulo ImportExcel no está instalado. Para archivos Excel, instale el módulo: Install-Module -Name ImportExcel"
                    return $null
                }
            }
            catch {
                Write-Warning "No se pudo importar el archivo Excel. Error: $($_.Exception.Message)"
                return $null
            }
        }
    }
    catch {
        Write-Error "Error al importar el archivo: $($_.Exception.Message)"
        return $null
    }
}

# Validaciones iniciales
if (-not (Test-Path $Directorio)) {
    Write-Error "El directorio especificado no existe: $Directorio"
    exit 1
}

$rutaActivo = Join-Path $Directorio $ActivoSource
$rutaUbicacion = Join-Path $Directorio $UbicacionSource

if (-not (Test-Path $rutaActivo)) {
    Write-Error "El archivo Activo-source no existe: $rutaActivo"
    exit 1
}

if (-not (Test-Path $rutaUbicacion)) {
    Write-Error "El archivo Ubicacion-source no existe: $rutaUbicacion"
    exit 1
}

# Procesar archivo activo-source
Write-Host "Procesando archivo activo-source..." -ForegroundColor Green
$datosActivo = Importar-Archivo -Archivo $rutaActivo

if ($null -eq $datosActivo) {
    Write-Error "No se pudieron importar los datos del archivo activo-source"
    exit 1
}

# Obtener cabeceras (primera fila desde columna C en adelante)
$cabeceras = @()
if ($datosActivo.Count -gt 0) {
    $primeraFila = $datosActivo[0]
    $propiedades = $primeraFila.PSObject.Properties.Name
    if ($propiedades.Count -gt 2) {
        $cabeceras = $propiedades[2..($propiedades.Count-1)] # Desde columna C en adelante
    }
    else {
        Write-Warning "El archivo activo-source no tiene suficientes columnas (se requieren al menos 3 columnas)"
        $cabeceras = $propiedades
    }
}

Write-Host "Se encontraron $($cabeceras.Count) cabeceras para procesar" -ForegroundColor Yellow

# Procesar cada cabecera y crear registros de ubicación
$nuevasUbicaciones = @()

foreach ($cabecera in $cabeceras) {
    Write-Host "Procesando cabecera: $cabecera" -ForegroundColor Gray
    $info = Extraer-InformacionCabecera -Cabecera $cabecera
    
    $nuevaUbicacion = [PSCustomObject]@{
        'ID' = ""
        'Name' = $info.Name
        'Address' = $info.Address
        'Parent Location' = $info.ParentLocation
        'Assigned To' = ""
        'Teams' = ""
        'Vendors' = ""
        'Contractors' = ""
    }
    
    Write-Host "  Tipo $($info.Tipo) - Name: $($info.Name), Address: $($info.Address), Parent: $($info.ParentLocation)" -ForegroundColor Cyan
    $nuevasUbicaciones += $nuevaUbicacion
}

# Procesar archivo ubicacion-source
Write-Host "Procesando archivo ubicacion-source..." -ForegroundColor Green
$datosUbicacion = Importar-Archivo -Archivo $rutaUbicacion

if ($null -eq $datosUbicacion) {
    Write-Error "No se pudieron importar los datos del archivo ubicacion-source"
    exit 1
}

# Extraer ubicaciones existentes
$ubicacionesExistentes = @()
foreach ($fila in $datosUbicacion) {
    $ubicacionExistente = [PSCustomObject]@{
        'ID' = if ($fila.ID) { $fila.ID } else { "" }
        'Name' = if ($fila.Name) { Normalizar-Texto $fila.Name } else { "" }
        'Address' = if ($fila.Address) { Normalizar-Texto $fila.Address } else { "" }
        'Parent Location' = if ($fila.'Parent Location') { Normalizar-Texto $fila.'Parent Location' } else { "" }
        'Assigned To' = if ($fila.'Assigned To') { $fila.'Assigned To' } else { "" }
        'Teams' = if ($fila.Teams) { $fila.Teams } else { "" }
        'Vendors' = if ($fila.Vendors) { $fila.Vendors } else { "" }
        'Contractors' = if ($fila.Contractors) { $fila.Contractors } else { "" }
    }
    $ubicacionesExistentes += $ubicacionExistente
}

# Combinar ubicaciones sin duplicados
$todasUbicaciones = @()
$hashUbicaciones = @{} # Para detectar duplicados

# Primero agregar ubicaciones existentes
foreach ($ubicacion in $ubicacionesExistentes) {
    $clave = "$($ubicacion.Name)|$($ubicacion.Address)|$($ubicacion.'Parent Location')".ToLower()
    if (-not $hashUbicaciones.ContainsKey($clave)) {
        $hashUbicaciones[$clave] = $true
        $todasUbicaciones += $ubicacion
    }
}

# Luego agregar nuevas ubicaciones (sin duplicados)
foreach ($ubicacion in $nuevasUbicaciones) {
    $clave = "$($ubicacion.Name)|$($ubicacion.Address)|$($ubicacion.'Parent Location')".ToLower()
    if (-not $hashUbicaciones.ContainsKey($clave) -and $ubicacion.Name -ne "") {
        $hashUbicaciones[$clave] = $true
        $todasUbicaciones += $ubicacion
    }
}

# Crear archivo de salida
$fecha = Get-Date -Format "yyyyMMdd_HHmmss"
$archivoSalida = Join-Path $Directorio "location_$fecha.csv"

# Exportar a CSV con configuración específica
Write-Host "Exportando a CSV: $archivoSalida" -ForegroundColor Yellow
$todasUbicaciones | Export-Csv -Path $archivoSalida -NoTypeInformation -Encoding UTF8 -Delimiter ","

# Verificar que el archivo se creó correctamente
if (Test-Path $archivoSalida) {
    $fileInfo = Get-Item $archivoSalida
    $rowCount = (Import-Csv $archivoSalida).Count
    
    Write-Host "Proceso completado exitosamente!" -ForegroundColor Green
    Write-Host "Archivo generado: $archivoSalida" -ForegroundColor Yellow
    Write-Host "Tamaño del archivo: $([math]::Round($fileInfo.Length/1KB, 2)) KB" -ForegroundColor Cyan
    Write-Host "Total de ubicaciones procesadas: $($todasUbicaciones.Count)" -ForegroundColor Cyan
    Write-Host " - Ubicaciones existentes: $($ubicacionesExistentes.Count)" -ForegroundColor Cyan
    Write-Host " - Nuevas ubicaciones: $($nuevasUbicaciones.Count)" -ForegroundColor Cyan
    Write-Host " - Ubicaciones únicas en el archivo final: $rowCount" -ForegroundColor Cyan
    
    # Mostrar algunos ejemplos del archivo generado
    Write-Host "`nPrimeros 5 registros del archivo generado:" -ForegroundColor Magenta
    $todasUbicaciones[0..4] | Format-Table Name, Address, 'Parent Location' -AutoSize
}
else {
    Write-Error "No se pudo crear el archivo de salida"
    exit 1
}