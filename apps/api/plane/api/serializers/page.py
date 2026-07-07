# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import Page, ProjectPage


class PageAPISerializer(BaseSerializer):
    """
    Serializer for pages exposed over the public API.

    Includes the parent field for nested (sub) pages and the list of project
    ids the page is linked to. `description_binary` is intentionally excluded
    as it is not JSON serializable.
    """

    projects = serializers.SerializerMethodField()

    class Meta:
        model = Page
        fields = [
            "id",
            "name",
            "description_html",
            "description_stripped",
            "access",
            "color",
            "parent",
            "is_locked",
            "archived_at",
            "workspace",
            "owned_by",
            "projects",
            "view_props",
            "logo_props",
            "external_id",
            "external_source",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "owned_by",
            "projects",
            "description_stripped",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]

    def get_projects(self, obj):
        # ProjectPage.objects is soft-delete aware (SoftDeletionManager)
        return [
            str(project_id)
            for project_id in ProjectPage.objects.filter(page_id=obj.id).values_list("project_id", flat=True)
        ]


class PageCreateAPISerializer(BaseSerializer):
    """Serializer for validating page create/update payloads on the public API."""

    class Meta:
        model = Page
        fields = [
            "name",
            "description_html",
            "access",
            "color",
            "parent",
            "is_locked",
            "archived_at",
            "view_props",
            "logo_props",
            "external_id",
            "external_source",
        ]
