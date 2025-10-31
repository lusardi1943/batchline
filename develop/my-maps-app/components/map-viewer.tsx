"use client"

import type { MapData, Layer, Feature } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { useState } from "react"
import { LayerManager } from "./layer-manager"
import { ExportImportDialog } from "./export-import-dialog"
import { generateId } from "@/lib/utils"

interface MapViewerProps {
  map: MapData
}

export function MapViewer({ map }: MapViewerProps) {
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set(map.layers.map((l) => l.id)))
  const [layersData, setLayersData] = useState<Layer[]>(map.layers)
  const [currentMap, setCurrentMap] = useState<MapData>(map)

  const toggleLayerVisibility = (layerId: string) => {
    const newVisible = new Set(visibleLayers)
    if (newVisible.has(layerId)) {
      newVisible.delete(layerId)
    } else {
      newVisible.add(layerId)
    }
    setVisibleLayers(newVisible)
  }

  const handleLayerUpdate = (updatedLayer: Layer) => {
    setLayersData(layersData.map((layer) => (layer.id === updatedLayer.id ? updatedLayer : layer)))
  }

  const handleLayerDelete = (layerId: string) => {
    setLayersData(layersData.filter((layer) => layer.id !== layerId))
    const newVisible = new Set(visibleLayers)
    newVisible.delete(layerId)
    setVisibleLayers(newVisible)
  }

  const handleLayerDuplicate = (layer: Layer) => {
    const newLayer: Layer = {
      ...layer,
      id: generateId(),
      name: `${layer.name} (copia)`,
      features: [...layer.features],
    }
    setLayersData([...layersData, newLayer])
    setVisibleLayers(new Set([...visibleLayers, newLayer.id]))
  }

  const handleFeaturesChange = (layerId: string, features: Feature[]) => {
    setLayersData(layersData.map((layer) => (layer.id === layerId ? { ...layer, features } : layer)))
  }

  const handleImportMap = (importedMap: MapData) => {
    setCurrentMap(importedMap)
    setLayersData(importedMap.layers)
    setVisibleLayers(new Set(importedMap.layers.map((l) => l.id)))
  }

  return (
    <div className="py-8 px-4 max-w-7xl mx-auto">
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">{currentMap.name}</h2>
          {currentMap.description && <p className="text-muted-foreground mt-2">{currentMap.description}</p>}
          <p className="text-xs text-muted-foreground mt-2">
            Creado: {new Date(currentMap.createdAt).toLocaleDateString()}
            {currentMap.updatedAt !== currentMap.createdAt && (
              <> | Actualizado: {new Date(currentMap.updatedAt).toLocaleDateString()}</>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-muted border border-border rounded-lg p-4 h-96 flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">Área del mapa interactivo</p>
                <p className="text-2xl font-bold text-primary">{visibleLayers.size} capas visibles</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <LayerManager
              layers={layersData}
              onLayerUpdate={handleLayerUpdate}
              onLayerDelete={handleLayerDelete}
              onLayerToggleVisibility={toggleLayerVisibility}
              onLayerDuplicate={handleLayerDuplicate}
            />
            <ExportImportDialog map={currentMap} onImport={handleImportMap} />
          </div>
        </div>
      </Card>
    </div>
  )
}
