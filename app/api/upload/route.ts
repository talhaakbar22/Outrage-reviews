import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Upload handling not implemented yet" },
    { status: 501 },
  );
}
