"use client"

import type { MapData } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, Edit, Trash2, Layers } from "lucide-react"

interface MapsListProps {
  maps: MapData[]
  onView: (map: MapData) => void
  onEdit: (map: MapData) => void
  onDelete: (id: string) => void
}

export function MapsList({ maps, onView, onEdit, onDelete }: MapsListProps) {
  if (maps.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 text-center max-w-md">
          <Layers className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground mb-2">No hay mapas guardados</h2>
          <p className="text-muted-foreground">Crea tu primer mapa para comenzar a guardar tus datos cartográficos</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="py-8 px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {maps.map((map) => (
          <Card key={map.id} className="p-4 hover:shadow-lg transition-shadow">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground truncate">{map.name}</h3>
              {map.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{map.description}</p>}
            </div>
            <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
              <Layers className="w-4 h-4" />
              <span>{map.layers.length} capas</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onView(map)}
                className="flex-1 flex items-center justify-center gap-1"
              >
                <Eye className="w-4 h-4" />
                Ver
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(map)}
                className="flex-1 flex items-center justify-center gap-1"
              >
                <Edit className="w-4 h-4" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm("¿Eliminar este mapa?")) {
                    onDelete(map.id)
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
