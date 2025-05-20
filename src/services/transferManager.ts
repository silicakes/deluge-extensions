import { uploadFiles, fsDelete } from "@/commands";
import {
  fileTransferQueue,
  fileTransferProgress,
  fileTransferInProgress,
  TransferItem,
} from "@/state";

interface Task {
  item: TransferItem;
  file: File;
  destDir: string;
  overwrite: boolean;
}

class TransferManager {
  private isProcessing = false;
  private tasks: Task[] = [];

  enqueueUploads(files: File[], destDir: string, overwrite = false) {
    const newTasks = files.map((file) => {
      const path = destDir.endsWith("/")
        ? `${destDir}${file.name}`
        : `${destDir}/${file.name}`;
      const id = `${path}-${Date.now()}-${Math.random()}`;
      const controller = new AbortController();
      const item: TransferItem = {
        id,
        kind: "upload",
        src: path,
        bytes: 0,
        total: 0,
        status: "pending",
        controller,
      };
      return { item, file, destDir, overwrite };
    });
    // Register tasks and update UI queue
    this.tasks.push(...newTasks);
    fileTransferQueue.value = [
      ...fileTransferQueue.value,
      ...newTasks.map((t) => t.item),
    ];
    // Start processing if idle
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    this.isProcessing = true;
    fileTransferInProgress.value = true;
    const totalTasks = this.tasks.length;
    let completed = 0;
    for (const task of [...this.tasks]) {
      const { item, file, destDir, overwrite } = task;
      if (item.status !== "pending") {
        completed++;
        continue;
      }
      try {
        await uploadFiles({
          files: [file],
          destDir,
          overwrite,
          signal: item.controller!.signal,
          onProgress: (_i, sent, total) => {
            fileTransferQueue.value = fileTransferQueue.value.map((t) =>
              t.id === item.id
                ? { ...t, status: "active", bytes: sent, total }
                : t,
            );
            fileTransferProgress.value = {
              path: item.src,
              bytes: sent,
              total,
              currentFileIndex: completed + 1,
              totalFiles: totalTasks,
              filesCompleted: completed,
            };
          },
        });
        // Mark done
        fileTransferQueue.value = fileTransferQueue.value.map((t) =>
          t.id === item.id
            ? { ...t, status: "done", bytes: t.total, total: t.total }
            : t,
        );
      } catch (error: unknown) {
        if (item.controller!.signal.aborted) {
          // Canceled by user
          fileTransferQueue.value = fileTransferQueue.value.map((t) =>
            t.id === item.id
              ? { ...t, status: "canceled", error: "Cancelled by user" }
              : t,
          );
          try {
            await fsDelete({ path: item.src });
          } catch {
            // ignore deletion errors
          }
        } else {
          // Error
          const errMsg = error instanceof Error ? error.message : String(error);
          fileTransferQueue.value = fileTransferQueue.value.map((t) =>
            t.id === item.id ? { ...t, status: "error", error: errMsg } : t,
          );
        }
      }
      completed++;
    }
    fileTransferInProgress.value = false;
    fileTransferProgress.value = null;
    this.isProcessing = false;
  }

  cancel(id?: string) {
    if (id) {
      // Cancel a single transfer
      const task = this.tasks.find((t) => t.item.id === id);
      if (task) {
        // Abort the controller
        task.item.controller?.abort();
        // Immediately mark in the UI as canceled
        fileTransferQueue.value = fileTransferQueue.value.map((t) =>
          t.id === id
            ? { ...t, status: "canceled", error: "Cancelled by user" }
            : t,
        );
        // Remove any partial file on device
        fsDelete({ path: task.item.src }).catch(() => {});
      }
    } else {
      // Cancel all transfers
      this.tasks.forEach((t) => t.item.controller?.abort());
    }
  }

  clearCompleted() {
    fileTransferQueue.value = fileTransferQueue.value.filter(
      (t) => t.status === "pending" || t.status === "active",
    );
  }

  clearAll() {
    fileTransferQueue.value = [];
  }
}

export const transferManager = new TransferManager();
