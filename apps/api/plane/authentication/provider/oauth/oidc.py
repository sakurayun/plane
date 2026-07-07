# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
import os
from datetime import datetime, timedelta
from urllib.parse import urlencode, urlparse

import pytz

# Module imports
from plane.authentication.adapter.oauth import OauthAdapter
from plane.license.utils.instance_value import get_configuration_value
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)


class OIDCOAuthProvider(OauthAdapter):
    """Generic OIDC provider (Logto, Keycloak, Authentik, ...).

    Unlike the host-based providers (Gitea/GitLab), the authorize, token and
    userinfo endpoints are configured independently so any OIDC-compliant IdP
    can be plugged in.
    """

    provider = "oidc"
    scope = "openid profile email"

    def __init__(self, request, code=None, state=None, callback=None):
        (
            OIDC_CLIENT_ID,
            OIDC_CLIENT_SECRET,
            OIDC_URL_AUTHORIZE,
            OIDC_URL_TOKEN,
            OIDC_URL_USERINFO,
        ) = get_configuration_value(
            [
                {
                    "key": "OIDC_CLIENT_ID",
                    "default": os.environ.get("OIDC_CLIENT_ID"),
                },
                {
                    "key": "OIDC_CLIENT_SECRET",
                    "default": os.environ.get("OIDC_CLIENT_SECRET"),
                },
                {
                    "key": "OIDC_URL_AUTHORIZE",
                    "default": os.environ.get("OIDC_URL_AUTHORIZE"),
                },
                {
                    "key": "OIDC_URL_TOKEN",
                    "default": os.environ.get("OIDC_URL_TOKEN"),
                },
                {
                    "key": "OIDC_URL_USERINFO",
                    "default": os.environ.get("OIDC_URL_USERINFO"),
                },
            ]
        )

        if not (
            OIDC_CLIENT_ID and OIDC_CLIENT_SECRET and OIDC_URL_AUTHORIZE and OIDC_URL_TOKEN and OIDC_URL_USERINFO
        ):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"],
                error_message="OIDC_NOT_CONFIGURED",
            )

        # Enforce http(s) scheme on all endpoints
        for endpoint in (OIDC_URL_AUTHORIZE, OIDC_URL_TOKEN, OIDC_URL_USERINFO):
            parsed = urlparse(endpoint)
            if not parsed.scheme or parsed.scheme not in ("https", "http"):
                raise AuthenticationException(
                    error_code=AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"],
                    error_message="OIDC_NOT_CONFIGURED",  # avoid leaking details to query params
                )

        self.token_url = OIDC_URL_TOKEN
        self.userinfo_url = OIDC_URL_USERINFO

        client_id = OIDC_CLIENT_ID
        client_secret = OIDC_CLIENT_SECRET

        redirect_uri = f"{'https' if request.is_secure() else 'http'}://{request.get_host()}/auth/oidc/callback/"
        url_params = {
            "client_id": client_id,
            "scope": self.scope,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
        }
        auth_url = f"{OIDC_URL_AUTHORIZE}{'&' if urlparse(OIDC_URL_AUTHORIZE).query else '?'}{urlencode(url_params)}"

        super().__init__(
            request,
            self.provider,
            client_id,
            self.scope,
            redirect_uri,
            auth_url,
            self.token_url,
            self.userinfo_url,
            client_secret,
            code,
            callback=callback,
        )

    def set_token_data(self):
        # client_secret_basic is the OIDC spec default and the only method
        # accepted by several IdPs (e.g. Logto traditional web apps), so the
        # secret goes into the Authorization header instead of the form body
        data = {
            "code": self.code,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }
        basic_auth = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {basic_auth}",
        }
        token_response = self.get_user_token(data=data, headers=headers)
        super().set_token_data(
            {
                "access_token": token_response.get("access_token"),
                "refresh_token": token_response.get("refresh_token", None),
                "access_token_expired_at": (
                    datetime.now(tz=pytz.utc) + timedelta(seconds=int(token_response.get("expires_in")))
                    if token_response.get("expires_in")
                    else None
                ),
                "refresh_token_expired_at": None,
                "id_token": token_response.get("id_token", ""),
            }
        )

    def set_user_data(self):
        # Standard OIDC userinfo claims: sub, email, name, given_name,
        # family_name, picture
        user_info_response = self.get_user_response()

        email = user_info_response.get("email")
        if not email:
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_OAUTH_PROVIDER_ERROR"],
                error_message="OIDC_OAUTH_PROVIDER_ERROR: email claim missing, enable the email scope on the IdP",
            )

        first_name = user_info_response.get("given_name") or user_info_response.get("name") or email.split("@")[0]
        last_name = user_info_response.get("family_name") or ""

        super().set_user_data(
            {
                "email": email,
                "user": {
                    "provider_id": str(user_info_response.get("sub")),
                    "email": email,
                    "avatar": user_info_response.get("picture") or "",
                    "first_name": first_name,
                    "last_name": last_name,
                    "is_password_autoset": True,
                },
            }
        )
