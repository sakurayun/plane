/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
// plane imports
import { API_BASE_URL } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
// components
import { CreateIntakeIssueModal } from "@/components/issues/create-issue-modal";
import { IssueFiltersDropdown } from "@/components/issues/filters";
// helpers
import { queryParamGenerator } from "@/helpers/query-param-generator";
// hooks
import { useIssueDetails } from "@/hooks/store/use-issue-details";
import { useIssueFilter } from "@/hooks/store/use-issue-filter";
import { useUser } from "@/hooks/store/use-user";
import useIsInIframe from "@/hooks/use-is-in-iframe";
// store
import type { PublishStore } from "@/store/publish/publish.store";
// types
import type { TIssueLayout } from "@/types/issue";
// local imports
import { IssuesLayoutSelection } from "./layout-selection";
import { NavbarTheme } from "./theme";
import { UserAvatar } from "./user-avatar";

export type NavbarControlsProps = {
  publishSettings: PublishStore;
};

export const NavbarControls = observer(function NavbarControls(props: NavbarControlsProps) {
  // props
  const { publishSettings } = props;
  // i18n
  const { t } = useTranslation();
  // router
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // user
  const { data: currentUser } = useUser();
  // query params
  const board = searchParams.get("board") || undefined;
  const labels = searchParams.get("labels") || undefined;
  const state = searchParams.get("state") || undefined;
  const priority = searchParams.get("priority") || undefined;
  const peekId = searchParams.get("peekId") || undefined;
  // hooks
  const { getIssueFilters, isIssueFiltersUpdated, initIssueFilters } = useIssueFilter();
  const { setPeekId } = useIssueDetails();
  // derived values
  const { anchor, view_props, workspace_detail } = publishSettings;
  const issueFilters = anchor ? getIssueFilters(anchor) : undefined;
  const activeLayout = issueFilters?.display_filters?.layout || undefined;

  const isInIframe = useIsInIframe();

  useEffect(() => {
    if (anchor && workspace_detail) {
      const viewsAcceptable: string[] = [];
      let currentBoard: TIssueLayout | null = null;

      if (view_props?.list) viewsAcceptable.push("list");
      if (view_props?.kanban) viewsAcceptable.push("kanban");
      if (view_props?.calendar) viewsAcceptable.push("calendar");
      if (view_props?.gantt) viewsAcceptable.push("gantt");
      if (view_props?.spreadsheet) viewsAcceptable.push("spreadsheet");

      if (board) {
        if (viewsAcceptable.includes(board.toString())) currentBoard = board.toString() as TIssueLayout;
        else {
          if (viewsAcceptable && viewsAcceptable.length > 0) currentBoard = viewsAcceptable[0] as TIssueLayout;
        }
      } else {
        if (viewsAcceptable && viewsAcceptable.length > 0) currentBoard = viewsAcceptable[0] as TIssueLayout;
      }

      if (currentBoard) {
        if (activeLayout === undefined || activeLayout !== currentBoard) {
          const { query, queryParam } = queryParamGenerator({ board: currentBoard, peekId, priority, state, labels });
          const params: any = {
            display_filters: { layout: (query?.board as string[])[0] },
            filters: {
              priority: query?.priority ?? undefined,
              state: query?.state ?? undefined,
              labels: query?.labels ?? undefined,
            },
          };

          if (!isIssueFiltersUpdated(anchor, params)) {
            initIssueFilters(anchor, params);
            router.push(`/issues/${anchor}?${queryParam}`);
          }
        }
      }
    }
  }, [
    anchor,
    board,
    labels,
    state,
    priority,
    peekId,
    activeLayout,
    router,
    initIssueFilters,
    setPeekId,
    isIssueFiltersUpdated,
    view_props,
    workspace_detail,
  ]);

  if (!anchor) return null;

  const canCreateIssue = publishSettings.canCreateIssue;
  const intakeId = publishSettings.intake;

  const handleCreateClick = () => {
    if (currentUser) {
      setIsCreateModalOpen(true);
    } else {
      // send anonymous users through sign-in, returning to this board
      window.location.assign(`${API_BASE_URL}/auth/oidc/?next_path=${encodeURIComponent(pathname)}`);
    }
  };

  return (
    <>
      {canCreateIssue && intakeId && (
        <CreateIntakeIssueModal
          anchor={anchor}
          intakeId={intakeId}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      {/* submit requirement */}
      {canCreateIssue && !isInIframe && (
        <div className="shrink-0">
          <Button variant="primary" size="sm" prependIcon={<Plus className="size-3.5" />} onClick={handleCreateClick}>
            {t("intake_submit.button")}
          </Button>
        </div>
      )}

      {/* issue views */}
      <div className="shrink-0">
        <IssuesLayoutSelection anchor={anchor} />
      </div>

      {/* issue filters */}
      <div className="shrink-0">
        <IssueFiltersDropdown anchor={anchor} />
      </div>

      {/* theming */}
      <div className="shrink-0">
        <NavbarTheme />
      </div>

      {!isInIframe && <UserAvatar />}
    </>
  );
});
