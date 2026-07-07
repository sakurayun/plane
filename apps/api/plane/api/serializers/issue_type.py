# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import IssueType
from plane.db.models.issue_type import ProjectIssueType


class IssueTypeAPISerializer(BaseSerializer):
    """Serializer for work item types exposed over the public API."""

    project_ids = serializers.SerializerMethodField()

    class Meta:
        model = IssueType
        fields = [
            "id",
            "name",
            "description",
            "logo_props",
            "is_epic",
            "is_default",
            "is_active",
            "level",
            "external_source",
            "external_id",
            "workspace",
            "project_ids",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "project_ids",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]

    def get_project_ids(self, obj):
        # ProjectIssueType.objects is soft-delete aware
        return [
            str(project_id)
            for project_id in ProjectIssueType.objects.filter(issue_type_id=obj.id).values_list(
                "project_id", flat=True
            )
        ]


class IssueTypeCreateAPISerializer(BaseSerializer):
    """Serializer for validating work item type create/update payloads."""

    class Meta:
        model = IssueType
        fields = [
            "name",
            "description",
            "logo_props",
            "is_epic",
            "is_default",
            "is_active",
            "level",
            "external_source",
            "external_id",
        ]
