import type { Theme } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type {
  SubscriptionProviderDefinition,
  SubscriptionProviderId,
  SubscriptionProviderRuntimeState,
  SubscriptionUsageWindowDefinition,
} from "../providers/index.ts";
import type { SubscriptionResetTimeDisplayMode, SubscriptionUsageDisplayMode } from "../settings.ts";
import { renderProgressBar } from "./progress-bar.ts";

interface SubscriptionsDialogOptions {
  providers: SubscriptionProviderDefinition[];
  displayMode: SubscriptionUsageDisplayMode;
  resetTimeDisplayMode: SubscriptionResetTimeDisplayMode;
  showThresholdNotches: boolean;
  showNowNotch: boolean;
  theme: Theme;
  onClose: () => void;
  onOpenSettings: () => void;
  requestRender: () => void;
}

function pad2(value: number): string {
  return String(Math.max(0, value)).padStart(2, "0");
}

function formatRelativeResetTime(resetAt: Date): string {
  const totalSeconds = Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1000));

  if (totalSeconds >= 24 * 60 * 60) {
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    return `${days}d ${pad2(hours)}h`;
  }

  if (totalSeconds >= 60 * 60) {
    const hours = Math.floor(totalSeconds / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    return `${pad2(hours)}h ${pad2(minutes)}m`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(minutes)}m ${pad2(seconds)}s`;
}

function formatAbsoluteResetTime(resetAt: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(resetAt);
}

function formatResetDetail(resetAt: Date, mode: SubscriptionResetTimeDisplayMode): string {
  return mode === "absolute"
    ? `Resets ${formatAbsoluteResetTime(resetAt)}`
    : `Resets in ${formatRelativeResetTime(resetAt)}`;
}

function projectPercentForDisplayMode(percent: number, displayMode: SubscriptionUsageDisplayMode): number {
  return displayMode === "remaining" ? Math.max(0, 100 - percent) : percent;
}

function getThresholdNotches(
  notches: number[] | undefined,
  displayMode: SubscriptionUsageDisplayMode,
): number[] {
  if (!notches?.length) {
    return [];
  }

  return [...new Set(
    notches
      .filter((notch) => notch === 50 || notch === 75)
      .map((notch) => projectPercentForDisplayMode(notch, displayMode)),
  )];
}

function getNowMarkerColor(
  usedPercent: number | undefined,
  pacePercent: number | undefined,
): Parameters<Theme["fg"]>[0] {
  if (usedPercent == null || pacePercent == null) {
    return "accent";
  }

  const delta = usedPercent - pacePercent;
  if (delta > 1) {
    return "error";
  }
  if (delta < -1) {
    return "success";
  }
  return "accent";
}

export class SubscriptionsDialog {
  private providers: SubscriptionProviderDefinition[];
  private readonly theme: Theme;
  private readonly onClose: () => void;
  private readonly onOpenSettings: () => void;
  private readonly requestRender: () => void;
  private displayMode: SubscriptionUsageDisplayMode;
  private resetTimeDisplayMode: SubscriptionResetTimeDisplayMode;
  private showThresholdNotches: boolean;
  private showNowNotch: boolean;
  private activeIndex = 0;
  private cachedWidth?: number;
  private cachedLines?: string[];
  private readonly runtimeStates = new Map<SubscriptionProviderId, SubscriptionProviderRuntimeState>();
  private readonly loadingProviders = new Set<SubscriptionProviderId>();
  private liveUpdateTicker?: ReturnType<typeof setInterval>;

  constructor(options: SubscriptionsDialogOptions) {
    this.providers = options.providers;
    this.theme = options.theme;
    this.onClose = options.onClose;
    this.onOpenSettings = options.onOpenSettings;
    this.requestRender = options.requestRender;
    this.displayMode = options.displayMode;
    this.resetTimeDisplayMode = options.resetTimeDisplayMode;
    this.showThresholdNotches = options.showThresholdNotches;
    this.showNowNotch = options.showNowNotch;
    this.syncLiveUpdateTicker();
    this.ensureActiveProviderLoaded();
  }

  setProviders(providers: SubscriptionProviderDefinition[]): void {
    this.providers = [...providers];
    if (this.providers.length === 0) {
      this.activeIndex = 0;
    } else if (this.activeIndex >= this.providers.length) {
      this.activeIndex = this.providers.length - 1;
    }
    this.syncLiveUpdateTicker();
    this.invalidate();
    this.ensureActiveProviderLoaded();
  }

  setDisplayMode(displayMode: SubscriptionUsageDisplayMode): void {
    this.displayMode = displayMode;
    this.invalidate();
  }

  setResetTimeDisplayMode(resetTimeDisplayMode: SubscriptionResetTimeDisplayMode): void {
    this.resetTimeDisplayMode = resetTimeDisplayMode;
    this.syncLiveUpdateTicker();
    this.invalidate();
  }

  setShowThresholdNotches(showThresholdNotches: boolean): void {
    this.showThresholdNotches = showThresholdNotches;
    this.invalidate();
  }

  setShowNowNotch(showNowNotch: boolean): void {
    this.showNowNotch = showNowNotch;
    this.syncLiveUpdateTicker();
    this.invalidate();
  }

  dispose(): void {
    if (this.liveUpdateTicker) {
      clearInterval(this.liveUpdateTicker);
      this.liveUpdateTicker = undefined;
    }
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, "q") || matchesKey(data, Key.ctrl("c"))) {
      this.onClose();
      return;
    }

    if (matchesKey(data, "s")) {
      this.onOpenSettings();
      return;
    }

    if (matchesKey(data, "r")) {
      this.refreshActiveProvider();
      return;
    }

    if (this.providers.length === 0) {
      return;
    }

    if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
      this.activeIndex = (this.activeIndex + 1) % this.providers.length;
      this.invalidate();
      this.ensureActiveProviderLoaded();
      return;
    }

    if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
      this.activeIndex = (this.activeIndex - 1 + this.providers.length) % this.providers.length;
      this.invalidate();
      this.ensureActiveProviderLoaded();
      return;
    }

    if (matchesKey(data, Key.home)) {
      this.activeIndex = 0;
      this.invalidate();
      this.ensureActiveProviderLoaded();
      return;
    }

    if (matchesKey(data, Key.end)) {
      this.activeIndex = this.providers.length - 1;
      this.invalidate();
      this.ensureActiveProviderLoaded();
    }
  }

  private syncLiveUpdateTicker(): void {
    const needsLiveUpdates = this.resetTimeDisplayMode === "relative" || this.showNowNotch;

    if (!needsLiveUpdates) {
      if (this.liveUpdateTicker) {
        clearInterval(this.liveUpdateTicker);
        this.liveUpdateTicker = undefined;
      }
      return;
    }

    if (this.liveUpdateTicker) {
      return;
    }

    this.liveUpdateTicker = setInterval(() => {
      this.invalidate();
      this.requestRender();
    }, 1000);
  }

  private ensureActiveProviderLoaded(force = false): void {
    const activeProvider = this.providers[this.activeIndex];
    if (!activeProvider?.loadRuntimeState) {
      return;
    }

    if (!force && (this.runtimeStates.has(activeProvider.id) || this.loadingProviders.has(activeProvider.id))) {
      return;
    }

    this.loadingProviders.add(activeProvider.id);
    this.runtimeStates.set(activeProvider.id, {
      state: "loading",
      implementationStatus: activeProvider.implementationStatus,
      statusLine: "loading live data",
      description: activeProvider.description,
      notes: activeProvider.notes,
      usageWindows: activeProvider.usageWindows,
    });
    this.invalidate();
    this.requestRender();

    void activeProvider
      .loadRuntimeState()
      .then((state) => {
        this.runtimeStates.set(activeProvider.id, state);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.runtimeStates.set(activeProvider.id, {
          state: "error",
          implementationStatus: activeProvider.implementationStatus,
          statusLine: "fetch failed",
          description: activeProvider.description,
          notes: activeProvider.notes,
          usageWindows: activeProvider.usageWindows,
          errorMessage: message,
        });
      })
      .finally(() => {
        this.loadingProviders.delete(activeProvider.id);
        this.invalidate();
        this.requestRender();
      });
  }

  private refreshActiveProvider(): void {
    const activeProvider = this.providers[this.activeIndex];
    if (!activeProvider?.loadRuntimeState) {
      return;
    }

    this.runtimeStates.delete(activeProvider.id);
    this.loadingProviders.delete(activeProvider.id);
    this.ensureActiveProviderLoaded(true);
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines: string[] = [];
    const totalWidth = Math.max(36, Math.min(96, width));
    const contentWidth = Math.max(10, totalWidth - 2);
    const leftPadding = " ".repeat(Math.max(0, Math.floor((width - totalWidth) / 2)));

    const padLine = (value: string) => {
      const truncated = truncateToWidth(value, contentWidth, "");
      return `${truncated}${" ".repeat(Math.max(0, contentWidth - visibleWidth(truncated)))}`;
    };

    const addBorder = (left: string, fill: string, right: string) => {
      lines.push(`${leftPadding}${this.theme.fg("accent", `${left}${fill.repeat(contentWidth)}${right}`)}`);
    };

    const addContentLine = (value = "") => {
      lines.push(
        `${leftPadding}${this.theme.fg("accent", "│")}${padLine(value)}${this.theme.fg("accent", "│")}`,
      );
    };

    const addWrappedBlock = (value: string, indent = "") => {
      const availableWidth = Math.max(1, contentWidth - visibleWidth(indent));
      for (const wrapped of wrapTextWithAnsi(value, availableWidth)) {
        addContentLine(`${indent}${wrapped}`);
      }
    };

    const addCompactLine = (left: string, right: string) => {
      const truncatedLeft = truncateToWidth(left, Math.max(1, contentWidth - visibleWidth(right) - 1), "…");
      const spacing = " ".repeat(Math.max(1, contentWidth - visibleWidth(truncatedLeft) - visibleWidth(right)));
      addContentLine(`${truncatedLeft}${spacing}${right}`);
    };

    const addBlankLine = () => addContentLine();

    const usageTone = (percent: number | undefined, mode: SubscriptionUsageDisplayMode): Parameters<Theme["fg"]>[0] => {
      if (percent == null) return "accent";
      if (mode === "remaining") {
        if (percent <= 10) return "error";
        if (percent <= 25) return "warning";
        return "success";
      }
      if (percent >= 90) return "error";
      if (percent >= 75) return "warning";
      return "success";
    };

    const formatStatusLine = (provider: SubscriptionProviderDefinition, runtimeState?: SubscriptionProviderRuntimeState) => {
      const parts = [runtimeState?.implementationStatus ?? provider.implementationStatus, `${provider.stability} source`];

      if (runtimeState?.state === "loading") {
        parts.push(runtimeState.statusLine ?? "loading live data");
      } else if (runtimeState?.state === "ready") {
        parts.push(runtimeState.statusLine ?? "live data");
      } else if (runtimeState?.state === "error") {
        parts.push(runtimeState.statusLine ?? "live fetch failed");
      } else if (provider.loadRuntimeState) {
        parts.push("live fetch available");
      } else {
        parts.push("live fetch pending");
      }

      return parts.join(" • ");
    };

    const getUsageWindows = (
      provider: SubscriptionProviderDefinition,
      runtimeState?: SubscriptionProviderRuntimeState,
    ): SubscriptionUsageWindowDefinition[] => {
      if (runtimeState?.usageWindows && runtimeState.usageWindows.length > 0) {
        return runtimeState.usageWindows;
      }
      return provider.usageWindows;
    };

    addBorder("┌", "─", "┐");
    addContentLine(this.theme.fg("accent", this.theme.bold(" Subscriptions")));

    const subtitle =
      this.providers.length > 0
        ? this.theme.fg(
            "muted",
            ` ${this.providers.length} provider tab(s) • ${this.displayMode} • reset ${this.resetTimeDisplayMode}`,
          )
        : this.theme.fg("warning", " No providers enabled");
    addContentLine(subtitle);
    addBlankLine();

    if (this.providers.length > 0) {
      const tabTokens = this.providers.map((provider, index) => {
        const tabText = ` ${provider.shortLabel} `;
        if (index === this.activeIndex) {
          return this.theme.bg("selectedBg", this.theme.fg("text", tabText));
        }
        return this.theme.fg("muted", tabText);
      });

      addWrappedBlock(tabTokens.join(" "));
      addBlankLine();

      const activeProvider = this.providers[this.activeIndex];
      const runtimeState = this.runtimeStates.get(activeProvider.id);
      const usageWindows = getUsageWindows(activeProvider, runtimeState);
      const statusLine = formatStatusLine(activeProvider, runtimeState);

      addWrappedBlock(this.theme.fg("accent", this.theme.bold(activeProvider.label)));
      addWrappedBlock(this.theme.fg("muted", statusLine));

      if (runtimeState?.lastUpdatedAt instanceof Date) {
        addWrappedBlock(
          this.theme.fg("dim", `Updated ${runtimeState.lastUpdatedAt.toLocaleTimeString()}`),
        );
      }

      addBlankLine();

      if (runtimeState?.state === "loading") {
        addWrappedBlock(this.theme.fg("warning", "Fetching latest provider data…"));
        addBlankLine();
      }

      if (runtimeState?.state === "error" && runtimeState.errorMessage) {
        addWrappedBlock(this.theme.fg("error", runtimeState.errorMessage));
        addBlankLine();
      }

      if (usageWindows.length > 0) {
        const barWidth = contentWidth >= 80 ? 60 : contentWidth >= 56 ? 40 : 20;

        for (const usageWindow of usageWindows) {
          const displayPercent = usageWindow.usedPercent == null
            ? undefined
            : projectPercentForDisplayMode(usageWindow.usedPercent, this.displayMode);
          const thresholdNotches = this.showThresholdNotches
            ? getThresholdNotches(usageWindow.notches, this.displayMode)
            : [];
          const timelineNotch = this.showNowNotch && usageWindow.pacePercent != null
            ? projectPercentForDisplayMode(usageWindow.pacePercent, this.displayMode)
            : undefined;
          const tone = usageTone(displayPercent, this.displayMode);
          const nowMarkerColor = getNowMarkerColor(usageWindow.usedPercent, usageWindow.pacePercent);
          const statusText = displayPercent == null
            ? this.theme.fg(tone, usageWindow.statusLabel ?? "pending")
            : this.theme.fg(
                tone,
                this.displayMode === "remaining"
                  ? `${Math.round(displayPercent)}% left`
                  : `${Math.round(displayPercent)}% used`,
              );

          addCompactLine(this.theme.fg("text", usageWindow.label), statusText);
          addContentLine(` ${renderProgressBar(this.theme, {
            width: barWidth,
            usedPercent: displayPercent ?? 0,
            notches: thresholdNotches,
            markerNotches: timelineNotch == null ? undefined : [timelineNotch],
            filledColor: tone,
            emptyColor: "dim",
            notchColor: "muted",
            markerColor: nowMarkerColor,
          })}`);

          if (usageWindow.detailLabel) {
            addWrappedBlock(this.theme.fg("dim", usageWindow.detailLabel), " ");
          }

          if (usageWindow.resetAt instanceof Date) {
            addWrappedBlock(
              this.theme.fg("dim", formatResetDetail(usageWindow.resetAt, this.resetTimeDisplayMode)),
              " ",
            );
          }

          addBlankLine();
        }
      } else {
        addWrappedBlock(this.theme.fg("warning", "No usage windows configured for this provider yet."));
        addBlankLine();
      }

    } else {
      addWrappedBlock(
        this.theme.fg(
          "warning",
          "No providers are currently enabled. Press s to open provider settings and enable one or more subscription tabs.",
        ),
      );
      addBlankLine();
    }

    addWrappedBlock(this.theme.fg("dim", "/subscriptions close • s settings"));
    addContentLine(this.theme.fg("dim", "Tab/←→ switch • r refresh • Esc close"));
    addBorder("└", "─", "┘");

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
