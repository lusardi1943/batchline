export interface Layer {
  id: string
  name: string
  color: string
  visible: boolean
  features: Feature[]
}

export interface Feature {
  id: string
  type: "point" | "polygon" | "line"
  coordinates: [number, number][]
  properties?: Record<string, any>
}

export interface MapData {
  id: string
  name: string
  description: string
  layers: Layer[]
  createdAt: string
  updatedAt: string
}

export interface DbMap {
  id: string
  name: string
  description: string
  data: string // JSON stringified MapData
  createdAt: string
  updatedAt: string
}
