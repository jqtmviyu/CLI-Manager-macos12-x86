import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { HistorySessionSummary } from "../../lib/types";
import { useHistoryStore } from "../../stores/historyStore";
import { TimelineHeatmap } from "./TimelineHeatmap";
import { StatsTrendChart } from "./StatsTrendChart";
import { StatsTokenDonut } from "./StatsTokenDonut";
import { StatsProjectBar } from "./StatsProjectBar";
import { StatsModelComposition } from "./StatsModelComposition";
import { StatsTokenTrendChart } from "./StatsTokenTrendChart";
import { StatsSourceComparisonChart } from "./StatsSourceComparisonChart";
import { StatsProjectEfficiencyScatter } from "./StatsProjectEfficiencyScatter";
import { StatsHourlyActivityChart } from "./StatsHourlyActivityChart";
import { Skeleton } from "../ui/Skeleton";
import { Portal } from "../ui/Portal";

interface StatsPanelProps {
  open: boolean;
  onClose: () => void;
  onOpenSession: (sessionKey: string) => Promise<void>;
}

const DAY_SESSION_PAGE_SIZE = 120;
const ALL_PROJECTS_VALUE = "__all_projects__";
const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface DateRangeInput {
  startDate: string;
  endDate: string;
}

function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("zh-CN").format(value);
}

const DAY_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatDay(dayStartUtc: number): string {
  if (!Number.isFinite(dayStartUtc) || dayStartUtc <= 0) return "-";
  return DAY_FORMATTER.format(new Date(dayStartUtc));
}

function formatDateTime(ts: number | null): string {
  if (!ts || !Number.isFinite(ts)) return "-";
  return DATETIME_FORMATTER.format(new Date(ts));
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentWeekDateRange(): DateRangeInput {
  const now = new Date();
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    startDate: formatDateInput(monday),
    endDate: formatDateInput(today),
  };
}

function parseDateInput(value: string, endOfDay: boolean): number | null {
  const match = DATE_INPUT_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date.getTime();
}

function makeSessionKey(summary: HistorySessionSummary): string {
  return `${summary.source}:${summary.session_id}:${summary.file_path}`;
}

function StatsSkeleton() {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-bg-secondary p-2 space-y-2 rounded-md">
            <Skeleton className="h-2.5 w-1/2" />
            <Skeleton className="h-5 w-2/3" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="bg-bg-secondary p-3 space-y-2 rounded-md">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-5/6" />
            <Skeleton className="h-2.5 w-2/3" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function StatsPanel({ open, onClose, onOpenSession }: StatsPanelProps) {
  const loadingStats = useHistoryStore((s) => s.loadingStats);
  const loadingStatsProjectOptions = useHistoryStore((s) => s.loadingStatsProjectOptions);
  const stats = useHistoryStore((s) => s.stats);
  const statsError = useHistoryStore((s) => s.statsError);
  const statsProjectOptionsError = useHistoryStore((s) => s.statsProjectOptionsError);
  const statsUpdatedAt = useHistoryStore((s) => s.statsUpdatedAt);
  const sourceFilter = useHistoryStore((s) => s.sourceFilter);
  const projectOptions = useHistoryStore((s) => s.statsProjectOptions);
  const loadStatsProjectOptions = useHistoryStore((s) => s.loadStatsProjectOptions);
  const loadStats = useHistoryStore((s) => s.loadStats);

  const [projectKey, setProjectKey] = useState("");
  const [projectSelectionTouched, setProjectSelectionTouched] = useState(false);
  const [projectOptionsReady, setProjectOptionsReady] = useState(false);
  const [projectSelectionReady, setProjectSelectionReady] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeInput>(() => getCurrentWeekDateRange());
  const [requestedStatsQueryKey, setRequestedStatsQueryKey] = useState<string | null>(null);
  const [selectedDayStart, setSelectedDayStart] = useState<number | null>(null);
  const [dayVisibleCount, setDayVisibleCount] = useState(DAY_SESSION_PAGE_SIZE);

  const dateBounds = useMemo(() => {
    const startAt = parseDateInput(dateRange.startDate, false);
    const endAt = parseDateInput(dateRange.endDate, true);
    if (!dateRange.startDate || !dateRange.endDate) {
      return { startAt, endAt, error: "请选择开始日期和结束日期" };
    }
    if (startAt === null || endAt === null) {
      return { startAt, endAt, error: "日期格式无效" };
    }
    if (endAt < startAt) {
      return { startAt, endAt, error: "结束日期不能早于开始日期" };
    }
    return { startAt, endAt, error: null };
  }, [dateRange.endDate, dateRange.startDate]);

  const dateRangeLabel = dateBounds.error ? "未生效" : `${dateRange.startDate} 至 ${dateRange.endDate}`;
  const statsQueryKey = useMemo(
    () => `${sourceFilter}|${projectKey || ALL_PROJECTS_VALUE}|${dateBounds.startAt ?? "invalid"}|${dateBounds.endAt ?? "invalid"}`,
    [dateBounds.endAt, dateBounds.startAt, projectKey, sourceFilter]
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setProjectOptionsReady(false);
    setProjectSelectionReady(false);
    void loadStatsProjectOptions()
      .catch(() => {
        // error state is already managed in store
      })
      .finally(() => {
        if (!cancelled) setProjectOptionsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sourceFilter, loadStatsProjectOptions]);

  useEffect(() => {
    if (!open) return;
    setProjectKey("");
    setProjectSelectionTouched(false);
    setDateRange(getCurrentWeekDateRange());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setProjectSelectionTouched(false);
  }, [open, sourceFilter]);

  useEffect(() => {
    if (!open || !projectOptionsReady) return;
    setProjectKey((prev) => {
      if (!projectSelectionTouched) return projectOptions[0] ?? "";
      if (prev === "") return "";
      if (projectOptions.includes(prev)) return prev;
      return projectOptions[0] ?? "";
    });
    setProjectSelectionReady(true);
  }, [open, projectOptions, projectOptionsReady, projectSelectionTouched]);

  useEffect(() => {
    if (!open) return;
    setSelectedDayStart(null);
    setDayVisibleCount(DAY_SESSION_PAGE_SIZE);
  }, [open, sourceFilter, projectKey, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    if (!open || !projectSelectionReady || dateBounds.error) {
      setRequestedStatsQueryKey(null);
      return;
    }
    if (dateBounds.startAt === null || dateBounds.endAt === null) {
      setRequestedStatsQueryKey(null);
      return;
    }
    const request = loadStats({
      projectKey: projectKey || null,
      startAt: dateBounds.startAt,
      endAt: dateBounds.endAt,
    });
    setRequestedStatsQueryKey(statsQueryKey);
    void request.catch(() => {
      // error state is already managed in store
    });
  }, [open, projectSelectionReady, projectKey, sourceFilter, dateBounds, statsQueryKey, loadStats]);

  useEffect(() => {
    if (!stats) return;
    if (selectedDayStart === null) return;
    const exists = stats.heatmap.some((day) => day.day_start_utc === selectedDayStart);
    if (!exists) {
      setSelectedDayStart(null);
      setDayVisibleCount(DAY_SESSION_PAGE_SIZE);
    }
  }, [stats, selectedDayStart]);

  useEffect(() => {
    setDayVisibleCount(DAY_SESSION_PAGE_SIZE);
  }, [selectedDayStart]);

  const selectedDay = useMemo(() => {
    if (!stats || selectedDayStart === null) return null;
    return stats.heatmap.find((item) => item.day_start_utc === selectedDayStart) ?? null;
  }, [stats, selectedDayStart]);

  const visibleDaySessions = useMemo(() => {
    if (!selectedDay) return [];
    return selectedDay.session_refs.slice(0, dayVisibleCount);
  }, [selectedDay, dayVisibleCount]);

  const sourceLabel = sourceFilter === "all" ? "全部来源" : sourceFilter;
  const projectLabel = projectKey || "全部项目";
  const waitingForStatsQuery =
    dateBounds.error === null && (!projectSelectionReady || requestedStatsQueryKey !== statsQueryKey);

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 57, backgroundColor: "rgba(0, 0, 0, 0.45)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
      <Card className="ui-stats-panel h-[min(86vh,860px)] w-full max-w-6xl overflow-hidden rounded-2xl bg-bg-primary flex flex-col">
        <div className="ui-stats-panel-header flex items-center justify-between border-b border-border px-3 py-2">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-text-primary">
              <span className="ui-stats-panel-badge">
                <BarChart3 size={15} />
              </span>
              分析看板
            </div>
            <div className="ui-dev-label mt-1 text-[11px] text-text-muted">会话趋势、Token 构成与活跃分布</div>
          </div>
          <Button onClick={onClose} aria-label="关闭分析看板" size="icon" variant="ghost" title="关闭">
            <X size={14} />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <Select
            value={projectKey || ALL_PROJECTS_VALUE}
            onChange={(e) => {
              const next = e.target.value;
              setProjectSelectionTouched(true);
              setProjectKey(next === ALL_PROJECTS_VALUE ? "" : next);
            }}
            disabled={!projectOptionsReady && loadingStatsProjectOptions}
            className="h-8 w-auto min-w-[124px] shrink-0 text-xs"
            aria-label="项目过滤"
          >
            <option value={ALL_PROJECTS_VALUE}>全部项目</option>
            {projectOptions.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </Select>

          <label className="flex items-center gap-1 text-[12px] font-medium text-text-secondary">
            <span>开始</span>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
              className="h-8 min-w-[132px] rounded-md border border-border bg-bg-secondary px-2 text-xs text-text-primary"
              aria-label="统计开始日期"
            />
          </label>

          <label className="flex items-center gap-1 text-[12px] font-medium text-text-secondary">
            <span>结束</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
              className="h-8 min-w-[132px] rounded-md border border-border bg-bg-secondary px-2 text-xs text-text-primary"
              aria-label="统计结束日期"
            />
          </label>

          <Button
            onClick={() => {
              if (!projectSelectionReady || dateBounds.error) return;
              if (dateBounds.startAt === null || dateBounds.endAt === null) return;
              const request = loadStats({
                projectKey: projectKey || null,
                startAt: dateBounds.startAt,
                endAt: dateBounds.endAt,
                force: true,
              });
              setRequestedStatsQueryKey(statsQueryKey);
              void request.catch(() => {
                // error state is already managed in store
              });
            }}
            disabled={!projectSelectionReady || dateBounds.error !== null || waitingForStatsQuery}
            aria-label="刷新统计"
            size="sm"
          >
            <RefreshCw size={12} className={loadingStats ? "animate-spin" : ""} />
            刷新
          </Button>

          <div className="ml-auto text-[12px] font-medium text-text-secondary">
            来源：{sourceLabel} ｜ 范围：{dateRangeLabel}
          </div>
          {dateBounds.error && <div className="w-full text-[12px] font-medium text-danger">{dateBounds.error}</div>}
          {statsProjectOptionsError && (
            <div className="w-full text-[12px] font-medium text-danger">项目选项加载失败：{statsProjectOptionsError}</div>
          )}
          <div className="w-full text-[12px] font-medium text-text-secondary">最近刷新：{waitingForStatsQuery ? "-" : formatDateTime(statsUpdatedAt)}</div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {(waitingForStatsQuery || (loadingStats && !stats)) && <StatsSkeleton />}

          {!waitingForStatsQuery && !loadingStats && statsError && (
            <Card className="bg-bg-secondary p-3 text-[12px] text-danger space-y-2">
              <div>统计加载失败：{statsError}</div>
              <Button
                onClick={() => {
                  if (dateBounds.error) return;
                  if (dateBounds.startAt === null || dateBounds.endAt === null) return;
                  const request = loadStats({
                    projectKey: projectKey || null,
                    startAt: dateBounds.startAt,
                    endAt: dateBounds.endAt,
                    force: true,
                  });
                  setRequestedStatsQueryKey(statsQueryKey);
                  void request.catch(() => {
                    // error state is already managed in store
                  });
                }}
                disabled={dateBounds.error !== null}
                size="sm"
              >
                <RefreshCw size={12} />
                重试
              </Button>
            </Card>
          )}

          {!waitingForStatsQuery && stats && (
            <>
              {loadingStats && (
                <div className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                  正在更新统计...
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Card className="ui-stats-metric-card bg-bg-secondary p-3">
                  <div className="text-[12px] font-medium text-text-muted">会话数</div>
                  <div className="ui-stats-metric-value mt-1 text-[20px] font-semibold text-text-primary">{formatCount(stats.total_sessions)}</div>
                </Card>
                <Card className="ui-stats-metric-card bg-bg-secondary p-3">
                  <div className="text-[12px] font-medium text-text-muted">消息数</div>
                  <div className="ui-stats-metric-value mt-1 text-[20px] font-semibold text-text-primary">{formatCount(stats.total_messages)}</div>
                </Card>
                <Card className="ui-stats-metric-card bg-bg-secondary p-3">
                  <div className="text-[12px] font-medium text-text-muted">输入 Token</div>
                  <div className="ui-stats-metric-value mt-1 text-[20px] font-semibold text-text-primary">{formatCount(stats.total_input_tokens)}</div>
                </Card>
                <Card className="ui-stats-metric-card bg-bg-secondary p-3">
                  <div className="text-[12px] font-medium text-text-muted">输出 Token</div>
                  <div className="ui-stats-metric-value mt-1 text-[20px] font-semibold text-text-primary">{formatCount(stats.total_output_tokens)}</div>
                </Card>
              </div>

              <Card className="bg-bg-secondary p-4">
                <div className="mb-2 text-[13px] font-semibold text-text-primary">统计口径说明</div>
                <div className="space-y-1.5 text-[12px] leading-6 text-text-secondary">
                  <div>会话数/消息数：按当前来源、项目与时间范围过滤后聚合。</div>
                  <div>Token：来自历史日志 `usage` 字段汇总（缺失 usage 的消息按 0 计）。</div>
                  <div>当前口径：来源 {sourceLabel}，项目 {projectLabel}，时间 {dateRangeLabel}。</div>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <StatsTrendChart
                    days={stats.heatmap}
                    selectedDayStart={selectedDayStart}
                    onSelectDay={(day) => setSelectedDayStart(day.day_start_utc)}
                  />
                </div>
                <StatsTokenDonut
                  inputTokens={stats.total_input_tokens}
                  outputTokens={stats.total_output_tokens}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <StatsProjectBar
                  items={stats.project_ranking}
                  selectedProjectKey={projectKey}
                  onSelectProject={(nextProjectKey) => {
                    setProjectSelectionTouched(true);
                    setProjectKey((prev) => (prev === nextProjectKey ? "" : nextProjectKey));
                  }}
                  onClearProject={() => {
                    setProjectSelectionTouched(true);
                    setProjectKey("");
                  }}
                />

                <StatsModelComposition items={stats.model_distribution} />
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <StatsTokenTrendChart items={stats.daily_series} />
                <StatsSourceComparisonChart items={stats.source_distribution} />
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <StatsProjectEfficiencyScatter items={stats.project_efficiency} />
                <StatsHourlyActivityChart items={stats.hourly_activity} />
              </div>

              <TimelineHeatmap
                days={stats.heatmap}
                selectedDayStart={selectedDayStart}
                onSelectDay={(day) => setSelectedDayStart(day.day_start_utc)}
              />

              <Card className="bg-bg-secondary p-4">
                <div className="mb-2 text-[13px] font-semibold text-text-primary">
                  {selectedDay ? `${formatDay(selectedDay.day_start_utc)} 会话` : "选择热力图日期查看会话"}
                </div>
                {!selectedDay && (
                  <div className="text-[12px] font-medium text-text-muted">点击上方热力图方块后，这里会展示当天会话清单</div>
                )}
                {selectedDay && selectedDay.session_refs.length === 0 && (
                  <div className="text-[12px] font-medium text-text-muted">当天无会话</div>
                )}

                {visibleDaySessions.map((session) => (
                  <button
                    key={makeSessionKey(session)}
                    onClick={() => {
                      void onOpenSession(makeSessionKey(session)).then(() => onClose());
                    }}
                    className="ui-list-row w-full border-b border-border py-2 text-left last:border-b-0"
                  >
                    <div className="truncate text-[13px] font-semibold text-text-primary">{session.title}</div>
                    <div className="ui-dev-label mt-0.5 text-[11px] text-text-muted">
                      {session.source} · {session.project_key} · {session.message_count} 条消息
                    </div>
                  </button>
                ))}

                {selectedDay && dayVisibleCount < selectedDay.session_refs.length && (
                  <Button onClick={() => setDayVisibleCount((prev) => prev + DAY_SESSION_PAGE_SIZE)} className="mt-2 w-full" size="sm">
                    加载更多 ({dayVisibleCount}/{selectedDay.session_refs.length})
                  </Button>
                )}
              </Card>
            </>
          )}
        </div>
      </Card>
    </div>
    </Portal>
  );
}
