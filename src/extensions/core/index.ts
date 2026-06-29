import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createDefaultSubscriptionProviderRegistry } from "./providers/index.ts";
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

      const enabledProviders = providerRegistry.getEnabledProviders();

      await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
        const dialog = new SubscriptionsDialog({
          providers: enabledProviders,
          theme,
          onClose: () => done(undefined),
        });

        return {
          render(width: number) {
            return dialog.render(width);
          },
          invalidate() {
            dialog.invalidate();
          },
          handleInput(data: string) {
            dialog.handleInput(data);
            tui.requestRender();
          },
        };
      });
    },
  });
}
