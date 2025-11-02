"use client"

import type React from "react"

import { useRef, useState } from "react"
import { X, Upload, AlertCircle } from "lucide-react"
import { saveMap } from "@/lib/db"
import { parseKMLFile } from "@/lib/kml-parser"

interface ImportDialogProps {
  onClose: () => void
  onSuccess: () => void
}

export default function ImportDialog({ onClose, onSuccess }: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFile = async (file: File) => {
    setError(null)
    setLoading(true)

    try {
      if (!file.name.endsWith(".kml") && !file.name.endsWith(".kmz")) {
        throw new Error("Solo se aceptan archivos KML o KMZ")
      }

      const geojson = await parseKMLFile(file)

      const mapData = {
        id: `map_${Date.now()}`,
        name: file.name.replace(/\.(kml|kmz)$/i, ""),
        description: `Importado desde ${file.name}`,
        geojson,
        featureCount: geojson.features?.length || 0,
        createdAt: new Date().toISOString(),
      }

      await saveMap(mapData)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar el archivo")
      console.error("Import error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFile(files[0])
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Importar Mapa</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-destructive/20 border border-destructive/50 rounded-lg flex gap-2">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragActive ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
            }`}
          >
            <Upload
              className={`w-10 h-10 mx-auto mb-3 transition-colors ${
                dragActive ? "text-accent" : "text-muted-foreground"
              }`}
            />
            <p className="text-sm font-medium text-foreground mb-1">Arrastra tu archivo aquí</p>
            <p className="text-xs text-muted-foreground mb-4">O haz clic para seleccionar</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".kml,.kmz"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFile(e.target.files[0])
                }
              }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="px-4 py-2 bg-accent text-accent-foreground rounded hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Importando..." : "Seleccionar Archivo"}
            </button>
          </div>

          <p className="text-xs text-muted-foreground mt-4 text-center">Formatos soportados: KML, KMZ</p>
        </div>
      </div>
    </div>
  )
}
