"use client"

import { useEffect, useRef } from "react"
import type { Layer, Feature } from "@/lib/types"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-draw/dist/leaflet.draw.css"
import "@geoman-io/leaflet-geoman-free"
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css"

interface InteractiveMapProps {
  layers: Layer[]
  visibleLayers: Set<string>
  onFeaturesChange?: (layerId: string, features: Feature[]) => void
}

export function InteractiveMap({ layers, visibleLayers, onFeaturesChange }: InteractiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layerGroups = useRef<Map<string, L.FeatureGroup>>(new Map())

  useEffect(() => {
    if (!mapContainer.current) return

    // Initialize map
    if (!map.current) {
      map.current = L.map(mapContainer.current).setView([51.505, -0.09], 13)

      // Add tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map.current)

      // Initialize layer groups for each layer
      layers.forEach((layer) => {
        const featureGroup = L.featureGroup()
        map.current!.addLayer(featureGroup)
        layerGroups.current.set(layer.id, featureGroup)

        // Render existing features
        layer.features.forEach((feature) => {
          addFeatureToMap(featureGroup, feature, layer.color)
        })
      })

      // Add Leaflet-Geoman controls
      map.current.pm.addControls({
        position: "topleft",
        drawText: true,
        editMode: true,
        drawPolyline: true,
        drawRectangle: true,
        drawPolygon: true,
        drawCircle: true,
        drawMarker: true,
        drawCircleMarker: true,
        cutPolygon: false,
        rotateMode: false,
        oneBlock: false,
        toolbar: {
          oneBlock: false,
          drawMarker: true,
          drawPolyline: true,
          drawPolygon: true,
          drawRectangle: true,
          drawCircle: true,
          drawText: true,
          editMode: true,
          dragMode: true,
          cutPolygon: false,
          removalMode: true,
        },
      })

      // Handle feature creation
      map.current.on("pm:create", (e: any) => {
        const feature = e.layer
        const visibleLayerId = Array.from(visibleLayers).find((id) =>
          layerGroups.current.get(id)?.hasLayer(feature as any),
        )

        if (visibleLayerId) {
          onFeaturesChange?.(visibleLayerId, [])
        }
      })
    }

    // Update layer visibility
    layers.forEach((layer) => {
      const featureGroup = layerGroups.current.get(layer.id)
      if (featureGroup) {
        if (visibleLayers.has(layer.id)) {
          map.current!.addLayer(featureGroup)
        } else {
          map.current!.removeLayer(featureGroup)
        }
      }
    })

    return () => {
      // Cleanup handled on component unmount
    }
  }, [layers, visibleLayers, onFeaturesChange])

  const addFeatureToMap = (group: L.FeatureGroup, feature: Feature, color: string) => {
    let layer: L.Layer | null = null

    if (feature.type === "point") {
      layer = L.circleMarker([feature.coordinates[0][0], feature.coordinates[0][1]], {
        radius: 6,
        color: color,
        weight: 2,
        opacity: 0.8,
        fillColor: color,
        fillOpacity: 0.6,
      })
    } else if (feature.type === "polygon") {
      const coords = feature.coordinates.map((c) => [c[0], c[1]] as [number, number])
      layer = L.polygon(coords, { color, weight: 2, fillColor: color, fillOpacity: 0.6 })
    } else if (feature.type === "line") {
      const coords = feature.coordinates.map((c) => [c[0], c[1]] as [number, number])
      layer = L.polyline(coords, { color, weight: 2 })
    }

    if (layer) {
      group.addLayer(layer)
    }
  }

  return (
    <div ref={mapContainer} className="w-full h-full rounded-lg border border-border" style={{ minHeight: "600px" }} />
  )
}
