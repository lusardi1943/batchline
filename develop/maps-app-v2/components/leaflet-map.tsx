"use client"

import { useEffect, useRef, useState } from "react"
import { ZoomIn, ZoomOut, MapPin } from "lucide-react"

interface LeafletMapProps {
  map: any
}

declare global {
  interface Window {
    L: any
  }
}

export default function LeafletMap({ map }: LeafletMapProps) {
  const mapRef = useRef<any>(null)
  const leafletMap = useRef<any>(null)
  const layersRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadLeaflet = async () => {
      if (window.L) {
        setIsLoading(false)
        return
      }

      const cssLink = document.createElement("link")
      cssLink.rel = "stylesheet"
      cssLink.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      document.head.appendChild(cssLink)

      return new Promise<void>((resolve) => {
        const script = document.createElement("script")
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"
        script.onload = () => {
          console.log("[v0] Leaflet loaded successfully")
          setIsLoading(false)
          resolve()
        }
        document.head.appendChild(script)
      })
    }

    loadLeaflet()
  }, [])

  useEffect(() => {
    if (isLoading || !mapRef.current || !map || !window.L) {
      console.log("[v0] Waiting for map render - isLoading:", isLoading, "map:", !!map, "L:", !!window.L)
      return
    }

    const L = window.L
    console.log("[v0] Rendering map:", map.name, "with features:", map.geojson?.features?.length || 0)

    if (!leafletMap.current) {
      console.log("[v0] Creating new Leaflet map instance")
      leafletMap.current = L.map(mapRef.current).setView([20, 0], 2)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(leafletMap.current)
    }

    if (layersRef.current) {
      console.log("[v0] Removing previous layer")
      leafletMap.current.removeLayer(layersRef.current)
    }

    if (map.geojson && map.geojson.features && map.geojson.features.length > 0) {
      console.log("[v0] Adding GeoJSON layer with", map.geojson.features.length, "features")

      const geoJsonLayer = L.geoJSON(map.geojson, {
        style: {
          color: "#3b82f6",
          weight: 3,
          opacity: 0.8,
          fillOpacity: 0.2,
        },
        pointToLayer: (feature: any, latlng: any) => {
          return L.circleMarker(latlng, {
            radius: 8,
            fillColor: "#3b82f6",
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
          })
        },
        onEachFeature: (feature: any, layer: any) => {
          const props = feature.properties
          if (props) {
            let popupContent = '<div style="font-size: 12px; max-width: 200px;">'
            Object.entries(props).forEach(([key, value]) => {
              if (value) {
                popupContent += `<strong>${key}:</strong> ${value}<br/>`
              }
            })
            popupContent += "</div>"
            layer.bindPopup(popupContent)
          }
        },
      }).addTo(leafletMap.current)

      layersRef.current = geoJsonLayer

      const bounds = geoJsonLayer.getBounds()
      if (bounds.isValid()) {
        console.log("[v0] Fitting bounds")
        leafletMap.current.fitBounds(bounds, { padding: [50, 50] })
      }
    } else {
      console.log("[v0] No GeoJSON features found in map")
    }

    return () => {
      // Cleanup
    }
  }, [map, isLoading])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (leafletMap.current) {
        console.log("[v0] Invalidating map size")
        leafletMap.current.invalidateSize()
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [isLoading])

  const handleZoomIn = () => {
    leafletMap.current?.zoomIn()
  }

  const handleZoomOut = () => {
    leafletMap.current?.zoomOut()
  }

  const handleZoomToFit = () => {
    if (layersRef.current) {
      const bounds = layersRef.current.getBounds()
      if (bounds.isValid()) {
        leafletMap.current?.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }

  return (
    <div className="w-full h-full relative bg-muted flex flex-col">
      <div ref={mapRef} className="flex-1 w-full" />

      {/* Zoom Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-card border border-border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors shadow-lg"
          title="Zoom in"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-card border border-border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors shadow-lg"
          title="Zoom out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={handleZoomToFit}
          className="p-2 bg-card border border-border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors shadow-lg"
          title="Fit to bounds"
        >
          <MapPin className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
