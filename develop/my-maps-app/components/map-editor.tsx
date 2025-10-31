"use client"

import { useState } from "react"
import type { MapData, Layer } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Edit2, Save } from "lucide-react"
import { generateId } from "@/lib/utils"

interface MapEditorProps {
  map?: MapData
  onSave: (map: MapData) => void
  isEditing: boolean
}

export function MapEditor({ map, onSave, isEditing }: MapEditorProps) {
  const [name, setName] = useState(map?.name || "")
  const [description, setDescription] = useState(map?.description || "")
  const [layers, setLayers] = useState<Layer[]>(map?.layers || [])
  const [layerName, setLayerName] = useState("")
  const [layerColor, setLayerColor] = useState("#3b82f6")
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success">("idle")

  const handleAddLayer = () => {
    if (!layerName.trim()) return

    if (editingLayerId) {
      setLayers(layers.map((l) => (l.id === editingLayerId ? { ...l, name: layerName, color: layerColor } : l)))
      setEditingLayerId(null)
    } else {
      const newLayer: Layer = {
        id: generateId(),
        name: layerName,
        color: layerColor,
        visible: true,
        features: [],
      }
      setLayers([...layers, newLayer])
    }

    setLayerName("")
    setLayerColor("#3b82f6")
  }

  const handleEditLayer = (layer: Layer) => {
    setLayerName(layer.name)
    setLayerColor(layer.color)
    setEditingLayerId(layer.id)
  }

  const handleDeleteLayer = (id: string) => {
    setLayers(layers.filter((l) => l.id !== id))
    if (editingLayerId === id) {
      setEditingLayerId(null)
      setLayerName("")
      setLayerColor("#3b82f6")
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Por favor ingresa un nombre para el mapa")
      return
    }

    setSaveStatus("saving")

    const newMap: MapData = {
      id: map?.id || generateId(),
      name,
      description,
      layers,
      createdAt: map?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      await onSave(newMap)
      setSaveStatus("success")
      setTimeout(() => setSaveStatus("idle"), 2000)
    } catch {
      setSaveStatus("idle")
      alert("Error al guardar el mapa")
    }
  }

  return (
    <div className="py-8 px-4 max-w-4xl mx-auto">
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">{isEditing ? "Editar Mapa" : "Crear Nuevo Mapa"}</h2>
          {saveStatus === "success" && <span className="text-sm text-green-600">Guardado exitosamente</span>}
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nombre del Mapa</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Rutas de Senderismo"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descripción</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe tu mapa..."
              className="w-full"
            />
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Capas</h3>

          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nombre de la Capa</label>
                <Input
                  value={layerName}
                  onChange={(e) => setLayerName(e.target.value)}
                  placeholder="Ej: Puntos de Interés"
                  onKeyPress={(e) => e.key === "Enter" && handleAddLayer()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Color</label>
                <input
                  type="color"
                  value={layerColor}
                  onChange={(e) => setLayerColor(e.target.value)}
                  className="w-full h-10 rounded cursor-pointer"
                />
              </div>

              <Button onClick={handleAddLayer} className="w-full flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                {editingLayerId ? "Actualizar Capa" : "Agregar Capa"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {layers.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No hay capas. Crea una nueva.</p>
            ) : (
              layers.map((layer) => (
                <div key={layer.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: layer.color }} />
                  <span className="flex-1 font-medium text-foreground">{layer.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => handleEditLayer(layer)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteLayer(layer.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t">
          <Button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2"
            disabled={saveStatus === "saving"}
          >
            <Save className="w-4 h-4" />
            {saveStatus === "saving" ? "Guardando..." : "Guardar Mapa"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
