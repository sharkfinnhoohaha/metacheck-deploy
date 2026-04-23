import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        query
      )}&entity=song&limit=10`
    );
    const data = await response.json();

    const results = data.results.map((item: any) => ({
      id: item.trackId?.toString() || Math.random().toString(36).substring(7),
      title: item.trackName || "Unknown Title",
      artist: item.artistName || "Unknown Artist",
      album: item.collectionName || "Unknown Album",
      artwork: item.artworkUrl100?.replace("100x100", "400x400") || "",
      genre: item.primaryGenreName || "",
      releaseDate: item.releaseDate || new Date().toISOString(),
      duration: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000).toString() : "0",
      isrc: item.isrc || "", // Still empty for iTunes mostly, but ready
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search API Error Details:", error);
    return NextResponse.json({ 
      error: "Failed to fetch music data", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
