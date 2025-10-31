"use client"

import type React from "react"

import { useState } from "react"
import type { MapData } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, Upload, Copy, Check } from "lucide-react"

interface ExportImportDialogProps {
  map: MapData
  onImport?: (data: MapData) => void
}

export function ExportImportDialog({ map, onImport }: ExportImportDialogProps) {
  const [copied, setCopied] = useState(false)
  const [importError, setImportError] = useState("")

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(map, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${map.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyJSON = () => {
    const dataStr = JSON.stringify(map, null, 2)
    navigator.clipboard.writeText(dataStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        if (data.name && data.layers) {
          onImport?.(data)
          setImportError("")
        } else {
          setImportError("Formato de archivo inválido")
        }
      } catch (error) {
        setImportError("Error al leer el archivo JSON")
      }
    }
    reader.readAsText(file)
  }

  return (
    <Card className="p-4 bg-card border border-border rounded-lg space-y-4">
      <h3 className="font-semibold text-foreground">Importar/Exportar</h3>

      {/* Export Section */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Exportar Mapa</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportJSON}
            className="flex-1 flex items-center justify-center gap-2 bg-transparent"
          >
            <Download className="w-4 h-4" />
            Descargar JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyJSON}
            className="flex-1 flex items-center justify-center gap-2 bg-transparent"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </div>

      {/* Import Section */}
      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium text-foreground">Importar Mapa</p>
        <div className="relative">
          <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" id="import-file" />
          <label htmlFor="import-file">
            <Button
              size="sm"
              variant="outline"
              asChild
              className="w-full flex items-center justify-center gap-2 cursor-pointer bg-transparent"
            >
              <span>
                <Upload className="w-4 h-4" />
                Seleccionar Archivo
              </span>
            </Button>
          </label>
        </div>
        {importError && <p className="text-xs text-destructive">{importError}</p>}
      </div>
    </Card>
  )
}
