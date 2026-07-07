/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { isEmpty } from "lodash-es";
import Link from "next/link";
import { useForm } from "react-hook-form";
// plane internal packages
import { API_BASE_URL } from "@plane/constants";
import { Button, getButtonStyling } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IFormattedInstanceConfiguration, TInstanceOIDCAuthenticationConfigurationKeys } from "@plane/types";
// components
import { CodeBlock } from "@/components/common/code-block";
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
import type { TControllerSwitchFormField } from "@/components/common/controller-switch";
import { ControllerSwitch } from "@/components/common/controller-switch";
import type { TCopyField } from "@/components/common/copy-field";
import { CopyField } from "@/components/common/copy-field";
// hooks
import { useInstance } from "@/hooks/store";

type Props = {
  config: IFormattedInstanceConfiguration;
};

type OIDCConfigFormValues = Record<TInstanceOIDCAuthenticationConfigurationKeys, string>;

export function InstanceOIDCConfigForm(props: Props) {
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
  } = useForm<OIDCConfigFormValues>({
    defaultValues: {
      OIDC_URL_AUTHORIZE: config["OIDC_URL_AUTHORIZE"],
      OIDC_URL_TOKEN: config["OIDC_URL_TOKEN"],
      OIDC_URL_USERINFO: config["OIDC_URL_USERINFO"],
      OIDC_CLIENT_ID: config["OIDC_CLIENT_ID"],
      OIDC_CLIENT_SECRET: config["OIDC_CLIENT_SECRET"],
      OIDC_DISPLAY_NAME: config["OIDC_DISPLAY_NAME"] || "SSO",
      ENABLE_OIDC_SYNC: config["ENABLE_OIDC_SYNC"] || "0",
      IS_OIDC_AUTO_REDIRECT: config["IS_OIDC_AUTO_REDIRECT"] || "0",
    },
  });

  const originURL = !isEmpty(API_BASE_URL) ? API_BASE_URL : typeof window !== "undefined" ? window.location.origin : "";

  const OIDC_FORM_FIELDS: TControllerInputFormField[] = [
    {
      key: "OIDC_URL_AUTHORIZE",
      type: "text",
      label: "Authorization endpoint",
      description: <>The IdP authorization URL. For Logto this is {"{endpoint}"}/oidc/auth.</>,
      placeholder: "https://iam.example.com/oidc/auth",
      error: Boolean(errors.OIDC_URL_AUTHORIZE),
      required: true,
    },
    {
      key: "OIDC_URL_TOKEN",
      type: "text",
      label: "Token endpoint",
      description: <>The IdP token URL. For Logto this is {"{endpoint}"}/oidc/token.</>,
      placeholder: "https://iam.example.com/oidc/token",
      error: Boolean(errors.OIDC_URL_TOKEN),
      required: true,
    },
    {
      key: "OIDC_URL_USERINFO",
      type: "text",
      label: "Userinfo endpoint",
      description: <>The IdP userinfo URL. For Logto this is {"{endpoint}"}/oidc/me.</>,
      placeholder: "https://iam.example.com/oidc/me",
      error: Boolean(errors.OIDC_URL_USERINFO),
      required: true,
    },
    {
      key: "OIDC_CLIENT_ID",
      type: "text",
      label: "Client ID",
      description: <>From your identity provider&apos;s application settings.</>,
      placeholder: "m7dvjxejt0e6xkb3v2lqp",
      error: Boolean(errors.OIDC_CLIENT_ID),
      required: true,
    },
    {
      key: "OIDC_CLIENT_SECRET",
      type: "password",
      label: "Client secret",
      description: <>Also from your identity provider&apos;s application settings.</>,
      placeholder: "9b0050f94ec1b744e32ce79ea4ffacd40d4119cb",
      error: Boolean(errors.OIDC_CLIENT_SECRET),
      required: true,
    },
    {
      key: "OIDC_DISPLAY_NAME",
      type: "text",
      label: "Display name",
      description: <>Shown on the login button, e.g. &quot;Continue with Logto&quot;.</>,
      placeholder: "Logto",
      error: Boolean(errors.OIDC_DISPLAY_NAME),
      required: false,
    },
  ];

  const OIDC_SYNC_SWITCH_FIELD: TControllerSwitchFormField<OIDCConfigFormValues> = {
    name: "ENABLE_OIDC_SYNC",
    label: "OIDC",
  };

  const OIDC_AUTO_REDIRECT_SWITCH_FIELD: TControllerSwitchFormField<OIDCConfigFormValues> = {
    name: "IS_OIDC_AUTO_REDIRECT",
    label: "Seamless sign-in (auto-redirect to the identity provider)",
  };

  const OIDC_SERVICE_FIELD: TCopyField[] = [
    {
      key: "Callback_URI",
      label: "Callback URI",
      url: `${originURL}/auth/oidc/callback/`,
      description: (
        <>
          We will auto-generate this. Paste this into the <CodeBlock darkerShade>Redirect URI</CodeBlock> field of your
          identity provider&apos;s application settings.
        </>
      ),
    },
  ];

  const onSubmit = async (formData: OIDCConfigFormValues) => {
    const payload: Partial<OIDCConfigFormValues> = { ...formData };

    try {
      const response = await updateInstanceConfigurations(payload);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Done!",
        message: "Your OIDC authentication is configured. You should test it now.",
      });
      reset({
        OIDC_URL_AUTHORIZE: response.find((item) => item.key === "OIDC_URL_AUTHORIZE")?.value,
        OIDC_URL_TOKEN: response.find((item) => item.key === "OIDC_URL_TOKEN")?.value,
        OIDC_URL_USERINFO: response.find((item) => item.key === "OIDC_URL_USERINFO")?.value,
        OIDC_CLIENT_ID: response.find((item) => item.key === "OIDC_CLIENT_ID")?.value,
        OIDC_CLIENT_SECRET: response.find((item) => item.key === "OIDC_CLIENT_SECRET")?.value,
        OIDC_DISPLAY_NAME: response.find((item) => item.key === "OIDC_DISPLAY_NAME")?.value,
        ENABLE_OIDC_SYNC: response.find((item) => item.key === "ENABLE_OIDC_SYNC")?.value,
        IS_OIDC_AUTO_REDIRECT: response.find((item) => item.key === "IS_OIDC_AUTO_REDIRECT")?.value,
      });
    } catch (err) {
      console.error(err);
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
        <div className="grid w-full grid-cols-2 gap-x-12 gap-y-8">
          <div className="col-span-2 flex flex-col gap-y-4 pt-1 md:col-span-1">
            <div className="pt-2.5 text-18 font-medium">IdP-provided details for Plane</div>
            {OIDC_FORM_FIELDS.map((field) => (
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
            <ControllerSwitch control={control} field={OIDC_SYNC_SWITCH_FIELD} />
            <ControllerSwitch control={control} field={OIDC_AUTO_REDIRECT_SWITCH_FIELD} />
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
          <div className="col-span-2 md:col-span-1">
            <div className="flex flex-col gap-y-4 rounded-lg bg-layer-1 px-6 pt-1.5 pb-4">
              <div className="pt-2 text-18 font-medium">Plane-provided details for your IdP</div>
              {OIDC_SERVICE_FIELD.map((field) => (
                <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
