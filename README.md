# OpenProject Time Logger

A Python script to automatically log spent time to OpenProject tasks via API. Supports batch processing from a structured JSON work log file with intelligent work package management, strict validation, and multi-date processing.

## Features

- **Date-wise JSON Work Log Processing**: Parse structured JSON work log files containing multiple dates and create time entries automatically
- **Strict Data Validation**: Comprehensive validation ensures data integrity with required fields and allowed values
- **Smart Work Package Management**:
  - SCRUM activities use work package IDs directly from JSON data
  - Non-SCRUM tasks automatically create new work packages or reuse existing ones
  - Duplicate detection prevents creating work packages with identical subjects
- **Multi-date Processing**: Process work logs for multiple dates in a single run
- **Intelligent Time Calculations**:
  - SCRUM entries automatically start at 10:00 AM
  - Other tasks calculate start times dynamically using break periods
  - Sequential timing ensures proper time progression throughout the day
- **Duplicate Prevention**: Checks for existing time entries to prevent duplicates
- **Interactive Comments and Status Selection**: Prompts for optional comments and status when creating new work packages
- **Multi-project Support**: Supports all configured projects with strict validation
- **Dry-run Analysis**: Preview what will be created before processing
- **API Validation**: Comprehensive error handling and validation

## Setup

1. Install Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Configure the system in `config.py` (see Configuration Template below or copy from `config.template.py`):
   - Add your API token (get from OpenProject Account Settings > Access Tokens)
   - Configure project mappings for your projects
   - Configure activity mappings for your activities
   - Set user assignment IDs for new work packages

3. Test API connectivity:

   ```bash
   python test_api.py
   ```

## Quick Start

1. **First Time Setup**:
   - Copy `config.template.py` to `config.py` and update with your credentials
   - Run `python test_api.py` to verify your configuration

2. **Create Date-wise Work Log**:
   - Create a `logs.json` file in the project root directory
   - Use the required JSON format (see format section below)
   - Ensure all data follows the strict validation rules

3. **Process Work Logs**:
   - Run `python log.py`
   - The script automatically finds and processes `logs.json`
   - Review validation messages and dry-run analysis
   - Confirm to process entries for each date

## Usage

### Main Script - Date-wise JSON Work Log Processing

Run the main script:

```bash
python log.py
```

The script will:

1. **File Detection**: Automatically look for `logs.json` in the project root
2. **Data Validation**: Validate all entries against strict validation rules
3. **Date Processing**: Process each date separately with individual confirmations
4. **Work Package Analysis**: Show what will be created vs. reused for each date
5. **Comment & Status Collection**: Prompt for optional comments and status on new work packages
6. **Dry-run Preview**: Display complete analysis before processing
7. **Batch Processing**: Create all time entries and work packages per date

### Date-wise JSON Work Log File Format

Create a `logs.json` file in the project root using this structure:

```json
{
    "logs": [
        {
            "date": "aug-28-2025",
            "entries": [
                {
                    "project": "IDCOL",
                    "subject": "August Daily Scrum - 50000179",
                    "break_hours": null,
                    "duration_hours": 0.5,
                    "activity": "Meeting",
                    "is_scrum": true,
                    "work_package_id": 5641
                },
                {
                    "project": "IDCOL",
                    "subject": "Enhanced notification template setup datatable",
                    "break_hours": 0.25,
                    "duration_hours": 1.5,
                    "activity": "Development",
                    "is_scrum": false,
                    "work_package_id": null
                },
                {
                    "project": "SEBL",
                    "subject": "View profile route linkup on clickable name and email",
                    "break_hours": 0.167,
                    "duration_hours": 0.5,
                    "activity": "Development",
                    "is_scrum": false,
                    "work_package_id": null
                }
            ]
        },
        {
            "date": "aug-29-2025",
            "entries": [
                {
                    "project": "IDCOL",
                    "subject": "August Daily Scrum - 50000179",
                    "break_hours": null,
                    "duration_hours": 0.5,
                    "activity": "Meeting",
                    "is_scrum": true,
                    "work_package_id": 5641
                }
            ]
        }
    ]
}
```

**JSON Field Descriptions:**

- `logs`: Array containing multiple date entries for batch processing
- `date`: Date in "month-day-year" format (e.g., "aug-28-2025", "sept-07-2025")
- `entries`: Array of time entries for that specific date
- `project`: Project name (must exactly match keys in PROJECT_MAPPINGS)
- `subject`: Task description (becomes work package subject)
- `break_hours`: Break time before this task (decimal hours, null for first task)
- `duration_hours`: Task duration (decimal hours)
- `activity`: Activity type (Development, Meeting, Support, etc.)
- `is_scrum`: Boolean - true for SCRUM activities, false for regular tasks
- `work_package_id`: Integer for SCRUM tasks, null for others

**Time Calculation Logic:**

- **SCRUM entries**: Always start at 10:00 AM, ignore break_hours
- **Regular tasks**: Start time = previous task end time + break_hours
- **End time**: Always calculated as start_time + duration_hours

**Work Package Management:**

- **SCRUM tasks**: Use the `work_package_id` specified in JSON
- **Regular tasks with `work_package_id: null`**: Create new work packages automatically
- **Duplicate detection**: Reuses existing work packages with identical subjects

## Example

```text
OpenProject Work Log Processor
========================================

Found work log file: date-wise-Processing work log file: logs.json

================================================================================
PROCESSING DATE: 2025-08-28 (Thursday, August 28, 2025)
================================================================================

============================================================
WORK PACKAGE ANALYSIS
============================================================

📅 SCRUM ENTRIES (1):
  • [IDCOL] August Daily Scrum - 50000179 → Work Package ID: 5641

🆕 NEW WORK PACKAGES TO CREATE (3):
  • [IDCOL] Enhance candidate onboarding process with additional fields and validations

--- Configuration for work package 1/3 ---
Enter comment (or press Enter to skip): Added new validation fields
    → Comment: Added new validation fields

Available statuses:
  1. New
  2. To Do
  3. In Progress
  4. Developed
  5. Closed
  6. Rejected
  7. On Hold
Select status (1-7, or press Enter for 'In Progress'): 3
Selected status: In Progress
    → Will create new work package with status 'In Progress'

  • [IDCOL] Enhance head count entry management with desk selection and improved filtering options

--- Configuration for work package 2/3 ---
Enter comment (or press Enter to skip):
    → Will create new work package with status 'In Progress'

  • [IDCOL] Update validation rules in WebRegisterRequest to enforce maximum length for first and last names

--- Configuration for work package 3/3 ---
Enter comment (or press Enter to skip):
    → Will create new work package with status 'In Progress'

============================================================
SUMMARY:
  SCRUM entries: 1
  Existing work package entries: 0
  Existing work packages (will reuse): 0
  New work packages (will create): 3
============================================================

Proceed with processing entries for 2025-08-28? (y/n): y

⏰ START TIME CONFIGURATION
==================================================
Enter the start time for the first task on 2025-08-28
Enter start time (e.g., 9:00 AM, 09:30, 14:30): 9:00

Updating work log entries with start time: 9:00 AM
✓ All 4 entries updated with new timing

============================================================
WORK LOG ENTRIES PREVIEW - 2025-08-28
============================================================

1. [IDCOL] August Daily Scrum - 50000179
   Time: 10:00 - 10:30 (0.5 hrs)
   Activity: Meeting
   Work Package: SCRUM (ID: 5641)

2. [IDCOL] Enhance candidate onboarding process with additional fields and validations
   Time: 09:00 - 13:00 (4.0 hrs)
   Activity: Development
   Comment: Added new validation fields

3. [IDCOL] Enhance head count entry management with desk selection and improved filtering options
   Time: 13:30 - 15:15 (1.75 hrs)
   Activity: Development

4. [IDCOL] Update validation rules in WebRegisterRequest to enforce maximum length for first and last names
   Time: 15:27 - 16:27 (1.0 hrs)
   Activity: Development

Total hours for 2025-08-28: 7.25
============================================================

Process all entries for 2025-08-28? (y/n): y

Processing 4 work log entries for 2025-08-28
============================================================

[1/4] Processing: IDCOL - August Daily Scrum - 50000179...
  Time: 10:00 - 10:30 (0.5 hrs)
  Activity: Meeting
  Using existing work package ID: 5641
  ✓ Successfully created time entry (ID: 13521)

[2/4] Processing: IDCOL - Enhance candidate onboarding process...
  Time: 09:00 - 13:00 (4.0 hrs)
  Activity: Development
  Checking for existing work package: Enhance candidate onboarding process with additional fields and validations
  ✓ Created work package ID: 5648
  ✓ Successfully created time entry (ID: 13522)

[3/4] Processing: IDCOL - Enhance head count entry management...
  Time: 13:30 - 15:15 (1.75 hrs)
  Activity: Development
  Checking for existing work package: Enhance head count entry management with desk selection and improved filtering options
  ✓ Created work package ID: 5649
  ✓ Successfully created time entry (ID: 13523)

[4/4] Processing: IDCOL - Update validation rules in WebRegisterRequest...
  Time: 15:27 - 16:27 (1.0 hrs)
  Activity: Development
  Checking for existing work package: Update validation rules in WebRegisterRequest to enforce maximum length for first and last names
  ✓ Created work package ID: 5650
  ✓ Successfully created time entry (ID: 13524)

============================================================
SUMMARY: 4 successful, 0 failed
============================================================

================================================================================
ALL DATES PROCESSED
================================================================================
```

## Configuration

### Configuration Template

Create or update your `config.py` file with the following structure:

```python
#!/usr/bin/env python3
"""
OpenProject Time Logging Script - Configuration

This file contains configuration settings for the OpenProject API.
Update the credentials and settings below before running the main script.
"""

CONFIG = {
    "base_url": "https://your-openproject-domain.com",
    "api_token": "your_api_token_here",
    "accountable_user_id": 83,  # User ID for "Responsible" field on new work packages
    "assignee_user_id": 83,     # User ID for "Assignee" field on new work packages
}

PROJECT_MAPPINGS = {
    # Project name to ID mappings - use exact project names as they appear in JSON
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
    # Activity name to OpenProject activity ID mappings
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
```

### Configuration Steps

1. **Get API Token**:
   - Log into your OpenProject instance
   - Go to Account Settings > Access Tokens
   - Create a new API token
   - Copy the token to `api_token` in config

2. **Find Project IDs**:
   - Navigate to each project in OpenProject
   - Check the URL: `/projects/64` means project ID is 64
   - Update `PROJECT_MAPPINGS` with the exact project names used in your JSON files

3. **Find User IDs**:
   - Go to Administration > Users (if admin) or check user profiles
   - User ID appears in URL: `/users/83` means user ID is 83
   - Set `accountable_user_id` and `assignee_user_id`

4. **Activity IDs** (optional):
   - Go to Administration > Enumerations > Activities
   - Check activity IDs if you need to customize `ACTIVITY_MAPPINGS`

### Project Mapping Logic

The system uses intelligent work package management:

#### SCRUM Activities

- Use `work_package_id` specified directly in JSON
- Always start at 10:00 AM regardless of break_hours
- No new work packages are created

#### Regular Tasks

- Tasks with `work_package_id: null` create new work packages
- Project is determined by the `project` field in JSON
- Maps to project ID using `PROJECT_MAPPINGS["{project}"]`
- Example: `"project": "IDCOL"` → uses `PROJECT_MAPPINGS["IDCOL"]: 64`

#### Duplicate Prevention

- Checks for existing work packages with identical subjects
- Reuses existing work packages instead of creating duplicates
- Checks for existing time entries to prevent duplicate logging

## API Reference

This script uses the OpenProject API v3:

- Projects: `/api/v3/projects`
- Work packages: `/api/v3/work_packages` (GET/POST)
- Time entries: `/api/v3/time_entries` (POST)
- Activities: `/api/v3/time_entries/activities`

## Files

- `log.py` - Main time logging script with date-wise JSON work log processing
- `test_api.py` - API connectivity test and configuration validation
- `config.py` - Configuration settings including project mappings
- `config.template.py` - Configuration template file
- `requirements.txt` - Python dependencies
- `README.md` - This documentation
- `logs.json` - Multi-date JSON work log file in project root

## Troubleshooting

### Common Issues

#### Authentication Failed (401)

- Verify your `api_token` in `config.py` is correct
- Check if the token has expired (regenerate in OpenProject if needed)
- Ensure token has appropriate permissions

#### Connection Error

- Verify `base_url` in `config.py` is correct
- Check internet connectivity
- Ensure OpenProject instance is accessible

#### Project Not Found (404)

- Run `python test_api.py` to verify project IDs
- Update project IDs in `PROJECT_MAPPINGS`
- Check if you have access permissions to the projects

#### Work Package Creation Failed (403)

- Verify user has work package creation permissions in the project
- Check if `accountable_user_id` and `assignee_user_id` are valid
- Ensure user is a member of the target project

#### Activity Validation Issues

- Activity endpoints may return 404 on some OpenProject instances (this is normal)
- Activity IDs in `ACTIVITY_MAPPINGS` should still work for time entry creation
- Test actual time logging to verify activity IDs are correct

#### Time Entry Creation Failed

- Check if work package exists and is accessible
- Verify activity ID is valid for your OpenProject instance
- Ensure date format is correct (YYYY-MM-DD)
- Check for duplicate time entries on the same date

#### JSON File Parsing Errors

- Verify JSON file syntax is correct
- Ensure all required fields are present: `project`, `subject`, `duration_hours`, `activity`, `is_scrum`
- Check that `work_package_id` is an integer (not string) for SCRUM tasks
- Validate `is_scrum` is a boolean value
- Ensure `logs` array contains valid date objects with `date` and `entries` fields
- Verify date format follows "month-day-year" pattern (e.g., "aug-28-2025")

#### Directory Structure

- Ensure `logs.json` file is placed in the project root directory
- The file should contain a `logs` array with multiple date entries
- Use proper date naming convention: "month-day-year" format (e.g., "aug-28-2025", "sept-07-2025")

### Getting Help

1. **Run API Test**: `python test_api.py` to validate configuration
2. **Check Logs**: Look for detailed error messages in the console output
3. **Verify Configuration**: Compare your `config.py` with `config.template.py`
4. **Test Single Entry**: Start with a simple `logs.json` file with one date and one entry to isolate issues

### Debug Mode

For additional debugging information, you can:

- Check the response from failed API calls (shown in error messages)
- Verify work package IDs exist in OpenProject web interface
- Test API endpoints manually using tools like curl or Postman

### Known Limitations

- Activities endpoint may not be accessible on some OpenProject configurations (returns 404)
- Large batch processing may take time due to API rate limiting
- Duplicate detection is based on exact subject matching (case-insensitive)
- SCRUM work package IDs must exist before running the script
- All user prompts now use (y/n) format and only accept 'y' or 'n' responses
