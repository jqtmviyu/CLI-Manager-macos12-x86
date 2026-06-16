use git2::{Repository, StatusOptions};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// 查询指定路径的当前 git 分支
///
/// 使用 libgit2 库直接查询仓库状态，避免文件 I/O 触发安全软件弹窗。
/// libgit2 是 Git 官方认证的库，被安全软件白名单信任，且比直接读文件更快（内部有缓存）。
/// 整段查询包在 `spawn_blocking` 内，不阻塞 tokio runtime 工作线程。
///
/// # Returns
/// * `Ok(Some(branch))` - 普通分支
/// * `Ok(None)` - 非 git 仓库、detached HEAD、路径无效，或查询失败
#[tauri::command]
pub async fn get_current_git_branch(path: String) -> Result<Option<String>, String> {
    // 前置检查：路径为空或不存在时快速返回
    if path.is_empty() || !Path::new(&path).exists() {
        return Ok(None);
    }

    tokio::task::spawn_blocking(move || {
        // 尝试打开 git 仓库
        let repo = match Repository::open(&path) {
            Ok(r) => r,
            Err(_) => return Ok(None), // 非 git 仓库或无权限
        };

        // 获取 HEAD 引用
        let head = match repo.head() {
            Ok(h) => h,
            Err(_) => return Ok(None), // detached HEAD 或其他异常
        };

        // 提取短分支名（如 "main"、"feature/foo"）
        // shorthand() 对于 refs/heads/main 返回 "main"，对于 detached HEAD 返回 None
        Ok(head.shorthand().map(|s| s.to_string()))
    })
    .await
    .map_err(|e| format!("git 分支查询任务失败: {e}"))?
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileChange {
    pub path: String,
    pub status: String,
    pub staged: bool,
    pub added: i32,
    pub deleted: i32,
}

/// 获取指定路径的 Git 文件变更列表
///
/// 使用 libgit2 库查询工作区和暂存区的文件状态。
///
/// # Returns
/// * `Ok(Vec<GitFileChange>)` - 变更文件列表
/// * `Err(String)` - 错误信息
#[tauri::command]
pub async fn git_get_changes(project_path: String) -> Result<Vec<GitFileChange>, String> {
    log::info!("[git_get_changes] 开始查询 Git 变更, project_path: {}", project_path);

    tokio::task::spawn_blocking(move || {
        let path = Path::new(&project_path);

        if !path.exists() {
            let err_msg = format!("路径不存在: {}", project_path);
            log::error!("[git_get_changes] {}", err_msg);
            return Err(err_msg);
        }

        log::info!("[git_get_changes] 路径存在，尝试打开 Git 仓库");

        // 打开 git 仓库
        let repo = Repository::open(path)
            .map_err(|e| {
                let err_msg = format!("不是 Git 仓库或无法访问: {}", e);
                log::error!("[git_get_changes] {}", err_msg);
                err_msg
            })?;

        log::info!("[git_get_changes] Git 仓库打开成功");

        // 获取状态
        let mut opts = StatusOptions::new();
        opts.include_untracked(true);
        opts.recurse_untracked_dirs(true);

        let statuses = repo
            .statuses(Some(&mut opts))
            .map_err(|e| {
                let err_msg = format!("获取 Git 状态失败: {}", e);
                log::error!("[git_get_changes] {}", err_msg);
                err_msg
            })?;

        log::info!("[git_get_changes] 获取到 {} 个状态条目", statuses.len());

        let mut changes = Vec::new();

        for entry in statuses.iter() {
            let status = entry.status();
            let file_path = entry.path().unwrap_or("").to_string();

            if file_path.is_empty() {
                continue;
            }

            // 解析状态
            let (status_char, staged) = parse_git2_status(status);

            // 对于已跟踪文件，尝试获取 diff 统计
            let (added, deleted) = if status.is_wt_new() {
                (0, 0) // 新文件暂不统计
            } else {
                get_diff_stats_git2(&repo, &file_path, staged)
            };

            changes.push(GitFileChange {
                path: file_path,
                status: status_char.to_string(),
                staged,
                added,
                deleted,
            });
        }

        log::info!("[git_get_changes] 查询完成，返回 {} 个变更文件", changes.len());
        Ok(changes)
    })
    .await
    .map_err(|e| {
        let err_msg = format!("Git 变更查询任务失败: {}", e);
        log::error!("[git_get_changes] {}", err_msg);
        err_msg
    })?
}

fn parse_git2_status(status: git2::Status) -> (&'static str, bool) {
    // 优先级：INDEX (staged) > WT (worktree)
    if status.is_index_new() {
        return ("A", true);
    }
    if status.is_index_modified() {
        return ("M", true);
    }
    if status.is_index_deleted() {
        return ("D", true);
    }
    if status.is_index_renamed() {
        return ("R", true);
    }

    if status.is_wt_modified() {
        return ("M", false);
    }
    if status.is_wt_deleted() {
        return ("D", false);
    }
    if status.is_wt_renamed() {
        return ("R", false);
    }
    if status.is_wt_new() {
        return ("U", false); // Untracked
    }

    ("M", false) // 默认
}

fn get_diff_stats_git2(repo: &Repository, file_path: &str, staged: bool) -> (i32, i32) {
    // 简化版：仅返回 0，完整实现需要 diff API
    // 可以通过 repo.diff_tree_to_index / diff_index_to_workdir 获取详细 diff
    // 此处为了性能和简洁，暂不实现（可后续优化）
    let _ = (repo, file_path, staged);
    (0, 0)
}

/// 获取指定文件的 Git diff 内容
///
/// # Returns
/// * `Ok(String)` - unified diff 格式的文本
/// * `Err(String)` - 错误信息
#[tauri::command]
pub async fn git_get_file_diff(project_path: String, file_path: String) -> Result<String, String> {
    log::info!("[git_get_file_diff] project_path: {}, file_path: {}", project_path, file_path);

    tokio::task::spawn_blocking(move || {
        let path = Path::new(&project_path);

        if !path.exists() {
            return Err(format!("路径不存在: {}", project_path));
        }

        let repo = Repository::open(path)
            .map_err(|e| format!("打开仓库失败: {}", e))?;

        // 获取 HEAD tree
        let head = repo.head().map_err(|e| format!("获取 HEAD 失败: {}", e))?;
        let head_tree = head.peel_to_tree().map_err(|e| format!("获取 HEAD tree 失败: {}", e))?;

        // 创建 diff 选项
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.pathspec(&file_path);
        diff_opts.context_lines(3);

        // 生成 diff（HEAD vs worktree）
        let diff = repo.diff_tree_to_workdir_with_index(Some(&head_tree), Some(&mut diff_opts))
            .map_err(|e| format!("生成 diff 失败: {}", e))?;

        // 转换为 patch 文本
        let mut patch_text = String::new();
        diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            let origin = line.origin();
            let content = std::str::from_utf8(line.content()).unwrap_or("");

            match origin {
                '+' | '-' | ' ' => {
                    patch_text.push(origin);
                    patch_text.push_str(content);
                }
                'F' => {
                    // 文件头
                    patch_text.push_str("diff --git ");
                    patch_text.push_str(content);
                }
                'H' => {
                    // hunk 头
                    patch_text.push_str("@@ ");
                    patch_text.push_str(content);
                }
                _ => {
                    patch_text.push_str(content);
                }
            }
            true
        }).map_err(|e| format!("打印 diff 失败: {}", e))?;

        log::info!("[git_get_file_diff] diff 生成成功，长度: {}", patch_text.len());
        Ok(patch_text)
    })
    .await
    .map_err(|e| format!("任务失败: {}", e))?
}
