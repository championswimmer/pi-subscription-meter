import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createDefaultSubscriptionProviderRegistry, type SubscriptionProviderId } from "./providers/index.ts";
import { loadSubscriptionMeterSettings, saveSubscriptionMeterSettings } from "./settings.ts";
import { ProviderSettingsDialog } from "./ui/provider-settings-dialog.ts";
import { SubscriptionsDialog } from "./ui/subscriptions-dialog.ts";

export default function (pi: ExtensionAPI) {
  const providerRegistry = createDefaultSubscriptionProviderRegistry();

  pi.registerCommand("subscriptions", {
    description: "Show subscription providers in a tabbed dialog",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/subscriptions requires TUI mode", "error");
        return;
      }

      providerRegistry.setEnabledProviders(loadSubscriptionMeterSettings().enabledProviders);

      let dialog: SubscriptionsDialog | undefined;
      let settingsOverlayOpen = false;

      await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
        const applyEnabledProviders = (enabledProviderIds: SubscriptionProviderId[]) => {
          try {
            const savedSettings = saveSubscriptionMeterSettings({
              version: 1,
              enabledProviders: enabledProviderIds,
            });

            providerRegistry.setEnabledProviders(savedSettings.enabledProviders);
            dialog?.setProviders(providerRegistry.getEnabledProviders());
            tui.requestRender();
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            ctx.ui.notify(`Failed to save subscription settings: ${message}`, "error");
          }
        };

        const openSettings = () => {
          if (settingsOverlayOpen) {
            return;
          }

          settingsOverlayOpen = true;

          void ctx.ui
            .custom<void>(
              (overlayTui, overlayTheme, _overlayKeybindings, overlayDone) => {
                const settingsDialog = new ProviderSettingsDialog({
                  theme: overlayTheme,
                  providers: providerRegistry.getAllProviders(),
                  enabledProviderIds: providerRegistry.getEnabledProviders().map((provider) => provider.id),
                  onEnabledProvidersChange: (enabledProviderIds) => {
                    applyEnabledProviders(enabledProviderIds);
                    overlayTui.requestRender();
                  },
                  onClose: () => overlayDone(undefined),
                });

                return {
                  render(width: number) {
                    return settingsDialog.render(width);
                  },
                  invalidate() {
                    settingsDialog.invalidate();
                  },
                  handleInput(data: string) {
                    settingsDialog.handleInput(data);
                    overlayTui.requestRender();
                  },
                };
              },
              {
                overlay: true,
                overlayOptions: {
                  width: "70%",
                  minWidth: 60,
                  maxHeight: "80%",
                  anchor: "center",
                  margin: 2,
                },
              },
            )
            .catch((error: unknown) => {
              const message = error instanceof Error ? error.message : String(error);
              ctx.ui.notify(`Failed to open subscription settings: ${message}`, "error");
            })
            .finally(() => {
              settingsOverlayOpen = false;
              dialog?.invalidate();
              tui.requestRender();
            });
        };

        dialog = new SubscriptionsDialog({
          providers: providerRegistry.getEnabledProviders(),
          theme,
          onClose: () => done(undefined),
          onOpenSettings: openSettings,
        });

        return {
          render(width: number) {
            return dialog?.render(width) ?? [];
          },
          invalidate() {
            dialog?.invalidate();
          },
          handleInput(data: string) {
            dialog?.handleInput(data);
            tui.requestRender();
          },
        };
      });
    },
  });
}
