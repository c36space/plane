// plane imports
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { API_BASE_URL } from "@plane/constants";
import type { TOAuthConfigs, TOAuthOption } from "@plane/types";
// hooks
import { useInstance } from "@/hooks/store/use-instance";

export const useExtendedOAuthConfig = (oauthActionText: string): TOAuthConfigs => {
  // router
  const searchParams = useSearchParams();
  // query params
  const next_path = searchParams.get("next_path");
  // theme
  const { resolvedTheme: _resolvedTheme } = useTheme();
  // store hooks
  const { config } = useInstance();

  const isOAuthEnabled = config?.is_keycloak_enabled || false;

  const oAuthOptions: TOAuthOption[] = [
    {
      id: "keycloak",
      text: `${oauthActionText} with Keycloak`,
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          height={18}
          width={18}
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
      onClick: () => {
        window.location.assign(`${API_BASE_URL}/auth/keycloak/${next_path ? `?next_path=${next_path}` : ``}`);
      },
      enabled: config?.is_keycloak_enabled,
    },
  ];

  return {
    isOAuthEnabled,
    oAuthOptions,
  };
};
