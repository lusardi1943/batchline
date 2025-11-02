"use client"
import dynamic from "next/dynamic"

const LeafletMapComponent = dynamic(() => import("@/components/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <p className="text-muted-foreground">Cargando mapa...</p>
    </div>
  ),
})

interface MapViewerProps {
  map: any
}

export default function MapViewer({ map }: MapViewerProps) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold text-foreground">{map.name}</h2>
          <p className="text-sm text-muted-foreground">{map.description}</p>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 overflow-hidden">
        <LeafletMapComponent map={map} />
      </div>
    </div>
  )
}
