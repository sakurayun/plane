# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.api.serializers import IssueTypeAPISerializer, IssueTypeCreateAPISerializer
from plane.app.permissions import (
    ProjectEntityPermission,
    ProjectAdminPermission,
    WorkspaceEntityPermission,
    WorkSpaceAdminPermission,
)
from plane.db.models import Issue, IssueType, Project, Workspace
from plane.db.models.issue_type import ProjectIssueType

from .base import BaseAPIView


def issue_type_in_use(issue_type_id):
    return Issue.objects.filter(type_id=issue_type_id).exists()


class ProjectWorkItemTypeListCreateAPIEndpoint(BaseAPIView):
    """List and create work item types linked to a project."""

    serializer_class = IssueTypeAPISerializer
    model = IssueType
    use_read_replica = True

    def get_permissions(self):
        if self.request.method == "GET":
            return [ProjectEntityPermission()]
        return [ProjectAdminPermission()]

    def get_queryset(self):
        return IssueType.objects.filter(
            workspace__slug=self.kwargs.get("slug"),
            pk__in=ProjectIssueType.objects.filter(
                project_id=self.kwargs.get("project_id")
            ).values_list("issue_type_id", flat=True),
        ).order_by("level", "created_at")

    def get(self, request, slug, project_id):
        # SDK contract: bare array, not a paginated envelope
        return Response(
            IssueTypeAPISerializer(self.get_queryset(), many=True).data,
            status=status.HTTP_200_OK,
        )

    def post(self, request, slug, project_id):
        serializer = IssueTypeCreateAPISerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        issue_type = IssueType.objects.create(
            **serializer.validated_data, workspace_id=project.workspace_id
        )
        ProjectIssueType.objects.create(
            project_id=project_id,
            issue_type=issue_type,
            level=int(issue_type.level or 0),
        )
        return Response(IssueTypeAPISerializer(issue_type).data, status=status.HTTP_201_CREATED)


class ProjectWorkItemTypeDetailAPIEndpoint(ProjectWorkItemTypeListCreateAPIEndpoint):
    """Retrieve, update and delete a work item type linked to a project."""

    def get(self, request, slug, project_id, type_id):
        issue_type = self.get_queryset().filter(pk=type_id).first()
        if issue_type is None:
            return Response({"error": "Work item type not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(IssueTypeAPISerializer(issue_type).data, status=status.HTTP_200_OK)

    def patch(self, request, slug, project_id, type_id):
        issue_type = self.get_queryset().filter(pk=type_id).first()
        if issue_type is None:
            return Response({"error": "Work item type not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = IssueTypeCreateAPISerializer(issue_type, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(IssueTypeAPISerializer(issue_type).data, status=status.HTTP_200_OK)

    def delete(self, request, slug, project_id, type_id):
        issue_type = self.get_queryset().filter(pk=type_id).first()
        if issue_type is None:
            return Response({"error": "Work item type not found"}, status=status.HTTP_404_NOT_FOUND)
        if issue_type_in_use(type_id):
            return Response(
                {"error": "Work item type is in use by existing work items and cannot be deleted"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        issue_type.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspaceWorkItemTypeListCreateAPIEndpoint(BaseAPIView):
    """List and create workspace-level work item types."""

    serializer_class = IssueTypeAPISerializer
    model = IssueType
    use_read_replica = True

    def get_permissions(self):
        if self.request.method == "GET":
            return [WorkspaceEntityPermission()]
        return [WorkSpaceAdminPermission()]

    def get_queryset(self):
        return IssueType.objects.filter(workspace__slug=self.kwargs.get("slug")).order_by(
            "level", "created_at"
        )

    def get(self, request, slug):
        # SDK contract: bare array, not a paginated envelope
        return Response(
            IssueTypeAPISerializer(self.get_queryset(), many=True).data,
            status=status.HTTP_200_OK,
        )

    def post(self, request, slug):
        serializer = IssueTypeCreateAPISerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        workspace = Workspace.objects.get(slug=slug)
        issue_type = IssueType.objects.create(**serializer.validated_data, workspace_id=workspace.id)

        # Optionally link to projects supplied in the payload
        project_ids = request.data.get("project_ids") or []
        for project_id in project_ids:
            project = Project.objects.filter(pk=project_id, workspace__slug=slug).first()
            if project:
                ProjectIssueType.objects.get_or_create(
                    project_id=project.id,
                    issue_type=issue_type,
                    defaults={"level": int(issue_type.level or 0)},
                )

        return Response(IssueTypeAPISerializer(issue_type).data, status=status.HTTP_201_CREATED)


class WorkspaceWorkItemTypeDetailAPIEndpoint(WorkspaceWorkItemTypeListCreateAPIEndpoint):
    """Retrieve, update and delete a workspace-level work item type."""

    def get(self, request, slug, type_id):
        issue_type = self.get_queryset().filter(pk=type_id).first()
        if issue_type is None:
            return Response({"error": "Work item type not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(IssueTypeAPISerializer(issue_type).data, status=status.HTTP_200_OK)

    def patch(self, request, slug, type_id):
        issue_type = self.get_queryset().filter(pk=type_id).first()
        if issue_type is None:
            return Response({"error": "Work item type not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = IssueTypeCreateAPISerializer(issue_type, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()

        # Optionally sync project links when project_ids is supplied
        if "project_ids" in request.data:
            desired_ids = {str(pid) for pid in (request.data.get("project_ids") or [])}
            existing = ProjectIssueType.objects.filter(issue_type_id=issue_type.id)
            for link in existing:
                if str(link.project_id) not in desired_ids:
                    link.delete()
            existing_ids = {
                str(pid)
                for pid in ProjectIssueType.objects.filter(issue_type_id=issue_type.id).values_list(
                    "project_id", flat=True
                )
            }
            for project_id in desired_ids - existing_ids:
                project = Project.objects.filter(pk=project_id, workspace__slug=slug).first()
                if project:
                    ProjectIssueType.objects.create(
                        project_id=project.id,
                        issue_type=issue_type,
                        level=int(issue_type.level or 0),
                    )

        return Response(IssueTypeAPISerializer(issue_type).data, status=status.HTTP_200_OK)

    def delete(self, request, slug, type_id):
        issue_type = self.get_queryset().filter(pk=type_id).first()
        if issue_type is None:
            return Response({"error": "Work item type not found"}, status=status.HTTP_404_NOT_FOUND)
        if issue_type_in_use(type_id):
            return Response(
                {"error": "Work item type is in use by existing work items and cannot be deleted"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        issue_type.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ImportWorkItemTypesAPIEndpoint(BaseAPIView):
    """Link existing workspace-level work item types to a project."""

    permission_classes = [ProjectAdminPermission]

    def post(self, request, slug, project_id):
        type_ids = request.data.get("work_item_types") or []
        if not isinstance(type_ids, list) or not type_ids:
            return Response(
                {"error": "work_item_types must be a non-empty list of ids"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        valid_types = IssueType.objects.filter(workspace__slug=slug, pk__in=type_ids)

        imported = []
        for issue_type in valid_types:
            _, created = ProjectIssueType.objects.get_or_create(
                project_id=project.id,
                issue_type=issue_type,
                defaults={"level": int(issue_type.level or 0)},
            )
            if created:
                imported.append(str(issue_type.id))

        return Response(
            {"imported": imported, "total": len(imported)},
            status=status.HTTP_200_OK,
        )
