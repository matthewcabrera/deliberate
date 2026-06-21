// One-off: send a single well-formed span to Arize with full debug logging.
//   node --env-file=.env.local scripts/otel-probe.mjs
import { diag, DiagConsoleLogger, DiagLogLevel, trace } from "@opentelemetry/api";
import { NodeTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const exporter = new OTLPTraceExporter({
  url: process.env.ARIZE_COLLECTOR_ENDPOINT,
  headers: { space_id: process.env.ARIZE_SPACE_ID, api_key: process.env.ARIZE_API_KEY },
});

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    "service.name": "deliberate",
    "openinference.project.name": process.env.ARIZE_PROJECT_NAME || "deliberate-ibis",
  }),
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});
provider.register();

console.log("endpoint:", process.env.ARIZE_COLLECTOR_ENDPOINT);
console.log("space_id:", process.env.ARIZE_SPACE_ID);
console.log("project:", process.env.ARIZE_PROJECT_NAME || "deliberate-ibis");

const tracer = trace.getTracer("probe");
const span = tracer.startSpan("probe.test");
span.setAttribute("openinference.span.kind", "LLM");
span.setAttribute("llm.model_name", "probe");
span.setAttribute("input.value", "probe input " + new Date().toISOString());
span.setAttribute("output.value", "probe output");
span.end();

await provider.forceFlush();
console.log(">>> flushed; waiting for exporter...");
await new Promise((r) => setTimeout(r, 2500));
await provider.shutdown();
console.log(">>> done");
