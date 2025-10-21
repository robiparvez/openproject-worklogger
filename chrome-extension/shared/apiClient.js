import { loadConfig } from './config.js';

export class OpenProjectTimeLogger {
    constructor() {
        this.baseUrl = '';
        this.accessToken = '';
        this.config = null;
    }

    async initialize() {
        const config = await loadConfig();
        this.config = config;
        this.baseUrl = config.CONFIG.base_url?.replace(/\/$/, '') || '';
        this.accessToken = config.CONFIG.access_token || '';

        if (!this.baseUrl || !this.accessToken) {
            throw new Error('Base URL and Access Token must be configured');
        }
    }

    async _makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/hal+json',
            Authorization: `Basic ${btoa(`apikey:${this.accessToken}`)}`
        };

        const response = await fetch(url, {
            ...options,
            headers: { ...headers, ...options.headers }
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    async getCurrentUser() {
        return this._makeRequest('/api/v3/users/me');
    }

    async getProjects() {
        try {
            const response = await this._makeRequest('/api/v3/projects?pageSize=100');
            return response._embedded?.elements || [];
        } catch (e) {
            console.error('Error getting projects:', e);
            return [];
        }
    }

    async getStatuses() {
        try {
            const response = await this._makeRequest('/api/v3/statuses');
            return response._embedded?.elements || [];
        } catch (e) {
            console.error('Error getting statuses:', e);
            return [];
        }
    }

    async testConnection() {
        try {
            const user = await this.getCurrentUser();
            return { success: true, user };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async getWorkPackageInfo(workPackageId) {
        try {
            return await this._makeRequest(`/api/v3/work_packages/${workPackageId}`);
        } catch (e) {
            console.error(`Error getting work package ${workPackageId}:`, e);
            return null;
        }
    }

    async checkExistingWorkPackageBySubject(projectId, subject) {
        const normalizedSubject = subject.trim().toLowerCase();
        console.log(`Checking for existing work package with subject: "${subject}"`);
        console.log(`Normalized subject: "${normalizedSubject}"`);

        try {
            let offset = 1;
            const pageSize = 100;

            while (true) {
                const params = new URLSearchParams({
                    pageSize: pageSize.toString(),
                    offset: offset.toString()
                });

                const data = await this._makeRequest(`/api/v3/projects/${projectId}/work_packages?${params}`);

                if (data._embedded && data._embedded.elements) {
                    const workPackages = data._embedded.elements;
                    console.log(`Found ${workPackages.length} work packages in project ${projectId}`);

                    for (const wp of workPackages) {
                        const wpSubject = (wp.subject || '').trim().toLowerCase();
                        console.log(`Comparing: "${wpSubject}" with "${normalizedSubject}"`);

                        if (wpSubject === normalizedSubject) {
                            console.log(`✅ Found exact match: '${wp.subject}' (ID: ${wp.id})`);
                            return wp;
                        }

                        if (wpSubject.includes(normalizedSubject) || normalizedSubject.includes(wpSubject)) {
                            console.log(`⚠️ Found partial match: '${wp.subject}' (ID: ${wp.id})`);
                        }
                    }

                    const total = data.total || 0;
                    const currentCount = (offset - 1) * pageSize + workPackages.length;

                    if (currentCount >= total || workPackages.length === 0) {
                        break;
                    }

                    offset++;
                } else {
                    console.log(`No work packages found in project ${projectId}`);
                    break;
                }
            }

            console.log(`❌ No existing work package found for subject: "${subject}"`);
            return null;
        } catch (error) {
            console.warn(`Could not check existing work packages: ${error.message}`);
            return null;
        }
    }

    async checkExistingTimeEntries(workPackageId, date, activityName = null) {
        try {
            const response = await this._makeRequest('/api/v3/time_entries');
            const timeEntries = response._embedded?.elements || [];

            let targetDate;
            if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                targetDate = date;
            } else {
                const parsedDate = new Date(date);
                const year = parsedDate.getFullYear();
                const month = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
                const day = parsedDate.getDate().toString().padStart(2, '0');
                targetDate = `${year}-${month}-${day}`;
            }

            return timeEntries.filter(entry => {
                const entryDate = entry.spentOn;
                const entryWorkPackageId = entry._links?.workPackage?.href?.split('/').pop();

                return entryDate === targetDate && entryWorkPackageId === workPackageId.toString();
            });
        } catch (e) {
            console.error('Error checking existing time entries:', e);
            return [];
        }
    }

    async createWorkPackage(projectId, subject, activityType = 'Development', description = '', statusId = 7) {
        const existing = await this.checkExistingWorkPackageBySubject(projectId, subject);
        if (existing) {
            return existing;
        }

        const typeMapping = {
            Development: 1,
            Support: 1,
            Meeting: 1,
            Specification: 1,
            Testing: 1,
            Other: 1
        };

        const typeId = typeMapping[activityType] || 1;
        const accountableUserId = this.config.CONFIG.accountable_user_id;
        const assigneeUserId = this.config.CONFIG.assignee_user_id;

        const workPackageData = {
            subject,
            _links: {
                project: { href: `/api/v3/projects/${projectId}` },
                type: { href: `/api/v3/types/${typeId}` },
                status: { href: `/api/v3/statuses/${statusId}` }
            }
        };

        if (description) {
            workPackageData.description = { raw: description };
        }

        if (accountableUserId) {
            workPackageData._links.accountable = { href: `/api/v3/users/${accountableUserId}` };
        }

        if (assigneeUserId) {
            workPackageData._links.assignee = { href: `/api/v3/users/${assigneeUserId}` };
        }

        return this._makeRequest('/api/v3/work_packages', {
            method: 'POST',
            body: JSON.stringify(workPackageData)
        });
    }

    async createTimeEntry(workPackageId, date, startTime, hours, activityName, comment = '') {
        const activityMapping = this.config.ACTIVITY_MAPPINGS;
        const activityId = activityMapping[activityName] || activityMapping['Development'] || 3;

        let formattedDate;
        try {
            if (typeof date === 'string' && date.includes('T')) {
                formattedDate = date.split('T')[0];
            } else if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                formattedDate = date;
            } else {
                const parsedDate = new Date(date);
                if (isNaN(parsedDate.getTime())) {
                    throw new Error(`Invalid date: ${date}`);
                }
                const year = parsedDate.getFullYear();
                const month = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
                const day = parsedDate.getDate().toString().padStart(2, '0');
                formattedDate = `${year}-${month}-${day}`;
            }
        } catch (error) {
            throw new Error(`Invalid time value for date: ${date}. Error: ${error.message}`);
        }

        if (isNaN(hours) || hours <= 0) {
            throw new Error(`Invalid hours value: ${hours}`);
        }

        let enhancedComment = comment || '';
        if (startTime && typeof startTime === 'string' && startTime.match(/^\d{1,2}:\d{2}$/)) {
            const endTime = this.calculateEndTime(startTime, hours);
            const timeInfo = `[${this.formatTime12Hour(startTime)} - ${this.formatTime12Hour(endTime)}]`;
            enhancedComment = enhancedComment ? `${timeInfo} ${enhancedComment}` : timeInfo;
        }

        const timeEntryData = {
            spentOn: formattedDate,
            hours: `PT${hours}H`,
            comment: enhancedComment ? { raw: enhancedComment } : undefined,
            _links: {
                workPackage: { href: `/api/v3/work_packages/${workPackageId}` },
                activity: { href: `/api/v3/time_entries/activities/${activityId}` }
            }
        };

        console.log('Creating time entry with data:', timeEntryData);

        return this._makeRequest('/api/v3/time_entries', {
            method: 'POST',
            body: JSON.stringify(timeEntryData)
        });
    }

    calculateEndTime(startTime, hours) {
        try {
            const [hourStr, minuteStr] = startTime.split(':');
            const startHour = parseInt(hourStr) || 0;
            const startMinute = parseInt(minuteStr) || 0;

            const additionalMinutes = Math.round(hours * 60);
            const totalMinutes = startHour * 60 + startMinute + additionalMinutes;

            const newHours = Math.floor(totalMinutes / 60) % 24;
            const newMinutes = totalMinutes % 60;

            return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
        } catch (error) {
            return startTime;
        }
    }

    formatTime12Hour(time24) {
        try {
            const [hour, minute] = time24.split(':').map(Number);
            const period = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
        } catch (error) {
            return time24;
        }
    }

    async dryRunWorkPackageAnalysis(workLogEntries) {
        const analysis = {
            scrum: [],
            existing: [],
            new: [],
            existingWorkPackages: []
        };

        for (const entry of workLogEntries) {
            if (entry.is_scrum) {
                analysis.scrum.push(entry);
            } else if (entry.work_package_id) {
                analysis.existing.push(entry);
            } else {
                const existing = await this.checkExistingWorkPackageBySubject(entry.project_id, entry.subject);
                if (existing) {
                    entry.existing_work_package_id = existing.id;
                    analysis.existingWorkPackages.push(entry);
                } else {
                    analysis.new.push(entry);
                }
            }
        }

        return analysis;
    }

    async processWorkLogEntries(workLogEntries, date, progressCallback = null) {
        const results = {
            successful: 0,
            failed: 0,
            details: []
        };

        for (let i = 0; i < workLogEntries.length; i++) {
            const entry = workLogEntries[i];
            const detail = {
                index: i + 1,
                project: entry.project,
                subject: entry.subject,
                hours: entry.hours,
                activity: entry.activity
            };

            try {
                if (progressCallback) {
                    progressCallback({
                        current: i + 1,
                        total: workLogEntries.length,
                        entry: entry
                    });
                }

                let workPackageId = entry.work_package_id;

                if (!workPackageId) {
                    const existing = await this.checkExistingWorkPackageBySubject(entry.project_id, entry.subject);
                    if (existing) {
                        workPackageId = existing.id;
                        detail.status = 'reused_existing_work_package';
                        detail.work_package_id = workPackageId;
                    } else {
                        const workPackage = await this.createWorkPackage(entry.project_id, entry.subject, entry.activity, entry.comment || '');
                        workPackageId = workPackage.id;
                        detail.status = 'created_work_package';
                        detail.work_package_id = workPackageId;
                    }
                } else {
                    detail.status = 'using_existing_work_package';
                    detail.work_package_id = workPackageId;
                }

                const existingTimeEntries = await this.checkExistingTimeEntries(workPackageId, date, entry.activity);
                if (existingTimeEntries.length > 0) {
                    detail.status = 'skipped_duplicate_time_entry';
                    detail.existing_time_entries = existingTimeEntries.length;
                    results.successful++;
                } else {
                    const timeEntry = await this.createTimeEntry(workPackageId, date, entry.start_time, entry.hours, entry.activity, entry.comment || '');
                    detail.time_entry_id = timeEntry.id;
                    detail.status = 'created_time_entry';
                    results.successful++;
                }
            } catch (error) {
                detail.status = 'error';
                detail.error = error.message;
                results.failed++;
            }

            results.details.push(detail);
        }

        return results;
    }

    async addTimeToExistingTimeEntry(workPackageId, date, additionalHours, activityName, comment = '') {
        try {
            const timeEntries = await this._makeRequest('/api/v3/time_entries');

            if (timeEntries._embedded && timeEntries._embedded.elements) {
                let targetDate;
                if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    targetDate = date;
                } else {
                    const parsedDate = new Date(date);
                    const year = parsedDate.getFullYear();
                    const month = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
                    const day = parsedDate.getDate().toString().padStart(2, '0');
                    targetDate = `${year}-${month}-${day}`;
                }

                const existingEntry = timeEntries._embedded.elements.find(entry => {
                    const entryDate = entry.spentOn;
                    const entryWorkPackageId = entry._links?.workPackage?.href?.split('/').pop();
                    return entryDate === targetDate && entryWorkPackageId == workPackageId;
                });

                if (existingEntry) {
                    const existingHoursMatch = existingEntry.hours.match(/PT(\d+(?:\.\d+)?)H/);
                    const existingHours = existingHoursMatch ? parseFloat(existingHoursMatch[1]) : 0;
                    const newTotalHours = existingHours + additionalHours;

                    const updateData = {
                        hours: `PT${newTotalHours}H`,
                        comment: comment ? { raw: comment } : existingEntry.comment
                    };

                    const updatedEntry = await this._makeRequest(`/api/v3/time_entries/${existingEntry.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify(updateData)
                    });

                    console.log(`Updated time entry: added ${additionalHours}h to existing ${existingHours}h = ${newTotalHours}h`);
                    return updatedEntry;
                }
            }

            return this.createTimeEntry(workPackageId, date, null, additionalHours, activityName, comment);
        } catch (error) {
            console.error(`Error adding time to existing entry: ${error.message}`);
            return this.createTimeEntry(workPackageId, date, null, additionalHours, activityName, comment);
        }
    }

    async findWorkPackageBySubject(projectId, subject) {
        return this.checkExistingWorkPackageBySubject(projectId, subject);
    }
}
