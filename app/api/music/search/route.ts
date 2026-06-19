import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";

type ITunesItem = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  isrc?: string;
};

export async function GET(req: Request) {
  // Public route — rate limit by IP so it can't be used to hammer iTunes.
  const { success } = await rateLimit("music-search", `ip:${clientIp(req)}`, {
    requests: 30,
    windowSec: 60,
  });
  if (success === false) {
    return NextResponse.json(
      { results: [], error: "Too many searches — try again in a moment." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") ?? "").slice(0, 200).trim();

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) {
      return NextResponse.json({ results: [], error: "Search is unavailable right now." }, { status: 502 });
    }
    const data = (await response.json()) as { results?: ITunesItem[] };

    const results = (data.results ?? []).map((item, i) => ({
      id: item.trackId?.toString() || `result-${i}`,
      title: item.trackName || "Unknown Title",
      artist: item.artistName || "Unknown Artist",
      album: item.collectionName || "Unknown Album",
      artwork: item.artworkUrl100?.replace("100x100", "400x400") || "",
      genre: item.primaryGenreName || "",
      releaseDate: item.releaseDate || "",
      duration: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000).toString() : "0",
      isrc: item.isrc || "",
    }));

    return NextResponse.json({ results });
  } catch (error) {
    // Log details server-side; don't leak internals to the client.
    console.error("Music search error:", error);
    return NextResponse.json({ results: [], error: "Failed to fetch music data." }, { status: 502 });
  }
}
