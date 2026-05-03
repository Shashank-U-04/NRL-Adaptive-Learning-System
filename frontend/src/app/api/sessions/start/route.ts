import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const API_BASE = process.env.API_BASE || "http://localhost:8000";
    
    console.log(`[PROXY] Forwarding session start to: ${API_BASE}/api/v1/sessions/start`);

    const res = await fetch(`${API_BASE}/api/v1/sessions/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward authorization header if present
        ...(request.headers.get("authorization") ? { "Authorization": request.headers.get("authorization")! } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: "Unknown backend error" }));
      console.error(`[PROXY] Backend error: ${res.status}`, errorData);
      
      return NextResponse.json({
        success: false,
        error: errorData.detail || "Backend failed to start session"
      }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (err) {
    console.error("[PROXY] Internal error:", err);
    return NextResponse.json({
      success: false,
      error: "Internal proxy error"
    }, { status: 500 });
  }
}
