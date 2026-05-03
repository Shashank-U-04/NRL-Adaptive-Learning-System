import { NextResponse } from "next/server";
import { mockModules } from "@/data/learning/mockModules";

export async function GET(
  _request: Request,
  context: { params: Promise<{ topicId: string }> },
) {
  const { topicId } = await context.params;
  try {
    const module = mockModules.find(m => m.id === topicId);
    
    if (!module) {
      return NextResponse.json({ 
        success: false, 
        error: "Module not found" 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { module }
    });
  } catch (error) {
    console.error(`Failed to fetch module ${topicId}:`, error);
    return NextResponse.json({
      success: false,
      error: "Internal Server Error"
    }, { status: 500 });
  }
}
