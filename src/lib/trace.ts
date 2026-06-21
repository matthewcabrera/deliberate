import { SpanStatusCode, trace, type Attributes, type Span } from "@opentelemetry/api";
import { OpenInferenceSpanKind, SemanticConventions } from "@arizeai/openinference-semantic-conventions";

export { flushTraces } from "./otel";

export const tracer = trace.getTracer("deliberate");

/** Run `fn` inside an active span, recording status and ending the span. */
export async function traced<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      span.setAttributes(attributes);
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

/** OpenInference attributes so Arize renders the span as an LLM call. */
export function llmAttributes(model: string, input: string, output: string): Attributes {
  return {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.LLM,
    [SemanticConventions.LLM_MODEL_NAME]: model,
    [SemanticConventions.INPUT_VALUE]: input,
    [SemanticConventions.OUTPUT_VALUE]: output,
  };
}
