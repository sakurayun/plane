/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { Link2 } from "lucide-react";
// plane imports
import { API_BASE_URL } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IUserAccount } from "@plane/types";
import { AlertModalCore, Loader } from "@plane/ui";
import { renderFormattedDate } from "@plane/utils";
// components
import { ProfileSettingsHeading } from "@/components/settings/profile/heading";
// hooks
import { useOAuthConfig } from "@/hooks/oauth";
import { useInstance } from "@/hooks/store/use-instance";
// services
import { UserService } from "@/services/user.service";

const userService = new UserService();

const USER_ACCOUNTS_KEY = "USER_ACCOUNTS_LIST";

// Human-readable provider names; OIDC resolves to the configured display name
const PROVIDER_NAME_MAP: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  gitlab: "GitLab",
  gitea: "Gitea",
};

export const LinkedAccountsProfileSettings = observer(function LinkedAccountsProfileSettings() {
  // states
  const [accountToDisconnect, setAccountToDisconnect] = useState<IUserAccount | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  // hooks
  const { t } = useTranslation();
  const { config } = useInstance();
  const { oAuthOptions } = useOAuthConfig("Connect");

  const { data: accounts, mutate } = useSWR(USER_ACCOUNTS_KEY, () => userService.getCurrentUserAccounts(), {
    revalidateOnFocus: true,
  });

  const getProviderName = (provider: string) =>
    provider === "oidc" ? config?.oidc_display_name || "SSO" : (PROVIDER_NAME_MAP[provider] ?? provider);

  const getAccountForProvider = (provider: string) => accounts?.find((account) => account.provider === provider);

  const handleConnect = (providerId: string) => {
    const nextPath = window.location.pathname;
    window.location.assign(`${API_BASE_URL}/auth/${providerId}/?connect=1&next_path=${nextPath}`);
  };

  const handleDisconnect = async () => {
    if (!accountToDisconnect) return;
    setIsDisconnecting(true);
    try {
      await userService.deleteUserAccount(accountToDisconnect.id);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Disconnected",
        message: `${getProviderName(accountToDisconnect.provider)} has been disconnected from your account.`,
      });
      setAccountToDisconnect(null);
      await mutate();
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Could not disconnect",
        message: error?.data?.error ?? "Something went wrong. Please try again.",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Providers currently enabled on the instance
  const enabledProviders = oAuthOptions.filter((option) => option.enabled !== false);
  // Accounts bound to providers that have since been disabled by the admin
  const orphanAccounts =
    accounts?.filter((account) => !enabledProviders.some((option) => option.id === account.provider)) ?? [];

  const renderAccountDetails = (account: IUserAccount) => (
    <div className="flex flex-col gap-0.5 text-11 text-tertiary">
      <span>
        Account ID: <span className="font-medium text-secondary">{account.provider_account_id}</span>
      </span>
      <span>
        Connected {renderFormattedDate(account.created_at)} · Last used {renderFormattedDate(account.last_connected_at)}
      </span>
    </div>
  );

  return (
    <>
      <AlertModalCore
        isOpen={!!accountToDisconnect}
        handleClose={() => setAccountToDisconnect(null)}
        handleSubmit={handleDisconnect}
        isSubmitting={isDisconnecting}
        variant="danger"
        title={`Disconnect ${accountToDisconnect ? getProviderName(accountToDisconnect.provider) : ""}?`}
        content="You will no longer be able to sign in with this social account. You can connect it again at any time."
        primaryButtonText={{ loading: "Disconnecting", default: "Disconnect" }}
        secondaryButtonText="Cancel"
      />
      <div className="flex w-full flex-col gap-6">
        <ProfileSettingsHeading
          title={t("profile.actions.linked_accounts")}
          description="Connect third-party sign-in providers to your account and manage existing connections."
        />
        {!accounts && (
          <Loader className="space-y-4">
            <Loader.Item height="56px" />
            <Loader.Item height="56px" />
          </Loader>
        )}
        {accounts && enabledProviders.length === 0 && orphanAccounts.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-md border border-subtle py-10 text-center">
            <Link2 className="h-6 w-6 text-tertiary" />
            <div className="text-13 text-secondary">No social sign-in providers are enabled on this instance.</div>
            <div className="text-11 text-tertiary">Ask your instance admin to enable one in God Mode.</div>
          </div>
        )}
        {accounts && (
          <div className="flex flex-col divide-y divide-subtle rounded-md border border-subtle">
            {enabledProviders.map((option) => {
              const account = getAccountForProvider(option.id);
              return (
                <div key={option.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 flex-shrink-0 place-items-center rounded-md border border-subtle bg-surface-2">
                      {option.icon}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 text-13 font-medium text-primary">
                        {getProviderName(option.id)}
                        {account && (
                          <span className="rounded-full bg-success-subtle px-2 py-0.5 text-10 font-medium text-success-primary">
                            Connected
                          </span>
                        )}
                      </div>
                      {account ? (
                        renderAccountDetails(account)
                      ) : (
                        <span className="text-11 text-tertiary">Not connected</span>
                      )}
                    </div>
                  </div>
                  {account ? (
                    <Button variant="error-outline" size="sm" onClick={() => setAccountToDisconnect(account)}>
                      Disconnect
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => handleConnect(option.id)}>
                      Connect
                    </Button>
                  )}
                </div>
              );
            })}
            {orphanAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 flex-shrink-0 place-items-center rounded-md border border-subtle bg-surface-2">
                    <Link2 className="h-4 w-4 text-tertiary" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 text-13 font-medium text-primary">
                      {getProviderName(account.provider)}
                      <span className="rounded-full bg-layer-1 px-2 py-0.5 text-10 font-medium text-tertiary">
                        Disabled by admin
                      </span>
                    </div>
                    {renderAccountDetails(account)}
                  </div>
                </div>
                <Button variant="error-outline" size="sm" onClick={() => setAccountToDisconnect(account)}>
                  Disconnect
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
});
