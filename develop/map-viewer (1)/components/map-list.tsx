"use client"

import { useEffect, useState } from "react"
import { type MapData, mapDB } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, Trash2, Eye, Calendar } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function MapList() {
  const [maps, setMaps] = useState<MapData[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadMaps()
  }, [])

  async function loadMaps() {
    try {
      const allMaps = await mapDB.getAllMaps()
      // Sort by most recent first
      allMaps.sort((a, b) => b.createdAt - a.createdAt)
      setMaps(allMaps)
    } catch (error) {
      console.error("[v0] Error loading maps:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await mapDB.deleteMap(id)
      setMaps(maps.filter((m) => m.id !== id))
      setDeleteId(null)
    } catch (error) {
      console.error("[v0] Error deleting map:", error)
    }
  }

  function handleView(id: string) {
    router.push(`/map/${id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Cargando mapas...</p>
        </div>
      </div>
    )
  }

  if (maps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MapPin className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">No hay mapas guardados</h3>
        <p className="text-muted-foreground max-w-md">
          Importa tu primer mapa KML o KMZ desde Google My Maps para comenzar
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {maps.map((map) => (
          <Card key={map.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg line-clamp-1">{map.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(map.createdAt).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </CardDescription>
                </div>
                <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              {map.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{map.description}</p>}
              <div className="flex gap-2">
                <Button onClick={() => handleView(map.id)} className="flex-1" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Mapa
                </Button>
                <Button onClick={() => setDeleteId(map.id)} variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar mapa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El mapa será eliminado permanentemente de tu dispositivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
