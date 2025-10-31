"use client"

import { useState } from "react"
import type { Layer } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Eye, EyeOff, Trash2, Copy, Lock, Unlock, ChevronDown, ChevronUp } from "lucide-react"

interface LayerManagerProps {
  layers: Layer[]
  onLayerUpdate: (layer: Layer) => void
  onLayerDelete: (layerId: string) => void
  onLayerToggleVisibility: (layerId: string) => void
  onLayerDuplicate: (layer: Layer) => void
  onLayerReorder?: (layers: Layer[]) => void
}

interface LayerUI extends Layer {
  opacity: number
  locked: boolean
  collapsed: boolean
}

export function LayerManager({
  layers,
  onLayerUpdate,
  onLayerDelete,
  onLayerToggleVisibility,
  onLayerDuplicate,
  onLayerReorder,
}: LayerManagerProps) {
  const [layerUIState, setLayerUIState] = useState<Map<string, Omit<LayerUI, keyof Layer>>>(
    new Map(
      layers.map((l) => [
        l.id,
        {
          opacity: 1,
          locked: false,
          collapsed: false,
        },
      ]),
    ),
  )

  const updateLayerUI = (layerId: string, updates: Partial<Omit<LayerUI, keyof Layer>>) => {
    setLayerUIState((prev) => {
      const newState = new Map(prev)
      newState.set(layerId, { ...prev.get(layerId)!, ...updates })
      return newState
    })
  }

  const handleOpacityChange = (layerId: string, opacity: number) => {
    updateLayerUI(layerId, { opacity })
  }

  const handleToggleLock = (layerId: string) => {
    const uiState = layerUIState.get(layerId)
    updateLayerUI(layerId, { locked: !uiState?.locked })
  }

  const handleToggleCollapsed = (layerId: string) => {
    const uiState = layerUIState.get(layerId)
    updateLayerUI(layerId, { collapsed: !uiState?.collapsed })
  }

  return (
    <Card className="p-4 bg-card border border-border rounded-lg">
      <h3 className="font-semibold text-foreground mb-3">Administrador de Capas</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {layers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No hay capas disponibles</p>
        ) : (
          layers.map((layer) => {
            const uiState = layerUIState.get(layer.id) || {
              opacity: 1,
              locked: false,
              collapsed: false,
            }
            return (
              <div key={layer.id} className="border border-border rounded-lg overflow-hidden bg-background">
                {/* Layer Header */}
                <div className="p-3 bg-muted hover:bg-accent transition-colors flex items-center gap-2">
                  <button
                    onClick={() => onLayerToggleVisibility(layer.id)}
                    className="flex-shrink-0 text-primary hover:text-primary/80"
                    title={layer.visible ? "Ocultar capa" : "Mostrar capa"}
                  >
                    {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => handleToggleCollapsed(layer.id)}
                    className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    {uiState.collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>

                  {/* Layer Color and Name */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="w-4 h-4 rounded flex-shrink-0 border border-border"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className="text-sm font-medium text-foreground truncate">{layer.name}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">({layer.features.length})</span>
                  </div>

                  <button
                    onClick={() => handleToggleLock(layer.id)}
                    className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                    title={uiState.locked ? "Desbloquear capa" : "Bloquear capa"}
                  >
                    {uiState.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </button>

                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onLayerDuplicate(layer)}
                      className="p-1 h-auto"
                      title="Duplicar capa"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onLayerDelete(layer.id)}
                      className="p-1 h-auto text-destructive hover:text-destructive"
                      title="Eliminar capa"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {!uiState.collapsed && (
                  <div className="p-3 space-y-3 border-t border-border">
                    {/* Opacity Control */}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Opacidad: {Math.round(uiState.opacity * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={uiState.opacity * 100}
                        onChange={(e) => handleOpacityChange(layer.id, Number.parseInt(e.target.value) / 100)}
                        className="w-full"
                        disabled={uiState.locked}
                      />
                    </div>

                    {/* Color Picker */}
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={layer.color}
                          onChange={(e) => onLayerUpdate({ ...layer, color: e.target.value })}
                          className="flex-1 h-8 rounded cursor-pointer"
                          disabled={uiState.locked}
                        />
                      </div>
                    </div>

                    {/* Layer Info */}
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Elementos: {layer.features.length}</div>
                      <div>Tipo: Sistema de capas personalizable</div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}
