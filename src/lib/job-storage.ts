import { tmpdir } from "node:os";
import { join } from "node:path";

export function jobDir(jobId: string) {
  return join(tmpdir(), "deliberate-jobs", jobId);
}
