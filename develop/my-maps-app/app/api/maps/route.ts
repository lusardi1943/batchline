import { type NextRequest, NextResponse } from "next/server"
import { getAllMaps, saveMap } from "@/lib/db"
import type { MapData } from "@/lib/types"

export async function GET(request: NextRequest) {
  try {
    const maps = await getAllMaps()
    return NextResponse.json(maps)
  } catch (error) {
    console.error("Error fetching maps:", error)
    return NextResponse.json({ error: "Failed to fetch maps" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const mapData: MapData = await request.json()
    await saveMap(mapData)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving map:", error)
    return NextResponse.json({ error: "Failed to save map" }, { status: 500 })
  }
}
