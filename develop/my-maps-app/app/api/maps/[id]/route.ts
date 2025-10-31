import { type NextRequest, NextResponse } from "next/server"
import { deleteMap } from "@/lib/db"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteMap(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting map:", error)
    return NextResponse.json({ error: "Failed to delete map" }, { status: 500 })
  }
}
