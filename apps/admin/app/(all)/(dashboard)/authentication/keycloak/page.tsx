import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { setPromiseToast } from "@plane/propel/toast";
import { Loader, ToggleSwitch } from "@plane/ui";
// assets
import KeycloakLogo from "@/app/assets/logos/keycloak-logo.png?url";
// components
import { AuthenticationMethodCard } from "@/components/authentication/authentication-method-card";
import { PageWrapper } from "@/components/common/page-wrapper";
// hooks
import { useInstance } from "@/hooks/store";
// types
// REMOVED: import type { Route } from "./+types/page";
// local
import { InstanceKeycloakConfigForm } from "./form";

// Remove Route type from component props
const InstanceKeycloakAuthenticationPage = observer(function InstanceKeycloakAuthenticationPage() {
  // store
  const { fetchInstanceConfigurations, formattedConfig, updateInstanceConfigurations } = useInstance();
  // state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // config
  const enableKeycloakConfig = formattedConfig?.IS_KEYCLOAK_ENABLED ?? "";

  useSWR("INSTANCE_CONFIGURATIONS", () => fetchInstanceConfigurations());

  const updateConfig = async (key: "IS_KEYCLOAK_ENABLED", value: string) => {
    setIsSubmitting(true);

    const payload = {
      [key]: value,
    };

    const updateConfigPromise = updateInstanceConfigurations(payload);

    setPromiseToast(updateConfigPromise, {
      loading: "Saving Configuration",
      success: {
        title: "Configuration saved",
        message: () => `Keycloak SSO authentication is now ${value === "1" ? "active" : "disabled"}.`,
      },
      error: {
        title: "Error",
        message: () => "Failed to save configuration",
      },
    });

    await updateConfigPromise
      .then(() => {
        setIsSubmitting(false);
        return undefined;
      })
      .catch((err) => {
        console.error(err);
        setIsSubmitting(false);
      });
  };

  return (
    <PageWrapper
      customHeader={
        <AuthenticationMethodCard
          name="Keycloak SSO"
          description="Allow members to login or sign up to plane with their organization's Keycloak Single Sign-On."
          icon={<img src={KeycloakLogo} height={24} width={24} alt="Keycloak Logo" />}
          config={
            <ToggleSwitch
              value={Boolean(parseInt(enableKeycloakConfig))}
              onChange={() => {
                if (Boolean(parseInt(enableKeycloakConfig)) === true) {
                  void updateConfig("IS_KEYCLOAK_ENABLED", "0");
                } else {
                  void updateConfig("IS_KEYCLOAK_ENABLED", "1");
                }
              }}
              size="sm"
              disabled={isSubmitting || !formattedConfig}
            />
          }
          disabled={isSubmitting || !formattedConfig}
          withBorder={false}
        />
      }
    >
      {formattedConfig ? (
        <InstanceKeycloakConfigForm config={formattedConfig} />
      ) : (
        <Loader className="space-y-8">
          <Loader.Item height="50px" width="25%" />
          <Loader.Item height="50px" />
          <Loader.Item height="50px" />
          <Loader.Item height="50px" />
          <Loader.Item height="50px" width="50%" />
        </Loader>
      )}
    </PageWrapper>
  );
});

// Update meta function to not use Route.MetaFunction
export const meta = () => [{ title: "Keycloak SSO Authentication - Plane" }];

export default InstanceKeycloakAuthenticationPage;
