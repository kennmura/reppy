import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

const requiredFields = ["full_name", "email", "sport", "location", "background"] as const;

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    for (const field of requiredFields) {
      if (!payload[field] || typeof payload[field] !== "string" || !payload[field].trim()) {
        return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
      }
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("coach_applications").insert({
      full_name: String(payload.full_name).trim(),
      email: String(payload.email).trim(),
      phone: payload.phone ? String(payload.phone).trim() : null,
      sport: String(payload.sport).trim(),
      location: String(payload.location).trim(),
      coaching_focus: payload.coaching_focus ? String(payload.coaching_focus).trim() : null,
      background: String(payload.background).trim(),
      message: payload.message ? String(payload.message).trim() : null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
