#!/usr/bin/env python3
"""
provision_fixed_accounts.py

One-time setup script: creates the fixed Technician and Manager accounts
in Firebase Authentication and sets their custom role claims.

Run once during setup:
    python3 backend/provision_fixed_accounts.py

Requires backend/serviceAccountKey.json (Firebase Admin SDK service account).
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from firebase_setup import get_auth

FIXED_ACCOUNTS = [
    {
        "email": "tech123@gmail.com",
        "password": "1234",
        "display_name": "Field Technician",
        "role": "technician",
    },
    {
        "email": "man123@gmail.com",
        "password": "1234",
        "display_name": "Operations Manager",
        "role": "manager",
    },
]


def provision():
    auth_client = get_auth()
    if not auth_client:
        print("[!] Firebase Admin SDK not initialized.")
        print("    Place your serviceAccountKey.json in backend/ and retry.")
        sys.exit(1)

    print("[*] Provisioning fixed accounts in Firebase Authentication...\n")
    for acct in FIXED_ACCOUNTS:
        email = acct["email"]
        role  = acct["role"]

        # Create or fetch
        try:
            try:
                user_record = auth_client.get_user_by_email(email)
                print(f"  [i] Account already exists: {email}  (UID: {user_record.uid})")
            except Exception:
                user_record = auth_client.create_user(
                    email=email,
                    password=acct["password"],
                    display_name=acct["display_name"],
                    email_verified=True,
                )
                print(f"  [✓] Created account: {email}  (UID: {user_record.uid})")

            # Set custom claim
            auth_client.set_custom_user_claims(user_record.uid, {"role": role})
            print(f"  [✓] Set custom claim  role='{role}'  on {email}")

        except Exception as exc:
            print(f"  [!] Failed for {email}: {exc}")

    print("\n[✓] Provisioning complete.")
    print("    Technician  → tech123@gmail.com  / 1234")
    print("    Manager     → man123@gmail.com   / 1234")


if __name__ == "__main__":
    provision()
