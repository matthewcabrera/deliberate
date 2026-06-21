import { diag, DiagConsoleLogger, DiagLogLevel, type Context } from "@opentelemetry/api";
import { NodeTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import type { ReadableSpan, Span as SdkSpan, SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// Arize identifies the project via this resource attribute.
const PROJECT_NAME_ATTR = "openinference.project.name";

// Only export our own pipeline spans — drop Next.js's auto-instrumented HTTP /
// render / fetch spans so the Arize trace view stays clean.
const KEEP_PREFIXES = ["ibis.", "deepgram.", "probe."];

class AppSpanFilter implements SpanProcessor {
  constructor(private readonly inner: SpanProcessor) {}
  onStart(span: SdkSpan, parentContext: Context) {
    this.inner.onStart(span, parentContext);
  }
  onEnd(span: ReadableSpan) {
    if (KEEP_PREFIXES.some((p) => span.name.startsWith(p))) this.inner.onEnd(span);
  }
  forceFlush() {
    return this.inner.forceFlush();
  }
  shutdown() {
    return this.inner.shutdown();
  }
}

// Stash the provider on globalThis so route bundles and the instrumentation
// bundle share one instance (and one exporter).
const globalRef = globalThis as unknown as { __deliberateOtel?: NodeTracerProvider };

export function setupTracing(): NodeTracerProvider | null {
  if (globalRef.__deliberateOtel) return globalRef.__deliberateOtel;

  const apiKey = process.env.ARIZE_API_KEY;
  const spaceId = process.env.ARIZE_SPACE_ID;
  if (!apiKey || !spaceId) {
    console.warn("[otel] ARIZE_API_KEY / ARIZE_SPACE_ID missing — tracing disabled.");
    return null;
  }

  // Surface OTLP export failures (auth, network) instead of swallowing them.
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const exporter = new OTLPTraceExporter({
    url: process.env.ARIZE_COLLECTOR_ENDPOINT || "https://otlp.arize.com/v1/traces",
    headers: { space_id: spaceId, api_key: apiKey },
  });

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "deliberate",
      [PROJECT_NAME_ATTR]: process.env.ARIZE_PROJECT_NAME || "deliberate-ibis",
    }),
    spanProcessors: [new AppSpanFilter(new BatchSpanProcessor(exporter))],
  });

  provider.register();
  globalRef.__deliberateOtel = provider;
  console.log("[otel] Arize tracing enabled for project", process.env.ARIZE_PROJECT_NAME || "deliberate-ibis");
  return provider;
}

export async function flushTraces(): Promise<void> {
  await globalRef.__deliberateOtel?.forceFlush();
}
