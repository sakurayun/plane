# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from urllib.parse import urlencode, urljoin

from django.http import HttpResponseRedirect

from plane.authentication.adapter.error import AuthenticationException
from plane.db.models import Account
from plane.utils.path_validator import validate_next_path

# The profile settings modal is not routable; these query params are picked up
# by the web app to reopen the modal on the connectors tab and show a toast
CONNECT_TAB_PARAM = "profile_settings_tab=linked-accounts"


def _connect_redirect(base_host, next_path, extra_params):
    path = str(validate_next_path(next_path)) if next_path else "/"
    separator = "&" if "?" in path else "?"
    url = urljoin(base_host, f"{path}{separator}{CONNECT_TAB_PARAM}&{urlencode(extra_params)}")
    return HttpResponseRedirect(url)


def handle_connect_callback(request, provider, connect_user_id, base_host, next_path):
    """Attach the OAuth account from `provider` to the currently logged-in user.

    Used when the OAuth flow was initiated with ?connect=1 by an authenticated
    user. Unlike the normal login flow this NEVER switches the session, never
    creates users, and does not care whether the provider email matches.
    """
    # The binding session must still belong to the initiating user
    if not request.user.is_authenticated or str(request.user.id) != str(connect_user_id):
        return _connect_redirect(base_host, next_path, {"connect_error": "not_authenticated"})

    try:
        provider.set_token_data()
        provider.set_user_data()
    except AuthenticationException:
        return _connect_redirect(base_host, next_path, {"connect_error": "provider_error"})

    provider_account_id = str(provider.user_data.get("user", {}).get("provider_id"))

    # (provider, provider_account_id) is globally unique - refuse to steal a
    # social account already connected to a different user
    existing = Account.objects.filter(
        provider=provider.provider, provider_account_id=provider_account_id
    ).first()
    if existing and str(existing.user_id) != str(connect_user_id):
        return _connect_redirect(base_host, next_path, {"connect_error": "already_connected"})

    provider.create_update_account(user=request.user)

    return _connect_redirect(base_host, next_path, {"connected": provider.provider})
