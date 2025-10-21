// WorkLogParser class for processing time log data
import { loadConfig } from './config.js';

export class WorkLogParser {
    constructor(filePath = null) {
        this.filePath = filePath;
        this.projectMappings = null;

        this.activityKeywords = {
            scrum: 'Meeting',
            meeting: 'Meeting',
            session: 'Meeting',
            clarification: 'Meeting',
            setup: 'Development',
            enhanced: 'Development',
            fixed: 'Development',
            fix: 'Development',
            route: 'Development',
            linkup: 'Development',
            template: 'Development',
            codes: 'Development',
            staging: 'Support',
            server: 'Support',
            feedback: 'Specification',
            recruitment: 'Specification',
            profile: 'Development',
            view: 'Development'
        };
    }

    async parseWorkLogFile(file) {
        if (!file.name.toLowerCase().endsWith('.json')) {
            throw new Error('Only JSON files are supported');
        }

        const text = await file.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error('Invalid JSON file');
        }

        return this.parseJsonWorkLogContent(data);
    }

    async parseJsonWorkLogContent(data) {
        const config = await loadConfig();
        this.projectMappings = config.PROJECT_MAPPINGS;

        const allTimeEntries = {};

        if (!data.logs || !Array.isArray(data.logs)) {
            throw new Error("Invalid JSON format: Missing 'logs' array");
        }

        if (data.logs.length === 0) {
            throw new Error("No log entries found in 'logs' array");
        }

        for (let logIndex = 0; logIndex < data.logs.length; logIndex++) {
            const logEntry = data.logs[logIndex];

            if (!logEntry.date) {
                console.warn(`Log entry ${logIndex + 1} missing 'date' field, skipping`);
                continue;
            }

            const dateStr = logEntry.date;
            let parsedDate;

            try {
                parsedDate = this.parseDateString(dateStr);
            } catch (e) {
                console.warn(`Log entry ${logIndex + 1} has invalid date format '${dateStr}': ${e.message}`);
                continue;
            }

            const entries = logEntry.entries || [];
            if (!Array.isArray(entries)) {
                console.warn(`Log entry ${logIndex + 1} 'entries' must be an array, skipping`);
                continue;
            }

            const timeEntries = [];
            let currentTime = new Date();
            currentTime.setHours(9, 0, 0, 0);

            for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
                const entryData = entries[entryIndex];

                const validationErrors = this.validateEntryData(entryData, entryIndex + 1);
                if (validationErrors.length > 0) {
                    console.error(`Validation errors for log date ${dateStr}, entry ${entryIndex + 1}:`);
                    validationErrors.forEach(error => console.error(`  - ${error}`));
                    console.error('Skipping this entry due to validation errors.');
                    continue;
                }

                const entry = await this.parseJsonTaskEntry(entryData, currentTime, parsedDate);
                if (entry) {
                    timeEntries.push(entry);
                    currentTime = new Date(entry.end_time);
                }
            }

            if (timeEntries.length > 0) {
                allTimeEntries[parsedDate] = timeEntries;
            }
        }

        return allTimeEntries;
    }

    parseDateString(dateStr) {
        const monthNames = {
            jan: 1,
            january: 1,
            feb: 2,
            february: 2,
            mar: 3,
            march: 3,
            apr: 4,
            april: 4,
            may: 5,
            jun: 6,
            june: 6,
            jul: 7,
            july: 7,
            aug: 8,
            august: 8,
            sep: 9,
            sept: 9,
            september: 9,
            oct: 10,
            october: 10,
            nov: 11,
            november: 11,
            dec: 12,
            december: 12
        };

        // Expected format: month-day-year (e.g., "sept-07-2025")
        const pattern = /^(\w+)-(\d{1,2})-(\d{4})$/;
        const match = dateStr.toLowerCase().match(pattern);

        if (!match) {
            throw new Error(`Date must be in format 'month-day-year' (e.g., 'sept-07-2025'), got '${dateStr}'`);
        }

        const [, monthStr, day, year] = match;
        const month = monthNames[monthStr.toLowerCase()];

        if (!month) {
            const availableMonths = [...new Set(Object.keys(monthNames))].sort();
            throw new Error(`Invalid month '${monthStr}'. Available: ${availableMonths.join(', ')}`);
        }

        try {
            const yearNum = parseInt(year);
            const monthNum = parseInt(month);
            const dayNum = parseInt(day);

            if (yearNum < 1900 || yearNum > 3000) {
                throw new Error(`Invalid year: ${year}`);
            }
            if (monthNum < 1 || monthNum > 12) {
                throw new Error(`Invalid month: ${month}`);
            }
            if (dayNum < 1 || dayNum > 31) {
                throw new Error(`Invalid day: ${day}`);
            }

            const testDate = new Date(yearNum, monthNum - 1, dayNum);
            if (testDate.getFullYear() !== yearNum || testDate.getMonth() !== monthNum - 1 || testDate.getDate() !== dayNum) {
                throw new Error(`Invalid date: ${monthStr}-${day}-${year}`);
            }

            const monthPadded = monthNum.toString().padStart(2, '0');
            const dayPadded = dayNum.toString().padStart(2, '0');
            return `${yearNum}-${monthPadded}-${dayPadded}`;
        } catch (e) {
            throw new Error(`Invalid date values: ${e.message}`);
        }
    }

    validateEntryData(entryData, entryIndex = null) {
        const errors = [];
        const prefix = entryIndex ? `Entry ${entryIndex}: ` : 'Entry: ';

        const requiredFields = ['project', 'subject', 'duration_hours', 'activity', 'is_scrum'];
        for (const field of requiredFields) {
            if (!(field in entryData)) {
                errors.push(`${prefix}Missing required field '${field}'`);
            } else if (entryData[field] === null || entryData[field] === undefined) {
                errors.push(`${prefix}Field '${field}' cannot be null`);
            }
        }

        if (entryData.project && this.projectMappings && !(entryData.project in this.projectMappings)) {
            const allowedProjects = Object.keys(this.projectMappings);
            errors.push(`${prefix}Invalid project '${entryData.project}'. Allowed values: ${allowedProjects.join(', ')}`);
        }

        if (entryData.subject !== undefined) {
            if (typeof entryData.subject !== 'string' || !entryData.subject.trim()) {
                errors.push(`${prefix}Field 'subject' must be a non-empty string`);
            }
        }

        if (entryData.duration_hours !== undefined) {
            const duration = parseFloat(entryData.duration_hours);
            if (isNaN(duration) || duration <= 0) {
                errors.push(`${prefix}Field 'duration_hours' must be a number greater than 0`);
            }
        }

        if (entryData.is_scrum !== undefined) {
            if (typeof entryData.is_scrum !== 'boolean') {
                errors.push(`${prefix}Field 'is_scrum' must be a boolean (true or false)`);
            }
        }

        if (entryData.break_hours !== undefined && entryData.break_hours !== null) {
            const breakHours = parseFloat(entryData.break_hours);
            if (isNaN(breakHours) || breakHours < 0) {
                errors.push(`${prefix}Field 'break_hours' must be a number 0 or greater, or null`);
            }
        }

        if (entryData.work_package_id !== undefined && entryData.work_package_id !== null) {
            const wpId = parseInt(entryData.work_package_id);
            if (isNaN(wpId) || wpId <= 0) {
                errors.push(`${prefix}Field 'work_package_id' must be a positive integer or null`);
            }
        }

        return errors;
    }

    async parseJsonTaskEntry(entryData, startTime, entryDate) {
        const project = entryData.project;
        const subject = entryData.subject || entryData.description;
        let activity = entryData.activity || 'Development';

        if (!project || !subject) {
            return null;
        }

        let durationHours = entryData.duration_hours || 0;
        if (typeof durationHours === 'string') {
            durationHours = parseFloat(durationHours.replace('h', '')) || 0;
        } else {
            durationHours = parseFloat(durationHours) || 0;
        }

        if (durationHours === 0) {
            return null;
        }

        const isScrum = !!entryData.is_scrum;
        const workPackageId = entryData.work_package_id;
        const breakHours = entryData.break_hours || 0;
        const breakMinutes = breakHours ? Math.round(breakHours * 60) : 0;

        let actualStartTime;
        let createNewTask = false;

        if (isScrum) {
            if (!workPackageId) {
                return null;
            }
            actualStartTime = new Date(startTime);
            actualStartTime.setHours(10, 0, 0, 0);
            createNewTask = false;
        } else {
            actualStartTime = new Date(startTime.getTime() + breakMinutes * 60 * 1000);
            createNewTask = !workPackageId;
        }

        const endTime = new Date(actualStartTime.getTime() + durationHours * 60 * 60 * 1000);

        if (!entryData.activity) {
            activity = this.determineActivity(subject);
        }

        return {
            project,
            work_package_id: workPackageId,
            project_id: this.projectMappings ? this.projectMappings[project] : null,
            subject,
            activity,
            start_time: actualStartTime.toISOString(),
            end_time: endTime.toISOString(),
            hours: durationHours,
            break_minutes: breakMinutes,
            break_hours: breakHours,
            create_new_task: createNewTask,
            is_scrum: isScrum,
            needs_user_choice: !isScrum && !workPackageId,
            entry_date: entryDate
        };
    }

    determineActivity(taskDescription) {
        const taskLower = taskDescription.toLowerCase();

        for (const [keyword, activity] of Object.entries(this.activityKeywords)) {
            if (taskLower.includes(keyword)) {
                return activity;
            }
        }

        return 'Development';
    }

    getDateFromFilename(filePath) {
        if (!filePath) return null;

        const filename = filePath.split('/').pop().split('\\').pop();
        const datePatterns = [/(\w+)-(\d{1,2})-(\d{4})/, /(\d{4})-(\d{1,2})-(\d{1,2})/, /(\d{1,2})-(\d{1,2})-(\d{4})/];

        const monthNames = {
            jan: 1,
            january: 1,
            feb: 2,
            february: 2,
            mar: 3,
            march: 3,
            apr: 4,
            april: 4,
            may: 5,
            jun: 6,
            june: 6,
            jul: 7,
            july: 7,
            aug: 8,
            august: 8,
            sep: 9,
            sept: 9,
            september: 9,
            oct: 10,
            october: 10,
            nov: 11,
            november: 11,
            dec: 12,
            december: 12
        };

        for (const pattern of datePatterns) {
            const match = filename.match(pattern);
            if (match) {
                if (pattern === datePatterns[0]) {
                    const month = monthNames[match[1].toLowerCase()];
                    if (month) {
                        const day = match[2].padStart(2, '0');
                        const monthFormatted = month.toString().padStart(2, '0');
                        return `${match[3]}-${monthFormatted}-${day}`;
                    }
                }
            }
        }

        return null;
    }
}
