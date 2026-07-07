/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { lazy, Suspense, useEffect } from "react";
import { observer } from "mobx-react";
import { useRouter, useSearchParams } from "next/navigation";
// plane imports
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TProfileSettingsTabs } from "@plane/types";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";

const ProfileSettingsModal = lazy(() =>
  import("@/components/settings/profile/modal").then((module) => ({
    default: module.ProfileSettingsModal,
  }))
);

const CONNECT_ERROR_MESSAGES: Record<string, string> = {
  already_connected: "This social account is already connected to a different user.",
  not_authenticated: "Your session changed while connecting. Please try again.",
  provider_error: "The identity provider returned an error. Please try again.",
};

/**
 * Handles deep links back into the (non-routable) profile settings modal.
 * The social account connect flow redirects here with query params:
 * ?profile_settings_tab=linked-accounts&connected=<provider> or &connect_error=<slug>
 */
function useProfileSettingsDeepLink() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toggleProfileSettingsModal } = useCommandPalette();

  useEffect(() => {
    const tab = searchParams.get("profile_settings_tab");
    if (!tab) return;

    const connected = searchParams.get("connected");
    const connectError = searchParams.get("connect_error");

    toggleProfileSettingsModal({ activeTab: tab as TProfileSettingsTabs, isOpen: true });

    if (connected) {
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Account connected",
        message: "The social account has been connected to your profile.",
      });
    }
    if (connectError) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Could not connect account",
        message: CONNECT_ERROR_MESSAGES[connectError] ?? "Something went wrong. Please try again.",
      });
    }

    // Strip the handled params from the URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("profile_settings_tab");
    params.delete("connected");
    params.delete("connect_error");
    const query = params.toString();
    router.replace(`${window.location.pathname}${query ? `?${query}` : ""}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
}

type TGlobalModalsProps = {
  workspaceSlug: string;
};

/**
 * GlobalModals component manages all workspace-level modals across Plane applications.
 *
 * This includes:
 * - Profile settings modal
 */
export const GlobalModals = observer(function GlobalModals(_props: TGlobalModalsProps) {
  useProfileSettingsDeepLink();

  return (
    <Suspense fallback={null}>
      <ProfileSettingsModal />
    </Suspense>
  );
});
