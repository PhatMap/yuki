import type { AiJobProgress, AiJobTask } from "@/lib/ai/jobs/types";

export function calculateAiJobProgress(
  tasks: AiJobTask[],
  message?: string,
  currentTaskId?: string,
): AiJobProgress {
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter((task) => task.status === "pending").length;
  const queuedTasks = tasks.filter((task) => task.status === "queued").length;
  const runningTasks = tasks.filter((task) => task.status === "running").length;
  const completedTasks = tasks.filter(
    (task) => task.status === "completed",
  ).length;
  const failedTasks = tasks.filter((task) => task.status === "failed").length;
  const skippedTasks = tasks.filter((task) => task.status === "skipped").length;
  const finishedTasks = completedTasks + failedTasks + skippedTasks;
  const percentComplete =
    totalTasks > 0 ? Math.round((finishedTasks / totalTasks) * 100) : 100;

  return {
    totalTasks,
    pendingTasks,
    queuedTasks,
    runningTasks,
    completedTasks,
    failedTasks,
    skippedTasks,
    percentComplete,
    currentTaskId,
    message,
  };
}
