// KML/KMZ file parser to convert to GeoJSON
import type { GeoJSON } from "geojson"
import JSZip from "jszip"

export async function parseKMLFile(file: File): Promise<GeoJSON.FeatureCollection> {
  let kmlString: string

  // Handle KMZ (zipped KML) files
  if (file.name.endsWith(".kmz")) {
    kmlString = await extractKMLFromKMZ(file)
  } else {
    kmlString = await file.text()
  }

  return parseKMLToGeoJSON(kmlString)
}

async function extractKMLFromKMZ(file: File): Promise<string> {
  try {
    const zip = new JSZip()
    const contents = await zip.loadAsync(file)

    // Find the first .kml file in the archive
    let kmlContent: string | null = null

    for (const filename of Object.keys(contents.files)) {
      if (filename.endsWith(".kml") && !contents.files[filename].dir) {
        const fileData = await contents.files[filename].async("text")
        kmlContent = fileData
        break
      }
    }

    if (!kmlContent) {
      throw new Error("No KML file found in KMZ archive")
    }

    return kmlContent
  } catch (error) {
    console.error("Error extracting KMZ:", error)
    throw new Error(
      "Failed to extract KML from KMZ file: " + (error instanceof Error ? error.message : "Unknown error"),
    )
  }
}

function parseKMLToGeoJSON(kmlString: string): GeoJSON.FeatureCollection {
  const parser = new DOMParser()
  const kmlDoc = parser.parseFromString(kmlString, "text/xml")

  if (kmlDoc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Invalid KML file")
  }

  const features: GeoJSON.Feature[] = []

  // Parse Placemarks
  const placemarks = kmlDoc.getElementsByTagName("Placemark")
  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i]
    const feature = parseKMLPlacemark(placemark)
    if (feature) {
      features.push(feature)
    }
  }

  return {
    type: "FeatureCollection",
    features,
  }
}

function parseKMLPlacemark(placemark: Element): GeoJSON.Feature | null {
  const name = placemark.getElementsByTagName("name")[0]?.textContent || "Unnamed"
  const description = placemark.getElementsByTagName("description")[0]?.textContent || ""

  // Parse geometry
  let geometry: GeoJSON.Geometry | null = null

  // Try Point
  const point = placemark.getElementsByTagName("Point")[0]
  if (point) {
    geometry = parseKMLPoint(point)
  }

  // Try LineString
  const lineString = placemark.getElementsByTagName("LineString")[0]
  if (lineString && !geometry) {
    geometry = parseKMLLineString(lineString)
  }

  // Try Polygon
  const polygon = placemark.getElementsByTagName("Polygon")[0]
  if (polygon && !geometry) {
    geometry = parseKMLPolygon(polygon)
  }

  // Try MultiGeometry
  const multiGeometry = placemark.getElementsByTagName("MultiGeometry")[0]
  if (multiGeometry && !geometry) {
    geometry = parseKMLMultiGeometry(multiGeometry)
  }

  if (!geometry) {
    return null
  }

  return {
    type: "Feature",
    geometry,
    properties: {
      name,
      description,
    },
  }
}

function parseKMLPoint(point: Element): GeoJSON.Point | null {
  const coordinates = point.getElementsByTagName("coordinates")[0]?.textContent
  if (!coordinates) return null

  const [lng, lat] = coordinates.trim().split(",").map(Number)
  return {
    type: "Point",
    coordinates: [lng, lat],
  }
}

function parseKMLLineString(lineString: Element): GeoJSON.LineString | null {
  const coordinates = lineString.getElementsByTagName("coordinates")[0]?.textContent
  if (!coordinates) return null

  const coords = coordinates
    .trim()
    .split("\n")
    .filter((c) => c.trim())
    .map((c) => {
      const [lng, lat] = c.trim().split(",").map(Number)
      return [lng, lat]
    })

  return {
    type: "LineString",
    coordinates: coords,
  }
}

function parseKMLPolygon(polygon: Element): GeoJSON.Polygon | null {
  const outerRing = polygon.getElementsByTagName("outerBoundaryIs")[0]
  if (!outerRing) return null

  const linearRing = outerRing.getElementsByTagName("LinearRing")[0]
  if (!linearRing) return null

  const coordinates = linearRing.getElementsByTagName("coordinates")[0]?.textContent
  if (!coordinates) return null

  const coords = coordinates
    .trim()
    .split("\n")
    .filter((c) => c.trim())
    .map((c) => {
      const [lng, lat] = c.trim().split(",").map(Number)
      return [lng, lat]
    })

  // Ensure polygon is closed
  if (coords.length > 0 && coords[0] !== coords[coords.length - 1]) {
    coords.push(coords[0])
  }

  return {
    type: "Polygon",
    coordinates: [coords],
  }
}

function parseKMLMultiGeometry(multiGeometry: Element): GeoJSON.Geometry | null {
  const geometries: GeoJSON.Geometry[] = []

  // Check for multiple geometries
  const points = multiGeometry.getElementsByTagName("Point")
  for (let i = 0; i < points.length; i++) {
    const geom = parseKMLPoint(points[i])
    if (geom) geometries.push(geom)
  }

  const lineStrings = multiGeometry.getElementsByTagName("LineString")
  for (let i = 0; i < lineStrings.length; i++) {
    const geom = parseKMLLineString(lineStrings[i])
    if (geom) geometries.push(geom)
  }

  const polygons = multiGeometry.getElementsByTagName("Polygon")
  for (let i = 0; i < polygons.length; i++) {
    const geom = parseKMLPolygon(polygons[i])
    if (geom) geometries.push(geom)
  }

  if (geometries.length === 0) return null
  if (geometries.length === 1) return geometries[0]

  return {
    type: "GeometryCollection",
    geometries,
  }
}
