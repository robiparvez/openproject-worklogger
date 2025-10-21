#!/usr/bin/env python3
"""
OpenProject Time Logging Script - Configuration

This file contains configuration settings for the OpenProject API.
Update the credentials and settings below before running the main script.
"""

CONFIG = {
    "base_url": "https://pm.reddotdigitalltd.com",
    "api_token": "a40c1095f43449186bcd86d0d05802a12c01af8c721409525da611f25b630ac7",
    "accountable_user_id": 83,  # M. D. Robiuzzaman Parvez
    "assignee_user_id": 83,  # M. D. Robiuzzaman Parvez
}

PROJECT_MAPPINGS = {
    "HRIS": 63,
    "CBL": 66,
    "SEBL": 65,
    "IDCOL": 64,
    "JBL": 67,
    "ROBI-HR4U": 68,
    "GENERAL-PROJECT-TASKS-MEETING-AND-SCRUM": 115,
    "COMMON-SLASH-GENERAL-PURPOSE-AND-MEETINGS-HR-ACTIVITY": 132,
    "COMMON-SLASH-RESEARCH-AND-DEVELOPMENT-R-AND-D": 138,
    "COMMON-SLASH-RFS-AND-DEMO-SUPPORT": 140,
    "COMMON-SLASH-LEARNING-AND-UPSKILLING": 141,
    "ELEARNING": 130,
    "INFO360-1": 129,
    "NEXT-GENERATION-PROVISING-SYSTEM-NGPS": 41,
}

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

DEFAULT_TIMEZONE = "Asia/Dhaka"
