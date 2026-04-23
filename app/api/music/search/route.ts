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
      id: item.trackId.toString(),
      title: item.trackName,
      artist: item.artistName,
      album: item.collectionName,
      artwork: item.artworkUrl100,
      genre: item.primaryGenreName,
      releaseDate: item.releaseDate,
      duration: Math.round(item.trackTimeMillis / 1000).toString(),
      // iTunes doesn't give ISRC in search results easily, but we can provide other metadata
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }
}
