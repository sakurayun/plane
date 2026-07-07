# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models import Q

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.api.serializers import PageAPISerializer, PageCreateAPISerializer
from plane.app.permissions import ProjectEntityPermission, WorkspaceEntityPermission
from plane.bgtasks.page_transaction_task import page_transaction
from plane.db.models import Page, Project, ProjectPage, Workspace

from .base import BaseAPIView

DEFAULT_DESCRIPTION_HTML = "<p></p>"


def validate_parent_page(slug, parent_id, project_id=None):
    """Return the parent Page if it is valid for nesting, else None.

    A parent page must live in the same workspace; for project pages it must
    also be linked to the same project.
    """
    parent_queryset = Page.objects.filter(pk=parent_id, workspace__slug=slug)
    if project_id:
        parent_queryset = parent_queryset.filter(
            pk__in=ProjectPage.objects.filter(project_id=project_id).values_list("page_id", flat=True)
        )
    return parent_queryset.first()


class BasePageAPIView(BaseAPIView):
    serializer_class = PageAPISerializer
    model = Page

    def page_visibility_filter(self):
        # Public pages are visible to all members; private pages only to the owner
        return Q(owned_by=self.request.user) | Q(access=Page.PUBLIC_ACCESS)

    def create_page(self, request, slug, project_id=None):
        serializer = PageCreateAPISerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data

        # Validate the parent page for nested pages
        parent = validated_data.get("parent")
        if parent is not None:
            valid_parent = validate_parent_page(
                slug=slug, parent_id=parent.id, project_id=project_id
            )
            if valid_parent is None:
                return Response(
                    {"error": "Parent page does not exist in this workspace/project"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if project_id:
            project = Project.objects.get(pk=project_id, workspace__slug=slug)
            workspace_id = project.workspace_id
        else:
            workspace_id = Workspace.objects.get(slug=slug).id

        # External id uniqueness check (parity with other public API resources)
        external_id = validated_data.get("external_id")
        external_source = validated_data.get("external_source")
        if external_id and external_source:
            existing_page = Page.objects.filter(
                workspace__slug=slug,
                external_id=external_id,
                external_source=external_source,
            ).first()
            if existing_page:
                return Response(
                    {
                        "error": "Page with the same external id and external source already exists",
                        "id": str(existing_page.id),
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        description_html = validated_data.pop("description_html", None) or DEFAULT_DESCRIPTION_HTML

        page = Page.objects.create(
            **validated_data,
            description_html=description_html,
            owned_by=request.user,
            workspace_id=workspace_id,
        )

        if project_id:
            ProjectPage.objects.create(
                workspace_id=workspace_id,
                project_id=project_id,
                page_id=page.id,
                created_by_id=page.created_by_id,
                updated_by_id=page.updated_by_id,
            )

        # Extract embedded assets/mentions from the description
        page_transaction.delay(
            new_description_html=description_html,
            old_description_html=None,
            page_id=str(page.id),
        )

        return Response(PageAPISerializer(page).data, status=status.HTTP_201_CREATED)

    def update_page(self, request, slug, pk, queryset):
        page = queryset.filter(pk=pk).first()
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)

        if page.is_locked:
            return Response({"error": "Page is locked"}, status=status.HTTP_400_BAD_REQUEST)

        if page.archived_at:
            return Response({"error": "Page is archived"}, status=status.HTTP_400_BAD_REQUEST)

        # Only the owner can change the access of the page
        if "access" in request.data and page.owned_by_id != request.user.id:
            return Response(
                {"error": "Only the owner of the page can change the access"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PageCreateAPISerializer(page, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Validate the parent page for nested pages
        parent = serializer.validated_data.get("parent")
        if parent is not None:
            if str(parent.id) == str(page.id):
                return Response(
                    {"error": "A page cannot be its own parent"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            project_id = self.kwargs.get("project_id")
            valid_parent = validate_parent_page(slug=slug, parent_id=parent.id, project_id=project_id)
            if valid_parent is None:
                return Response(
                    {"error": "Parent page does not exist in this workspace/project"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        old_description_html = page.description_html
        serializer.save()
        page.refresh_from_db()

        if "description_html" in request.data:
            page_transaction.delay(
                new_description_html=page.description_html,
                old_description_html=old_description_html,
                page_id=str(page.id),
            )

        return Response(PageAPISerializer(page).data, status=status.HTTP_200_OK)


class ProjectPageListCreateAPIEndpoint(BasePageAPIView):
    """List and create pages within a project."""

    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            Page.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(
                pk__in=ProjectPage.objects.filter(
                    project_id=self.kwargs.get("project_id")
                ).values_list("page_id", flat=True)
            )
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .filter(self.page_visibility_filter())
            .select_related("workspace", "owned_by")
            .order_by(self.request.GET.get("order_by", "-created_at"))
            .distinct()
        )

    def get(self, request, slug, project_id):
        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            on_results=lambda pages: PageAPISerializer(
                pages, many=True, fields=self.fields, expand=self.expand
            ).data,
        )

    def post(self, request, slug, project_id):
        return self.create_page(request, slug, project_id=project_id)


class ProjectPageDetailAPIEndpoint(BasePageAPIView):
    """Retrieve and update a single project page."""

    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            Page.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(
                pk__in=ProjectPage.objects.filter(
                    project_id=self.kwargs.get("project_id")
                ).values_list("page_id", flat=True)
            )
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .filter(self.page_visibility_filter())
            .select_related("workspace", "owned_by")
            .distinct()
        )

    def get(self, request, slug, project_id, pk):
        page = self.get_queryset().filter(pk=pk).first()
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            PageAPISerializer(page, fields=self.fields, expand=self.expand).data,
            status=status.HTTP_200_OK,
        )

    def patch(self, request, slug, project_id, pk):
        return self.update_page(request, slug, pk, self.get_queryset())


class WorkspacePageListCreateAPIEndpoint(BasePageAPIView):
    """List and create workspace-level pages (pages not linked to any project)."""

    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            Page.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .exclude(pk__in=ProjectPage.objects.values_list("page_id", flat=True))
            .filter(self.page_visibility_filter())
            .select_related("workspace", "owned_by")
            .order_by(self.request.GET.get("order_by", "-created_at"))
            .distinct()
        )

    def get(self, request, slug):
        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            on_results=lambda pages: PageAPISerializer(
                pages, many=True, fields=self.fields, expand=self.expand
            ).data,
        )

    def post(self, request, slug):
        return self.create_page(request, slug, project_id=None)


class WorkspacePageDetailAPIEndpoint(BasePageAPIView):
    """Retrieve and update a single workspace-level page."""

    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            Page.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .exclude(pk__in=ProjectPage.objects.values_list("page_id", flat=True))
            .filter(self.page_visibility_filter())
            .select_related("workspace", "owned_by")
            .distinct()
        )

    def get(self, request, slug, pk):
        page = self.get_queryset().filter(pk=pk).first()
        if page is None:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            PageAPISerializer(page, fields=self.fields, expand=self.expand).data,
            status=status.HTTP_200_OK,
        )

    def patch(self, request, slug, pk):
        return self.update_page(request, slug, pk, self.get_queryset())
