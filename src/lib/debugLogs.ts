export interface DebugLogEvent {
  id?: string;
  time: string;
  stage: string;
  detail: string;
}

/**
 * Formats voice pipeline debug events into chronological, human-readable lines
 * suitable for clipboard export and diagnostics.
 *
 * @param logs The array of debug events in chronological order
 * @param maxCount Optional count of most recent events to export (e.g. 20)
 * @returns Plain text lines formatted as `[time] [stage] detail`
 */
export function formatDebugLogs(
  logs: DebugLogEvent[],
  maxCount?: number
): string {
  const events = typeof maxCount === 'number' && maxCount > 0 ? logs.slice(-maxCount) : logs;
  if (events.length === 0) {
    return 'No pipeline events recorded yet.';
  }
  return events
    .map((log) => `[${log.time}] [${log.stage}] ${log.detail}`)
    .join('\n');
}
