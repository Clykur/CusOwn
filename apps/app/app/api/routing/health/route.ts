import { NextRequest, NextResponse } from "next/server";
import { getRoutingHealth } from "@cusown/shared/server";

export async function GET(_req: NextRequest) {
  const health = getRoutingHealth();
  return NextResponse.json({ status: "ok", routing: health });
}
