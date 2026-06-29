import type { Theme } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { SubscriptionProviderDefinition } from "../providers/index.ts";

interface SubscriptionsDialogOptions {
  providers: SubscriptionProviderDefinition[];
  theme: Theme;
  onClose: () => void;
}

export class SubscriptionsDialog {
  private readonly providers: SubscriptionProviderDefinition[];
  private readonly theme: Theme;
  private readonly onClose: () => void;
  private activeIndex = 0;
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(options: SubscriptionsDialogOptions) {
    this.providers = options.providers;
    this.theme = options.theme;
    this.onClose = options.onClose;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, "q") || matchesKey(data, Key.ctrl("c"))) {
      this.onClose();
      return;
    }

    if (this.providers.length === 0) {
      return;
    }

    if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
      this.activeIndex = (this.activeIndex + 1) % this.providers.length;
      this.invalidate();
      return;
    }

    if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
      this.activeIndex = (this.activeIndex - 1 + this.providers.length) % this.providers.length;
      this.invalidate();
      return;
    }

    if (matchesKey(data, Key.home)) {
      this.activeIndex = 0;
      this.invalidate();
      return;
    }

    if (matchesKey(data, Key.end)) {
      this.activeIndex = this.providers.length - 1;
      this.invalidate();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines: string[] = [];
    const safeWidth = Math.max(40, width);
    const innerWidth = Math.max(10, safeWidth - 2);
    const contentWidth = Math.max(10, innerWidth - 2);

    const padLine = (value: string) => {
      const truncated = truncateToWidth(value, contentWidth, "");
      return `${truncated}${" ".repeat(Math.max(0, contentWidth - visibleWidth(truncated)))}`;
    };

    const addBorder = (left: string, fill: string, right: string) => {
      lines.push(this.theme.fg("accent", `${left}${fill.repeat(innerWidth)}${right}`));
    };

    const addContentLine = (value = "") => {
      lines.push(
        `${this.theme.fg("accent", "│")}${padLine(value)}${this.theme.fg("accent", "│")}`,
      );
    };

    const addWrappedBlock = (value: string, indent = "") => {
      const availableWidth = Math.max(1, contentWidth - visibleWidth(indent));
      for (const wrapped of wrapTextWithAnsi(value, availableWidth)) {
        addContentLine(`${indent}${wrapped}`);
      }
    };

    const addBlankLine = () => addContentLine();

    addBorder("┌", "─", "┐");
    addContentLine(this.theme.fg("accent", this.theme.bold(" Subscriptions")));

    const subtitle =
      this.providers.length > 0
        ? this.theme.fg("muted", ` ${this.providers.length} enabled provider tab(s)`) 
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
      const stabilityColor =
        activeProvider.stability === "official"
          ? "success"
          : activeProvider.stability === "mixed"
            ? "warning"
            : activeProvider.stability === "unofficial"
              ? "error"
              : "muted";

      addWrappedBlock(this.theme.fg("accent", this.theme.bold(activeProvider.label)));
      addWrappedBlock(this.theme.fg("text", activeProvider.description));
      addBlankLine();
      addWrappedBlock(
        `${this.theme.fg("muted", "Provider ID: ")}${this.theme.fg("text", activeProvider.id)}`,
      );
      addWrappedBlock(
        `${this.theme.fg("muted", "Status: ")}${this.theme.fg("warning", activeProvider.implementationStatus)}`,
      );
      addWrappedBlock(
        `${this.theme.fg("muted", "Stability: ")}${this.theme.fg(stabilityColor, activeProvider.stability)}`,
      );
      addBlankLine();
      addWrappedBlock(this.theme.fg("muted", "Auth"));
      addWrappedBlock(this.theme.fg("text", activeProvider.authHint), "  ");
      addBlankLine();
      addWrappedBlock(this.theme.fg("muted", "Usage source"));
      addWrappedBlock(this.theme.fg("text", activeProvider.usageHint), "  ");
      addBlankLine();
      addWrappedBlock(this.theme.fg("muted", "Notes"));
      for (const note of activeProvider.notes) {
        addWrappedBlock(this.theme.fg("text", note), "  • ");
      }
    } else {
      addWrappedBlock(
        this.theme.fg(
          "warning",
          "No providers are currently enabled. Set PI_SUBSCRIPTION_METER_PROVIDERS to a comma-separated list such as openrouter,anthropic and reload the extension.",
        ),
      );
    }

    addBlankLine();
    addContentLine(this.theme.fg("dim", " Tab/←→ switch • Home/End jump • Esc close"));
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
