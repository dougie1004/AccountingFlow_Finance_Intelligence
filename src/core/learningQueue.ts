class LearningQueue {
  private queue: (() => Promise<void>)[] = [];
  private isProcessing = false;

  enqueue(task: () => Promise<void>) {
    this.queue.push(task);
    this.process();
  }

  private async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) continue;

      try {
        await task();
      } catch (e) {
        console.error("[LearningQueue] task failed:", e);
      }

      // SQLite breathing time (중요: 동시성 락 방지)
      await new Promise(res => setTimeout(res, 10));
    }

    this.isProcessing = false;
  }
}

export const learningQueue = new LearningQueue();
