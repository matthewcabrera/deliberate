// Serverless YouTube audio via the RapidAPI youtube-mp36 endpoint. The convert
// step is async (poll until status "ok"), and the returned CDN link only serves
// the file when fetched with the RapidAPI host as the Referer — so we download
// the bytes server-side and hand them to Deepgram (Deepgram-by-URL can't set
// that header).

const RAPIDAPI_HOST = process.env.RAPIDAPI_YT_HOST || "youtube-mp36.p.rapidapi.com";

export function youtubeVideoId(input: string): string | null {
  const m = input.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(input.trim()) ? input.trim() : null;
}

interface DlResponse {
  status?: string;
  link?: string;
  title?: string;
  msg?: string;
}

export interface YoutubeAudio {
  audio: Uint8Array;
  mime: string;
  title?: string;
}

export async function fetchYoutubeAudio(url: string): Promise<YoutubeAudio> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not set.");
  const id = youtubeVideoId(url);
  if (!id) throw new Error("Could not parse a YouTube video id from that URL.");

  const apiHeaders = { "x-rapidapi-host": RAPIDAPI_HOST, "x-rapidapi-key": key };

  // Poll the convert endpoint until the MP3 is ready.
  let link = "";
  let title: string | undefined;
  let lastStatus = "";
  for (let attempt = 0; attempt < 15; attempt++) {
    const res = await fetch(`https://${RAPIDAPI_HOST}/dl?id=${id}`, { headers: apiHeaders });
    if (!res.ok) throw new Error(`RapidAPI error ${res.status} fetching YouTube audio.`);
    const data = (await res.json()) as DlResponse;
    lastStatus = data.status || "";
    if (data.title) title = data.title;
    if (data.status === "ok" && data.link) {
      link = data.link;
      break;
    }
    if (data.status === "fail") {
      throw new Error(`YouTube conversion failed: ${data.msg || "unknown error"}.`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (!link) throw new Error(`YouTube audio wasn't ready in time (last status: ${lastStatus || "none"}).`);

  // The CDN only serves the file with the RapidAPI host as Referer.
  const audioRes = await fetch(link, {
    headers: { Referer: `https://${RAPIDAPI_HOST}/`, "User-Agent": "Mozilla/5.0" },
  });
  if (!audioRes.ok) throw new Error(`Could not download the converted audio (${audioRes.status}).`);

  return { audio: new Uint8Array(await audioRes.arrayBuffer()), mime: "audio/mpeg", title };
}
