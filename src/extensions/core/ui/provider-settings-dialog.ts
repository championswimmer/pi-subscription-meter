import { DynamicBorder, type Theme, getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text } from "@earendil-works/pi-tui";
import type { SubscriptionProviderDefinition, SubscriptionProviderId } from "../providers/index.ts";

interface ProviderSettingsDialogOptions {
  theme: Theme;
  providers: SubscriptionProviderDefinition[];
  enabledProviderIds: SubscriptionProviderId[];
  onEnabledProvidersChange: (enabledProviderIds: SubscriptionProviderId[]) => void;
  onClose: () => void;
}

export class ProviderSettingsDialog {
  private readonly container: Container;
  private readonly settingsList: SettingsList;
  private readonly providers: SubscriptionProviderDefinition[];
  private enabledProviderIds: Set<SubscriptionProviderId>;
  private readonly onEnabledProvidersChange: (enabledProviderIds: SubscriptionProviderId[]) => void;

  constructor(options: ProviderSettingsDialogOptions) {
    this.providers = options.providers;
    this.enabledProviderIds = new Set(options.enabledProviderIds);
    this.onEnabledProvidersChange = options.onEnabledProvidersChange;

    const items: SettingItem[] = this.providers.map((provider) => ({
      id: provider.id,
      label: provider.label,
      currentValue: this.enabledProviderIds.has(provider.id) ? "enabled" : "disabled",
      values: ["enabled", "disabled"],
    }));

    this.container = new Container();
    this.container.addChild(new DynamicBorder((text) => options.theme.fg("accent", text)));
    this.container.addChild(new Text(options.theme.fg("accent", options.theme.bold("Subscription Providers"))));
    this.container.addChild(
      new Text(options.theme.fg("muted", "Toggle providers to control which subscription tabs appear.")),
    );

    this.settingsList = new SettingsList(
      items,
      Math.min(items.length + 2, 15),
      getSettingsListTheme(),
      (id, newValue) => {
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
      new Text(options.theme.fg("dim", "↑↓ navigate • ←→ toggle • / search • esc close")),
    );
    this.container.addChild(new DynamicBorder((text) => options.theme.fg("accent", text)));
  }

  getEnabledProviderIds(): SubscriptionProviderId[] {
    return this.providers
      .map((provider) => provider.id)
      .filter((providerId) => this.enabledProviderIds.has(providerId));
  }

  render(width: number): string[] {
    return this.container.render(width);
  }

  invalidate(): void {
    this.container.invalidate();
  }

  handleInput(data: string): void {
    this.settingsList.handleInput?.(data);
  }
}
