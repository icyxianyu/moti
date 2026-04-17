function readLimit(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : fallback;

  // 环境变量缺失、非数字或小于等于 0 时，统一回退到默认值，避免把服务配置成无效状态。
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export class TaskLimiter {
  // 当前已占用的“执行槽位”数量。
  private active = 0;

  constructor(private readonly limit: number) {}

  tryAcquire(): (() => void) | null {
    // 到达上限时直接返回 null，让调用方尽快返回 429，而不是继续堆积任务。
    if (this.active >= this.limit) {
      return null;
    }

    this.active += 1;
    let released = false;

    // 返回一个 release 函数，调用方应在 finally 中执行，确保异常时也能释放槽位。
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
    };
  }

  snapshot() {
    return {
      active: this.active,
      limit: this.limit,
    };
  }
}

// 三类高开销任务分别设置独立并发上限，避免彼此互相挤占资源。
// 默认值按 2C4G 机器做了偏保守的配置：生成 2，并行分析 1，建索引 1。
export const generateLimiter = new TaskLimiter(readLimit("GENERATE_CONCURRENCY", 2));
export const analyzeLimiter = new TaskLimiter(readLimit("ANALYZE_CONCURRENCY", 1));
export const ingestLimiter = new TaskLimiter(readLimit("INGEST_CONCURRENCY", 1));
