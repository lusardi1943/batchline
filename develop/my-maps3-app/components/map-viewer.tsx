"use client"

import { useEffect, useRef, useState } from "react"
import type { ParsedKML, KMLPlacemark } from "@/lib/kml-parser"
import { Loader2 } from "lucide-react"

// Leaflet types (will be loaded dynamically)
type LeafletMap = any
type LeafletMarker = any
type LeafletPolyline = any
type LeafletPolygon = any

interface MapViewerProps {
  parsedKML: ParsedKML
}

export function MapViewer({ parsedKML }: MapViewerProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<LeafletMap | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function initMap() {
      try {
        // Dynamically import Leaflet to avoid SSR issues
        const L = (await import("leaflet")).default

        // Import Leaflet CSS
        await import("leaflet/dist/leaflet.css")

        if (!mounted || !mapContainer.current) return

        // Create map
        const map = L.map(mapContainer.current, {
          zoomControl: true,
          attributionControl: true,
        })

        mapInstance.current = map

        // Add OpenStreetMap tiles
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map)

        // Add placemarks to map
        const bounds: [number, number][] = []

        parsedKML.placemarks.forEach((placemark) => {
          addPlacemarkToMap(L, map, placemark, bounds)
        })

        // Fit map to bounds
        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [50, 50] })
        } else if (parsedKML.bounds) {
          const { north, south, east, west } = parsedKML.bounds
          map.fitBounds([
            [south, west],
            [north, east],
          ])
        } else {
          // Default view (world)
          map.setView([0, 0], 2)
        }

        setIsLoading(false)
      } catch (err) {
        console.error("[v0] Error initializing map:", err)
        setError("Failed to load map")
        setIsLoading(false)
      }
    }

    initMap()

    return () => {
      mounted = false
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [parsedKML])

  function addPlacemarkToMap(L: any, map: LeafletMap, placemark: KMLPlacemark, bounds: [number, number][]) {
    const popupContent = `
      <div class="p-2">
        <h3 class="font-semibold text-sm mb-1">${placemark.name}</h3>
        ${placemark.description ? `<p class="text-xs text-gray-600">${placemark.description}</p>` : ""}
      </div>
    `

    if (placemark.type === "Point" && placemark.coordinates.length > 0) {
      const [lng, lat] = placemark.coordinates[0]
      const marker = L.marker([lat, lng], {
        icon: L.icon({
          iconUrl: placemark.style?.iconUrl || "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
          shadowSize: [41, 41],
        }),
      }).addTo(map)

      marker.bindPopup(popupContent)
      bounds.push([lat, lng])
    } else if (placemark.type === "LineString") {
      const latLngs = placemark.coordinates.map(([lng, lat]) => {
        bounds.push([lat, lng])
        return [lat, lng] as [number, number]
      })

      const polyline = L.polyline(latLngs, {
        color: placemark.style?.color || "#3b82f6",
        weight: 3,
        opacity: 0.8,
      }).addTo(map)

      polyline.bindPopup(popupContent)
    } else if (placemark.type === "Polygon") {
      const latLngs = placemark.coordinates.map(([lng, lat]) => {
        bounds.push([lat, lng])
        return [lat, lng] as [number, number]
      })

      const polygon = L.polygon(latLngs, {
        color: placemark.style?.color || "#3b82f6",
        fillColor: placemark.style?.fillColor || "#3b82f6",
        fillOpacity: 0.3,
        weight: 2,
      }).addTo(map)

      polygon.bindPopup(popupContent)
    }
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-muted">
        <div className="text-center">
          <p className="text-destructive font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Cargando mapa...</p>
          </div>
        </div>
      )}
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  )
}
