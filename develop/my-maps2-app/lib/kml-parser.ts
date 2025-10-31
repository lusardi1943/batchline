// KML/KMZ Parser for extracting geographic data

export interface KMLPlacemark {
  id: string
  name: string
  description?: string
  coordinates: [number, number][] // [lng, lat] pairs
  type: "Point" | "LineString" | "Polygon"
  style?: {
    color?: string
    fillColor?: string
    iconUrl?: string
  }
}

export interface ParsedKML {
  name: string
  description?: string
  placemarks: KMLPlacemark[]
  bounds?: {
    north: number
    south: number
    east: number
    west: number
  }
}

export async function parseKML(kmlContent: string): Promise<ParsedKML> {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(kmlContent, "text/xml")

  // Check for parsing errors
  const parserError = xmlDoc.querySelector("parsererror")
  if (parserError) {
    throw new Error("Invalid KML format")
  }

  // Extract document name and description
  const docName = xmlDoc.querySelector("Document > name")?.textContent || "Untitled Map"
  const docDescription = xmlDoc.querySelector("Document > description")?.textContent

  // Parse styles
  const styles = parseStyles(xmlDoc)

  // Parse placemarks
  const placemarkElements = xmlDoc.querySelectorAll("Placemark")
  const placemarks: KMLPlacemark[] = []

  placemarkElements.forEach((placemark, index) => {
    const parsed = parsePlacemark(placemark, index, styles)
    if (parsed) {
      placemarks.push(parsed)
    }
  })

  // Calculate bounds
  const bounds = calculateBounds(placemarks)

  return {
    name: docName,
    description: docDescription,
    placemarks,
    bounds,
  }
}

function parseStyles(xmlDoc: Document): Map<string, any> {
  const styles = new Map()
  const styleElements = xmlDoc.querySelectorAll("Style")

  styleElements.forEach((style) => {
    const id = style.getAttribute("id")
    if (!id) return

    const iconStyle = style.querySelector("IconStyle")
    const lineStyle = style.querySelector("LineStyle")
    const polyStyle = style.querySelector("PolyStyle")

    const styleData: any = {}

    if (iconStyle) {
      const iconHref = iconStyle.querySelector("Icon href")?.textContent
      if (iconHref) styleData.iconUrl = iconHref
    }

    if (lineStyle) {
      const color = lineStyle.querySelector("color")?.textContent
      if (color) styleData.color = kmlColorToHex(color)
    }

    if (polyStyle) {
      const color = polyStyle.querySelector("color")?.textContent
      if (color) styleData.fillColor = kmlColorToHex(color)
    }

    styles.set(id, styleData)
  })

  return styles
}

function parsePlacemark(placemark: Element, index: number, styles: Map<string, any>): KMLPlacemark | null {
  const name = placemark.querySelector("name")?.textContent || `Placemark ${index + 1}`
  const description = placemark.querySelector("description")?.textContent

  // Get style reference
  const styleUrl = placemark.querySelector("styleUrl")?.textContent?.replace("#", "")
  const style = styleUrl ? styles.get(styleUrl) : undefined

  // Parse Point
  const point = placemark.querySelector("Point coordinates")
  if (point) {
    const coords = parseCoordinates(point.textContent || "")
    if (coords.length > 0) {
      return {
        id: `placemark-${index}`,
        name,
        description,
        coordinates: coords,
        type: "Point",
        style,
      }
    }
  }

  // Parse LineString
  const lineString = placemark.querySelector("LineString coordinates")
  if (lineString) {
    const coords = parseCoordinates(lineString.textContent || "")
    if (coords.length > 1) {
      return {
        id: `placemark-${index}`,
        name,
        description,
        coordinates: coords,
        type: "LineString",
        style,
      }
    }
  }

  // Parse Polygon
  const polygon = placemark.querySelector("Polygon outerBoundaryIs LinearRing coordinates")
  if (polygon) {
    const coords = parseCoordinates(polygon.textContent || "")
    if (coords.length > 2) {
      return {
        id: `placemark-${index}`,
        name,
        description,
        coordinates: coords,
        type: "Polygon",
        style,
      }
    }
  }

  return null
}

function parseCoordinates(coordString: string): [number, number][] {
  const coords: [number, number][] = []
  const lines = coordString.trim().split(/\s+/)

  for (const line of lines) {
    const parts = line.split(",")
    if (parts.length >= 2) {
      const lng = Number.parseFloat(parts[0])
      const lat = Number.parseFloat(parts[1])
      if (!isNaN(lng) && !isNaN(lat)) {
        coords.push([lng, lat])
      }
    }
  }

  return coords
}

function kmlColorToHex(kmlColor: string): string {
  // KML color format: aabbggrr (alpha, blue, green, red)
  if (kmlColor.length === 8) {
    const a = kmlColor.substring(0, 2)
    const b = kmlColor.substring(2, 4)
    const g = kmlColor.substring(4, 6)
    const r = kmlColor.substring(6, 8)
    return `#${r}${g}${b}`
  }
  return "#3b82f6" // Default blue
}

function calculateBounds(placemarks: KMLPlacemark[]) {
  if (placemarks.length === 0) return undefined

  let north = -90
  let south = 90
  let east = -180
  let west = 180

  placemarks.forEach((placemark) => {
    placemark.coordinates.forEach(([lng, lat]) => {
      north = Math.max(north, lat)
      south = Math.min(south, lat)
      east = Math.max(east, lng)
      west = Math.min(west, lng)
    })
  })

  return { north, south, east, west }
}

export async function parseKMZ(file: File): Promise<string> {
  // KMZ is a zipped KML file - we need to extract it
  const JSZip = (await import("jszip")).default
  const zip = new JSZip()
  const contents = await zip.loadAsync(file)

  // Find the main KML file (usually doc.kml)
  const kmlFiles = contents.file(/\.kml$/i)
  if (kmlFiles.length === 0) {
    throw new Error("No KML file found in KMZ archive")
  }

  const kmlText = await kmlFiles[0].async("text")
  return kmlText
}

export async function parseKMLFile(file: File): Promise<ParsedKML> {
  const isKMZ = file.name.toLowerCase().endsWith(".kmz")

  if (isKMZ) {
    const kmlText = await parseKMZ(file)
    return parseKML(kmlText)
  } else {
    const text = await file.text()
    return parseKML(text)
  }
}
