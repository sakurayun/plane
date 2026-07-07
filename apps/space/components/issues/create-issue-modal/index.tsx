/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { Check, X } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { PriorityIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TIssuePriorities } from "@plane/types";
import { EModalPosition, EModalWidth, Input, ModalCore } from "@plane/ui";
import { cn } from "@plane/utils";
// hooks
import { useIssue } from "@/hooks/store/use-issue";
import { useLabel } from "@/hooks/store/use-label";

type Props = {
  anchor: string;
  intakeId: string;
  isOpen: boolean;
  onClose: () => void;
};

const PRIORITY_OPTIONS: { key: TIssuePriorities; labelKey: string }[] = [
  { key: "urgent", labelKey: "issue.priority.urgent" },
  { key: "high", labelKey: "issue.priority.high" },
  { key: "medium", labelKey: "issue.priority.medium" },
  { key: "low", labelKey: "issue.priority.low" },
  { key: "none", labelKey: "issue.priority.none" },
];

export const CreateIntakeIssueModal = observer(function CreateIntakeIssueModal(props: Props) {
  const { anchor, intakeId, isOpen, onClose } = props;
  // hooks
  const { t } = useTranslation();
  const { createIntakeIssue } = useIssue();
  const { labels } = useLabel();
  // state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TIssuePriorities>("none");
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setPriority("none");
    setSelectedLabelIds([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) => (prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("error"),
        message: t("intake_submit.name_required"),
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const descriptionHtml = description.trim()
        ? `<p>${description
            .trim()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br/>")}</p>`
        : "<p></p>";
      await createIntakeIssue(anchor, intakeId, {
        name: name.trim(),
        description_html: descriptionHtml,
        priority,
        label_ids: selectedLabelIds,
      });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("intake_submit.success_title"),
        message: t("intake_submit.success_message"),
      });
      handleClose();
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("error"),
        message: error?.error ?? t("intake_submit.error_message"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <div className="flex flex-col gap-5 p-5">
        {/* header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-16 font-semibold text-primary text-balance">{t("intake_submit.title")}</h3>
            <p className="text-11 text-tertiary text-pretty">{t("intake_submit.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="grid size-7 flex-shrink-0 place-items-center rounded-md text-tertiary transition-colors hover:bg-layer-1 hover:text-secondary"
            aria-label={t("close")}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-11 font-medium text-secondary">{t("intake_submit.name_label")}</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("intake_submit.name_placeholder")}
            className="w-full rounded-md"
            autoFocus
            maxLength={255}
          />
        </div>

        {/* description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-11 font-medium text-secondary">{t("intake_submit.description_label")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("intake_submit.description_placeholder")}
            rows={4}
            className="w-full resize-none rounded-md border border-strong bg-surface-1 px-3 py-2 text-13 text-primary outline-none transition-colors placeholder:text-placeholder focus:border-accent-primary"
          />
        </div>

        {/* priority */}
        <div className="flex flex-col gap-1.5">
          <label className="text-11 font-medium text-secondary">{t("intake_submit.priority_label")}</label>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITY_OPTIONS.map((option) => {
              const isActive = priority === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPriority(option.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-12 transition-all active:scale-[0.96]",
                    isActive
                      ? "border-accent-primary bg-accent-primary/10 text-primary"
                      : "border-strong text-secondary hover:bg-layer-1"
                  )}
                >
                  <PriorityIcon priority={option.key} className="size-3.5" withContainer={false} />
                  {t(option.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* labels (select only, no creation) */}
        {labels && labels.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-11 font-medium text-secondary">{t("intake_submit.labels_label")}</label>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {labels.map((label) => {
                const isActive = selectedLabelIds.includes(label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleLabel(label.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-12 transition-all active:scale-[0.96]",
                      isActive ? "border-accent-primary bg-accent-primary/10 text-primary" : "border-strong text-secondary hover:bg-layer-1"
                    )}
                  >
                    <span
                      className="size-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: label.color || "#94a3b8" }}
                    />
                    {label.name}
                    {isActive && <Check className="size-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={isSubmitting}>
            {t("cancel")}
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} loading={isSubmitting} disabled={!name.trim()}>
            {isSubmitting ? t("intake_submit.submitting") : t("intake_submit.submit")}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
