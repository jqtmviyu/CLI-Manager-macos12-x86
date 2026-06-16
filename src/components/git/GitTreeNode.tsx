import { ChevronRight, Folder } from "../icons";
import type { GitTreeNode } from "../../lib/types";
import { GitStatusIcon } from "./GitStatusIcon";
import { useGitStore } from "../../stores/gitStore";
import { TERM } from "../stats/termStatsUi";
import { getMaterialFileIcon, getMaterialFolderIcon } from "@baybreezy/file-extension-icon";

interface GitTreeNodeProps {
  node: GitTreeNode;
  depth: number;
  onFileClick: (filePath: string) => void;
}

export function GitTreeNodeComponent({ node, depth, onFileClick }: GitTreeNodeProps) {
  const { collapsedDirs, toggleDir } = useGitStore();
  const isCollapsed = collapsedDirs.has(node.path);
  const indentPx = depth * 12 + 4;

  if (node.type === "file") {
    const { icon: FileIconComponent, color } = getFileIcon(node.name);

    // 根据 Git 状态给文件名着色
    let fileNameColor = TERM.fg; // 默认前景色
    if (node.change) {
      switch (node.change.status) {
        case "M": // 修改
          fileNameColor = TERM.blue;
          break;
        case "A": // 新增（已暂存）
          fileNameColor = TERM.green;
          break;
        case "D": // 删除
          fileNameColor = "#808080";
          break;
        case "U": // 未跟踪
        case "??":
          fileNameColor = TERM.red;
          break;
        case "R": // 重命名
          fileNameColor = TERM.magenta;
          break;
        default:
          fileNameColor = TERM.fg;
      }
    }

    return (
      <div
        className="flex items-center gap-1.5 rounded py-0.5 px-1 hover:bg-opacity-10 cursor-pointer text-[11px]"
        style={{ paddingLeft: indentPx, backgroundColor: "transparent" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${TERM.cyan}20`)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        onClick={() => onFileClick(node.path)}
      >
        <FileIconComponent size={11} strokeWidth={1.5} style={{ color }} className="shrink-0" />
        <span className="flex-1 truncate" style={{ color: fileNameColor }}>{node.name}</span>
        {node.change && (
          <>
            <GitStatusIcon status={node.change.status} size={12} />
            {(node.change.added > 0 || node.change.deleted > 0) && (
              <span className="text-[10px]" style={{ color: TERM.dim }}>
                {node.change.added > 0 && (
                  <span style={{ color: TERM.green }}>+{node.change.added}</span>
                )}
                {node.change.added > 0 && node.change.deleted > 0 && " "}
                {node.change.deleted > 0 && (
                  <span style={{ color: TERM.red }}>-{node.change.deleted}</span>
                )}
              </span>
            )}
          </>
        )}
      </div>
    );
  }

  // 目录节点
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 rounded py-0.5 px-1 hover:bg-opacity-10 cursor-pointer font-medium text-[11px]"
        style={{ paddingLeft: indentPx, backgroundColor: "transparent" }}
        onClick={() => toggleDir(node.path)}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${TERM.cyan}20`)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <span
          className="inline-flex items-center justify-center shrink-0 transition-transform"
          style={{
            transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
            color: TERM.dim,
          }}
        >
          <ChevronRight size={10} strokeWidth={2} />
        </span>
        <Folder size={11} strokeWidth={1.5} style={{ color: TERM.yellow }} className="shrink-0" />
        <span className="flex-1 truncate" style={{ color: TERM.fg }}>{node.name}</span>
        {hasChildren && (
          <span className="text-[9px] rounded px-1 py-0" style={{ color: TERM.dim, backgroundColor: `${TERM.dim}20` }}>
            {node.children!.length}
          </span>
        )}
      </div>

      {!isCollapsed && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <GitTreeNodeComponent key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} />
          ))}
        </div>
      )}
    </div>
  );
}
