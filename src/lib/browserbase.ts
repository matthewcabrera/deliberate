import Browserbase from "@browserbasehq/sdk";
import { chromium } from "playwright-core";
import { PDFParse } from "pdf-parse";
import type { NormalizedTranscript } from "@/lib/contracts";

export interface CapturedPage {
  url: string;
  title: string;
  text: string;
  screenshot: Buffer; // PNG
  sessionId: string;
  replayUrl: string;
  sources?: { url: string; title: string }[];
}

function bbCredentials() {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    throw new Error("BROWSERBASE_API_KEY / BROWSERBASE_PROJECT_ID are not set (add them to .env.local).");
  }
  return { apiKey, projectId };
}

async function openSession() {
  const { apiKey, projectId } = bbCredentials();
  const useProxies = process.env.BROWSERBASE_PROXIES === "1";
  const bb = new Browserbase({ apiKey });
  const session = await bb.sessions.create({
    projectId,
    ...(useProxies ? { proxies: true } : {}),
    browserSettings: { viewport: { width: 1280, height: 800 }, blockAds: true },
  });
  const browser = await chromium.connectOverCDP(session.connectUrl);
  return { session, browser };
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// old.reddit.com is far more accessible to automated browsers than the new UI.
function normalizeUrl(url: string): string {
  return url.replace(/^(https?:\/\/)(www\.)?reddit\.com/i, "$1old.reddit.com");
}

const pdfTitle = (url: string) => decodeURIComponent((url.split("/").pop() || "PDF source").split("?")[0]);

// Open the URL in a recorded Browserbase session and capture the page text + a
// screenshot. PDFs are read from their bytes (they download / don't render as
// HTML text). Bot-blocked sites (Reddit) need residential proxies — a paid
// feature, opt-in via BROWSERBASE_PROXIES=1.
export async function captureUrl(rawUrl: string): Promise<CapturedPage> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    throw new Error("BROWSERBASE_API_KEY / BROWSERBASE_PROJECT_ID are not set (add them to .env.local).");
  }

  const url = normalizeUrl(rawUrl);
  const useProxies = process.env.BROWSERBASE_PROXIES === "1";

  const bb = new Browserbase({ apiKey });
  const session = await bb.sessions.create({
    projectId,
    ...(useProxies ? { proxies: true } : {}),
    browserSettings: { viewport: { width: 1280, height: 800 }, blockAds: true },
  });

  const browser = await chromium.connectOverCDP(session.connectUrl);
  try {
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.newPage());

    let title = "";
    let text = "";
    let screenshot = Buffer.alloc(0);

    // Fetch PDF bytes directly through the browser context (no navigation, so no
    // "download is starting" error), then parse the text.
    const readPdf = async () => {
      const resp = await page.request.get(url, { timeout: 60000 });
      text = await extractPdfText(new Uint8Array(Buffer.from(await resp.body())));
      title = pdfTitle(url);
    };

    if (/\.pdf(\?|#|$)/i.test(url)) {
      await readPdf();
    } else {
      try {
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(3000);
        screenshot = Buffer.from(await page.screenshot({ type: "png" }));
        const contentType = response?.headers()["content-type"] ?? "";
        if (/application\/pdf/i.test(contentType) && response) {
          text = await extractPdfText(new Uint8Array(Buffer.from(await response.body())));
          title = pdfTitle(url);
        } else {
          title = await page.title();
          text = await page.innerText("body").catch(() => "");
        }
      } catch (err) {
        if (/download is starting/i.test(String(err))) await readPdf();
        else throw err;
      }
    }

    if (!text.trim()) {
      throw new Error(
        "Couldn't read any text from that page — it may block automated access or need a login. (Sites like Reddit need Browserbase residential proxies, a paid feature; set BROWSERBASE_PROXIES=1.)",
      );
    }

    return {
      url,
      title,
      text,
      screenshot,
      sessionId: session.id,
      replayUrl: `https://browserbase.com/sessions/${session.id}`,
    };
  } finally {
    await browser.close();
  }
}

// Search the web for a topic, open the top results in one Browserbase session,
// and combine their text into a single captured "page" the IBIS extractor maps.
export async function searchAndCapture(query: string, maxPages = 3): Promise<CapturedPage> {
  const { session, browser } = await openSession();
  try {
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.newPage());

    await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(1500);
    const serpShot = Buffer.from(await page.screenshot({ type: "png" }));

    const hrefs = await page
      .$$eval("a.result__a", (els) => els.map((e) => (e as HTMLAnchorElement).href))
      .catch(() => [] as string[]);
    const urls = [
      ...new Set(
        hrefs.map((h) => {
          const m = h.match(/[?&]uddg=([^&]+)/);
          return m ? decodeURIComponent(m[1]) : h;
        }),
      ),
    ]
      .filter((u) => /^https?:\/\//i.test(u) && !/duckduckgo\.com/i.test(u))
      .slice(0, 6); // candidate pool; we keep the first maxPages readable ones

    const blocked = /just a moment|enable javascript and cookies|checking your browser|verify you are human|are you a robot/i;
    const results: { url: string; title: string; text: string }[] = [];
    for (const u of urls) {
      if (results.length >= maxPages) break;
      try {
        await page.goto(u, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(1500);
        const title = await page.title();
        const text = (await page.innerText("body").catch(() => "")).trim();
        if (text.length > 300 && !blocked.test(title) && !blocked.test(text.slice(0, 400))) {
          results.push({ url: u, title, text });
        }
      } catch {
        // skip pages that block, download, or time out
      }
    }

    if (!results.length) {
      throw new Error(`No readable sources were found for "${query}". Try rephrasing, or paste a URL.`);
    }

    const combined = results.map((r) => `Source: ${r.title}\n${r.text}`).join("\n\n");
    return {
      url: `search:${query}`,
      title: query,
      text: combined,
      screenshot: serpShot,
      sessionId: session.id,
      replayUrl: `https://browserbase.com/sessions/${session.id}`,
      sources: results.map((r) => ({ url: r.url, title: r.title })),
    };
  } finally {
    await browser.close();
  }
}

// Turn captured page text into our transcript shape so the existing IBIS
// extractor runs unchanged. Each meaningful paragraph becomes an "utterance"
// attributed to the source; grounding is by text quote rather than audio time.
export function pageTextToTranscript(page: CapturedPage, jobId: string): NormalizedTranscript {
  const title = (page.title || "Web source").trim();
  const lines = page.text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 40); // drop nav links / short cruft

  const chunks: string[] = [];
  let chars = 0;
  for (const line of lines) {
    if (chunks.length >= 80 || chars > 16000) break;
    chunks.push(line);
    chars += line.length;
  }
  if (chunks.length === 0 && page.text.trim()) {
    chunks.push(page.text.trim().slice(0, 4000));
  }

  const speakerLabel = title.slice(0, 48);
  const utterances = chunks.map((text, i) => ({
    id: `u${i + 1}`,
    speakerId: "source_0",
    speakerLabel,
    startSec: i,
    endSec: i + 1,
    confidence: 1,
    text,
  }));

  return {
    type: "normalized_transcript",
    version: 1,
    source: {
      id: `src_${jobId}`,
      inputUrl: page.url,
      canonicalUrl: page.url,
      sourceType: "webpage",
      title,
      fetchedAt: new Date().toISOString(),
      browserbaseSessionId: page.sessionId,
      screenshotPath: `data/jobs/${jobId}/screenshot.png`,
    },
    durationSec: utterances.length,
    speakers: [{ id: "source_0", label: speakerLabel, inferredName: speakerLabel, confidence: "high" }],
    utterances,
    fullText: chunks.join("\n"),
  };
}
