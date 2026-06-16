import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X } from "../icons";
import { parseDiff, Diff, Hunk, tokenize } from "react-diff-view";
import "react-diff-view/style/index.css";
import "./diffViewer.css";

interface DiffViewerModalProps {
  open: boolean;
  onClose: () => void;
  projectPath: string;
  filePath: string;
  fileName: string;
}

export function DiffViewerModal({ open, onClose, projectPath, filePath, fileName }: DiffViewerModalProps) {
  const [diffText, setDiffText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDiffText("");
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    invoke<string>("git_get_file_diff", { projectPath, filePath })
      .then((diff) => {
        if (cancelled) return;
        setDiffText(diff);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, projectPath, filePath]);

  if (!open) return null;

  let parsedDiff = null;
  let tokens = null;

  if (diffText) {
    try {
      const files = parseDiff(diffText);
      if (files.length > 0) {
        parsedDiff = files[0];
        tokens = tokenize(parsedDiff.hunks);
      }
    } catch (err) {
      console.error("[DiffViewerModal] 解析 diff 失败:", err);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 100, backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-6xl h-[85vh] flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Diff: {fileName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="关闭"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">加载中...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 max-w-md text-center">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && diffText && parsedDiff && tokens && (
            <div className="diff-viewer-container bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <Diff
                viewType="split"
                diffType={parsedDiff.type}
                hunks={parsedDiff.hunks}
                tokens={tokens}
              >
                {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
              </Diff>
            </div>
          )}

          {!loading && !error && (!diffText || !parsedDiff) && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-600 dark:text-gray-400">无 diff 内容</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
