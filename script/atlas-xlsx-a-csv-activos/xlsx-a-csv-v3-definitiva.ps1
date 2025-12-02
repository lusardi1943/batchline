<#
.SYNOPSIS
  Genera CSV desde archivos Excel según plantilla embebida y la lógica Parent->Name->Locations,
  procesando columna por columna (C..última) y reiniciando el estado para cada columna.
  Inserta una fila en blanco entre los bloques resultantes de cada columna.
  Ordena la salida por Location Name (A-Z) y asegura padres antes que hijos.

.PARAMETER Directory
  Carpeta donde buscar los archivos Excel.

.PARAMETER Mask
  Máscara del nombre de archivo (por ejemplo "datos.xlsx" o "*.xlsx").

.NOTES
  Requiere Excel instalado (COM) para leer .xlsx/.xls si no se usa ImportExcel.
  Exporta CSV en UTF8 (con BOM cuando PowerShell lo soporte), separador coma.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Directory,

    [Parameter(Mandatory=$true)]
    [string]$Mask
)

# Forzar cultura a Español (España)
[System.Threading.Thread]::CurrentThread.CurrentCulture = 'es-ES'
[System.Threading.Thread]::CurrentThread.CurrentUICulture = 'es-ES'

# Plantilla embebida (cabeceras en el orden requerido)
$templateHeaders = @(
    'ID','Name','Description','Status','Archived','Location Name','Parent Asset','Area','Barcode',
    'Category','Primary User','Warranty Expiration Date','Additional Information','Serial Number',
    'Assigned To','Teams','Parts','Vendors','Contractors','Acquisition cost'
)

function Release-ComObject {
    param($obj)
    if ($null -ne $obj) {
        try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($obj) | Out-Null } catch {}
    }
}

if (-not (Test-Path -Path $Directory -PathType Container)) {
    Write-Error "El directorio no existe: $Directory"
    exit 1
}

$files = Get-ChildItem -Path $Directory -Filter $Mask -File -ErrorAction SilentlyContinue
if (-not $files -or $files.Count -eq 0) {
    Write-Host "No se encontraron archivos que coincidan con la máscara '$Mask' en '$Directory'."
    exit 0
}

foreach ($file in $files) {
    $filePath = $file.FullName
    Write-Host "Procesando: $filePath"

    $timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($filePath)
    $outFileName = "$baseName-CSV-$timestamp.csv"
    $outPath = Join-Path -Path $file.DirectoryName -ChildPath $outFileName

    $resultsGlobal = @()

    $excel = $null; $workbook = $null; $ws = $null; $used = $null
    try {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false

        $workbook = $excel.Workbooks.Open($filePath)
        # Usamos la primera hoja por defecto
        $ws = $workbook.Worksheets.Item(1)
        $used = $ws.UsedRange

        # Leer dimensiones
        $rows = [int]$used.Rows.Count
        $cols = [int]$used.Columns.Count

        if ($rows -lt 1 -or $cols -lt 3) {
            Write-Warning "El archivo '$($file.Name)' no tiene suficientes filas/columnas (se requieren al menos 1 fila y 3 columnas). Se omite."
            continue
        }

        # Leer todo el rango en memoria para evitar llamadas COM por celda
        $data = $used.Value2

        # Liberar referencia a $used (ya tenemos $data)
        Release-ComObject $used
        $used = $null

        # Construir cabeceras de Location desde la fila 1, columnas 3..$cols
        $locationHeaders = @{}
        for ($c = 3; $c -le $cols; $c++) {
            $raw = $data[1, $c]
            $h = if ($null -eq $raw) { "" } else { [string]$raw.Trim() }
            if ([string]::IsNullOrWhiteSpace($h)) { $h = "Location_$c" }
            $locationHeaders[$c] = $h
        }

        # Procesar columna por columna (C..última)
        for ($c = 3; $c -le $cols; $c++) {
            $locName = $locationHeaders[$c]
            Write-Verbose "Procesando columna $c -> '$locName'"

            $resultsCol = @()

            $r = 2
            while ($r -le $rows) {
                $parentRaw = $data[$r,1]
                $parentVal = if ($null -eq $parentRaw) { "" } else { [string]$parentRaw.Trim() }

                if (-not [string]::IsNullOrWhiteSpace($parentVal)) {
                    $currentParent = $parentVal
                    # Usamos un flag por Parent dentro de la columna para añadir el padre solo una vez
                    $parentAdded = $false

                    # recorrer hijos (col B) a partir de la fila siguiente
                    $rChild = $r + 1
                    while ($rChild -le $rows) {
                        $parentAtChildRaw = $data[$rChild,1]
                        $parentAtChild = if ($null -eq $parentAtChildRaw) { "" } else { [string]$parentAtChildRaw.Trim() }

                        # si aparece un nuevo Parent en Col A, salimos del bloque de hijos
                        if (-not [string]::IsNullOrWhiteSpace($parentAtChild)) { break }

                        $nameRaw = $data[$rChild,2]
                        $nameVal = if ($null -eq $nameRaw) { "" } else { [string]$nameRaw.Trim() }

                        # si Name vacío, fin de hijos asociados
                        if ([string]::IsNullOrWhiteSpace($nameVal)) { break }

                        # Solo comprobamos la columna de Location actual ($c)
                        $cellValueRaw = $data[$rChild, $c]
                        if ($null -ne $cellValueRaw) {
                            $cellText = [string]$cellValueRaw
                            $cellText = $cellText.Trim()
                            if (-not [string]::IsNullOrWhiteSpace($cellText)) {
                                # Parseo numérico respetando la cultura actual
                                $num = 0.0
                                $isNum = [double]::TryParse($cellText, [System.Globalization.NumberStyles]::Any, [System.Threading.Thread]::CurrentThread.CurrentCulture, [ref]$num)
                                $include = $false
                                if ($isNum) {
                                    if ($num -ge 1.0) { $include = $true }
                                } else {
                                    if (-not $cellText.Equals('0')) { $include = $true }
                                }

                                if ($include) {
                                    # Añadir registro padre (una sola vez por Parent en esta Location)
                                    if (-not $parentAdded) {
                                        $parentObj = [PSCustomObject]@{
                                            ID = ''
                                            Name = [string]$currentParent
                                            Description = ''
                                            Status = ''
                                            Archived = ''
                                            'Location Name' = [string]$locName
                                            'Parent Asset' = ''
                                            Area = ''
                                            Barcode = ''
                                            Category = ''
                                            'Primary User' = ''
                                            'Warranty Expiration Date' = ''
                                            'Additional Information' = ''
                                            'Serial Number' = ''
                                            'Assigned To' = ''
                                            Teams = ''
                                            Parts = ''
                                            Vendors = ''
                                            Contractors = ''
                                            'Acquisition cost' = ''
                                        }
                                        $resultsCol += $parentObj
                                        $parentAdded = $true
                                    }

                                    # Añadir hijo
                                    $childObj = [PSCustomObject]@{
                                        ID = ''
                                        Name = [string]$nameVal
                                        Description = ''
                                        Status = ''
                                        Archived = ''
                                        'Location Name' = [string]$locName
                                        'Parent Asset' = [string]$currentParent
                                        Area = ''
                                        Barcode = ''
                                        Category = ''
                                        'Primary User' = ''
                                        'Warranty Expiration Date' = ''
                                        'Additional Information' = ''
                                        'Serial Number' = ''
                                        'Assigned To' = ''
                                        Teams = ''
                                        Parts = ''
                                        Vendors = ''
                                        Contractors = ''
                                        'Acquisition cost' = ''
                                    }
                                    $resultsCol += $childObj
                                }
                            }
                        }

                        $rChild++
                    } # end while hijos

                    # continuar desde donde terminó el bloque de hijos
                    $r = $rChild
                } else {
                    $r++
                }
            } # end while filas

            # Al finalizar la columna actual, ordenar y agrupar SOLO los registros de esta columna
            if ($resultsCol.Count -gt 0) {
                # Orden: Location Name (aunque es la misma), padres antes que hijos, luego por Name
                $sortedCol = $resultsCol | Sort-Object -Property @{Expression={$_. 'Location Name'}}, @{Expression={ if ([string]::IsNullOrWhiteSpace($_.'Parent Asset')) { 0 } else { 1 } }}, 'Name'

                # Asegurar orden de columnas según plantilla
                $orderedCol = $sortedCol | ForEach-Object {
                    $props = [ordered]@{}
                    foreach ($h in $templateHeaders) {
                        if ($_.PSObject.Properties.Name -contains $h) { $props[$h] = [string]($_.$h) } else { $props[$h] = '' }
                    }
                    New-Object PSObject -Property $props
                }

                # Si ya hay datos globales, insertar una fila en blanco antes de añadir este bloque
                if ($resultsGlobal.Count -gt 0) {
                    $blankProps = [ordered]@{}
                    foreach ($h in $templateHeaders) { $blankProps[$h] = '' }
                    $blankRow = New-Object PSObject -Property $blankProps
                    $resultsGlobal += $blankRow
                }

                # Añadir al resultado global (manteniendo el orden por columna procesada)
                $resultsGlobal += $orderedCol
            } else {
                Write-Verbose "No hay datos para la Location '$locName' (col $c)."
            }
        } # end for columnas

    } catch {
        Write-Error "Error procesando '$($file.Name)': $_"
    } finally {
        # Cerrar y liberar COM objects
        if ($workbook -ne $null) {
            try { $workbook.Close($false) } catch {}
            Release-ComObject $workbook
            $workbook = $null
        }
        if ($ws -ne $null) {
            Release-ComObject $ws
            $ws = $null
        }
        if ($excel -ne $null) {
            try { $excel.Quit() } catch {}
            Release-ComObject $excel
            $excel = $null
        }
        [GC]::Collect(); [GC]::WaitForPendingFinalizers()
    }

    # Exportar resultados si hay registros
    if ($resultsGlobal.Count -eq 0) {
        Write-Host "No se generaron registros para '$($file.Name)'."
    } else {
        # Determinar encoding: usar UTF8BOM en PowerShell 7+, en 5.1 usar UTF8
        if ($PSVersionTable.PSVersion.Major -ge 7) {
            $encodingToUse = 'UTF8BOM'
        } else {
            $encodingToUse = 'UTF8'
        }

        # Exportar CSV con BOM cuando sea posible y coma como separador
        try {
            if ($encodingToUse -eq 'UTF8BOM') {
                $resultsGlobal | Export-Csv -Path $outPath -NoTypeInformation -Encoding UTF8BOM -Delimiter ','
            } else {
                $resultsGlobal | Export-Csv -Path $outPath -NoTypeInformation -Encoding UTF8 -Delimiter ','
            }
            Write-Host "CSV generado (procesado por columnas con líneas en blanco entre bloques): $outPath"
        } catch {
            Write-Warning "Error al exportar CSV con encoding '$encodingToUse'. Intentando UTF8 sin BOM."
            $resultsGlobal | Export-Csv -Path $outPath -NoTypeInformation -Encoding UTF8 -Delimiter ','
            Write-Host "CSV generado (procesado por columnas con líneas en blanco entre bloques): $outPath"
        }
    }
}

Write-Host "Proceso finalizado para todos los archivos."