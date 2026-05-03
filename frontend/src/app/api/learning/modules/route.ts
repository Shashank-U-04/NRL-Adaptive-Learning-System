import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/learning/modules`);
    const data = await res.json();
    return NextResponse.json({ modules: data.data || data });
  } catch (error) {
    console.error("Failed to fetch modules:", error);
    return NextResponse.json({ modules: [] }, { status: 500 });
  }
}
