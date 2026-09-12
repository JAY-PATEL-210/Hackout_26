#!/usr/bin/env python3
"""
setup_demo_users.py

Creates 3 demo accounts in Firebase Authentication and assigns custom role claims:
1. Operator / User      : user@windfarm.io       (role: "user")
2. Field Technician     : technician@windfarm.io (role: "technician")
3. Plant Manager        : manager@windfarm.io    (role: "manager")
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from firebase_setup import get_auth

DEMO_USERS = [
    {
        "email": "user@windfarm.io",
        "password": "User123!",
        "display_name": "Standard Operator",
        "role": "user",
    },
    {
        "email": "technician@windfarm.io",
        "password": "Tech123!",
        "display_name": "Senior Field Technician",
        "role": "technician",
    },
    {
        "email": "manager@windfarm.io",
        "password": "Manager123!",
        "display_name": "Operations Manager",
        "role": "manager",
    },
]


def create_demo_users():
    auth_client = get_auth()
    if not auth_client:
        print("[!] Firebase Auth client not available. Service account key required.")
        return False

    print("[*] Setting up demo users in Firebase Authentication...")

    for u in DEMO_USERS:
        email = u["email"]
        role = u["role"]
        try:
            # Check if user already exists
            try:
                user_record = auth_client.get_user_by_email(email)
                print(f"  [i] User {email} already exists (UID: {user_record.uid}).")
            except auth_client.UserNotFoundError:
                user_record = auth_client.create_user(
                    email=email,
                    password=u["password"],
                    display_name=u["display_name"],
                    email_verified=True,
                )
                print(f"  [✓] Created user {email} (UID: {user_record.uid}).")

            # Set custom role claim
            auth_client.set_custom_user_claims(user_record.uid, {"role": role})
            print(f"  [✓] Assigned custom claim {{'role': '{role}'}} to {email}")

        except Exception as e:
            print(f"  [!] Failed to configure user {email}: {e}")

    print("[✓] Demo users setup complete!")
    return True


if __name__ == "__main__":
    create_demo_users()
