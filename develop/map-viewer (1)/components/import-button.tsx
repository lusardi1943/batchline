"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, FileUp } from "lucide-react"
import { mapDB, type MapData } from "@/lib/db"
import { parseKML } from "@/lib/kml-parser"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function ImportButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [mapName, setMapName] = useState("")
  const [mapDescription, setMapDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const extension = file.name.split(".").pop()?.toLowerCase()
    if (extension !== "kml" && extension !== "kmz") {
      setError("Por favor selecciona un archivo KML o KMZ")
      return
    }

    setSelectedFile(file)
    setError(null)

    // Auto-fill name from filename
    if (!mapName) {
      const nameWithoutExt = file.name.replace(/\.(kml|kmz)$/i, "")
      setMapName(nameWithoutExt)
    }
  }

  async function handleImport() {
    if (!selectedFile) return

    setIsUploading(true)
    setError(null)

    try {
      // Read file content
      const fileContent = await readFileAsText(selectedFile)

      // Parse KML to validate
      const parsed = await parseKML(fileContent)

      // Create map data
      const mapData: MapData = {
        id: crypto.randomUUID(),
        name: mapName || parsed.name || selectedFile.name,
        description: mapDescription || parsed.description,
        kmlContent: fileContent,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      // Save to IndexedDB
      await mapDB.addMap(mapData)

      // Reset and close
      setIsOpen(false)
      setSelectedFile(null)
      setMapName("")
      setMapDescription("")

      // Reload page to show new map
      window.location.reload()
    } catch (err) {
      console.error("[v0] Error importing map:", err)
      setError(err instanceof Error ? err.message : "Error al importar el mapa")
    } finally {
      setIsUploading(false)
    }
  }

  function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result
        if (typeof result === "string") {
          resolve(result)
        } else {
          reject(new Error("Failed to read file"))
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file)
    })
  }

  function handleOpenDialog() {
    setIsOpen(true)
    setError(null)
  }

  function handleCloseDialog() {
    if (!isUploading) {
      setIsOpen(false)
      setSelectedFile(null)
      setMapName("")
      setMapDescription("")
      setError(null)
    }
  }

  return (
    <>
      <Button onClick={handleOpenDialog}>
        <Upload className="h-4 w-4 mr-2" />
        Importar Mapa
      </Button>

      <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Mapa KML/KMZ</DialogTitle>
            <DialogDescription>
              Sube un archivo KML o KMZ exportado desde Google My Maps u otra fuente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="file">Archivo</Label>
              <div className="flex gap-2">
                <Input
                  id="file"
                  ref={fileInputRef}
                  type="file"
                  accept=".kml,.kmz"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="flex-1"
                />
                {selectedFile && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ""
                      }
                    }}
                    disabled={isUploading}
                  >
                    ✕
                  </Button>
                )}
              </div>
              {selectedFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileUp className="h-3 w-3" />
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {/* Map Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Mapa</Label>
              <Input
                id="name"
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
                placeholder="Ej: Ruta de Senderismo 2024"
                disabled={isUploading}
              />
            </div>

            {/* Map Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                value={mapDescription}
                onChange={(e) => setMapDescription(e.target.value)}
                placeholder="Añade una descripción para tu mapa..."
                rows={3}
                disabled={isUploading}
              />
            </div>

            {/* Error Message */}
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isUploading}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={!selectedFile || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
