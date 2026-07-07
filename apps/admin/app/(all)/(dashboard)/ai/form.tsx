/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Lightbulb, RefreshCw } from "lucide-react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { InstanceService } from "@plane/services";
import type { IFormattedInstanceConfiguration, TInstanceAIConfigurationKeys } from "@plane/types";
import { CustomSelect, Input } from "@plane/ui";
// components
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
// hooks
import { useInstance } from "@/hooks/store";

type IInstanceAIForm = {
  config: IFormattedInstanceConfiguration;
};

type AIFormValues = Record<TInstanceAIConfigurationKeys, string>;

const instanceService = new InstanceService();

export function InstanceAIForm(props: IInstanceAIForm) {
  const { config } = props;
  // store
  const { updateInstanceConfigurations } = useInstance();
  // states
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  // form data
  const {
    handleSubmit,
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<AIFormValues>({
    defaultValues: {
      LLM_API_BASE_URL: config["LLM_API_BASE_URL"] ?? "",
      LLM_API_KEY: config["LLM_API_KEY"] ?? "",
      LLM_MODEL: config["LLM_MODEL"] ?? "",
    },
  });

  const aiFormFields: TControllerInputFormField[] = [
    {
      key: "LLM_API_BASE_URL",
      type: "text",
      label: "API base URL",
      description: (
        <>
          Base URL of an OpenAI-compatible API. Leave empty to use the official OpenAI API
          (https://api.openai.com/v1).
        </>
      ),
      placeholder: "https://api.openai.com/v1",
      error: Boolean(errors.LLM_API_BASE_URL),
      required: false,
    },
    {
      key: "LLM_API_KEY",
      type: "password",
      label: "API key",
      description: (
        <>
          You will find your API key{" "}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            className="text-accent-primary hover:underline"
            rel="noreferrer"
          >
            here.
          </a>
        </>
      ),
      placeholder: "sk-asddassdfasdefqsdfasd23das3dasdcasd",
      error: Boolean(errors.LLM_API_KEY),
      required: false,
    },
  ];

  const handleFetchModels = async () => {
    const formValues = getValues();
    setIsFetchingModels(true);
    await instanceService
      .fetchLLMModels({
        api_key: formValues.LLM_API_KEY,
        base_url: formValues.LLM_API_BASE_URL,
      })
      .then((response) => {
        const models = response?.models ?? [];
        setAvailableModels(models);
        if (models.length === 0) {
          setToast({
            type: TOAST_TYPE.WARNING,
            title: "No models found",
            message: "The API returned an empty model list.",
          });
        } else {
          setToast({
            type: TOAST_TYPE.SUCCESS,
            title: "Success",
            message: `Fetched ${models.length} models.`,
          });
        }
      })
      .catch((err) => {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Failed to fetch models",
          message: err?.error ?? "Please check the API base URL and API key.",
        });
      })
      .finally(() => setIsFetchingModels(false));
  };

  const onSubmit = async (formData: AIFormValues) => {
    const payload: Partial<AIFormValues> = { ...formData };

    await updateInstanceConfigurations(payload)
      .then(() =>
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Success",
          message: "AI Settings updated successfully",
        })
      )
      .catch((err) => console.error(err));
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <div className="pb-1 text-18 font-medium text-primary">OpenAI</div>
          <div className="text-13 font-regular text-tertiary">
            Works with the official OpenAI API and any OpenAI-compatible API.
          </div>
        </div>
        <div className="grid-col grid w-full grid-cols-1 items-center justify-between gap-x-12 gap-y-8 lg:grid-cols-3">
          {aiFormFields.map((field) => (
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
          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">LLM Model</h4>
            <div className="flex items-center gap-2">
              <div className="grow">
                <Controller
                  control={control}
                  name="LLM_MODEL"
                  render={({ field: { value, onChange, ref } }) =>
                    availableModels.length > 0 ? (
                      <CustomSelect
                        value={value}
                        label={value || "Select a model"}
                        onChange={onChange}
                        buttonClassName="rounded-md border-subtle"
                        optionsClassName="max-h-60 overflow-y-auto"
                        input
                      >
                        {availableModels.map((model) => (
                          <CustomSelect.Option key={model} value={model} className="w-full">
                            {model}
                          </CustomSelect.Option>
                        ))}
                      </CustomSelect>
                    ) : (
                      <Input
                        id="LLM_MODEL"
                        name="LLM_MODEL"
                        type="text"
                        value={value}
                        onChange={onChange}
                        ref={ref}
                        hasError={Boolean(errors.LLM_MODEL)}
                        placeholder="gpt-4o-mini"
                        className="w-full rounded-md font-medium"
                      />
                    )
                  }
                />
              </div>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleFetchModels}
                loading={isFetchingModels}
                disabled={isFetchingModels}
              >
                <RefreshCw className="size-3.5" />
                {isFetchingModels ? "Fetching" : "Fetch models"}
              </Button>
            </div>
            <p className="pt-0.5 text-11 text-tertiary">
              Type a model name, or click &quot;Fetch models&quot; to pick one from the API&apos;s /models list using
              the values above.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start gap-4">
        <Button variant="primary" size="lg" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
          {isSubmitting ? "Saving" : "Save changes"}
        </Button>

        <div className="relative inline-flex items-center gap-1.5 rounded-sm border border-accent-subtle bg-accent-subtle px-4 py-2 text-caption-sm-regular text-accent-secondary">
          <Lightbulb className="size-4" />
          <div>
            If you have a preferred AI models vendor, please get in{" "}
            <a className="font-medium underline" href="https://plane.so/contact">
              touch with us.
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
