# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import WorkspaceEntityPermission

from .base import BaseAPIView

# Workspace features only exist on Plane EE/Cloud. Community Edition reports
# them all as disabled so API clients (e.g. the Plane MCP server) can degrade
# gracefully instead of receiving a 404.
WORKSPACE_FEATURES_STUB = {
    "project_grouping": False,
    "initiatives": False,
    "teams": False,
    "customers": False,
    "wiki": False,
    "pi": False,
}

CE_FEATURE_DETAIL = "Workspace features are not available on Plane Community Edition"


class WorkspaceFeatureAPIEndpoint(BaseAPIView):
    """Static workspace feature flags for Community Edition."""

    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get(self, request, slug):
        return Response(
            {**WORKSPACE_FEATURES_STUB, "detail": CE_FEATURE_DETAIL},
            status=status.HTTP_200_OK,
        )

    def patch(self, request, slug):
        # Feature flags cannot be enabled on CE; echo the static payload so
        # OpenAPI/SDK clients still receive a valid WorkspaceFeature shape
        return Response(
            {**WORKSPACE_FEATURES_STUB, "detail": CE_FEATURE_DETAIL},
            status=status.HTTP_200_OK,
        )
