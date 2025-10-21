# OpenProject Time Logger - Chrome Extension

A powerful Chrome extension for streamlining time logging to OpenProject. Upload JSON-formatted work logs, automatically create work packages, and log time entries with intelligent start/end time calculations and duplicate detection.

## 🌟 Overview

This extension transforms time logging from a manual, time-consuming process into an automated workflow. Simply prepare your work logs in JSON format, upload them through the extension, and let it handle the complexity of:

- Creating new work packages or finding existing ones
- Calculating accurate start and end times based on task duration and breaks
- Handling multi-date work logs across different projects
- Displaying comprehensive timelines with total hours per day
- Adding detailed time entries with start/finish times in comments

## ✨ Key Features

### 📋 **Smart Work Log Processing**

- **Multi-Date Support**: Process work logs spanning multiple dates in a single upload
- **Automatic Work Package Management**: Creates new work packages or links to existing ones based on subject matching
- **Intelligent Duplicate Detection**: Scans existing work packages to prevent duplicates
- **SCRUM Entry Handling**: Special handling for daily scrum/meeting entries with fixed time slots

### ⏱️ **Advanced Time Management**

- **Start Time Prompts**: Interactive prompts to set start times for the first task of each date
- **Break Time Calculation**: Automatically accounts for breaks between tasks
- **Time Chain Calculation**: Intelligently chains tasks together with proper timing
- **12-Hour Time Format**: User-friendly display with AM/PM notation
- **Timeline Visualization**: Beautiful timeline view showing all tasks with start/end times and total hours per day

### 🎯 **Robust Validation**

- **Pre-Upload Analysis**: Comprehensive validation before any API calls
- **Required Field Checking**: Ensures all mandatory fields are present
- **Project Mapping Verification**: Validates project names against configured mappings
- **Data Type Validation**: Checks duration hours, break hours, and other numeric fields
- **Date Format Validation**: Enforces correct date format (month-day-year)

### 📊 **Analysis & Review**

- **Entry Categorization**: Separate views for SCRUM entries, existing work packages, new entries, and duplicates
- **Summary Statistics**: Total entries, date count, total hours, and date range
- **Work Package Details**: Shows work package IDs and subjects for existing entries
- **Comment & Status Management**: Allows adding comments and setting status for new work packages
- **Visual Timeline**: Card-based timeline with project badges, SCRUM indicators, and hour totals

### 🔄 **Seamless API Integration**

- **OpenProject API v3**: Full compatibility with OpenProject's latest API
- **Auto-Project Fetching**: Dynamically loads available projects from your OpenProject instance
- **Status Management**: Fetches and allows selection of work package statuses
- **Batch Processing**: Efficiently processes multiple entries with progress tracking
- **Error Handling**: Comprehensive error messages and recovery options

## 📦 Installation

### Prerequisites

- Google Chrome or Chromium-based browser
- OpenProject instance with API v3 access
- Valid OpenProject Access Token

### Steps

1. **Download the Extension**

   ```bash
   git clone <repository-url>
   cd openproject-time-logger/chrome-extension
   ```

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked**
   - Select the `chrome-extension` folder

3. **Verify Installation**
   - Extension icon should appear in Chrome toolbar
   - Click icon and select **Options** to configure

## 🔧 Configuration

### Step 1: Configure API Connection

1. Click the extension icon and select **Options**
2. Navigate to **Configuration** tab
3. Enter your credentials:
   - **Access Token**: Your OpenProject personal access token
     - Get it from: OpenProject → My Account → Access tokens → Generate

4. Click **Save & Test Connection**
   - Success: Projects will be automatically loaded
   - Failure: Check token validity and OpenProject URL

### Step 2: Project Setup

The extension comes pre-configured with common project mappings. You can view available projects by clicking the **📋 Projects** button on the Upload Logs page.

**Current Project Mappings:**

- BD-TICKET → 151
- COMMON-SLASH-LEARNING-AND-UPSKILLING → 141
- COMMON-SLASH-RFS-AND-DEMO-SUPPORT → 140
- IDCOL → 64
- SEBL → 65
- IOT-AND-FWA → 21
- And many more...

To modify project mappings, update the `PROJECT_MAPPINGS` in `shared/config.js`.

## 📝 Usage Guide

### Creating Your Work Log JSON

Your work log must follow this structure:

```json
{
    "logs": [
        {
            "date": "oct-9-2025",
            "entries": [
                {
                    "project": "COMMON-SLASH-GENERAL-PURPOSE-AND-MEETINGS-HR-ACTIVITY",
                    "subject": "Primary Laptop replacement readiness discussion at Shanta Tower",
                    "break_hours": null,
                    "duration_hours": 2.5,
                    "activity": "Meeting",
                    "is_scrum": false,
                    "work_package_id": null
                },
                {
                    "project": "IOT-AND-FWA",
                    "subject": "Bulk channel mapping finalization with stakeholders",
                    "break_hours": 0.33,
                    "duration_hours": 4.5,
                    "activity": "Development",
                    "is_scrum": false,
                    "work_package_id": null
                }
            ]
        },
        {
            "date": "oct-13-2025",
            "entries": [
                {
                    "project": "IOT-AND-FWA",
                    "subject": "Bulk Channel Mapping UAT preparation & UAT",
                    "break_hours": null,
                    "duration_hours": 2,
                    "activity": "Testing",
                    "is_scrum": false,
                    "work_package_id": null
                }
            ]
        }
    ]
}
```

#### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `date` | string | Date in `month-day-year` format | `"oct-9-2025"` |
| `project` | string | Project name from mappings | `"IDCOL"` |
| `subject` | string | Work description | `"Fix login bug"` |
| `duration_hours` | number | Time spent in hours | `2.5` |
| `activity` | string | Activity type | `"Development"` |
| `is_scrum` | boolean | Is this a SCRUM/meeting entry? | `false` |

#### Optional Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `work_package_id` | number/null | Existing work package ID | `null` |
| `break_hours` | number/null | Break time in hours | `null` |

#### Supported Activities

- **Development** (Software development work)
- **Support** (Support and maintenance)
- **Meeting** (Meetings and discussions)
- **Testing** (QA and testing activities)
- **Specification** (Requirements and documentation)
- **Management** (Administrative tasks)
- **Change Request** (CR implementation)
- **Other** (Miscellaneous work)

### Upload Workflow

#### 1. **Upload Logs**

- Click **Upload Logs** tab
- Drag & drop or click to select your JSON file
- File is automatically validated

#### 2. **Set Start Times**

- For each date with non-SCRUM entries, you'll be prompted to set a start time
- Choose hour, minute, and AM/PM
- Click **✅ Confirm Start Time**
- The system will automatically calculate all subsequent task times

#### 3. **Review Analysis**

   The extension categorizes your entries:

- **📅 Timeline**: Visual timeline showing all tasks with:
  - Start and end times for each task
  - Total hours per day
  - Grand total for multi-day logs
  - SCRUM badges for meeting entries
  - Project badges for easy identification

- **🎯 SCRUM Entries**: Daily scrums and meetings (require work_package_id)
- **✅ Existing Work Packages**: Entries with valid work_package_id
- **➕ New Entries**: Tasks that will create new work packages
- **⚠️ Duplicates Found**: Matching work packages in OpenProject

#### 4. **Add Comments & Status** (for new work packages)

- Optional: Add descriptive comments
- Optional: Select work package status (default: New)
- Comments and status help with work package organization

#### 5. **Process Entries**

- Click **🚀 Process All Entries**
- Watch real-time progress
- Review detailed results for each entry

#### 6. **Complete**

- View success/failure statistics
- Created vs Updated count
- Option to upload another file or close

## 🎨 Timeline Feature

The extension includes a beautiful timeline visualization that shows:

### Per-Date Display

- **Date Header**: Day, month, date, and year
- **Total Hours Badge**: Total hours worked that day
- **Task Cards**: Each task showing:
  - Project name badge
  - SCRUM badge (if applicable)
  - Task description
  - Start and end times (12-hour format)
  - Duration badge

### Multi-Date Summary

- **Grand Total**: Total hours across all dates
- **Number of Days**: Total days in the work log
- **Visual Hierarchy**: Easy to scan and verify

### Example Timeline Display

```text
📅 Thu, Oct 9, 2025                           Total: 7h
┌─────────────────────────────────────────────────────────┐
│ COMMON-SLASH-GENERAL-PURPOSE... Meeting    11:00 AM - 1:30 PM │
│                                            2.5h         │
├─────────────────────────────────────────────────────────┤
│ IOT-AND-FWA  Bulk channel mapping         1:50 PM - 6:20 PM  │
│                                            4.5h         │
└─────────────────────────────────────────────────────────┘

📅 Mon, Oct 13, 2025                          Total: 6.5h
┌─────────────────────────────────────────────────────────┐
│ IOT-AND-FWA  UAT preparation              9:00 AM - 11:00 AM │
│                                            2h           │
└─────────────────────────────────────────────────────────┘

⏱️ Grand Total (2 days): 13.5h
```

## 🔍 How It Works

### Entry Processing Flow

1. **Parse JSON**: Validate structure and required fields
2. **Check Start Times**: Prompt user for first task start time per date
3. **Calculate Times**: Chain tasks together with breaks
4. **Analyze Entries**: Categorize and check for duplicates
5. **Create/Link Work Packages**:
   - SCRUM entries → Link to existing work package
   - Has work_package_id → Use existing
   - No work_package_id → Check for duplicates → Create new if needed
6. **Create Time Entries**: Add time with start/finish times in comment

### Time Calculation Logic

For each date:

1. **First Non-SCRUM Task**: User sets start time (e.g., 11:00 AM)
2. **Subsequent Tasks**:
   - End of previous task + break hours = Start of next task
   - Start + duration = End time
3. **SCRUM Entries**: Fixed timing (10:00 AM default), don't affect chain

### Example Time Chain

```text
Task 1: 11:00 AM - 1:30 PM (2.5h)
Break: 20 minutes (0.33h)
Task 2: 1:50 PM - 6:20 PM (4.5h)
```

## 🐛 Troubleshooting

### Connection Issues

**Problem**: "Failed to connect to OpenProject"

- ✅ Verify your Access Token is valid
- ✅ Check base URL format in `shared/config.js`
- ✅ Ensure your OpenProject instance is accessible
- ✅ Confirm API v3 is enabled on your OpenProject

**Problem**: "Authentication failed"

- ✅ Regenerate your Access Token in OpenProject
- ✅ Ensure token has required permissions

### Upload Failures

**Problem**: "Project mapping not found"

- ✅ Check project name matches exactly in `PROJECT_MAPPINGS`
- ✅ Case-sensitive matching required
- ✅ Click **📋 Projects** button to view available projects

**Problem**: "SCRUM entry missing work_package_id"

- ✅ SCRUM entries (`is_scrum: true`) must have a valid `work_package_id`
- ✅ Find the work package ID in OpenProject

**Problem**: "Time calculation failed"

- ✅ Ensure duration_hours is a positive number
- ✅ Check break_hours is 0 or greater
- ✅ Verify start time was set for the date

### Validation Errors

**Problem**: "Invalid date format"

- ✅ Use format: `month-day-year` (e.g., `oct-9-2025`)
- ✅ Valid months: jan, feb, mar, apr, may, jun, jul, aug, sep/sept, oct, nov, dec

**Problem**: "Missing required field"

- ✅ Ensure all required fields are present
- ✅ Check for typos in field names
- ✅ Verify values are not null where required

**Problem**: "Start time not set"

- ✅ Complete the start time prompt for each date
- ✅ Start time prompt only shows for non-SCRUM entries
- ✅ Each date needs its own start time

## 📊 Sample Files

### Sample Work Log (`sample.json`)

A complete example is provided in the extension directory showing:

- Multiple dates
- Different project types
- SCRUM and regular entries
- Various activities
- Break time handling

## 🚀 Advanced Features

### Duplicate Prevention

The extension performs intelligent duplicate checking:

- Searches for existing work packages with matching subjects
- Case-insensitive comparison
- Partial matching detection
- Allows linking to duplicates or creating new

### Smart Time Entry Comments

Time entries include enhanced comments with:

- Start and end times in 12-hour format
- Example: `[11:00 AM - 1:30 PM] Worked on feature implementation`
- Helps with time tracking and reporting

### Batch Processing with Progress

- Real-time progress bar
- Individual entry status updates
- Detailed success/error messages
- Count of created vs updated entries

### Status Management

- Fetch available statuses from OpenProject
- Set custom status for new work packages
- Default status: New (ID: 7)
- Status dropdown with all available options

## 🛠️ Technical Details

### Architecture

- **Manifest V3**: Latest Chrome extension format
- **ES6 Modules**: Modern JavaScript structure
- **Service Worker**: Background script for extension lifecycle
- **Storage API**: Chrome local storage for configuration

### File Structure

```plaintext
chrome-extension/
├── manifest.json           # Extension configuration
├── README.md              # This file
├── sample.json            # Example work log
├── work-log.json          # Current work log
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── background/
│   └── service-worker.js  # Background script
├── options/               # Extension UI
│   ├── options.html       # Main interface
│   ├── options.css        # Styling
│   └── options.js         # UI logic (1875 lines)
└── shared/                # Core functionality
    ├── config.js          # Configuration management
    ├── apiClient.js       # OpenProject API client (449 lines)
    ├── parser.js          # JSON parsing & validation (369 lines)
    └── workLogService.js  # Work log processing (600 lines)
```

### Key Components

**OpenProjectTimeLogger** (`apiClient.js`)

- API authentication and requests
- Work package creation and search
- Time entry creation
- Project and status fetching

**WorkLogParser** (`parser.js`)

- JSON file parsing
- Date validation and conversion
- Entry validation
- Activity determination

**WorkLogService** (`workLogService.js`)

- Time calculations and chaining
- Start time management
- Entry processing and analysis
- Work package duplicate detection

## 📈 Version History

### Version 1.0.0

- Initial release
- Basic time logging functionality
- Project mapping support
- Single date processing

### Version 2.0.0 (Current)

- ✨ Multi-date work log support
- ✨ Interactive start time prompts per date
- ✨ Beautiful timeline visualization with total hours
- ✨ Enhanced UI with 4-step workflow
- ✨ Smart work package duplicate detection
- ✨ Improved time calculation with break handling
- ✨ Status selection for new work packages
- ✨ Real-time progress tracking
- ✨ Comment management for work packages
- 🐛 Fixed time inheritance across dates
- 🐛 Fixed duplicate timeline display
- 🎨 Modern gradient UI design
- 🎨 Card-based timeline with badges
- 🎨 Improved error messaging

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

- Additional activity types
- Custom project mapping UI
- Export functionality for processed logs
- Enhanced error recovery
- Offline mode support
- Time entry editing capabilities

## 📄 License

This extension is provided as-is for use with OpenProject instances. Ensure compliance with your organization's policies regarding API usage and automation.

## 🆘 Support

For issues or questions:

1. Check the **Troubleshooting** section above
2. Review the **Sample Files** for correct format
3. Test API connection in Configuration page
4. Check Chrome DevTools Console for detailed errors (F12)

## 🔗 Related Resources

- [OpenProject API Documentation](https://www.openproject.org/docs/api/)
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)

---

**Version**: 2.0.0
**Last Updated**: October 2025
**Compatible with**: OpenProject API v3
**Minimum Chrome Version**: 88+
