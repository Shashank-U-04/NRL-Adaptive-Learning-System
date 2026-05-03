import { NextResponse } from "next/server";
import { mockModules } from "@/data/learning/mockModules";

export async function GET() {
  try {
    // In a real app, this would fetch from a database or backend API
    const summaries = mockModules.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      difficulty: m.difficulty,
      progress: m.progress || 0
    }));

    return NextResponse.json({
      success: true,
      data: { modules: summaries }
    });
  } catch (error) {
    console.error("Failed to fetch modules:", error);
    return NextResponse.json({
      success: false,
      data: { modules: [] },
      error: "Failed to fetch modules"
    }, { status: 500 });
  }
}
