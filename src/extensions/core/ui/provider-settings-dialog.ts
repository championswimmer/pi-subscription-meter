import { DynamicBorder, type Theme, getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { SubscriptionProviderDefinition, SubscriptionProviderId } from "../providers/index.ts";
import type { SubscriptionResetTimeDisplayMode, SubscriptionUsageDisplayMode } from "../settings.ts";

const DISPLAY_MODE_SETTING_ID = "__display_mode__";
const RESET_TIME_DISPLAY_MODE_SETTING_ID = "__reset_time_display_mode__";
const THRESHOLD_NOTCHES_SETTING_ID = "__threshold_notches__";
const NOW_NOTCH_SETTING_ID = "__now_notch__";

interface ProviderSettingsDialogOptions {
  theme: Theme;
  providers: SubscriptionProviderDefinition[];
  enabledProviderIds: SubscriptionProviderId[];
  displayMode: SubscriptionUsageDisplayMode;
  resetTimeDisplayMode: SubscriptionResetTimeDisplayMode;
  showThresholdNotches: boolean;
  showNowNotch: boolean;
  onEnabledProvidersChange: (enabledProviderIds: SubscriptionProviderId[]) => void;
  onDisplayModeChange: (displayMode: SubscriptionUsageDisplayMode) => void;
  onResetTimeDisplayModeChange: (resetTimeDisplayMode: SubscriptionResetTimeDisplayMode) => void;
  onShowThresholdNotchesChange: (showThresholdNotches: boolean) => void;
  onShowNowNotchChange: (showNowNotch: boolean) => void;
  onClose: () => void;
}

export class ProviderSettingsDialog {
  private readonly container: Container;
  private readonly settingsList: SettingsList;
  private readonly providers: SubscriptionProviderDefinition[];
  private readonly theme: Theme;
  private enabledProviderIds: Set<SubscriptionProviderId>;
  private displayMode: SubscriptionUsageDisplayMode;
  private resetTimeDisplayMode: SubscriptionResetTimeDisplayMode;
  private showThresholdNotches: boolean;
  private showNowNotch: boolean;
  private readonly onEnabledProvidersChange: (enabledProviderIds: SubscriptionProviderId[]) => void;
  private readonly onDisplayModeChange: (displayMode: SubscriptionUsageDisplayMode) => void;
  private readonly onResetTimeDisplayModeChange: (resetTimeDisplayMode: SubscriptionResetTimeDisplayMode) => void;
  private readonly onShowThresholdNotchesChange: (showThresholdNotches: boolean) => void;
  private readonly onShowNowNotchChange: (showNowNotch: boolean) => void;

  constructor(options: ProviderSettingsDialogOptions) {
    this.providers = options.providers;
    this.theme = options.theme;
    this.enabledProviderIds = new Set(options.enabledProviderIds);
    this.displayMode = options.displayMode;
    this.resetTimeDisplayMode = options.resetTimeDisplayMode;
    this.showThresholdNotches = options.showThresholdNotches;
    this.showNowNotch = options.showNowNotch;
    this.onEnabledProvidersChange = options.onEnabledProvidersChange;
    this.onDisplayModeChange = options.onDisplayModeChange;
    this.onResetTimeDisplayModeChange = options.onResetTimeDisplayModeChange;
    this.onShowThresholdNotchesChange = options.onShowThresholdNotchesChange;
    this.onShowNowNotchChange = options.onShowNowNotchChange;

    const items: SettingItem[] = [
      {
        id: DISPLAY_MODE_SETTING_ID,
        label: "Display mode",
        currentValue: this.displayMode,
        values: ["used", "remaining"],
      },
      {
        id: RESET_TIME_DISPLAY_MODE_SETTING_ID,
        label: "Reset time",
        currentValue: this.resetTimeDisplayMode,
        values: ["relative", "absolute"],
      },
      {
        id: THRESHOLD_NOTCHES_SETTING_ID,
        label: "50/75 marks",
        currentValue: this.showThresholdNotches ? "shown" : "hidden",
        values: ["shown", "hidden"],
      },
      {
        id: NOW_NOTCH_SETTING_ID,
        label: "Now mark",
        currentValue: this.showNowNotch ? "shown" : "hidden",
        values: ["shown", "hidden"],
      },
      ...this.providers.map((provider) => ({
        id: provider.id,
        label: provider.label,
        currentValue: this.enabledProviderIds.has(provider.id) ? "enabled" : "disabled",
        values: ["enabled", "disabled"],
      })),
    ];

    this.container = new Container();
    this.container.addChild(new DynamicBorder((text) => options.theme.fg("accent", text)));
    this.container.addChild(new Text(options.theme.fg("accent", options.theme.bold("Subscription Settings"))));
    this.container.addChild(
      new Text(options.theme.fg("muted", "Choose bar semantics, reset-time format, notch visibility, and which provider tabs appear.")),
    );

    this.settingsList = new SettingsList(
      items,
      Math.min(items.length + 2, 15),
      getSettingsListTheme(),
      (id, newValue) => {
        if (id === DISPLAY_MODE_SETTING_ID) {
          this.displayMode = newValue as SubscriptionUsageDisplayMode;
          this.onDisplayModeChange(this.displayMode);
          return;
        }

        if (id === RESET_TIME_DISPLAY_MODE_SETTING_ID) {
          this.resetTimeDisplayMode = newValue as SubscriptionResetTimeDisplayMode;
          this.onResetTimeDisplayModeChange(this.resetTimeDisplayMode);
          return;
        }

        if (id === THRESHOLD_NOTCHES_SETTING_ID) {
          this.showThresholdNotches = newValue === "shown";
          this.onShowThresholdNotchesChange(this.showThresholdNotches);
          return;
        }

        if (id === NOW_NOTCH_SETTING_ID) {
          this.showNowNotch = newValue === "shown";
          this.onShowNowNotchChange(this.showNowNotch);
          return;
        }

        if (newValue === "enabled") {
          this.enabledProviderIds.add(id as SubscriptionProviderId);
        } else {
          this.enabledProviderIds.delete(id as SubscriptionProviderId);
        }

        this.onEnabledProvidersChange(this.getEnabledProviderIds());
      },
      options.onClose,
      { enableSearch: true },
    );

    this.container.addChild(this.settingsList);
    this.container.addChild(
      new Text(options.theme.fg("dim", "↑↓ navigate • / search • esc close")),
    );
    this.container.addChild(new DynamicBorder((text) => options.theme.fg("accent", text)));
  }

  getEnabledProviderIds(): SubscriptionProviderId[] {
    return this.providers
      .map((provider) => provider.id)
      .filter((providerId) => this.enabledProviderIds.has(providerId));
  }

  render(width: number): string[] {
    const innerWidth = Math.max(10, width - 2);
    const rendered = this.container.render(innerWidth);

    if (rendered.length === 0) {
      return [];
    }

    return rendered.map((line, index) => {
      if (index === 0) {
        return this.renderBorderLine("┌", "┐", innerWidth);
      }

      if (index === rendered.length - 1) {
        return this.renderBorderLine("└", "┘", innerWidth);
      }

      const truncated = truncateToWidth(line, innerWidth, "");
      const padding = " ".repeat(Math.max(0, innerWidth - visibleWidth(truncated)));
      return `${this.renderSideBorder()}${truncated}${padding}${this.renderSideBorder()}`;
    });
  }

  private renderBorderLine(left: string, right: string, innerWidth: number): string {
    return this.theme.fg("accent", `${left}${"─".repeat(innerWidth)}${right}`);
  }

  private renderSideBorder(): string {
    return this.theme.fg("accent", "│");
  }

  invalidate(): void {
    this.container.invalidate();
  }

  handleInput(data: string): void {
    this.settingsList.handleInput?.(data);
  }
}
