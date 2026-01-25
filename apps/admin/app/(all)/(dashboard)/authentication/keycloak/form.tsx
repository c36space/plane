import { useState } from "react";
import { isEmpty } from "lodash-es";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Monitor, Shield } from "lucide-react";
// plane internal packages
import { API_BASE_URL } from "@plane/constants";
import { Button, getButtonStyling } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IFormattedInstanceConfiguration } from "@plane/types";
// components
import { CodeBlock } from "@/components/common/code-block";
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";
import type { TControllerInputFormField } from "@/components/common/controller-input";
import type { TControllerSwitchFormField } from "@/components/common/controller-switch";
import { ControllerSwitch } from "@/components/common/controller-switch";
import { ControllerInput } from "@/components/common/controller-input";
import type { TCopyField } from "@/components/common/copy-field";
import { CopyField } from "@/components/common/copy-field";
// hooks
import { useInstance } from "@/hooks/store";

type Props = {
  config: IFormattedInstanceConfiguration;
};

// Define Keycloak configuration keys
type TInstanceKeycloakAuthenticationConfigurationKeys =
  | "IS_KEYCLOAK_ENABLED"
  | "KEYCLOAK_CLIENT_ID"
  | "KEYCLOAK_CLIENT_SECRET"
  | "KEYCLOAK_BASE_URL"
  | "KEYCLOAK_REALM"
  | "ENABLE_KEYCLOAK_SYNC";

type KeycloakConfigFormValues = Record<TInstanceKeycloakAuthenticationConfigurationKeys, string>;

export function InstanceKeycloakConfigForm(props: Props) {
  const { config } = props;
  // states
  const [isDiscardChangesModalOpen, setIsDiscardChangesModalOpen] = useState(false);
  // store hooks
  const { updateInstanceConfigurations } = useInstance();
  // form data
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<KeycloakConfigFormValues>({
    defaultValues: {
      KEYCLOAK_CLIENT_ID: config["KEYCLOAK_CLIENT_ID"] || "",
      KEYCLOAK_CLIENT_SECRET: config["KEYCLOAK_CLIENT_SECRET"] || "",
      KEYCLOAK_BASE_URL: config["KEYCLOAK_BASE_URL"] || "",
      KEYCLOAK_REALM: config["KEYCLOAK_REALM"] || "master",
      ENABLE_KEYCLOAK_SYNC: config["ENABLE_KEYCLOAK_SYNC"] || "0",
    },
  });

  const originURL = !isEmpty(API_BASE_URL) ? API_BASE_URL : typeof window !== "undefined" ? window.location.origin : "";

  const KEYCLOAK_FORM_FIELDS: TControllerInputFormField[] = [
    {
      key: "KEYCLOAK_CLIENT_ID",
      type: "text",
      label: "Client ID",
      description: (
        <>
          Your Keycloak client ID from the Keycloak admin console.{" "}
          <a
            tabIndex={-1}
            href="https://www.keycloak.org/docs/latest/server_admin/#_clients"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
          >
            Learn more
          </a>
        </>
      ),
      placeholder: "plane-web-client",
      error: Boolean(errors.KEYCLOAK_CLIENT_ID),
      required: true,
    },
    {
      key: "KEYCLOAK_CLIENT_SECRET",
      type: "password",
      label: "Client Secret",
      description: (
        <>
          Your Keycloak client secret from the Keycloak admin console.{" "}
          <a
            tabIndex={-1}
            href="https://www.keycloak.org/docs/latest/server_admin/#_clients"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
          >
            Learn more
          </a>
        </>
      ),
      placeholder: "your-client-secret-here",
      error: Boolean(errors.KEYCLOAK_CLIENT_SECRET),
      required: true,
    },
    {
      key: "KEYCLOAK_BASE_URL",
      type: "text",
      label: "Keycloak Base URL",
      description: (
        <>
          The base URL of your Keycloak instance (e.g., https://c36space.com/auth).{" "}
          <a
            tabIndex={-1}
            href="https://www.keycloak.org/getting-started/getting-started-docker"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
          >
            Learn more
          </a>
        </>
      ),
      placeholder: "https://c36space.com/auth",
      error: Boolean(errors.KEYCLOAK_BASE_URL),
      required: true,
    },
    {
      key: "KEYCLOAK_REALM",
      type: "text",
      label: "Realm",
      description: (
        <>
          The base URL of your Keycloak instance (e.g., &quot;https://c36space.com/auth&quot;).{" "}
          <a
            tabIndex={-1}
            href="https://www.keycloak.org/docs/latest/server_admin/#_realms"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
          >
            Learn more
          </a>
        </>
      ),
      placeholder: "master",
      error: Boolean(errors.KEYCLOAK_REALM),
      required: false,
    },
  ];

  const KEYCLOAK_FORM_SWITCH_FIELD: TControllerSwitchFormField<KeycloakConfigFormValues> = {
    name: "ENABLE_KEYCLOAK_SYNC",
    label: "Keycloak",
  };

  const KEYCLOAK_COMMON_SERVICE_DETAILS: TCopyField[] = [
    {
      key: "Origin_URL",
      label: "Origin URL",
      url: originURL,
      description: (
        <p>
          We will auto-generate this. Paste this into your <CodeBlock darkerShade>Web Origins</CodeBlock> field in
          Keycloak client configuration.
        </p>
      ),
    },
  ];

  const KEYCLOAK_SERVICE_DETAILS: TCopyField[] = [
    {
      key: "Web_Callback_URI",
      label: "Web Callback URI",
      url: `${originURL}/auth/keycloak/callback/`,
      description: (
        <p>
          We will auto-generate this. Paste this into your <CodeBlock darkerShade>Valid Redirect URIs</CodeBlock> field
          in Keycloak.
        </p>
      ),
    },
    {
      key: "Space_Callback_URI",
      label: "Space Callback URI",
      url: `${originURL}/auth/keycloak/callback/space/`,
      description: (
        <p>
          We will auto-generate this. Also paste this into your <CodeBlock darkerShade>Valid Redirect URIs</CodeBlock>{" "}
          field in Keycloak.
        </p>
      ),
    },
  ];

  const onSubmit = async (formData: KeycloakConfigFormValues) => {
    const payload: Partial<KeycloakConfigFormValues> = { ...formData };

    try {
      await updateInstanceConfigurations(payload);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: "Your Keycloak SSO authentication is configured. You should test it now.",
      });
      // Reset form with current values
      reset(formData);
    } catch (err) {
      console.error(err);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Failed to save configuration. Please try again.",
      });
    }
  };

  const handleGoBack = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (isDirty) {
      e.preventDefault();
      setIsDiscardChangesModalOpen(true);
    }
  };

  return (
    <>
      <ConfirmDiscardModal
        isOpen={isDiscardChangesModalOpen}
        onDiscardHref="/authentication"
        handleClose={() => setIsDiscardChangesModalOpen(false)}
      />
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-2 gap-x-12 gap-y-8 w-full">
          <div className="flex flex-col gap-y-4 col-span-2 md:col-span-1 pt-1">
            <div className="pt-2.5 text-18 font-medium">Keycloak-provided details for Plane</div>
            {KEYCLOAK_FORM_FIELDS.map((field) => (
              <ControllerInput
                key={field.key}
                control={control}
                type={field.type}
                name={field.key}
                label={field.label}
                description={field.description}
                placeholder={field.placeholder}
                error={field.error}
                required={field.required}
              />
            ))}
            <ControllerSwitch control={control} field={KEYCLOAK_FORM_SWITCH_FIELD} />
            <div className="flex flex-col gap-1 pt-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={(e) => void handleSubmit(onSubmit)(e)}
                  loading={isSubmitting}
                  disabled={!isDirty}
                >
                  {isSubmitting ? "Saving" : "Save changes"}
                </Button>
                <Link href="/authentication" className={getButtonStyling("secondary", "lg")} onClick={handleGoBack}>
                  Go back
                </Link>
              </div>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1 flex flex-col gap-y-6">
            <div className="pt-2 text-18 font-medium">Plane-provided details for Keycloak</div>

            <div className="flex flex-col gap-y-4">
              {/* common service details */}
              <div className="flex flex-col gap-y-4 px-6 py-4 bg-layer-1 rounded-lg">
                {KEYCLOAK_COMMON_SERVICE_DETAILS.map((field) => (
                  <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
                ))}
              </div>

              {/* web service details */}
              <div className="flex flex-col rounded-lg overflow-hidden">
                <div className="px-6 py-3 bg-layer-3 font-medium text-11 uppercase flex items-center gap-x-3 text-secondary">
                  <Monitor className="w-3 h-3" />
                  Web
                </div>
                <div className="px-6 py-4 flex flex-col gap-y-4 bg-layer-1">
                  {KEYCLOAK_SERVICE_DETAILS.map((field) => (
                    <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
                  ))}
                </div>
              </div>

              {/* Keycloak Configuration Guide */}
              <div className="flex flex-col rounded-lg overflow-hidden border border-custom-border-200">
                <div className="px-6 py-3 bg-layer-3 font-medium text-11 uppercase flex items-center gap-x-3 text-secondary">
                  <Shield className="w-3 h-3" />
                  Keycloak Configuration Steps
                </div>
                <div className="px-6 py-4 flex flex-col gap-y-3 bg-layer-1">
                  <ol className="list-decimal pl-5 space-y-2 text-sm">
                    <li>
                      Log into your Keycloak Admin Console at{" "}
                      <CodeBlock>{config.KEYCLOAK_BASE_URL || "https://your-keycloak.com/auth"}</CodeBlock>
                    </li>
                    <li>
                      Navigate to <strong>Clients</strong> → <strong>Create client</strong>
                    </li>
                    <li>
                      Set <CodeBlock>Client ID</CodeBlock> to:{" "}
                      <CodeBlock>{config.KEYCLOAK_CLIENT_ID || "[Your Client ID]"}</CodeBlock>
                    </li>
                    <li>
                      Enable <CodeBlock>Client authentication</CodeBlock>
                    </li>
                    <li>
                      Add the above Redirect URIs to <CodeBlock>Valid Redirect URIs</CodeBlock>
                    </li>
                    <li>
                      Add Web Origins: <CodeBlock>{originURL}</CodeBlock>
                    </li>
                    <li>
                      Create Mappers for: <CodeBlock>email</CodeBlock>, <CodeBlock>given_name</CodeBlock>,{" "}
                      <CodeBlock>family_name</CodeBlock>, <CodeBlock>preferred_username</CodeBlock>
                    </li>
                    <li>
                      Save and copy the <CodeBlock>Client Secret</CodeBlock>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
