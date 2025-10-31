import { useEffect } from "react"
import { useParams } from "next/navigation"
import { useState } from "react"
import { MapViewer } from "@/components/map-viewer"
import { parseKML } from "@/lib/kml-parser"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MapPin } from "lucide-react"
import Link from "next/link"

// This is a client-side only page since we're using IndexedDB
export default function MapPage() {
  return <MapPageClient />
}

function MapPageClient() {
  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-semibold">Visor de Mapa</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <MapViewerWrapper />
      </main>
    </div>
  )
}

function MapViewerWrapper() {
  "use client"

  const [mapData, setMapData] = useState<any>(null)
  const [parsedKML, setParsedKML] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const params = useParams()
  const id = params.id as string

  useEffect(() => {
    async function loadMap() {
      try {
        // Import mapDB dynamically to avoid SSR issues
        const { mapDB } = await import("@/lib/db")
        const map = await mapDB.getMap(id)

        if (!map) {
          setError("Map not found")
          setLoading(false)
          return
        }

        setMapData(map)

        // Parse KML
        const parsed = await parseKML(map.kmlContent)
        setParsedKML(parsed)
        setLoading(false)
      } catch (err) {
        console.error("[v0] Error loading map:", err)
        setError("Failed to load map")
        setLoading(false)
      }
    }

    loadMap()
  }, [id])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
          <p className="text-muted-foreground">Cargando mapa...</p>
        </div>
      </div>
    )
  }

  if (error || !parsedKML) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Mapa no encontrado</h2>
          <p className="text-muted-foreground mb-4">{error || "No se pudo cargar el mapa"}</p>
          <Button asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Mis Mapas
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return <MapViewer parsedKML={parsedKML} />
}
