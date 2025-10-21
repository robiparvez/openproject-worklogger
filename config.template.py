#!/usr/bin/env python3
"""
OpenProject Time Logging Script - Configuration Template

This file contains configuration template for the OpenProject API.
Copy this file to config.py and update the values below before running the main script.

Run 'python test_api.py' after configuration to get suggested project mappings
and verify your setup.
"""

CONFIG = {
    "base_url": "https://pm.reddotdigitalltd.com",

    # API token from Account Settings > Access Tokens
    "api_token": "your_api_token_here",

    # User ID for "Responsible" field on new work packages
    "accountable_user_id": 83,

    # User ID for "Assignee" field on new work packages
    "assignee_user_id": 83,
}

# Project name to ID mappings - use exact project names as they appear in JSON
# Run 'python test_api.py' to get the suggested mappings from your OpenProject instance
PROJECT_MAPPINGS = {
    "PROJECT_NAME_1": 64,
    "PROJECT_NAME_2": 65,
    "PROJECT_NAME_3": 66,
    # Add more projects as needed
    # Example mappings (update with your actual project names):
    # "HRIS": 63,
    # "CBL": 66,
    # "IDCOL": 64,
    # "ROBI-HR4U": 68,
    # "COMMON-SLASH-GENERAL-PURPOSE-AND-MEETINGS-HR-ACTIVITY": 132,
}

# Activity name to OpenProject activity ID mappings
# Update these IDs based on your OpenProject instance
ACTIVITY_MAPPINGS = {
    "Development": 3,
    "Support": 5,
    "Meeting": 14,
    "Testing": 4,
    "Specification": 2,
    "Other": 6,
    "Change Request": 15,
    "Management": 16,
}

# Default timezone for time calculations
DEFAULT_TIMEZONE = "Asia/Dhaka"

# Configuration Instructions:
#
# 1. Get API Token:
#    - Log into OpenProject
#    - Go to Account Settings > Access Tokens
#    - Create new API token
#    - Copy token to 'api_token' above
#
# 2. Find Project IDs and Names:
#    - Run: python test_api.py
#    - Copy the suggested PROJECT_MAPPINGS from the output
#    - Update PROJECT_MAPPINGS above with the exact project names
#    - Project names in JSON files must exactly match the keys in PROJECT_MAPPINGS
#
# 3. Find User IDs:
#    - Go to user profile or Administration > Users
#    - Check URL: /users/83 means ID is 83
#    - Update accountable_user_id and assignee_user_id
#
# 4. Test Configuration:
#    - Run: python test_api.py
#    - Verify connection and permissions
#    - All projects should show as accessible
