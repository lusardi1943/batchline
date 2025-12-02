<#
.SYNOPSIS
  Genera CSV desde archivos Excel según plantilla embebida y la lógica Parent->Name->Locations,
  y ordena la salida por Location Name (A-Z).

.PARAMETER Directory
  Carpeta donde buscar los archivos Excel.

.PARAMETER Mask
  Máscara del nombre de archivo (por ejemplo "datos.xlsx" o "*.xlsx").

.NOTES
  Requiere Excel instalado (COM) para leer .xlsx/.xls. Exporta CSV en UTF8, separador coma.
#>

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

function Release-ComObject { param($obj) if ($null -ne $obj) { try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($obj) | Out-Null } catch {} } }

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

    $results = @()

    $excel = $null; $workbook = $null; $ws = $null; $used = $null
    try {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false

        $workbook = $excel.Workbooks.Open($filePath)
        $ws = $workbook.Worksheets.Item(1)
        $used = $ws.UsedRange
        $rows = [int]$used.Rows.Count
        $cols = [int]$used.Columns.Count

        if ($rows -lt 1 -or $cols -lt 3) {
            Write-Warning "El archivo '$($file.Name)' no tiene suficientes filas/columnas (se requieren al menos 1 fila y 3 columnas). Se omite."
            continue
        }

        # Leer nombres de locaciones desde la fila 1, columnas C..última (trim)
        $locationHeaders = @{}
        for ($c = 3; $c -le $cols; $c++) {
            $raw = [string]$used.Cells.Item(1,$c).Text
            $h = if ($null -eq $raw) { "" } else { $raw.Trim() }
            if ([string]::IsNullOrWhiteSpace($h)) { $h = "Location_$c" }
            $locationHeaders[$c] = $h
        }

        # Recorremos columna A buscando Parent Asset (trim y saltar filas vacías)
        $r = 2
        while ($r -le $rows) {
            $parentRaw = $used.Cells.Item($r,1).Text
            $parentVal = if ($null -eq $parentRaw) { "" } else { $parentRaw.ToString().Trim() }

            if (-not [string]::IsNullOrWhiteSpace($parentVal)) {
                $currentParent = $parentVal

                # Recorremos la columna B desde la fila siguiente para obtener los hijos (Names)
                $rChild = $r + 1
                while ($rChild -le $rows) {
                    $parentAtChildRaw = $used.Cells.Item($rChild,1).Text
                    $parentAtChild = if ($null -eq $parentAtChildRaw) { "" } else { $parentAtChildRaw.ToString().Trim() }

                    # Si aparece un nuevo Parent Asset en Col A, salimos del bloque de hijos
                    if (-not [string]::IsNullOrWhiteSpace($parentAtChild)) { break }

                    $nameRaw = $used.Cells.Item($rChild,2).Text
                    $nameVal = if ($null -eq $nameRaw) { "" } else { $nameRaw.ToString().Trim() }

                    # Si Name está vacío, fin de los hijos asociados (según tu regla)
                    if ([string]::IsNullOrWhiteSpace($nameVal)) { break }

                    # Para cada columna de Location (C..cols) comprobar valor en la fila del hijo
                    for ($c = 3; $c -le $cols; $c++) {
                        $cell = $used.Cells.Item($rChild,$c)
                        $cellValueRaw = $cell.Value2
                        if ($null -eq $cellValueRaw) { continue }

                        $cellText = $cellValueRaw.ToString().Trim()
                        if ([string]::IsNullOrWhiteSpace($cellText)) { continue }

                        # Normalizar número: si es numérico y >=1 incluir; si no numérico, incluir si distinto de '0'
                        $num = 0.0
                        $isNum = [double]::TryParse($cellText, [ref]$num)
                        $include = $false
                        if ($isNum) {
                            if ($num -ge 1.0) { $include = $true }
                        } else {
                            if (-not $cellText.Equals('0')) { $include = $true }
                        }

                        if ($include) {
                            $locName = $locationHeaders[$c]

                            # Crear objeto con todas las propiedades de la plantilla (solo Name, Location Name y Parent Asset llenos)
                            $obj = [PSCustomObject]@{
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

                            $results += $obj
                        }
                    }

                    $rChild++
                }

                # Continuar desde la fila donde terminó el bloque de hijos
                $r = $rChild
            } else {
                $r++
            }
        }

    } catch {
        Write-Error "Error procesando '$($file.Name)': $_"
    } finally {
        if ($workbook -ne $null) { $workbook.Close($false); Release-ComObject $workbook }
        if ($excel -ne $null) { $excel.Quit(); Release-ComObject $excel }
        [GC]::Collect(); [GC]::WaitForPendingFinalizers()
    }

    # Exportar resultados si hay registros
    if ($results.Count -eq 0) {
        Write-Host "No se generaron registros para '$($file.Name)'."
    } else {
        # Ordenar por Location Name (A-Z) y luego por Name para determinismo
        $sorted = $results | Sort-Object -Property 'Location Name','Name'

        # Asegurar orden de columnas según plantilla y convertir todo a string
        $ordered = $sorted | ForEach-Object {
            $props = [ordered]@{}
            foreach ($h in $templateHeaders) {
                if ($_.PSObject.Properties.Name -contains $h) { $props[$h] = [string]($_.$h) } else { $props[$h] = '' }
            }
            New-Object PSObject -Property $props
        }

        # Exportar CSV con UTF8 y coma como separador
        $ordered | Export-Csv -Path $outPath -NoTypeInformation -Encoding UTF8 -Delimiter ','

        Write-Host "CSV generado (ordenado por Location Name): $outPath"
    }
}

Write-Host "Proceso finalizado para todos los archivos."