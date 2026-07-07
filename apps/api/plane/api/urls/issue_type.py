# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    ProjectWorkItemTypeListCreateAPIEndpoint,
    ProjectWorkItemTypeDetailAPIEndpoint,
    WorkspaceWorkItemTypeListCreateAPIEndpoint,
    WorkspaceWorkItemTypeDetailAPIEndpoint,
    ImportWorkItemTypesAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/work-item-types/",
        WorkspaceWorkItemTypeListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="workspace-work-item-types",
    ),
    path(
        "workspaces/<str:slug>/work-item-types/<uuid:type_id>/",
        WorkspaceWorkItemTypeDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="workspace-work-item-type-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-item-types/",
        ProjectWorkItemTypeListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="project-work-item-types",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-item-types/<uuid:type_id>/",
        ProjectWorkItemTypeDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="project-work-item-type-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/import-work-item-types/",
        ImportWorkItemTypesAPIEndpoint.as_view(http_method_names=["post"]),
        name="project-import-work-item-types",
    ),
]
