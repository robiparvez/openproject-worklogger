#!/usr/bin/env python3
"""
OpenProject Time Logging Script

This script allows logging spent time to OpenProject tasks via the API.
It can either log individual time entries or parse daily work logs for batch processing.
"""

import requests
import re
import os
import json
from datetime import datetime, timedelta
from requests.auth import HTTPBasicAuth
from config import (
    CONFIG,
    PROJECT_MAPPINGS,
    ACTIVITY_MAPPINGS,
)


def validate_entry_data(entry_data, entry_index=None):
    """Validate entry data against required schema and allowed values."""
    errors = []
    prefix = f"Entry {entry_index}: " if entry_index is not None else "Entry: "

    # Required fields validation
    required_fields = ["project", "subject", "duration_hours", "activity", "is_scrum"]
    for field in required_fields:
        if field not in entry_data:
            errors.append(f"{prefix}Missing required field '{field}'")
        elif entry_data[field] is None:
            errors.append(f"{prefix}Field '{field}' cannot be null")

    # Project validation
    if "project" in entry_data and entry_data["project"]:
        if entry_data["project"] not in PROJECT_MAPPINGS:
            allowed_projects = list(PROJECT_MAPPINGS.keys())
            errors.append(
                f"{prefix}Invalid project '{entry_data['project']}'. Allowed values: {allowed_projects}"
            )

    # Subject validation
    if "subject" in entry_data:
        if (
            not isinstance(entry_data["subject"], str)
            or not entry_data["subject"].strip()
        ):
            errors.append(f"{prefix}Field 'subject' must be a non-empty string")

    # Duration hours validation
    if "duration_hours" in entry_data:
        try:
            duration = float(entry_data["duration_hours"])
            if duration <= 0:
                errors.append(f"{prefix}Field 'duration_hours' must be greater than 0")
        except (TypeError, ValueError):
            errors.append(
                f"{prefix}Field 'duration_hours' must be a number (integer or float)"
            )

    # Activity validation
    if "activity" in entry_data and entry_data["activity"]:
        if entry_data["activity"] not in ACTIVITY_MAPPINGS:
            allowed_activities = list(ACTIVITY_MAPPINGS.keys())
            errors.append(
                f"{prefix}Invalid activity '{entry_data['activity']}'. Allowed values: {allowed_activities}"
            )

    # is_scrum validation
    if "is_scrum" in entry_data:
        if not isinstance(entry_data["is_scrum"], bool):
            errors.append(f"{prefix}Field 'is_scrum' must be a boolean (true or false)")

    # break_hours validation (nullable)
    if "break_hours" in entry_data and entry_data["break_hours"] is not None:
        try:
            break_hours = float(entry_data["break_hours"])
            if break_hours < 0:
                errors.append(f"{prefix}Field 'break_hours' must be 0 or greater")
        except (TypeError, ValueError):
            errors.append(
                f"{prefix}Field 'break_hours' must be a number (integer or float) or null"
            )

    # work_package_id validation (nullable, integer only)
    if "work_package_id" in entry_data and entry_data["work_package_id"] is not None:
        try:
            wp_id = int(entry_data["work_package_id"])
            if wp_id <= 0:
                errors.append(
                    f"{prefix}Field 'work_package_id' must be a positive integer"
                )
        except (TypeError, ValueError):
            errors.append(f"{prefix}Field 'work_package_id' must be an integer or null")

    return errors


class WorkLogParser:
    """Parses daily work log files and extracts time entry information."""

    def __init__(self, file_path=None):
        self.file_path = file_path
        self.project_mappings = PROJECT_MAPPINGS

        self.activity_keywords = {
            "scrum": "Meeting",
            "meeting": "Meeting",
            "session": "Meeting",
            "clarification": "Meeting",
            "setup": "Development",
            "enhanced": "Development",
            "fixed": "Development",
            "fix": "Development",
            "route": "Development",
            "linkup": "Development",
            "template": "Development",
            "codes": "Development",
            "staging": "Support",
            "server": "Support",
            "feedback": "Specification",
            "recruitment": "Specification",
            "profile": "Development",
            "view": "Development",
        }

    def parse_work_log_file(self, file_path=None):
        """Parse a JSON work log file and return a dictionary of date entries."""
        if file_path is None:
            file_path = self.file_path

        if file_path is None:
            raise ValueError("No file path provided")

        if not os.path.exists(file_path):
            print(f"Work log file not found: {file_path}")
            return {}

        if not file_path.lower().endswith(".json"):
            raise ValueError(
                "Only JSON format work log files are supported. Please provide a .json file."
            )

        return self.parse_json_work_log_file(file_path)

    def parse_json_work_log_file(self, file_path):
        """Parse a JSON work log file and return a dictionary of date entries."""
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                data = json.load(file)

            return self.parse_json_work_log_content(data)
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON file: {e}")
            return {}
        except Exception as e:
            print(f"Error reading JSON file: {e}")
            return {}

    def parse_json_work_log_content(self, data):
        """Parse JSON work log content with multiple date entries and extract time entries."""
        all_time_entries = {}  # Dictionary with date as key

        if "logs" not in data:
            raise ValueError("Invalid JSON format: Missing 'logs' array")

        logs = data.get("logs", [])
        if not isinstance(logs, list):
            raise ValueError("Invalid JSON format: 'logs' must be an array")

        if not logs:
            raise ValueError("No log entries found in 'logs' array")

        for log_index, log_entry in enumerate(logs):
            if "date" not in log_entry:
                print(
                    f"Warning: Log entry {log_index + 1} missing 'date' field, skipping"
                )
                continue

            date_str = log_entry["date"]

            # Parse date in the required format (e.g., "sept-07-2025")
            try:
                parsed_date = self.parse_date_string(date_str)
            except ValueError as e:
                print(
                    f"Warning: Log entry {log_index + 1} has invalid date format '{date_str}': {e}"
                )
                continue

            entries = log_entry.get("entries", [])
            if not isinstance(entries, list):
                print(
                    f"Warning: Log entry {log_index + 1} 'entries' must be an array, skipping"
                )
                continue

            time_entries = []
            current_time = datetime.strptime("09:00", "%H:%M")

            for entry_index, entry_data in enumerate(entries):
                # Validate entry data
                validation_errors = validate_entry_data(entry_data, entry_index + 1)
                if validation_errors:
                    print(
                        f"Validation errors for log date {date_str}, entry {entry_index + 1}:"
                    )
                    for error in validation_errors:
                        print(f"  - {error}")
                    print("Skipping this entry due to validation errors.")
                    continue

                entry = self.parse_json_task_entry(
                    entry_data, current_time, parsed_date
                )
                if entry:
                    time_entries.append(entry)
                    current_time = entry["end_time"]

            if time_entries:
                all_time_entries[parsed_date] = time_entries

        return all_time_entries

    def parse_date_string(self, date_str):
        """Parse date string in the required format (e.g., 'sept-07-2025')."""
        month_names = {
            "jan": 1,
            "january": 1,
            "feb": 2,
            "february": 2,
            "mar": 3,
            "march": 3,
            "apr": 4,
            "april": 4,
            "may": 5,
            "jun": 6,
            "june": 6,
            "jul": 7,
            "july": 7,
            "aug": 8,
            "august": 8,
            "sep": 9,
            "sept": 9,
            "september": 9,
            "oct": 10,
            "october": 10,
            "nov": 11,
            "november": 11,
            "dec": 12,
            "december": 12,
        }

        # Expected format: month-day-year (e.g., "sept-07-2025")
        pattern = r"^(\w+)-(\d{1,2})-(\d{4})$"
        match = re.match(pattern, date_str.lower())

        if not match:
            raise ValueError(
                f"Date must be in format 'month-day-year' (e.g., 'sept-07-2025'), got '{date_str}'"
            )

        month_str, day, year = match.groups()
        month = month_names.get(month_str.lower())

        if not month:
            available_months = list(set(month_names.keys()))
            raise ValueError(
                f"Invalid month '{month_str}'. Available: {sorted(available_months)}"
            )

        try:
            return datetime(int(year), month, int(day)).date()
        except ValueError as e:
            raise ValueError(f"Invalid date values: {e}")

    def parse_json_task_entry(self, entry_data, start_time, entry_date):
        """Parse individual JSON task entry and extract time entry information."""
        project = entry_data.get("project")
        subject = entry_data.get("subject") or entry_data.get("description")
        activity = entry_data.get("activity", "Development")

        if not project or not subject:
            return None

        duration_hours = entry_data.get("duration_hours", 0)
        if isinstance(duration_hours, str):
            duration_hours = float(duration_hours.rstrip("h"))
        else:
            duration_hours = float(duration_hours) if duration_hours else 0

        if duration_hours == 0:
            return None

        is_scrum = entry_data.get("is_scrum", False)
        work_package_id = entry_data.get("work_package_id")
        break_hours = entry_data.get("break_hours") or 0
        break_minutes = int(break_hours * 60) if break_hours else 0

        if is_scrum:
            if not work_package_id:
                return None
            actual_start_time = datetime.strptime("10:00", "%H:%M").replace(
                year=entry_date.year, month=entry_date.month, day=entry_date.day
            )
            end_time = actual_start_time + timedelta(hours=duration_hours)
            work_package_id = (
                int(work_package_id)
                if isinstance(work_package_id, str)
                else work_package_id
            )
            create_new_task = False
            break_minutes = 0
            break_hours = 0
        else:
            actual_start_time = start_time + timedelta(minutes=break_minutes)
            # Use entry_date for the date part
            actual_start_time = actual_start_time.replace(
                year=entry_date.year, month=entry_date.month, day=entry_date.day
            )
            end_time = actual_start_time + timedelta(hours=duration_hours)

            if work_package_id:
                work_package_id = int(work_package_id)
                create_new_task = False
            else:
                work_package_id = None
                create_new_task = True

        return {
            "project": project,
            "work_package_id": work_package_id,
            "project_id": self.project_mappings.get(project),
            "subject": subject,
            "activity": activity,
            "start_time": actual_start_time,
            "end_time": end_time,
            "hours": duration_hours,
            "break_minutes": break_minutes,
            "break_hours": break_hours,
            "create_new_task": create_new_task,
            "is_scrum": is_scrum,
            "needs_user_choice": not is_scrum and not work_package_id,
            "entry_date": entry_date,  # Add date information
        }

    def determine_activity(self, task_description):
        """Determine the activity type based on task description."""
        task_lower = task_description.lower()

        for keyword, activity in self.activity_keywords.items():
            if keyword in task_lower:
                return activity

        return "Development"


class OpenProjectTimeLogger:
    """Handles time logging operations for OpenProject tasks."""

    def __init__(self, base_url, api_token):
        self.base_url = base_url.rstrip("/")
        self.api_token = api_token
        self.session = requests.Session()
        self._setup_authentication()

    def _setup_authentication(self):
        """Setup API token authentication for API requests."""
        self.session.auth = HTTPBasicAuth("apikey", self.api_token)
        self.session.headers.update(
            {"Content-Type": "application/json", "Accept": "application/hal+json"}
        )

    def get_work_package_info(self, work_package_id):
        """Retrieve work package information to validate the task exists."""
        url = f"{self.base_url}/api/v3/work_packages/{work_package_id}"

        try:
            response = self.session.get(url)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching work package info: {e}")
            return None

    def get_current_user(self):
        """Retrieve current user information."""
        url = f"{self.base_url}/api/v3/users/me"

        try:
            response = self.session.get(url)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching current user info: {e}")
            return None

    def check_existing_work_package_by_subject(self, project_id, subject):
        """Check if a work package with the same subject already exists in the project."""
        url = f"{self.base_url}/api/v3/projects/{project_id}/work_packages"

        normalized_subject = subject.strip().lower()

        try:
            params = {"pageSize": 100, "offset": 1}

            all_work_packages = []
            page = 1

            while True:
                params["offset"] = page
                response = self.session.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                if "_embedded" in data and "elements" in data["_embedded"]:
                    work_packages = data["_embedded"]["elements"]
                    all_work_packages.extend(work_packages)

                    total = data.get("total", 0)
                    current_count = len(all_work_packages)

                    if current_count >= total or len(work_packages) == 0:
                        break

                    page += 1
                else:
                    break

            for wp in all_work_packages:
                wp_subject = wp.get("subject", "").strip().lower()
                if wp_subject == normalized_subject:
                    return wp

            return None

        except requests.exceptions.RequestException as e:
            print(f"Warning: Could not check existing work packages: {e}")
            return None

    def check_existing_time_entries(self, work_package_id, date, activity_name=None):
        """Check if time entries already exist for the given work package and date."""
        url = f"{self.base_url}/api/v3/time_entries"

        try:
            response = self.session.get(url)
            response.raise_for_status()
            data = response.json()

            existing_entries = []
            if "_embedded" in data and "elements" in data["_embedded"]:
                all_entries = data["_embedded"]["elements"]

                for entry in all_entries:
                    wp_href = (
                        entry.get("_links", {}).get("workPackage", {}).get("href", "")
                    )
                    if not wp_href.endswith(f"/{work_package_id}"):
                        continue

                    entry_date = entry.get("spentOn")
                    if entry_date != date.strftime("%Y-%m-%d"):
                        continue

                    if activity_name:
                        activity_mapping = {
                            "development": 3,
                            "support": 5,
                            "meeting": 14,
                            "specification": 2,
                            "testing": 4,
                            "other": 6,
                            "change request": 15,
                            "management": 16,
                        }
                        target_activity_id = activity_mapping.get(activity_name.lower())
                        if target_activity_id:
                            activity_href = (
                                entry.get("_links", {})
                                .get("activity", {})
                                .get("href", "")
                            )
                            if not activity_href.endswith(f"/{target_activity_id}"):
                                continue

                    existing_entries.append(entry)

            return existing_entries

        except requests.exceptions.RequestException as e:
            print(f"Warning: Could not check existing time entries: {e}")
            return []

    def parse_time_input(self, time_str):
        """Parse time string in various formats (HH:MM AM/PM, HH:MM, etc.)."""
        time_str = time_str.strip()

        try:
            if "AM" in time_str.upper() or "PM" in time_str.upper():
                return datetime.strptime(time_str.upper(), "%I:%M %p").time()
            else:
                return datetime.strptime(time_str, "%H:%M").time()
        except ValueError:
            try:
                return datetime.strptime(time_str, "%H").time()
            except ValueError:
                raise ValueError(f"Invalid time format: {time_str}")

    def calculate_finish_time(self, start_time, hours):
        """Calculate finish time based on start time and duration."""
        start_datetime = datetime.combine(datetime.today(), start_time)
        finish_datetime = start_datetime + timedelta(hours=hours)
        return finish_datetime.time()

    def format_time_for_display(self, time_obj):
        """Format time object for display in 12-hour format."""
        return time_obj.strftime("%I:%M %p").lstrip("0")

    def create_work_package(
        self,
        project_id,
        subject,
        activity_type="Development",
        description="",
        status_id=7,
    ):

        existing_wp = self.check_existing_work_package_by_subject(project_id, subject)
        if existing_wp:
            existing_id = existing_wp.get("id")
            print(
                f"  ✓ Found existing work package with same subject (ID: {existing_id})"
            )
            return existing_id

        type_mapping = {
            "Development": 1,
            "Support": 1,
            "Meeting": 1,
            "Specification": 1,
            "Testing": 1,
            "Other": 1,
        }

        type_id = type_mapping.get(activity_type, 1)

        accountable_user_id = CONFIG.get("accountable_user_id")
        assignee_user_id = CONFIG.get("assignee_user_id")

        work_package_data = {
            "subject": subject,
            "_links": {
                "project": {"href": f"/api/v3/projects/{project_id}"},
                "type": {"href": f"/api/v3/types/{type_id}"},
                "status": {"href": f"/api/v3/statuses/{status_id}"},
            },
        }

        if description:
            work_package_data["description"] = {
                "format": "markdown",
                "raw": description,
            }

        if accountable_user_id:
            work_package_data["_links"]["responsible"] = {
                "href": f"/api/v3/users/{accountable_user_id}"
            }

        if assignee_user_id:
            work_package_data["_links"]["assignee"] = {
                "href": f"/api/v3/users/{assignee_user_id}"
            }

        url = f"{self.base_url}/api/v3/work_packages"

        try:
            response = self.session.post(url, json=work_package_data)
            if response.status_code == 201:
                work_package = response.json()
                return work_package.get("id")
            elif response.status_code == 422:
                error_data = response.json()
                print(f"Validation error creating work package:")
                if "_embedded" in error_data and "errors" in error_data["_embedded"]:
                    for error in error_data["_embedded"]["errors"]:
                        print(f"  - {error.get('message', 'Unknown error')}")
                else:
                    print(f"  - {response.text}")
                return None
            else:
                response.raise_for_status()
                return response.json().get("id")
        except requests.exceptions.RequestException as e:
            print(f"Error creating work package: {e}")
            if hasattr(e, "response") and e.response is not None:
                print(f"Response: {e.response.text}")
            return None

    def create_time_entry(
        self, work_package_id, date, start_time, hours, activity_name, comment=""
    ):
        """Create a time entry for the specified work package."""

        activity_mapping = {
            "development": 3,
            "support": 5,
            "meeting": 14,
            "specification": 2,
            "testing": 4,
            "other": 6,
            "change request": 15,
            "management": 16,
        }

        activity_id = activity_mapping.get(activity_name.lower(), 3)

        time_entry_data = {
            "spentOn": date.strftime("%Y-%m-%d"),
            "hours": f"PT{hours}H",
            "comment": comment,
            "_links": {
                "workPackage": {"href": f"/api/v3/work_packages/{work_package_id}"},
                "activity": {"href": f"/api/v3/time_entries/activities/{activity_id}"},
            },
        }

        url = f"{self.base_url}/api/v3/time_entries"

        try:
            response = self.session.post(url, json=time_entry_data)
            if response.status_code == 201:
                return response.json()
            elif response.status_code == 422:
                error_data = response.json()
                print("Validation error:")
                if "_embedded" in error_data and "errors" in error_data["_embedded"]:
                    for error in error_data["_embedded"]["errors"]:
                        print(f"  - {error.get('message', 'Unknown error')}")
                else:
                    print(f"  - {response.text}")
                return None
            else:
                response.raise_for_status()
                return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error creating time entry: {e}")
            if hasattr(e, "response") and e.response is not None:
                print(f"Response: {e.response.text}")
            return None

    def dry_run_work_package_analysis(self, work_log_entries):
        """Analyze which work packages exist and which will be created without making changes."""
        print("\n" + "=" * 60)
        print("WORK PACKAGE ANALYSIS")
        print("=" * 60)

        existing_packages = []
        new_packages = []
        scrum_packages = []
        existing_wp_packages = []

        for entry in work_log_entries:
            if entry.get("is_scrum", False):
                scrum_packages.append(entry)
            elif entry.get("create_new_task", False):
                project_id = entry.get("project_id")
                if project_id:
                    existing_wp = self.check_existing_work_package_by_subject(
                        project_id, entry["subject"]
                    )
                    if existing_wp:
                        existing_packages.append(
                            {
                                "entry": entry,
                                "existing_id": existing_wp.get("id"),
                                "existing_subject": existing_wp.get("subject", ""),
                            }
                        )
                    else:
                        new_packages.append(entry)
                else:
                    print(
                        f"⚠ Warning: No project ID found for {entry['project']} - {entry['subject']}"
                    )
            else:
                existing_wp_packages.append(entry)

        if scrum_packages:
            print(f"\n📅 SCRUM ENTRIES ({len(scrum_packages)}):")
            for entry in scrum_packages:
                wp_id = entry.get("work_package_id", "Not configured")
                print(
                    f"  • [{entry['project']}] {entry['subject']} → Work Package ID: {wp_id}"
                )

        if existing_wp_packages:
            print(f"\n🔗 EXISTING WORK PACKAGE ENTRIES ({len(existing_wp_packages)}):")
            for entry in existing_wp_packages:
                print(
                    f"  • [{entry['project']}] {entry['subject']} → Work Package ID: {entry['work_package_id']}"
                )

        if existing_packages:
            print(f"\n✅ EXISTING WORK PACKAGES FOUND ({len(existing_packages)}):")
            for pkg in existing_packages:
                entry = pkg["entry"]
                print(f"  • [{entry['project']}] {entry['subject']}")
                print(f"    → Will use existing Work Package ID: {pkg['existing_id']}")

        if new_packages:
            print(f"\n🆕 NEW WORK PACKAGES TO CREATE ({len(new_packages)}):")
            for i, entry in enumerate(new_packages, 1):
                print(f"  • [{entry['project']}] {entry['subject']}")

                print(
                    f"\n--- Configuration for work package {i}/{len(new_packages)} ---"
                )

                comment = get_work_package_comment(entry["subject"])
                entry["work_package_comment"] = comment
                if comment:
                    print(f"    → Comment: {comment}")

                status_id = get_work_package_status()
                entry["work_package_status_id"] = status_id

                # Get status name for display
                status_names = {
                    1: "New",
                    2: "To Do",
                    7: "In Progress",
                    11: "Developed",
                    12: "Closed",
                    13: "Rejected",
                    14: "On Hold",
                }
                status_name = status_names.get(status_id, f"Status ID {status_id}")
                print(f"    → Will create new work package with status '{status_name}'")

        print(f"\n" + "=" * 60)
        print("SUMMARY:")
        print(f"  SCRUM entries: {len(scrum_packages)}")
        print(f"  Existing work package entries: {len(existing_wp_packages)}")
        print(f"  Existing work packages (will reuse): {len(existing_packages)}")
        print(f"  New work packages (will create): {len(new_packages)}")
        print("=" * 60)

        return {
            "scrum": scrum_packages,
            "existing_wp": existing_wp_packages,
            "existing": existing_packages,
            "new": new_packages,
        }

    def process_work_log_entries(self, work_log_entries, date):
        """Process multiple work log entries and create time entries."""
        successful_entries = []
        failed_entries = []

        print(
            f"\nProcessing {len(work_log_entries)} work log entries for {date.strftime('%Y-%m-%d')}"
        )
        print("=" * 60)

        for i, entry in enumerate(work_log_entries, 1):
            print(
                f"\n[{i}/{len(work_log_entries)}] Processing: {entry['project']} - {entry['subject'][:50]}..."
            )
            print(
                f"  Time: {entry['start_time'].strftime('%H:%M')} - {entry['end_time'].strftime('%H:%M')} ({entry['hours']} hrs)"
            )
            print(f"  Activity: {entry['activity']}")

            work_package_id = entry["work_package_id"]

            if entry.get("is_scrum", False) and work_package_id:
                existing_entries = self.check_existing_time_entries(
                    work_package_id, date, entry["activity"]
                )
                if existing_entries:
                    print(
                        f"  ⚠ SCRUM entry already exists for {date.strftime('%Y-%m-%d')} - skipping"
                    )
                    print(
                        f"    Found {len(existing_entries)} existing SCRUM time entries"
                    )
                    continue

            if entry.get("create_new_task", False):
                print(f"  Checking for existing work package: {entry['subject']}")
                project_id = entry.get("project_id")
                if project_id:
                    comment = entry.get("work_package_comment", "")
                    status_id = entry.get(
                        "work_package_status_id", 7
                    )  # Default to "In Progress"
                    work_package_id = self.create_work_package(
                        project_id,
                        entry["subject"],
                        entry["activity"],
                        comment,
                        status_id,
                    )
                    if work_package_id:
                        # Check if time entry already exists for this work package
                        existing_entries = self.check_existing_time_entries(
                            work_package_id, date, entry["activity"]
                        )
                        if existing_entries:
                            print(
                                f"  ⚠ Time entry already exists for {date.strftime('%Y-%m-%d')} - skipping"
                            )
                            print(
                                f"    Found {len(existing_entries)} existing time entries"
                            )
                            continue
                    else:
                        print(f"  ✗ Failed to create work package")
                        failed_entries.append(entry)
                        continue
                else:
                    print(f"  ✗ No project ID found for {entry['project']}")
                    failed_entries.append(entry)
                    continue
            else:
                print(f"  Using existing work package ID: {work_package_id}")
                # Check if time entry already exists for existing work packages too
                existing_entries = self.check_existing_time_entries(
                    work_package_id, date, entry["activity"]
                )
                if existing_entries:
                    print(
                        f"  ⚠ Time entry already exists for {date.strftime('%Y-%m-%d')} - skipping"
                    )
                    print(f"    Found {len(existing_entries)} existing time entries")
                    continue

            result = self.create_time_entry(
                work_package_id,
                date,
                entry["start_time"].time(),
                entry["hours"],
                entry["activity"],
                f"[{entry['project']}] {entry['subject']}",
            )

            if result:
                print(
                    f"  ✓ Successfully created time entry (ID: {result.get('id', 'Unknown')})"
                )
                successful_entries.append(entry)
            else:
                print(f"  ✗ Failed to create time entry")
                failed_entries.append(entry)

        print(f"\n" + "=" * 60)
        print(
            f"SUMMARY: {len(successful_entries)} successful, {len(failed_entries)} failed"
        )
        print("=" * 60)

        return successful_entries, failed_entries


def get_work_log_file_input():
    """Get the logs.json file path."""
    expected_file = "logs.json"

    if os.path.exists(expected_file):
        print(f"Found work log file: {expected_file}")
        return expected_file
    else:
        print(
            f"Error: Could not find required file '{expected_file}' in the current directory."
        )
        print(
            "Please ensure you have a 'logs.json' file in the project root."
        )
        return None


def get_yes_no_input(prompt):
    """Get yes/no input from user, only allowing 'y' or 'n'."""
    while True:
        response = input(f"{prompt} (y/n): ").strip().lower()
        if response in ["y", "n"]:
            return response == "y"
        else:
            print("Please enter 'y' for yes or 'n' for no.")


def get_work_package_comment(task_subject):
    """Get optional comment/description for a new work package."""
    comment = input("Enter comment (or press Enter to skip): ").strip()
    return comment if comment else ""


def get_work_package_status():
    """Get work package status from user input."""
    status_mapping = {
        "1": {"id": 1, "name": "New"},
        "2": {"id": 2, "name": "To Do"},
        "3": {"id": 7, "name": "In Progress"},
        "4": {"id": 11, "name": "Developed"},
        "5": {"id": 12, "name": "Closed"},
        "6": {"id": 13, "name": "Rejected"},
        "7": {"id": 14, "name": "On Hold"},
    }

    print("\nAvailable statuses:")
    for key, status in status_mapping.items():
        print(f"  {key}. {status['name']}")

    while True:
        choice = input(
            "Select status (1-7, or press Enter for 'In Progress'): "
        ).strip()

        if not choice:  # Default to "In Progress"
            return status_mapping["3"]["id"]

        if choice in status_mapping:
            selected_status = status_mapping[choice]
            print(f"Selected status: {selected_status['name']}")
            return selected_status["id"]
        else:
            print("Invalid choice. Please select 1-7 or press Enter for default.")


def get_user_work_package_choices(work_log_entries):
    """Process work package handling for non-SCRUM tasks automatically."""
    updated_entries = []

    for entry in work_log_entries:
        if entry.get("needs_user_choice", False):
            entry["create_new_task"] = True
            entry["work_package_id"] = None
        updated_entries.append(entry)

    return updated_entries


def main():
    """Main execution function."""
    config = CONFIG

    logger = OpenProjectTimeLogger(config["base_url"], config["api_token"])

    print("\nOpenProject Work Log Processor")
    print("=" * 40)

    work_log_file = get_work_log_file_input()

    if not work_log_file:
        print("No work log file found. Exiting.")
        return

    print(f"Processing work log file: {work_log_file}")

    parser = WorkLogParser(work_log_file)
    try:
        all_date_entries = parser.parse_work_log_file()
    except (ValueError, json.JSONDecodeError) as e:
        print(f"Error parsing work log file: {e}")
        return

    if not all_date_entries:
        print("No valid time entries found in the work log file.")
        return

    # Process each date separately
    for date, work_log_entries in all_date_entries.items():
        print(f"\n" + "=" * 80)
        print(
            f"PROCESSING DATE: {date.strftime('%Y-%m-%d')} ({date.strftime('%A, %B %d, %Y')})"
        )
        print("=" * 80)

        if not work_log_entries:
            print(f"No entries found for {date.strftime('%Y-%m-%d')}, skipping.")
            continue

        work_log_entries = get_user_work_package_choices(work_log_entries)

        # Check if first record is not SCRUM and prompt for start time
        if work_log_entries and not work_log_entries[0].get("is_scrum", False):
            print("\n" + "=" * 50)
            print("⏰ START TIME CONFIGURATION")
            print("=" * 50)
            print(
                f"Enter the start time for the first task on {date.strftime('%Y-%m-%d')}"
            )

            while True:
                try:
                    start_time_input = input(
                        "Enter start time (e.g., 9:00 AM, 09:30, 14:30): "
                    ).strip()
                    if not start_time_input:
                        print("Start time is required. Please enter a valid time.")
                        continue

                    # Parse the time input
                    start_time = logger.parse_time_input(start_time_input)

                    # Update all entries with the new start time
                    current_time = datetime.combine(date, start_time)

                    print(
                        f"\nUpdating work log entries with start time: {logger.format_time_for_display(start_time)}"
                    )

                    for i, entry in enumerate(work_log_entries):
                        if i == 0:
                            # First entry starts at the specified time
                            entry["start_time"] = current_time
                        else:
                            # Add any break time to the current time
                            current_time += timedelta(
                                minutes=entry.get("break_minutes", 0)
                            )
                            entry["start_time"] = current_time

                        # Calculate end time
                        entry["end_time"] = entry["start_time"] + timedelta(
                            hours=entry["hours"]
                        )
                        current_time = entry["end_time"]

                    print(
                        f"✓ All {len(work_log_entries)} entries updated with new timing"
                    )
                    break

                except ValueError as e:
                    print(f"Invalid time format: {e}")
                    print("Please use formats like: 9:00 AM, 2:30 PM, 09:00, 14:30")
                    continue

        analysis = logger.dry_run_work_package_analysis(work_log_entries)

        if not get_yes_no_input(
            f"\nProceed with processing entries for {date.strftime('%Y-%m-%d')}?"
        ):
            print(f"Processing cancelled for {date.strftime('%Y-%m-%d')}.")
            continue

        print(f"\n" + "=" * 60)
        print(f"WORK LOG ENTRIES PREVIEW - {date.strftime('%Y-%m-%d')}")
        print("=" * 60)

        total_hours = 0
        for i, entry in enumerate(work_log_entries, 1):
            print(f"{i}. [{entry['project']}] {entry['subject']}")
            print(
                f"   Time: {entry['start_time'].strftime('%H:%M')} - {entry['end_time'].strftime('%H:%M')} ({entry['hours']} hrs)"
            )
            print(f"   Activity: {entry['activity']}")

            if entry.get("is_scrum", False):
                print(f"   Work Package: SCRUM (ID: {entry['work_package_id']})")
            elif not entry.get("create_new_task", False):
                print(f"   Work Package: Existing (ID: {entry['work_package_id']})")

            # Show comment if available
            if entry.get("create_new_task", False):
                comment = entry.get("work_package_comment", "")
                if comment:
                    print(f"   Comment: {comment}")

            total_hours += entry["hours"]
            print()

        print(f"Total hours for {date.strftime('%Y-%m-%d')}: {total_hours}")
        print("=" * 60)

        if not get_yes_no_input(
            f"\nProcess all entries for {date.strftime('%Y-%m-%d')}?"
        ):
            print(f"Processing cancelled for {date.strftime('%Y-%m-%d')}.")
            continue

        successful, failed = logger.process_work_log_entries(work_log_entries, date)

        if failed:
            print(
                f"\n{len(failed)} entries failed for {date.strftime('%Y-%m-%d')}. Would you like to retry them individually?"
            )
            if get_yes_no_input("Retry failed entries?"):
                for entry in failed:
                    print(f"\nRetrying: {entry['subject']}")
                    result = logger.create_time_entry(
                        entry["work_package_id"],
                        date,
                        entry["start_time"].time(),
                        entry["hours"],
                        entry["activity"],
                        f"[{entry['project']}] {entry['subject']}",
                    )
                    if result:
                        print("✓ Success on retry")
                    else:
                        print("✗ Failed again")

    print(f"\n" + "=" * 80)
    print("ALL DATES PROCESSED")
    print("=" * 80)


if __name__ == "__main__":
    main()
