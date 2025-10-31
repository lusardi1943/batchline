"use client"

import { useEffect, useState } from "react"
import { MapsList } from "@/components/maps-list"
import { MapEditor } from "@/components/map-editor"
import { MapViewer } from "@/components/map-viewer"
import { Button } from "@/components/ui/button"
import { Plus, MapPin } from "lucide-react"
import type { MapData } from "@/lib/types"

export default function Home() {
  const [maps, setMaps] = useState<MapData[]>([])
  const [selectedMap, setSelectedMap] = useState<MapData | null>(null)
  const [view, setView] = useState<"list" | "editor" | "viewer">("list")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      const response = await fetch("/api/db/init", { method: "POST" })
      if (response.ok) {
        await loadMaps()
      }
    } catch (error) {
      console.error("Error initializing app:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMaps = async () => {
    try {
      const response = await fetch("/api/maps")
      const data = await response.json()
      setMaps(data)
    } catch (error) {
      console.error("Error loading maps:", error)
    }
  }

  const handleCreateNew = () => {
    setSelectedMap(null)
    setView("editor")
  }

  const handleSaveMap = async (mapData: MapData) => {
    try {
      const response = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapData),
      })
      if (response.ok) {
        await loadMaps()
        setView("list")
      }
    } catch (error) {
      console.error("Error saving map:", error)
    }
  }

  const handleDeleteMap = async (id: string) => {
    try {
      await fetch(`/api/maps/${id}`, { method: "DELETE" })
      await loadMaps()
    } catch (error) {
      console.error("Error deleting map:", error)
    }
  }

  const handleViewMap = (map: MapData) => {
    setSelectedMap(map)
    setView("viewer")
  }

  const handleEditMap = (map: MapData) => {
    setSelectedMap(map)
    setView("editor")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <MapPin className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-foreground">Inicializando aplicación...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Mis Mapas</h1>
          </div>
          {view === "list" && (
            <Button onClick={handleCreateNew} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Mapa
            </Button>
          )}
          {(view === "editor" || view === "viewer") && (
            <Button onClick={() => setView("list")} variant="outline">
              Volver
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {view === "list" && (
          <MapsList maps={maps} onView={handleViewMap} onEdit={handleEditMap} onDelete={handleDeleteMap} />
        )}
        {view === "editor" && selectedMap && <MapEditor map={selectedMap} onSave={handleSaveMap} isEditing={true} />}
        {view === "editor" && !selectedMap && <MapEditor onSave={handleSaveMap} isEditing={false} />}
        {view === "viewer" && selectedMap && <MapViewer map={selectedMap} />}
      </div>
    </main>
  )
}
