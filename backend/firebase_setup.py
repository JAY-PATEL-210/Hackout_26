#!/usr/bin/env python3
"""
firebase_setup.py

Initializes the Firebase Admin SDK using service account credentials.
Loads credentials securely from environment variables or a local key file.
Never hardcodes sensitive keys.
"""

import os
import json
import logging
from typing import Optional

import firebase_admin
from firebase_admin import credentials, firestore, auth

logger = logging.getLogger("firebase_setup")

PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "hackout-26")

_cached_app = None
_cached_db = None


def get_credentials():
    """
    Locates and returns Firebase Admin credentials using:
    1. FIREBASE_SERVICE_ACCOUNT_KEY (path to service account JSON)
    2. FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON string)
    3. GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON)
    4. Local backend/serviceAccountKey.json (if present)
    5. Application Default Credentials fallback
    """
    # 1. Path in env var
    env_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
    if env_path and os.path.exists(env_path):
        return credentials.Certificate(env_path)

    # 2. Raw JSON string in env var
    raw_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if raw_json:
        try:
            cert_dict = json.loads(raw_json)
            return credentials.Certificate(cert_dict)
        except Exception as e:
            logger.warning(f"Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: {e}")

    # 3. Google application credentials
    gac_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if gac_path and os.path.exists(gac_path):
        return credentials.Certificate(gac_path)

    # 4. Local candidate files in backend/ or root
    base_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(base_dir, "serviceAccountKey.json"),
        os.path.join(base_dir, "..", "serviceAccountKey.json"),
        os.path.join(base_dir, f"{PROJECT_ID}-firebase-adminsdk.json"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return credentials.Certificate(path)

    # 5. Default credentials fallback
    try:
        return credentials.ApplicationDefault()
    except Exception:
        return None


def init_firebase():
    """Initializes and caches the Firebase Admin App."""
    global _cached_app, _cached_db
    if _cached_app is not None:
        return _cached_app, _cached_db

    try:
        cred = get_credentials()
        options = {"projectId": PROJECT_ID}
        if cred:
            _cached_app = firebase_admin.initialize_app(cred, options)
            logger.info(f"Firebase Admin initialized with certificate for project '{PROJECT_ID}'.")
        else:
            # Fallback initialization for environment where credentials will be mounted
            _cached_app = firebase_admin.initialize_app(options=options)
            logger.info(f"Firebase Admin initialized with project options for '{PROJECT_ID}'.")

        _cached_db = firestore.client()
    except ValueError:
        # Already initialized
        _cached_app = firebase_admin.get_app()
        _cached_db = firestore.client()
    except Exception as e:
        logger.error(f"Error initializing Firebase Admin: {e}")
        _cached_db = None

    return _cached_app, _cached_db


app, db = init_firebase()


def get_db():
    global _cached_db
    if _cached_db is None:
        _, _cached_db = init_firebase()
    return _cached_db


def get_auth():
    init_firebase()
    return auth
