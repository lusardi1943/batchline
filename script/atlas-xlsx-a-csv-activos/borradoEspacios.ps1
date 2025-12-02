param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Mask,
    [switch]$Backup  # si se pasa, crea copia .bak antes de sobrescribir
)

function Trim-ObjectProperties {
    param([psobject]$obj)
    foreach ($prop in $obj.PSObject.Properties) {
        $val = $prop.Value
        if ($null -ne $val) {
            if ($val -is [string]) {
                $prop.Value = $val.TrimEnd()
            } elseif ($val -is [System.Array]) {
                $prop.Value = $val | ForEach-Object { if ($_ -is [string]) { $_.TrimEnd() } else { $_ } }
            }
        }
    }
    return $obj
}

function Process-CsvFile {
    param([string]$FilePath)
    Write-Host "Procesando CSV: $FilePath"
    $data = Import-Csv -Path $FilePath -ErrorAction Stop
    $trimmed = $data | ForEach-Object { Trim-ObjectProperties $_ }
    if ($Backup) { Copy-Item -Path $FilePath -Destination "$FilePath.bak" -Force }
    $trimmed | Export-Csv -Path $FilePath -NoTypeInformation -Encoding UTF8
    Write-Host "Reescrito CSV: $FilePath"
}

function Process-XlsxWithImportExcel {
    param([string]$FilePath)
    Write-Host "Procesando XLSX (ImportExcel): $FilePath"
    $sheets = Get-ExcelSheetInfo -Path $FilePath
    if ($Backup) { Copy-Item -Path $FilePath -Destination "$FilePath.bak" -Force }
    # Crear un archivo temporal y escribir cada hoja procesada con -Append
    $tmp = [System.IO.Path]::GetTempFileName() + ".xlsx"
    Remove-Item -Path $tmp -ErrorAction SilentlyContinue
    foreach ($s in $sheets) {
        $name = $s.Name
        $data = Import-Excel -Path $FilePath -WorksheetName $name
        $trimmed = $data | ForEach-Object { Trim-ObjectProperties $_ }
        if (-not (Test-Path $tmp)) {
            $trimmed | Export-Excel -Path $tmp -WorksheetName $name -AutoSize -Force
        } else {
            $trimmed | Export-Excel -Path $tmp -WorksheetName $name -AutoSize -Append
        }
    }
    Move-Item -Path $tmp -Destination $FilePath -Force
    Write-Host "Reescrito XLSX: $FilePath"
}

function Process-XlsxWithCOM {
    param([string]$FilePath)
    Write-Host "Procesando XLSX (COM): $FilePath"
    if ($Backup) { Copy-Item -Path $FilePath -Destination "$FilePath.bak" -Force }
    $excel = New-Object -ComObject Excel.Application
    $excel.DisplayAlerts = $false
    $excel.Visible = $false
    $wb = $excel.Workbooks.Open($FilePath)
    try {
        foreach ($ws in $wb.Worksheets) {
            $used = $ws.UsedRange
            if ($used -ne $null) {
                $rows = $used.Rows.Count
                $cols = $used.Columns.Count
                for ($r = 1; $r -le $rows; $r++) {
                    for ($c = 1; $c -le $cols; $c++) {
                        $cell = $ws.Cells.Item($r,$c)
                        $val = $cell.Value2
                        if ($val -ne $null -and ($val -is [string])) {
                            $cell.Value2 = $val.TrimEnd()
                        }
                    }
                }
            }
        }
        $wb.Save()
    } finally {
        $wb.Close($true)
        $excel.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
    }
    Write-Host "Reescrito XLSX: $FilePath"
}

# Recorrer archivos
Get-ChildItem -Path $Path -Filter $Mask -File -Recurse | ForEach-Object {
    $file = $_.FullName
    $ext = $_.Extension.ToLower()
    try {
        switch ($ext) {
            '.csv' {
                Process-CsvFile -FilePath $file
            }
            '.xlsx' { 
                if (Get-Module -ListAvailable -Name ImportExcel) {
                    Import-Module ImportExcel -ErrorAction SilentlyContinue
                    Process-XlsxWithImportExcel -FilePath $file
                } else {
                    Process-XlsxWithCOM -FilePath $file
                }
            }
            '.xls' {
                # .xls también por COM
                Process-XlsxWithCOM -FilePath $file
            }
            default {
                Write-Host "Extensión no soportada (se omite): $file"
            }
        }
    } catch {
        Write-Warning "Error procesando $file : $_"
    }
}