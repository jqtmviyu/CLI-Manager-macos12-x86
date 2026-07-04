import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState, type ComponentType } from "react";
import { BookOpen, Download, ExternalLink, Github, Info, UserRound } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useI18n } from "../../lib/i18n";

const REPOSITORY_URL = "https://github.com/dark-hxx/CLI-Manager";
const MANUAL_URL = `${REPOSITORY_URL}/blob/master/docs/%E5%8A%9F%E8%83%BD%E6%B8%85%E5%8D%95.md`;
const AUTHOR_URL = "https://github.com/dark-hxx";

const PROJECT_HIGHLIGHTS = [
  { zh: "多项目 PTY 终端管理", en: "Multi-project PTY terminal management" },
  { zh: "Claude Code / Codex CLI 集成", en: "Claude Code / Codex CLI integration" },
  { zh: "历史会话 Diff 与用量分析", en: "History Diff and usage analysis" },
  { zh: "供应商切换与 WebDAV 同步", en: "Provider switching and WebDAV sync" },
];

interface ExternalLinkItemProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  url: string;
}

async function openExternalUrl(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch (e) {
    console.error("Failed to open URL:", e);
  }
}

function ExternalLinkItem({ icon: Icon, title, description, url }: ExternalLinkItemProps) {
  return (
    <button
      type="button"
      onClick={() => void openExternalUrl(url)}
      className="ui-interactive ui-focus-ring ui-surface-card flex min-w-0 items-start gap-3 rounded-2xl border border-border p-4 text-left transition-colors hover:bg-surface-container-high"
    >
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-surface-container-high text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
          {title}
          <ExternalLink className="h-3.5 w-3.5 text-on-surface-variant" />
        </span>
        <span className="mt-1 block text-xs leading-5 text-on-surface-variant">{description}</span>
      </span>
    </button>
  );
}

export function AboutSection() {
  const { language, t } = useI18n();
  const text = (zh: string, en: string) => (language === "zh-CN" ? zh : en);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const result = await invoke<{ version: string; name: string }>("get_app_version");
        setCurrentVersion(result.version);
      } catch (error) {
        console.error("Failed to fetch version:", error);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Info className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-on-surface">{text("项目介绍", "Project Overview")}</div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
              {text(
                "CLI-Manager 是面向 Claude Code / Codex CLI 的跨平台 AI CLI 增强工作台，用于集中管理多项目终端、会话历史、Diff 回看、用量分析、供应商切换和配置同步。",
                "CLI-Manager is a cross-platform AI CLI workspace for Claude Code and Codex CLI, covering multi-project terminals, session history, Diff review, usage analysis, provider switching, and configuration sync."
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PROJECT_HIGHLIGHTS.map((item) => (
                <span
                  key={item.zh}
                  className="rounded-full border border-border bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant"
                >
                  {language === "zh-CN" ? item.zh : item.en}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <div className="text-sm font-semibold text-on-surface">{t("about.appInfo.title")}</div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-on-surface-variant">{t("about.appInfo.version")}</span>
          <span className="rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-xs font-semibold text-on-surface">
            V{currentVersion || "---"}
          </span>
        </div>
        <p className="mt-3 text-xs leading-5 text-on-surface-variant">{t("about.appInfo.releaseDescription")}</p>
        <button
          type="button"
          onClick={() => void openExternalUrl(`${REPOSITORY_URL}/releases`)}
          className="ui-interactive ui-focus-ring mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-container-high px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{t("about.appInfo.openReleases")}</span>
          <ExternalLink className="h-3 w-3 text-on-surface-variant" />
        </button>
      </section>

      <div className="space-y-3">
        <div className="px-1 text-sm font-semibold text-on-surface">{text("项目资源", "Project Resources")}</div>
        <div className="grid gap-3 md:grid-cols-2">
          <ExternalLinkItem
            icon={Download}
            title={t("about.resources.releases.title")}
            description={t("about.resources.releases.description")}
            url={`${REPOSITORY_URL}/releases`}
          />
          <ExternalLinkItem
            icon={Github}
            title={text("Git 开源地址", "Git Repository")}
            description={text("查看源码、提交 Issue 或参与 Pull Request。", "View source code, submit issues, or contribute pull requests.")}
            url={REPOSITORY_URL}
          />
          <ExternalLinkItem
            icon={BookOpen}
            title={text("操作手册", "User Manual")}
            description={text("查看功能清单、使用说明和能力边界。", "View feature list, usage notes, and capability boundaries.")}
            url={MANUAL_URL}
          />
        </div>
      </div>

      <section className="ui-surface-card rounded-2xl border border-border p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-surface-container-high text-primary">
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-on-surface">{text("作者信息", "Author")}</div>
            <div className="mt-2 text-sm text-on-surface-variant">{text("作者：", "Author: ")}hxx / dark-hxx</div>
            <div className="mt-1 text-xs leading-5 text-on-surface-variant">
              {text("项目长期围绕 AI CLI 工作流、终端体验、历史会话分析和多项目管理持续演进。", "The project continues to evolve around AI CLI workflows, terminal experience, history analytics, and multi-project management.")}
            </div>
            <button
              type="button"
              onClick={() => void openExternalUrl(AUTHOR_URL)}
              className="ui-interactive ui-focus-ring mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-container-high px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
            >
              <Github className="h-3.5 w-3.5" />
              <span>{text("查看作者主页", "View Author Profile")}</span>
              <ExternalLink className="h-3 w-3 text-on-surface-variant" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
