# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    IntakeIssueListCreateAPIEndpoint,
    IntakeIssueDetailAPIEndpoint,
)


urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/intake-issues/",
        IntakeIssueListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="intake-issue",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/intake-issues/<uuid:issue_id>/",
        IntakeIssueDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="intake-issue",
    ),
    # Status updates share the detail PATCH logic (status/snoozed_till/duplicate_to)
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/intake-issues/<uuid:issue_id>/status/",
        IntakeIssueDetailAPIEndpoint.as_view(http_method_names=["patch"]),
        name="intake-issue-status",
    ),
]
