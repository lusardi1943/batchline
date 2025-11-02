// IndexedDB management for storing KML/KMZ maps locally

const DB_NAME = "MapsApp"
const STORE_NAME = "maps"
const DB_VERSION = 1

let db: IDBDatabase | null = null

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
  })
}

export async function saveMap(mapData: any): Promise<string> {
  if (!db) await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(mapData)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as string)
  })
}

export async function getStoredMaps(): Promise<any[]> {
  if (!db) await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

export async function getMap(id: string): Promise<any> {
  if (!db) await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

export async function deleteMap(id: string): Promise<void> {
  if (!db) await initDB()

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}
