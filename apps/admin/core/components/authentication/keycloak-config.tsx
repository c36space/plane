import { observer } from "mobx-react";
import Link from "next/link";
import { Settings2, Shield } from "lucide-react";
// plane internal packages
import { getButtonStyling } from "@plane/propel/button";
import type { TInstanceAuthenticationMethodKeys } from "@plane/types";
import { ToggleSwitch } from "@plane/ui";
import { cn } from "@plane/utils";
// hooks
import { useInstance } from "@/hooks/store";

type Props = {
  disabled: boolean;
  updateConfig: (key: TInstanceAuthenticationMethodKeys, value: string) => void;
};

export const KeycloakConfiguration = observer(function KeycloakConfiguration(props: Props) {
  const { disabled, updateConfig } = props;

  // store
  const { formattedConfig } = useInstance();

  // derived values
  const enableKeycloakConfig = formattedConfig?.IS_KEYCLOAK_ENABLED ?? "";

  const isKeycloakConfigured =
    !!formattedConfig?.KEYCLOAK_CLIENT_ID &&
    !!formattedConfig?.KEYCLOAK_CLIENT_SECRET &&
    !!formattedConfig?.KEYCLOAK_BASE_URL;

  return (
    <div className="flex items-center gap-4">
      {isKeycloakConfigured ? (
        <>
          <Link
            href="/authentication/keycloak"
            className={cn(getButtonStyling("link", "base"), "font-medium flex items-center gap-2 text-sm")}
          >
            <Shield className="h-3 w-3" />
            Edit
          </Link>
          <ToggleSwitch
            value={Boolean(parseInt(enableKeycloakConfig))}
            onChange={() => {
              const newEnableKeycloakConfig = parseInt(enableKeycloakConfig) ? "0" : "1";
              updateConfig("IS_KEYCLOAK_ENABLED", newEnableKeycloakConfig);
            }}
            size="sm"
            disabled={disabled}
          />
        </>
      ) : (
        <Link
          href="/authentication/keycloak"
          className={cn(
            getButtonStyling("secondary", "base"), // Changed from "secondary-neutral" to "secondary"
            "text-tertiary flex items-center gap-2 text-sm"
          )}
        >
          <Settings2 className="h-3 w-3" />
          Configure
        </Link>
      )}
    </div>
  );
});
