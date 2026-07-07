/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
// types
import type { TIssue } from "@plane/types";
import { cn } from "@plane/utils";
// hooks
import { useLabel } from "@/hooks/store/use-label";
// components
import { IssuePropertyLabels } from "../../properties";

type Props = {
  issue: TIssue;
  onClose: () => void;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: any) => void;
  disabled: boolean;
};

export const SpreadsheetLabelColumn = observer(function SpreadsheetLabelColumn(props: Props) {
  const { issue, onChange, disabled, onClose } = props;
  // hooks
  const { labelMap } = useLabel();

  const defaultLabelOptions = issue?.label_ids?.map((id) => labelMap[id]) || [];
  const labelCount = issue?.label_ids?.length ?? 0;
  // With multiple labels each label renders as its own chip; lay them out in
  // a horizontal flex row instead of the single full-cell dropdown button
  const showAllLabels = labelCount > 1;

  return (
    <div
      className={cn("h-11 w-full border-b-[0.5px] border-subtle", {
        "flex items-center gap-1.5 overflow-x-auto px-page-x": showAllLabels,
      })}
    >
      <IssuePropertyLabels
        projectId={issue.project_id ?? null}
        value={issue.label_ids || []}
        defaultOptions={defaultLabelOptions}
        onChange={(data) => onChange(issue, { label_ids: data }, { changed_property: "labels", change_details: data })}
        className={showAllLabels ? undefined : "h-full w-full"}
        buttonClassName={
          showAllLabels
            ? "rounded-sm"
            : "px-page-x w-full h-full group-[.selected-issue-row]:bg-accent-primary/5 group-[.selected-issue-row]:hover:bg-accent-primary/10 rounded-none"
        }
        hideDropdownArrow
        maxRender={labelCount || 1}
        disabled={disabled}
        placeholderText="Select labels"
        onClose={onClose}
        noLabelBorder={!showAllLabels}
        fullWidth={!showAllLabels}
        fullHeight={!showAllLabels}
      />
    </div>
  );
});
