import type { MapData, DbMap } from "@/lib/types"

// IndexedDB operations for offline-first functionality
const DB_NAME = "MapsDatabase"
const DB_VERSION = 1
const STORE_NAME = "maps"

let db: IDBDatabase | null = null

export async function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve()
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" })
        store.createIndex("createdAt", "createdAt", { unique: false })
      }
    }
  })
}

export async function saveMap(mapData: MapData): Promise<void> {
  if (!db) await initializeDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)

    const dbMap: DbMap = {
      id: mapData.id,
      name: mapData.name,
      description: mapData.description,
      data: JSON.stringify(mapData),
      createdAt: mapData.createdAt,
      updatedAt: mapData.updatedAt,
    }

    const request = store.put(dbMap)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getAllMaps(): Promise<MapData[]> {
  if (!db) await initializeDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const dbMaps: DbMap[] = request.result
      const maps: MapData[] = dbMaps.map((dbMap) => JSON.parse(dbMap.data))
      resolve(maps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    }
  })
}

export async function deleteMap(id: string): Promise<void> {
  if (!db) await initializeDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}
