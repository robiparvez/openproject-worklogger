import { loadConfig } from './config.js';
import { OpenProjectTimeLogger } from './apiClient.js';
import { WorkLogParser } from './parser.js';

export class WorkLogService {
    constructor() {
        this.config = null;
        this.logger = new OpenProjectTimeLogger();
        this.parser = new WorkLogParser();
        this.workLogEntries = [];
        this.analysisData = null;
        this.statusData = [];
    }

    async initialize() {
        this.config = await loadConfig();
        await this.logger.initialize();
    }

    async initializeLogger() {
        if (!this.logger) {
            this.logger = new OpenProjectTimeLogger();
        }
        await this.logger.initialize();
    }

    async fetchStatuses() {
        if (this.statusData.length === 0) {
            await this.initializeLogger();
            this.statusData = await this.logger.getStatuses();
        }
        return this.statusData;
    }

    async processFile(file) {
        if (!file.name.toLowerCase().endsWith('.json')) {
            throw new Error('The uploaded file must be a JSON file');
        }

        const allDateEntries = await this.parser.parseWorkLogFile(file);

        if (Object.keys(allDateEntries).length === 0) {
            throw new Error('No valid entries found in the file');
        }

        this.workLogEntries = [];
        for (const [date, entries] of Object.entries(allDateEntries)) {
            this.workLogEntries.push(...entries);
        }

        return {
            entries: this.workLogEntries,
            dateCount: Object.keys(allDateEntries).length,
            totalEntries: this.workLogEntries.length
        };
    }

    async performWorkPackageAnalysis() {
        if (!this.config) {
            await this.initialize();
        }

        const analysisResult = {
            scrum: [],
            existing: [],
            new: [],
            existingWorkPackages: [],
            duplicates: []
        };

        const seenEntries = new Set();
        const uniqueEntries = [];

        for (const entry of this.workLogEntries) {
            const entryKey = `${entry.project}|${entry.subject}|${entry.hours || entry.duration_hours}`;
            if (!seenEntries.has(entryKey)) {
                seenEntries.add(entryKey);
                uniqueEntries.push(entry);
            }
        }

        for (const entry of uniqueEntries) {
            if (entry.is_scrum && entry.work_package_id) {
                analysisResult.scrum.push(entry);
            } else if (entry.work_package_id) {
                analysisResult.existing.push(entry);
            } else {
                const projectMapping = this.config.PROJECT_MAPPINGS || {};
                const projectId = projectMapping[entry.project];

                if (projectId) {
                    try {
                        const existingWp = await this.logger.checkExistingWorkPackageBySubject(projectId, entry.subject);
                        if (existingWp) {
                            entry.existing_work_package_id = existingWp.id;
                            analysisResult.duplicates.push({
                                ...entry,
                                existing_work_package_id: existingWp.id,
                                existing_subject: existingWp.subject
                            });
                        } else {
                            analysisResult.new.push(entry);
                        }
                    } catch (error) {
                        analysisResult.new.push(entry);
                    }
                } else {
                    throw new Error(`Project mapping not found for ${entry.project}`);
                }
            }
        }

        this.analysisData = analysisResult;
        return analysisResult;
    }

    calculateTotalTime() {
        let totalMinutes = 0;
        this.workLogEntries.forEach(entry => {
            totalMinutes += (entry.hours || entry.duration_hours || 0) * 60;
        });
        return (totalMinutes / 60).toFixed(2);
    }

    calculateAllTimes() {
        const validationIssues = [];

        // Group entries by date
        const entriesByDate = {};
        this.workLogEntries.forEach(entry => {
            const date = entry.entry_date;
            if (!entriesByDate[date]) {
                entriesByDate[date] = [];
            }
            entriesByDate[date].push(entry);
        });

        // Calculate times for each date separately
        for (const [date, entries] of Object.entries(entriesByDate)) {
            // Sort entries: SCRUM entries first, then non-scrum by start time if available, then by order
            const sortedEntries = [...entries].sort((a, b) => {
                // SCRUM entries should be first
                if (a.is_scrum && !b.is_scrum) return -1;
                if (!a.is_scrum && b.is_scrum) return 1;

                // If both are scrum or both are non-scrum, sort by calculated_start_time if available
                if (a.calculated_start_time && b.calculated_start_time) {
                    const timeA = this.extractTimeFromString(a.calculated_start_time) || '00:00';
                    const timeB = this.extractTimeFromString(b.calculated_start_time) || '00:00';
                    return new Date(`1970-01-01T${timeA}:00`) - new Date(`1970-01-01T${timeB}:00`);
                }

                // If only one has a start time, put it first
                if (a.calculated_start_time && !b.calculated_start_time) return -1;
                if (!a.calculated_start_time && b.calculated_start_time) return 1;

                // Otherwise maintain original order
                const aIndex = this.workLogEntries.indexOf(a);
                const bIndex = this.workLogEntries.indexOf(b);
                return aIndex - bIndex;
            });

            // Reset currentTime for each date to ensure fresh start
            let currentTime = null;

            // Track if we've processed the first non-scrum entry for this date
            let isFirstNonScrum = true;

            sortedEntries.forEach((entry, index) => {
                if (entry.is_scrum) {
                    // Validate that SCRUM entries have work_package_id
                    if (!entry.work_package_id) {
                        validationIssues.push({
                            type: 'missing_work_package_id',
                            entry: entry,
                            message: `SCRUM entry "${entry.subject}" is missing required work_package_id`
                        });
                    }

                    // SCRUM entries have their own fixed start time
                    if (!entry.calculated_start_time) {
                        entry.calculated_start_time = '10:00'; // Default SCRUM time
                    }
                    const endTime = this.addHoursToTime(entry.calculated_start_time, entry.hours || entry.duration_hours || 0);
                    entry.calculated_end_time = endTime;
                    return; // Skip to next entry, don't affect isFirstNonScrum
                }

                // This is a non-scrum entry
                if (isFirstNonScrum) {
                    // For the first non-scrum entry of each date, only use calculated_start_time if it exists
                    // Don't inherit from previous dates - each date should start fresh for non-scrum entries
                    if (entry.calculated_start_time) {
                        currentTime = entry.calculated_start_time;
                    } else {
                        // Check if this entry should have a user-set start time
                        if (!entry.user_set_start_time) {
                            // This entry needs user input for start time - skip calculation for now
                            isFirstNonScrum = false;
                            return;
                        }
                        // Extract time from start_time ISO string, or default to 09:00 as fallback
                        currentTime = this.extractTimeFromString(entry.start_time) || '09:00';
                    }
                    isFirstNonScrum = false; // Mark that we've processed the first non-scrum entry
                } else {
                    const breakHours = entry.break_hours || 0;
                    const previousNonScrumEntry = this.findPreviousNonScrumEntry(sortedEntries, index);
                    if (previousNonScrumEntry) {
                        const previousEndTime = previousNonScrumEntry.calculated_end_time;
                        currentTime = this.addHoursToTime(previousEndTime, breakHours);
                    }
                }

                entry.calculated_start_time = currentTime;
                const endTime = this.addHoursToTime(currentTime, entry.hours || entry.duration_hours || 0);
                entry.calculated_end_time = endTime;

                // Debug logging for problematic entries
                if (!currentTime || currentTime === 'Invalid Time' || !endTime || endTime === 'Invalid Time') {
                    console.warn('Time calculation issue:', {
                        entry: entry.subject,
                        hours: entry.hours || entry.duration_hours,
                        calculatedStart: currentTime,
                        calculatedEnd: endTime
                    });
                }

                // Check for overlaps with previous non-scrum entry
                const prevNonScrumEntry = this.findPreviousNonScrumEntry(sortedEntries, index);
                if (prevNonScrumEntry && prevNonScrumEntry.calculated_end_time) {
                    const prevEndTime = new Date(`1970-01-01T${prevNonScrumEntry.calculated_end_time}:00`);
                    const currentStartTime = new Date(`1970-01-01T${currentTime}:00`);

                    if (currentStartTime < prevEndTime) {
                        validationIssues.push({
                            type: 'time_overlap',
                            entry: entry,
                            message: `Start time ${currentTime} overlaps with previous task end time ${prevNonScrumEntry.calculated_end_time}`
                        });
                    }
                }

                currentTime = endTime;
            });
        }

        return validationIssues;
    }

    findPreviousNonScrumEntry(entries, currentIndex) {
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (!entries[i].is_scrum) {
                return entries[i];
            }
        }
        return null;
    }

    addHoursToTime(timeString, hours) {
        if (!timeString || !hours) return timeString;

        try {
            let cleanTimeString = timeString;

            // If it's an ISO string, extract just the time part
            if (timeString.includes('T')) {
                const date = new Date(timeString);
                cleanTimeString = date.toTimeString().slice(0, 5); // HH:MM format
            }

            const [hourStr, minuteStr] = cleanTimeString.split(':');
            const startHour = parseInt(hourStr) || 0;
            const startMinute = parseInt(minuteStr || 0) || 0;

            // Convert hours to minutes and round to avoid floating point issues
            const additionalMinutes = Math.round(hours * 60);
            const totalMinutes = startHour * 60 + startMinute + additionalMinutes;

            const newHours = Math.floor(totalMinutes / 60);
            const newMinutes = totalMinutes % 60;

            // Ensure we don't go beyond 24 hours
            const finalHours = newHours % 24;

            return `${String(finalHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
        } catch (error) {
            console.error('Error in addHoursToTime:', error, 'timeString:', timeString, 'hours:', hours);
            return timeString;
        }
    }

    extractTimeFromString(timeString) {
        if (!timeString) return null;

        try {
            // If it's an ISO string, extract just the time part
            if (timeString.includes('T')) {
                const date = new Date(timeString);
                return date.toTimeString().slice(0, 5); // HH:MM format
            }

            // If it's already in HH:MM format, return as is
            if (timeString.match(/^\d{1,2}:\d{2}$/)) {
                return timeString;
            }

            return null;
        } catch (error) {
            console.error('Error extracting time from string:', error, 'timeString:', timeString);
            return null;
        }
    }

    formatTime12Hour(time24) {
        if (!time24 || typeof time24 !== 'string') return 'Invalid Time';

        try {
            const timeParts = time24.split(':');
            if (timeParts.length !== 2) return 'Invalid Time';

            const hour = parseInt(timeParts[0]) || 0;
            const minute = parseInt(timeParts[1]) || 0;

            // Validate hour and minute ranges
            if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                return 'Invalid Time';
            }

            const period = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

            return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
        } catch (error) {
            console.error('Error in formatTime12Hour:', error, 'time24:', time24);
            return 'Invalid Time';
        }
    }

    formatDateTime(dateTimeString) {
        if (!dateTimeString) return 'Not set';

        try {
            if (dateTimeString.includes('T')) {
                const date = new Date(dateTimeString);
                return date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            } else {
                return this.formatTime12Hour(dateTimeString);
            }
        } catch (e) {
            return dateTimeString;
        }
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown';

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    }

    generateSmartComment(subject, activity, durationHours) {
        const subjectLower = subject.toLowerCase();

        const templates = {
            bug: [`Fixed ${subject.toLowerCase()} issue`, `Resolved bug in ${subject.toLowerCase()}`, `Debugged and fixed ${subject.toLowerCase()}`],
            development: [`Developed ${subject.toLowerCase()} functionality`, `Implemented ${subject.toLowerCase()} feature`, `Created ${subject.toLowerCase()} module`],
            testing: [`Tested ${subject.toLowerCase()} functionality`, `Performed quality assurance on ${subject.toLowerCase()}`],
            update: [`Updated ${subject.toLowerCase()}`, `Enhanced ${subject.toLowerCase()} functionality`],
            ui: [`Improved ${subject.toLowerCase()} user interface`, `Enhanced ${subject.toLowerCase()} user experience`],
            api: [`Integrated ${subject.toLowerCase()} API`, `Developed ${subject.toLowerCase()} API endpoint`],
            database: [`Optimized ${subject.toLowerCase()} database queries`, `Updated ${subject.toLowerCase()} database schema`],
            config: [`Configured ${subject.toLowerCase()} settings`, `Set up ${subject.toLowerCase()} environment`],
            documentation: [`Documented ${subject.toLowerCase()} process`, `Created ${subject.toLowerCase()} documentation`],
            research: [`Researched ${subject.toLowerCase()} solution`, `Analyzed ${subject.toLowerCase()} requirements`]
        };

        let selectedTemplates = [];
        for (const [key, templateList] of Object.entries(templates)) {
            if (subjectLower.includes(key) || activity.toLowerCase().includes(key)) {
                selectedTemplates = templateList;
                break;
            }
        }

        if (selectedTemplates.length === 0) {
            selectedTemplates = activity === 'Development' ? templates.development : activity === 'Testing' ? templates.testing : activity === 'Support' ? templates.bug : [`Worked on ${subject.toLowerCase()}`];
        }

        let comment = selectedTemplates[Math.floor(Math.random() * selectedTemplates.length)];

        if (durationHours >= 4) {
            comment += '. Comprehensive work completed with thorough testing.';
        } else if (durationHours >= 2) {
            comment += '. Task completed successfully.';
        }

        return comment;
    }

    async processEntry(entry, commentData = {}) {
        const duration = entry.duration_hours || entry.hours || 0;
        let workPackageId = entry.work_package_id || entry.existing_work_package_id;

        const newEntries = this.analysisData.new || [];
        const newEntryIndex = newEntries.findIndex(newEntry => newEntry.project === entry.project && newEntry.subject === entry.subject);

        if (newEntryIndex !== -1) {
            const comment = commentData[`comment_${newEntryIndex}`] || '';
            const statusValue = commentData[`status_${newEntryIndex}`];
            const selectedStatusId = statusValue ? parseInt(statusValue) : null;

            if (selectedStatusId && !isNaN(selectedStatusId)) {
                entry.statusId = selectedStatusId;
                const statusName = this.statusData.find(s => s.id === selectedStatusId)?.name || 'Unknown Status';
                entry.statusName = statusName;
            }
        }

        const entryDate = entry.entry_date || entry.date;
        if (!entryDate) {
            throw new Error(`Entry missing date information: ${entry.subject}`);
        }

        if (entry.is_scrum && workPackageId) {
            await this.logger.createTimeEntry(workPackageId, entryDate, entry.calculated_start_time || entry.start_time, duration, entry.activity, `[${entry.project}] ${entry.subject}`);
            return { type: 'scrum', message: `SCRUM: ${entry.project} - ${entry.subject} (${duration}h)` };
        } else if (entry.existing_work_package_id) {
            await this.logger.createTimeEntry(entry.existing_work_package_id, entryDate, entry.calculated_start_time || entry.start_time, duration, entry.activity, `[${entry.project}] ${entry.subject}`);
            return { type: 'existing', message: `Existing WP: ${entry.project} - ${entry.subject} (${duration}h)` };
        } else if (entry.work_package_id) {
            await this.logger.createTimeEntry(workPackageId, entryDate, entry.calculated_start_time || entry.start_time, duration, entry.activity, `[${entry.project}] ${entry.subject}`);
            return { type: 'duplicate', message: `Added time to duplicate: ${entry.project} - ${entry.subject} (+${duration}h)` };
        } else {
            const projectMapping = this.config.PROJECT_MAPPINGS || {};
            const projectId = projectMapping[`${entry.project}_PROJECT`] || projectMapping[entry.project];

            if (!projectId) {
                throw new Error(`No project mapping found for project: ${entry.project}`);
            }

            const existingWorkPackage = await this.logger.findWorkPackageBySubject(projectId, entry.subject);

            if (existingWorkPackage) {
                await this.logger.createTimeEntry(existingWorkPackage.id, entryDate, entry.calculated_start_time || entry.start_time, duration, entry.activity, `[${entry.project}] ${entry.subject}`);
                return { type: 'found_existing', message: `Found existing WP: ${entry.project} - ${entry.subject} (${duration}h)` };
            } else {
                const workPackage = await this.logger.createWorkPackage(projectId, entry.subject, entry.activity, commentData[`comment_${newEntryIndex}`] || '', entry.statusId || 7);

                await this.logger.createTimeEntry(workPackage.id, entryDate, entry.calculated_start_time || entry.start_time, duration, entry.activity, `[${entry.project}] ${entry.subject}`);

                const statusText = entry.statusName ? `, Status: ${entry.statusName}` : '';
                return {
                    type: 'new',
                    message: `New WP created: ${entry.project} - ${entry.subject} (ID: ${workPackage.id}, ${duration}h${statusText})`,
                    workPackageId: workPackage.id
                };
            }
        }
    }

    async processAllEntries(commentData = {}, progressCallback = null) {
        if (!this.logger) {
            await this.initialize();
        }

        const results = [];
        let createdCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        const totalEntries = this.workLogEntries.length;

        for (let i = 0; i < this.workLogEntries.length; i++) {
            const entry = this.workLogEntries[i];

            if (progressCallback) {
                progressCallback({
                    current: i + 1,
                    total: totalEntries,
                    entry: entry,
                    message: `Processing: ${entry.project} - ${entry.subject}`
                });
            }

            try {
                const result = await this.processEntry(entry, commentData);
                results.push({ success: true, entry, result });

                // Track created vs updated based on result type
                if (result.type === 'new') {
                    createdCount++;
                } else {
                    updatedCount++;
                }
            } catch (error) {
                results.push({ success: false, entry, error: error.message });
                errorCount++;
            }
        }

        return {
            results,
            createdCount,
            updatedCount,
            successCount: createdCount + updatedCount, // Keep for backward compatibility
            errorCount,
            totalEntries
        };
    }

    checkAndPromptForStartTime() {
        const entriesByDate = {};

        this.workLogEntries.forEach(entry => {
            const date = entry.entry_date;
            if (!date) return;

            if (!entriesByDate[date]) {
                entriesByDate[date] = [];
            }
            entriesByDate[date].push(entry);
        });

        const sortedDates = Object.keys(entriesByDate).sort();

        for (const date of sortedDates) {
            const entries = entriesByDate[date];

            entries.sort((a, b) => {
                const aIndex = this.workLogEntries.indexOf(a);
                const bIndex = this.workLogEntries.indexOf(b);
                return aIndex - bIndex;
            });

            const firstNonScrumEntry = entries.find(entry => !entry.is_scrum);

            if (firstNonScrumEntry && !firstNonScrumEntry.user_set_start_time) {
                // Clear any inherited calculated times for ALL non-scrum entries on this date
                // This ensures each date starts completely fresh
                entries.forEach(entry => {
                    if (!entry.is_scrum) {
                        delete entry.calculated_start_time;
                        delete entry.calculated_end_time;
                    }
                });

                return { needsStartTime: true, entry: firstNonScrumEntry, date: date };
            }
        }

        return { needsStartTime: false };
    }
    setStartTimeForFirstEntry(startTime, targetDate = null) {
        if (targetDate) {
            const firstNonScrumEntry = this.workLogEntries.find(entry => !entry.is_scrum && entry.entry_date === targetDate);
            if (firstNonScrumEntry) {
                firstNonScrumEntry.calculated_start_time = startTime;
                firstNonScrumEntry.user_set_start_time = true; // Mark as user-set
                const validationIssues = this.calculateAllTimes();
                return validationIssues;
            }
        } else {
            const firstNonScrumEntry = this.workLogEntries.find(entry => !entry.is_scrum);
            if (firstNonScrumEntry) {
                firstNonScrumEntry.calculated_start_time = startTime;
                firstNonScrumEntry.user_set_start_time = true; // Mark as user-set
                const validationIssues = this.calculateAllTimes();
                return validationIssues;
            }
        }
        return [];
    }

    getAnalysisData() {
        return this.analysisData;
    }

    getWorkLogEntries() {
        return this.workLogEntries;
    }

    getFirstEntryDate() {
        return this.workLogEntries.length > 0 ? this.formatDate(this.workLogEntries[0].entry_date || this.workLogEntries[0].date) : 'Unknown';
    }
}
