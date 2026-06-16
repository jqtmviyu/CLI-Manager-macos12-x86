import { useGitStore } from "../../stores/gitStore";
import { GitTreeNodeComponent } from "./GitTreeNode";

interface GitChangesTreeProps {
  onFileClick: (filePath: string) => void;
}

export function GitChangesTree({ onFileClick }: GitChangesTreeProps) {
  const { tree } = useGitStore();

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <GitTreeNodeComponent key={node.path} node={node} depth={0} onFileClick={onFileClick} />
      ))}
    </div>
  );
}
