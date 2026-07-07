# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from plane.db.models import ProjectMember, WorkspaceMember
from .base import BaseSerializer
from plane.db.models import User
from plane.utils.permissions import ROLE


class ProjectMemberSerializer(BaseSerializer):
    """
    Serializer for project members.
    """

    member = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=True,
    )

    def validate_member(self, value):
        slug = self.context.get("slug")
        if not slug:
            raise serializers.ValidationError("Slug is required", code="INVALID_SLUG")
        if not value:
            raise serializers.ValidationError("Member is required", code="INVALID_MEMBER")
        if not WorkspaceMember.objects.filter(workspace__slug=slug, member=value).exists():
            raise serializers.ValidationError("Member not found in workspace", code="INVALID_MEMBER")
        return value

    def validate_role(self, value):
        if value not in [ROLE.ADMIN.value, ROLE.MEMBER.value, ROLE.GUEST.value]:
            raise serializers.ValidationError("Invalid role", code="INVALID_ROLE")
        return value

    class Meta:
        model = ProjectMember
        fields = ["id", "member", "role"]
        read_only_fields = ["id"]


ROLE_SLUG_MAP = {
    ROLE.ADMIN.value: "admin",
    ROLE.MEMBER.value: "member",
    ROLE.GUEST.value: "guest",
}


class MemberLiteSerializer(serializers.Serializer):
    """
    Flattened member representation for the members-lite endpoints.

    Outputs the member's user fields (UserLite shape) alongside role, role_slug,
    is_active and is_bot. Works for both WorkspaceMember and ProjectMember rows.
    """

    def to_representation(self, instance):
        from .user import UserLiteSerializer

        data = UserLiteSerializer(instance.member).data
        data["role"] = instance.role
        data["role_slug"] = ROLE_SLUG_MAP.get(instance.role)
        data["is_active"] = instance.is_active
        data["is_bot"] = instance.member.is_bot
        return data
