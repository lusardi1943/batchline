"use client"

import { useEffect, useState } from "react"
import MapViewer from "@/components/map-viewer"
import MapList from "@/components/map-list"
import ImportDialog from "@/components/import-dialog"
import { initDB, getStoredMaps, deleteMap } from "@/lib/db"
import { MapIcon, Upload, LucideSidebar as MapIconSidebar } from "lucide-react"

export default function Home() {
  const [maps, setMaps] = useState<any[]>([])
  const [selectedMap, setSelectedMap] = useState<any>(null)
  const [showImport, setShowImport] = useState(false)
  const [activeTab, setActiveTab] = useState<"import" | "maps">("import")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initDB()
        const storedMaps = await getStoredMaps()
        setMaps(storedMaps)
        if (storedMaps.length > 0) {
          setSelectedMap(storedMaps[0])
          setActiveTab("maps")
        }
      } catch (error) {
        console.error("Error initializing app:", error)
      } finally {
        setLoading(false)
      }
    }

    initializeApp()
  }, [])

  const handleMapImported = async () => {
    const updatedMaps = await getStoredMaps()
    setMaps(updatedMaps)
    if (updatedMaps.length > 0) {
      setSelectedMap(updatedMaps[0])
      setActiveTab("maps")
    }
    setShowImport(false)
  }

  const handleDeleteMap = async (mapId: string) => {
    await deleteMap(mapId)
    const updatedMaps = await getStoredMaps()
    setMaps(updatedMaps)
    if (selectedMap?.id === mapId) {
      setSelectedMap(updatedMaps[0] || null)
    }
  }

  const handleSelectMap = (map: any) => {
    setSelectedMap(map)
    setActiveTab("maps")
  }

  const handleImportTab = () => {
    setActiveTab("import")
    setSelectedMap(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-foreground">Cargando mapas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent rounded-lg">
              <MapIcon className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Visor de Mapas KML/KMZ</h1>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {maps.length} mapa{maps.length !== 1 ? "s" : ""} guardado{maps.length !== 1 ? "s" : ""}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex w-80 flex-col border-r border-border bg-card">
          <div className="flex gap-0 border-b border-border">
            <button
              onClick={() => {
                handleImportTab()
                setSelectedMap(null)
              }}
              className={`flex-1 px-4 py-3 font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${
                activeTab === "import"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="w-4 h-4" />
              Importar
            </button>
            <button
              onClick={() => setActiveTab("maps")}
              className={`flex-1 px-4 py-3 font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${
                activeTab === "maps"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapIconSidebar className="w-4 h-4" />
              Mapas
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            {activeTab === "import" && (
              <div className="p-4">
                <ImportDialogContent onImportClick={() => setShowImport(true)} />
              </div>
            )}

            {activeTab === "maps" && (
              <>
                {maps.length === 0 ? (
                  <div className="flex items-center justify-center h-full p-4 text-center">
                    <div className="text-muted-foreground">
                      <p className="mb-2 text-sm">No hay mapas importados</p>
                      <p className="text-xs">Importa un archivo KML o KMZ para comenzar</p>
                    </div>
                  </div>
                ) : (
                  <MapList
                    maps={maps}
                    selectedMap={selectedMap}
                    onSelectMap={handleSelectMap}
                    onDeleteMap={handleDeleteMap}
                  />
                )}
              </>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs - Mobile */}
          <div className="lg:hidden flex gap-0 border-b border-border bg-card">
            <button
              onClick={() => {
                handleImportTab()
                setSelectedMap(null)
              }}
              className={`flex-1 px-4 py-3 font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${
                activeTab === "import"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="w-4 h-4" />
              Importar
            </button>
            <button
              onClick={() => setActiveTab("maps")}
              className={`flex-1 px-4 py-3 font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${
                activeTab === "maps"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapIconSidebar className="w-4 h-4" />
              Mapas
            </button>
          </div>

          {/* Mobile - Import Tab */}
          {activeTab === "import" && (
            <div className="lg:hidden flex-1 overflow-auto p-4">
              <ImportDialogContent onImportClick={() => setShowImport(true)} />
            </div>
          )}

          {/* Mobile - Maps List Tab */}
          {activeTab === "maps" && (
            <div className="lg:hidden flex-1 overflow-auto">
              {maps.length === 0 ? (
                <div className="flex items-center justify-center h-full p-4 text-center">
                  <div className="text-muted-foreground">
                    <p className="mb-2 text-sm">No hay mapas importados</p>
                    <p className="text-xs">Importa un archivo KML o KMZ para comenzar</p>
                  </div>
                </div>
              ) : (
                <MapList
                  maps={maps}
                  selectedMap={selectedMap}
                  onSelectMap={handleSelectMap}
                  onDeleteMap={handleDeleteMap}
                />
              )}
            </div>
          )}

          {/* Desktop - Map Viewer */}
          {selectedMap ? (
            <div className="hidden lg:flex flex-1 overflow-hidden">
              <MapViewer map={selectedMap} />
            </div>
          ) : (
            <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-card to-background">
              <div className="text-center">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 opacity-20">
                  <MapIcon className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Selecciona un mapa</h2>
                <p className="text-muted-foreground mb-6">Importa un archivo KML o KMZ para visualizarlo</p>
              </div>
            </div>
          )}

          {/* Mobile - Map Viewer */}
          {selectedMap && (
            <div className="lg:hidden flex-1 overflow-hidden">
              <div className="relative h-full">
                <button
                  onClick={() => {
                    setSelectedMap(null)
                    setActiveTab("maps")
                  }}
                  className="absolute top-4 right-4 px-4 py-2 bg-card text-foreground border border-border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors font-medium z-10 text-sm"
                >
                  Cerrar
                </button>
                <MapViewer map={selectedMap} />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Import Dialog */}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} onSuccess={handleMapImported} />}
    </div>
  )
}

function ImportDialogContent({ onImportClick }: { onImportClick: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Importar Mapa
        </h2>
      </div>

      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent/50 transition-colors">
        <MapIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground mb-1">Importar Mapa KML/KMZ</p>
        <p className="text-xs text-muted-foreground mb-4">
          Arrastra un archivo KML o KMZ aquí, o haz clic para seleccionar
        </p>
        <button
          onClick={onImportClick}
          className="px-6 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity font-medium text-sm"
        >
          Seleccionar Archivo
        </button>
      </div>

      <div className="pt-4 border-t border-border space-y-1">
        <p className="text-xs font-medium text-foreground">Formatos soportados: KML, KMZ</p>
        <p className="text-xs text-muted-foreground">Tamaño máximo: 50MB</p>
      </div>
    </div>
  )
}
