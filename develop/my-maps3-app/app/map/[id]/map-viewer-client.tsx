"use client"

import { useEffect, useState } from "react"
import { type MapData, mapDB } from "@/lib/db"
import { MapViewer } from "@/components/map-viewer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Calendar } from "lucide-react"

export function MapViewerClient({ mapId }: { mapId: string }) {
  const [map, setMap] = useState<MapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMap()
  }, [mapId])

  async function loadMap() {
    try {
      const mapData = await mapDB.getMap(mapId)
      if (!mapData) {
        setError("Mapa no encontrado")
      } else {
        setMap(mapData)
      }
    } catch (err) {
      console.error("[v0] Error loading map:", err)
      setError("Error al cargar el mapa")
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (!map) return

    const blob = new Blob([map.kmlContent], { type: "application/vnd.google-earth.kml+xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${map.name}.kml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Cargando mapa...</p>
        </div>
      </div>
    )
  }

  if (error || !map) {
    return (
      <Card className="p-8 text-center">
        <p className="text-destructive">{error || "Mapa no encontrado"}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">{map.name}</h2>
            {map.description && <p className="text-muted-foreground mb-4">{map.description}</p>}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Creado:{" "}
                {new Date(map.createdAt).toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          </div>
          <Button onClick={handleDownload} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar KML
          </Button>
        </div>
      </Card>

      <MapViewer kmlContent={map.kmlContent} />
    </div>
  )
}
