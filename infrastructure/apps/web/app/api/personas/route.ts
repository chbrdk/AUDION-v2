import { NextResponse } from "next/server";
import { getChatApiBase } from "../_lib/backend";

export async function GET() {
  try {
    const chatApiBase = getChatApiBase();
    const response = await fetch(`${chatApiBase}/personas/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Chat API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Chat API error: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch personas:", error);
    if (error instanceof Error) {
      if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
        return NextResponse.json(
          { error: "Connection refused. Is the chat API running?" },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: `Failed to fetch personas: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Unknown error while fetching personas" },
      { status: 500 }
    );
  }
}
