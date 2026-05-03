import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export async function GET(
  _request: Request,
  context: { params: Promise<{ topicId: string }> },
) {
  const { topicId } = await context.params;
  try {
    const res = await fetch(`${API_BASE}/learning/modules/${topicId}`);
    if (!res.ok) {
        return NextResponse.json({ error: "Module not found" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json({ module: data });
  } catch (error) {
    console.error(`Failed to fetch module ${topicId}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
