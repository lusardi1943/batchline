import { MapList } from "@/components/map-list"
import { ImportButton } from "@/components/import-button"
import { MapPin } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <MapPin className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Map Viewer</h1>
                <p className="text-sm text-muted-foreground">Visualizador offline de mapas KML/KMZ</p>
              </div>
            </div>
            <ImportButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Mis Mapas</h2>
          <p className="text-muted-foreground">Todos tus mapas importados se guardan localmente en tu dispositivo</p>
        </div>
        <MapList />
      </main>
    </div>
  )
}
