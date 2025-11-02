"use client"

import { X } from "lucide-react"
import dynamic from "next/dynamic"

const LeafletMapComponent = dynamic(() => import("@/components/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-muted">
      <p className="text-muted-foreground">Cargando mapa...</p>
    </div>
  ),
})

interface MapModalProps {
  map: any
  onClose: () => void
}

export default function MapModal({ map, onClose }: MapModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h2 className="text-lg font-bold text-foreground">{map.name}</h2>
          <p className="text-sm text-muted-foreground">{map.description}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Cerrar">
          <X className="w-6 h-6 text-foreground" />
        </button>
      </div>

      {/* Map Container - Full screen */}
      <div className="flex-1 w-full overflow-hidden">
        <LeafletMapComponent map={map} />
      </div>
    </div>
  )
}
