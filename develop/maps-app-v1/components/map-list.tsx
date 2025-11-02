"use client"

import { Trash2, MapPin } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface MapListProps {
  maps: any[]
  selectedMap: any
  onSelectMap: (map: any) => void
  onDeleteMap: (mapId: string) => void
}

export default function MapList({ maps, selectedMap, onSelectMap, onDeleteMap }: MapListProps) {
  return (
    <div className="space-y-2 p-4">
      {maps.map((map) => (
        <div
          key={map.id}
          onClick={() => onSelectMap(map)}
          className={`p-3 rounded-lg cursor-pointer transition-all border-2 group ${
            selectedMap?.id === map.id
              ? "border-accent bg-accent/10"
              : "border-border hover:border-accent/50 hover:bg-muted"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
                <h3 className="font-semibold text-foreground truncate text-sm">{map.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground truncate">{map.description || "Sin descripción"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Importado: {formatDistanceToNow(new Date(map.createdAt), { addSuffix: true })}
              </p>
              <p className="text-xs text-muted-foreground">Elementos: {map.featureCount || 0}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDeleteMap(map.id)
              }}
              className="p-1.5 hover:bg-destructive/20 rounded text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              title="Eliminar mapa"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
