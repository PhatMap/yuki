import type { AiJob, AiJobTask } from "@/lib/ai/jobs/types";

export interface MockJobTaskResult {
  taskId: string;
  jobId: string;
  kind: string;
  cacheKey?: string;
  processedAt: string;
  summary: string;
  inputEcho: unknown;
}

export interface MockJobTaskHandlerOptions {
  delayMs?: number;
}

function waitForDelay(delayMs: number, signal?: AbortSignal) {
  if (delayMs <= 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }

    const timeoutId = globalThis.setTimeout(resolve, delayMs);

    signal?.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timeoutId);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function runMockJobTask(
  task: AiJobTask,
  job: AiJob,
  options: MockJobTaskHandlerOptions = {},
  signal?: AbortSignal,
): Promise<MockJobTaskResult> {
  await waitForDelay(options.delayMs ?? 5, signal);

  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }

  return {
    taskId: task.id,
    jobId: job.id,
    kind: task.kind,
    cacheKey: task.cacheKey,
    processedAt: "1970-01-01T00:00:00.000Z",
    summary: `Mock result for ${task.kind} task ${task.sequence}.`,
    inputEcho: task.input,
  };
}
