import { loadConfig, saveConfig, updateProjectMappings } from '../shared/config.js';
import { OpenProjectTimeLogger } from '../shared/apiClient.js';
import { WorkLogService } from '../shared/workLogService.js';

class IntegratedOptionsController {
    constructor() {
        this.config = null;
        this.workLogService = new WorkLogService();
        this.commentData = {};

        this.currentStep = 1;
        this.completedSteps = [];
        this.isAnalyzing = false; // Flag to prevent concurrent analysis

        this.initElements();
        this.initEventListeners();
        this.initCustomDropzone();
        this.loadConfiguration();
    }

    initElements() {
        this.toasterContainer = document.getElementById('toasterContainer');

        this.form = document.getElementById('configForm');
        this.accessToken = document.getElementById('accessToken');
        this.saveTestBtn = document.getElementById('saveTestBtn');
        this.saveStatus = document.getElementById('saveStatus');

        this.steps = document.querySelectorAll('.step');
        this.stepContents = document.querySelectorAll('.step-content');

        this.prevStep1 = document.getElementById('prevStep1');
        this.nextStep2 = document.getElementById('nextStep2');
        this.prevStep2 = document.getElementById('prevStep2');
        this.processAnotherBtn = document.getElementById('processAnotherBtn');

        this.logFile = document.getElementById('logFile');
        this.customDropzone = document.getElementById('customDropzone');
        this.fileName = document.getElementById('fileName');
        this.downloadSampleBtn = document.getElementById('downloadSampleBtn');

        this.configSection = document.getElementById('configSection');
        this.uploadSection = document.getElementById('uploadSection');

        this.analysisSection = document.getElementById('analysisSection');
        this.analysisSummary = document.getElementById('analysisSummary');
        this.analysisDetails = document.getElementById('analysisDetails');
        this.commentSection = document.getElementById('commentSection');
        this.commentInputs = document.getElementById('commentInputs');
        this.processBtn = document.getElementById('processBtn');
        this.resetBtn = document.getElementById('resetBtn');

        this.processingSection = document.getElementById('processingSection');
        this.successSection = document.getElementById('successSection');
        this.progressText = document.getElementById('progressText');
        this.progressFill = document.getElementById('progressFill');
        this.progressDetails = document.getElementById('progressDetails');
        this.processingLog = document.getElementById('processingLog');
        this.resultsSummary = document.getElementById('resultsSummary');
        this.closeBtn = document.getElementById('closeBtn');
        this.successStats = document.getElementById('successStats');

        this.reconfigureApiBtn = document.getElementById('reconfigureApiBtn');
        this.showProjectsBtn = document.getElementById('showProjectsBtn');

        this.commentModal = document.getElementById('commentModal');
        this.commentModalTitle = document.getElementById('commentModalTitle');
        this.commentModalSubject = document.getElementById('commentModalSubject');
        this.commentModalInput = document.getElementById('commentModalInput');
        this.commentModalOk = document.getElementById('commentModalOk');
        this.commentModalSkip = document.getElementById('commentModalSkip');

        this.projectsModal = document.getElementById('projectsModal');
        this.projectsModalClose = document.getElementById('projectsModalClose');
        this.projectsTable = document.getElementById('projectsTable');
        this.projectsTableBody = document.getElementById('projectsTableBody');
        this.projectsLoading = document.getElementById('projectsLoading');
        this.projectsError = document.getElementById('projectsError');
    }

    initEventListeners() {
        this.form.addEventListener('submit', e => this.handleSaveAndTest(e));

        this.prevStep1?.addEventListener('click', () => this.goToStep(1));
        this.nextStep2?.addEventListener('click', () => this.goToStep(3));
        this.prevStep2?.addEventListener('click', () => this.goToStep(2));
        this.processAnotherBtn?.addEventListener('click', () => this.resetToStep(2));
        this.closeBtn?.addEventListener('click', () => this.closeCurrentTab());

        this.reconfigureApiBtn?.addEventListener('click', () => this.handleReconfigureApi());
        this.showProjectsBtn?.addEventListener('click', () => this.showProjectsModal());

        if (this.downloadSampleBtn) {
            this.downloadSampleBtn.addEventListener('click', () => this.downloadSampleFile());
        }

        if (this.processBtn) {
            this.processBtn.addEventListener('click', () => {
                this.processEntries();
            });
        }
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.resetToStep(2));
        }

        this.commentModalOk.addEventListener('click', () => this.handleCommentModalOk());
        this.commentModalSkip.addEventListener('click', () => this.handleCommentModalSkip());

        this.projectsModalClose?.addEventListener('click', () => this.hideProjectsModal());

        // Close modals when clicking outside
        this.projectsModal?.addEventListener('click', e => {
            if (e.target === this.projectsModal) {
                this.hideProjectsModal();
            }
        });
    }

    initCustomDropzone() {
        const dropzone = this.customDropzone;
        const fileInput = this.logFile;

        dropzone.addEventListener('click', () => {
            fileInput.click();
        });

        dropzone.addEventListener('dragover', e => {
            e.preventDefault();
            dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', e => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', e => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];

                if (!file.name.toLowerCase().endsWith('.json')) {
                    this.showToaster('Please select a JSON file', 'error');
                    return;
                }

                const event = new Event('change');
                Object.defineProperty(event, 'target', {
                    value: { files: [file] },
                    enumerable: true
                });

                this.handleFileSelect(event);
            }
        });

        fileInput.addEventListener('change', e => {
            this.handleFileSelect(e);
        });
    }

    updateStepperUI() {
        this.steps.forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.remove('active', 'completed', 'pending');

            if (stepNumber < this.currentStep || this.completedSteps.includes(stepNumber)) {
                step.classList.add('completed');
            } else if (stepNumber === this.currentStep) {
                step.classList.add('active');
            } else {
                step.classList.add('pending');
            }
        });

        this.stepContents.forEach((content, index) => {
            const stepNumber = index + 1;
            content.classList.toggle('active', stepNumber === this.currentStep);
        });

        // Show analysis section only in step 3
        if (this.analysisSection) {
            this.analysisSection.style.display = this.currentStep === 3 ? 'block' : 'none';
        }
    }

    goToStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > 4) return;

        this.currentStep = stepNumber;
        this.updateStepperUI();

        // Handle step 3 - Review & Process Entries
        if (stepNumber === 3) {
            if (this.analysisSection) {
                this.analysisSection.style.display = 'block';
            }

            const analysisData = this.workLogService.getAnalysisData();
            const hasWorkLogEntries = this.workLogService.workLogEntries && this.workLogService.workLogEntries.length > 0;

            if (analysisData) {
                // We have analysis data, display it
                this.displayAnalysis();
            } else if (hasWorkLogEntries && !this.isAnalyzing) {
                // We have work log entries but no analysis yet, show loader and trigger analysis
                this.showAnalysisLoader();
                this.analyzeWorkLog().catch(error => {
                    console.error('Analysis failed:', error);
                    this.showAnalysisError(error.message);
                });
            } else if (this.isAnalyzing) {
                // Analysis is already in progress, just show the loader
                this.showAnalysisLoader();
            } else {
                // No work log entries available, show message to upload file
                this.showNoDataMessage();
            }
        }
    }

    completeStep(stepNumber) {
        if (!this.completedSteps.includes(stepNumber)) {
            this.completedSteps.push(stepNumber);
        }
        this.updateStepperUI();

        // Only auto-advance for step 1 (configuration) and step 3 (processing)
        if ((stepNumber === 1 || stepNumber === 3) && stepNumber < 4) {
            setTimeout(() => {
                this.goToStep(stepNumber + 1);
            }, 500);
        }
    }

    resetToStep(stepNumber) {
        this.currentStep = stepNumber;
        this.completedSteps = this.completedSteps.filter(step => step < stepNumber);

        // Reset data based on step
        if (stepNumber <= 2) {
            this.resetFileData();
        }
        if (stepNumber <= 1) {
            this.resetAllData();
        }

        this.updateStepperUI();
    }

    resetFileData() {
        this.parsedData = null;
        this.workLogEntries = [];
        this.isAnalyzing = false; // Reset analysis flag

        // Clear workLogService data
        if (this.workLogService) {
            this.workLogService.workLogEntries = [];
            this.workLogService.analysisData = null;
        }

        if (this.logFile) this.logFile.value = '';
        if (this.fileName) {
            this.fileName.classList.add('hidden');
            this.fileName.textContent = '';
        }
        if (this.nextStep2) this.nextStep2.disabled = true;
        if (this.processBtn) this.processBtn.disabled = true;
    }

    resetAllData() {
        this.resetFileData();
        if (this.analysisSummary) this.analysisSummary.innerHTML = '';
        if (this.analysisDetails) this.analysisDetails.innerHTML = '';
        if (this.commentInputs) this.commentInputs.innerHTML = '';
        if (this.processingLog) this.processingLog.innerHTML = '';
        if (this.progressFill) this.progressFill.style.width = '0%';
        if (this.progressDetails) this.progressDetails.textContent = '0/0';
        if (this.processingSection) this.processingSection.style.display = 'block';
        if (this.successSection) {
            this.successSection.classList.add('hidden');
            this.successSection.style.display = 'none';
        }
        if (this.successStats) this.successStats.innerHTML = '';
    }

    // Toaster notification methods
    showToaster(message, type = 'success', duration = 5000, persistent = false) {
        if (!this.toasterContainer) return;

        const toaster = document.createElement('div');
        toaster.className = `toaster ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        toaster.innerHTML = `
            <div class="toaster-content">
                <div class="toaster-icon">${icons[type] || icons.success}</div>
                <div class="toaster-message">${message}</div>
            </div>
        `;

        this.toasterContainer.appendChild(toaster);

        // Auto-hide after duration unless persistent is true
        if (!persistent && duration > 0) {
            setTimeout(() => {
                if (toaster.parentElement) {
                    toaster.classList.add('hiding');
                    setTimeout(() => toaster.remove(), 300);
                }
            }, duration);
        }
    }

    hideToaster(toasterElement) {
        if (toasterElement) {
            toasterElement.classList.add('hiding');
            setTimeout(() => toasterElement.remove(), 300);
        }
    }

    async loadConfiguration() {
        try {
            this.config = await loadConfig();

            this.accessToken.value = this.config.CONFIG.access_token || '';

            if (this.config.CONFIG.access_token && this.config.CONFIG.access_token.trim()) {
                this.showToaster('Access token found! Proceeding to Upload Logs...', 'success');

                setTimeout(() => {
                    this.completeStep(1);
                    this.goToStep(2);
                }, 800);
            }
        } catch (error) {
            this.showToaster('Error loading configuration', 'error', 0, true);
        }
    }

    async handleSaveAndTest(event) {
        event.preventDefault();

        try {
            const accessTokenValue = this.accessToken.value.trim();

            if (!accessTokenValue) {
                this.showToaster('Please enter an Access Token', 'error', 0, true);
                return;
            } // Create basic config with just access token
            const basicConfig = {
                CONFIG: {
                    base_url: 'https://pm.reddotdigitalltd.com',
                    access_token: accessTokenValue,
                    accountable_user_id: '',
                    assignee_user_id: ''
                },
                PROJECT_MAPPINGS: {},
                DEFAULT_TIMEZONE: 'Asia/Dhaka'
            };

            console.log('Saving config:', {
                base_url: basicConfig.CONFIG.base_url,
                access_token: basicConfig.CONFIG.access_token ? '[PRESENT]' : '[MISSING]'
            });

            await saveConfig(basicConfig);

            // Verify the config was saved
            const verifyConfig = await loadConfig();
            console.log('Verified saved config:', {
                base_url: verifyConfig.CONFIG.base_url,
                access_token: verifyConfig.CONFIG.access_token ? '[PRESENT]' : '[MISSING]'
            });

            this.config = verifyConfig;

            await this.testConnectionAndFetchUserInfo();
        } catch (error) {
            console.error('Configuration error:', error);
            this.showToaster(`Configuration failed: ${error.message}`, 'error', 0, true);
        }
    }

    async testConnectionAndFetchUserInfo() {
        try {
            this.config = await loadConfig();

            console.log('Testing connection with config:', {
                base_url: this.config.CONFIG.base_url,
                access_token: this.config.CONFIG.access_token ? '[PRESENT]' : '[MISSING]'
            });

            const logger = new OpenProjectTimeLogger();
            await logger.initialize();
            const user = await logger.getCurrentUser();

            const projects = await logger.getProjects();

            const projectMappings = {};
            projects.forEach(project => {
                const identifier =
                    project.identifier?.toUpperCase() ||
                    project.name
                        .toUpperCase()
                        .replace(/\s+/g, '-')
                        .replace(/[^\w-]/g, '')
                        .replace(/--+/g, '-');
                projectMappings[identifier] = project.id;
            });

            // Update config with user ID and project mappings
            const updatedConfig = {
                ...this.config,
                CONFIG: {
                    ...this.config.CONFIG,
                    accountable_user_id: user.id,
                    assignee_user_id: user.id
                },
                PROJECT_MAPPINGS: projectMappings
            };

            await saveConfig(updatedConfig);

            await updateProjectMappings(projectMappings);

            this.config = updatedConfig;

            this.showToaster(`Configuration saved successfully! Authenticated as: ${user.name} | ${projects.length} projects loaded`, 'success');

            // Complete step 1 and move to step 2
            this.completeStep(1);
        } catch (error) {
            this.showToaster(`Configuration saved but connection failed: ${error.message}`, 'error', 0, true);
        }
    }

    showStatus(message, type) {
        this.saveStatus.textContent = message;
        this.saveStatus.className = `status ${type}`;
        this.saveStatus.classList.remove('hidden');
        this.saveStatus.style.display = 'inline-block';

        setTimeout(() => {
            this.saveStatus.classList.add('hidden');
            this.saveStatus.style.display = 'none';
        }, 5000);
    }

    // Reconfigure Access Token method
    async handleReconfigureApi() {
        try {
            const clearedConfig = {
                ...this.config,
                CONFIG: {
                    ...this.config.CONFIG,
                    access_token: '',
                    accountable_user_id: '',
                    assignee_user_id: ''
                }
            };

            await saveConfig(clearedConfig);

            this.config = clearedConfig;

            this.accessToken.value = '';

            // Reset completed steps and navigate back to Step 1
            this.completedSteps = [];
            this.goToStep(1);

            this.showToaster('Access token cleared. Please enter your new access token.', 'info');
        } catch (error) {
            this.showToaster(`Error clearing configuration: ${error.message}`, 'error', 0, true);
        }
    }

    // Time Logger functionality methods
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        this.fileName.textContent = file.name;
        this.fileName.classList.remove('hidden');

        try {
            const result = await this.workLogService.processFile(file);

            // Sync the workLogEntries from the service for UI operations
            this.workLogEntries = this.workLogService.workLogEntries;

            if (this.nextStep2) {
                this.nextStep2.disabled = false;
            }

            this.showToaster(`Logs uploaded successfully! Found ${result.totalEntries} entries across ${result.dateCount} date(s)`, 'success');

            this.completeStep(2);

            this.analyzeWorkLog().catch(error => {
                console.error('Analysis failed:', error);
            });
        } catch (error) {
            this.showToaster(`Error reading file: ${error.message}`, 'error', 0, true);
            this.logFile.value = '';
            this.fileName.classList.add('hidden');

            // If user is on step 3 and file upload failed, show the no data message
            if (this.currentStep === 3) {
                this.showNoDataMessage();
            }
        }
    }

    downloadSampleFile() {
        const link = document.createElement('a');
        link.href = '../sample.json';
        link.download = 'sample.json';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showToaster('Sample file download started', 'success');
    }

    async analyzeWorkLog() {
        // Prevent concurrent analysis
        if (this.isAnalyzing) {
            console.log('Analysis already in progress, skipping...');
            return;
        }

        try {
            this.isAnalyzing = true;

            if (!this.config) {
                this.showStatus('Configuration not loaded. Please save configuration first.', 'error');
                return;
            }

            await this.workLogService.initialize();
            await this.workLogService.performWorkPackageAnalysis();

            // Show analysis and update UI
            this.displayAnalysis();

            if (this.analysisSection) {
                this.analysisSection.style.display = 'block';
            }

            // Complete step 2 to enable Continue button
            this.completeStep(2);

            if (this.processBtn) {
                this.processBtn.disabled = false;
            }

            // If user is currently on step 3, automatically show the analysis
            if (this.currentStep === 3) {
                this.displayAnalysis();
            }
        } catch (error) {
            this.showStatus(`Analysis failed: ${error.message}`, 'error');

            // If user is currently on step 3, show error message
            if (this.currentStep === 3) {
                this.showAnalysisError(error.message);
            }
        } finally {
            this.isAnalyzing = false;
        }
    }

    // Helper method to build time range with log date and processed times
    buildTimeRange(entry) {
        const logDateRaw = entry.entry_date || entry.date; // original parsed date from log file
        let logDateDisplay = '';
        if (logDateRaw) {
            try {
                // Accept formats: YYYY-MM-DD or ISO
                const dateObj = new Date(logDateRaw);
                if (!isNaN(dateObj.getTime())) {
                    logDateDisplay = dateObj.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    });
                } else {
                    logDateDisplay = logDateRaw; // fallback raw
                }
            } catch {
                logDateDisplay = logDateRaw;
            }
        } else {
            logDateDisplay = 'Unknown Date';
        }

        // Build time range using the JSON log date + processed times (avoid creation dates)
        const extractTime = val => {
            if (!val) return '';
            if (typeof val === 'string') {
                // If already HH:MM
                if (/^\d{1,2}:\d{2}$/.test(val)) return val;
                // If ISO-like, extract local HH:MM
                const d = new Date(val);
                if (!isNaN(d.getTime())) {
                    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                }
                return val; // fallback raw
            }
            return '';
        };

        const startVal = entry.calculated_start_time || entry.start_time;
        const endVal = entry.calculated_end_time || entry.end_time;
        const startTimePart = extractTime(startVal);
        const endTimePart = extractTime(endVal);

        return startTimePart || endTimePart ? `${logDateDisplay} ${startTimePart}${endTimePart ? ' – ' + endTimePart : ''}` : '';
    }

    showStartTimePrompt(firstEntry, entryDate) {
        // Remove any existing start time prompt to prevent duplicates
        const existingPrompt = document.getElementById('startTimePrompt');
        if (existingPrompt) {
            existingPrompt.remove();
        }

        // Clear the analysis loader since we're showing the start time prompt
        this.analysisSummary.innerHTML = '';
        this.analysisDetails.innerHTML = '';

        const dateDisplay = entryDate ? `for ${entryDate}` : '';
        const promptHtml = `
            <div id="startTimePrompt" style="background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 12px; padding: 25px; margin-bottom: 25px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);" data-entry-date="${entryDate || ''}">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                    <span style="font-size: 24px;">🕒</span>
                    <h3 style="margin: 0; color: #333; font-size: 18px;">Set Start Time for First Task ${dateDisplay}</h3>
                </div>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">
                    The first task "<strong>${firstEntry.subject}</strong>" needs a start time to calculate the schedule for all subsequent tasks.
                </p>
                <div style="display: flex; align-items: end; gap: 15px; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <label style="display: block; color: #333; font-weight: 600; margin-bottom: 5px; text-align: center;">Hour</label>
                        <select id="hourInput" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; background: white; text-align: center;">
                            ${Array.from({ length: 12 }, (_, i) => {
                                const hour = i + 1;
                                const selected = hour === 9 ? 'selected' : '';
                                return `<option value="${hour}" ${selected}>${String(hour).padStart(2, '0')}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; color: #333; font-weight: 600; margin-bottom: 5px; text-align: center;">Minute</label>
                        <select id="minuteInput" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; background: white; text-align: center;">
                            ${Array.from({ length: 60 }, (_, i) => {
                                const minute = i;
                                const selected = minute === 0 ? 'selected' : '';
                                return `<option value="${minute}" ${selected}>${String(minute).padStart(2, '0')}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; color: #333; font-weight: 600; margin-bottom: 5px; text-align: center;">Period</label>
                        <select id="periodInput" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; background: white; text-align: center;">
                            <option value="AM" selected>AM</option>
                            <option value="PM">PM</option>
                        </select>
                    </div>
                </div>
                <div id="timeValidationError" style="color: #d32f2f; font-size: 12px; margin-bottom: 15px; display: none;"></div>
                <div style="text-align: center;">
                    <button id="confirmStartTimeBtn" style="background: linear-gradient(135deg, #4caf50, #45a049); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; box-shadow: 0 3px 8px rgba(76, 175, 80, 0.3); display: inline-flex; align-items: center; gap: 8px; font-size: 14px;">
                        ✅ Confirm Start Time
                    </button>
                </div>
            </div>
        `;

        // Insert the prompt at the top of the analysis summary
        this.analysisSummary.insertAdjacentHTML('afterbegin', promptHtml);

        // Add event listener for the confirm button
        const confirmBtn = document.getElementById('confirmStartTimeBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.setStartTimeAndCalculate();
            });
        }
    }

    setStartTimeAndCalculate() {
        const hourInput = document.getElementById('hourInput');
        const minuteInput = document.getElementById('minuteInput');
        const periodInput = document.getElementById('periodInput');
        const errorDiv = document.getElementById('timeValidationError');

        errorDiv.style.display = 'none';

        const hour = parseInt(hourInput.value);
        const minute = parseInt(minuteInput.value);
        const period = periodInput.value;

        const errors = [];

        if (isNaN(hour) || hour < 1 || hour > 12) {
            errors.push('Invalid hour (must be 1-12)');
        }

        if (isNaN(minute) || minute < 0 || minute > 59) {
            errors.push('Invalid minute (must be 00-59)');
        }

        if (period !== 'AM' && period !== 'PM') {
            errors.push('Invalid period (must be AM or PM)');
        }

        if (errors.length > 0) {
            errorDiv.textContent = errors.join(', ');
            errorDiv.style.display = 'block';
            return;
        }

        let hour24 = hour;
        if (period === 'AM' && hour === 12) {
            hour24 = 0;
        } else if (period === 'PM' && hour !== 12) {
            hour24 = hour + 12;
        }

        const startTime = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

        // Get the target date from the prompt
        const startTimePrompt = document.getElementById('startTimePrompt');
        const targetDate = startTimePrompt ? startTimePrompt.getAttribute('data-entry-date') : null;

        // Set the start time for the first non-SCRUM entry of the specific date
        this.workLogService.setStartTimeForFirstEntry(startTime, targetDate);

        document.getElementById('startTimePrompt')?.remove();

        // Show loading state while calculating times
        this.showAnalysisLoader();

        // Use setTimeout to allow loader to render before processing
        setTimeout(() => {
            const validationIssues = this.workLogService.calculateAllTimes();
            this.displayValidationIssues(validationIssues);

            const nextStartTimeCheck = this.workLogService.checkAndPromptForStartTime();
            if (nextStartTimeCheck.needsStartTime) {
                this.showStartTimePrompt(nextStartTimeCheck.entry, nextStartTimeCheck.date);
                return;
            }

            this.renderAnalysisContent();

            this.showToaster(`Start time set to ${this.workLogService.formatTime12Hour(startTime)}`, 'success', 3000);
            this.showTimelineReview();
        }, 100);
    }

    showTimelineReview() {
        // Get unique dates to determine if multi-date
        const uniqueDates = [...new Set(this.workLogEntries.map(entry => entry.entry_date))];
        const timelineTitle = uniqueDates.length === 1 ? 'Timeline' : `Timeline (${uniqueDates.length} dates)`;

        // Create a timeline review section
        const timelineHtml = `
            <div id="timelineReview" style="background: linear-gradient(135deg, #e8f5e8 0%, #d4edda 100%); border: 2px solid #28a745; border-radius: 12px; padding: 20px; margin: 20px 0; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.2);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                    <span style="font-size: 24px;">📅</span>
                    <h4 style="margin: 0; color: #155724; font-size: 16px;">${timelineTitle}</h4>
                </div>
                <div style="background: white; border-radius: 8px; padding: 15px; border: 1px solid #c3e6cb;">
                    ${this.generateTimelineList()}
                </div>
            </div>
        `;

        // Insert after the analysis summary
        this.analysisSummary.insertAdjacentHTML('afterend', timelineHtml);
    }

    generateTimelineList() {
        // Group entries by date
        const entriesByDate = {};
        this.workLogEntries.forEach(entry => {
            const date = entry.entry_date;
            if (!entriesByDate[date]) {
                entriesByDate[date] = [];
            }
            entriesByDate[date].push(entry);
        });

        // Sort dates and generate timeline
        const sortedDates = Object.keys(entriesByDate).sort();
        let timelineHtml = '';
        let grandTotal = 0;

        sortedDates.forEach(date => {
            const entries = entriesByDate[date];

            // Calculate total hours for this date
            const dateTotal = entries.reduce((sum, entry) => {
                return sum + (entry.duration_hours || entry.hours || 0);
            }, 0);
            grandTotal += dateTotal;

            // Sort entries by time within each date
            const sortedEntries = [...entries].sort((a, b) => {
                // SCRUM entries first, then by calculated start time
                if (a.is_scrum && !b.is_scrum) return -1;
                if (!a.is_scrum && b.is_scrum) return 1;

                const aTime = a.calculated_start_time || a.start_time || '00:00';
                const bTime = b.calculated_start_time || b.start_time || '00:00';
                return aTime.localeCompare(bTime);
            });

            // Format date for display
            let dateDisplay = date;
            try {
                const dateObj = new Date(date);
                if (!isNaN(dateObj.getTime())) {
                    dateDisplay = dateObj.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    });
                }
            } catch {
                // Keep original date string
            }

            // Add date header with total hours
            if (sortedDates.length > 1) {
                timelineHtml += `
                    <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 12px 16px; margin: 15px -15px 10px -15px; border-radius: 8px; border-left: 4px solid #007bff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 18px;">📅</span>
                                <span style="font-weight: 700; color: #212529; font-size: 15px;">${dateDisplay}</span>
                            </div>
                            <div style="background: #007bff; color: white; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 4px rgba(0,123,255,0.3);">
                                Total: ${dateTotal}h
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Single date - show total hours in a header
                timelineHtml += `
                    <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 12px 16px; margin: 0 -15px 15px -15px; border-radius: 8px; border-left: 4px solid #007bff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 18px;">📅</span>
                                <span style="font-weight: 700; color: #212529; font-size: 15px;">${dateDisplay}</span>
                            </div>
                            <div style="background: #007bff; color: white; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 4px rgba(0,123,255,0.3);">
                                Total: ${dateTotal}h
                            </div>
                        </div>
                    </div>
                `;
            }

            // Add entries for this date
            timelineHtml += `<div style="background: white; border-radius: 6px; border: 1px solid #e9ecef; overflow: hidden; margin-bottom: 10px;">`;

            timelineHtml += sortedEntries
                .map((entry, index) => {
                    const startTime = entry.calculated_start_time || entry.start_time;
                    const endTime = entry.calculated_end_time || entry.end_time;
                    const duration = entry.duration_hours || entry.hours || 0;
                    const isScrum = entry.is_scrum;

                    return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; ${index < sortedEntries.length - 1 ? 'border-bottom: 1px solid #f1f3f4;' : ''} ${index % 2 === 0 ? 'background: #fafbfc;' : 'background: white;'}">
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                ${isScrum ? '<span style="background: linear-gradient(135deg, #7b1fa2, #9c27b0); color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 1px 3px rgba(123,31,162,0.4);">SCRUM</span>' : ''}
                                <span style="background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">${entry.project}</span>
                            </div>
                            <div style="color: #212529; font-weight: 500; line-height: 1.4; word-wrap: break-word;">${entry.subject}</div>
                        </div>
                        <div style="text-align: right; font-size: 12px; color: #6c757d; min-width: 130px; margin-left: 16px;">
                            <div style="font-weight: 700; color: #495057; margin-bottom: 2px;">
                                ${startTime ? this.workLogService.formatTime12Hour(startTime) : '<span style="color: #dc3545;">TBD</span>'} - ${endTime ? this.workLogService.formatTime12Hour(endTime) : '<span style="color: #dc3545;">TBD</span>'}
                            </div>
                            <div style="background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 12px; font-weight: 600; display: inline-block;">${duration}h</div>
                        </div>
                    </div>
                `;
                })
                .join('');

            timelineHtml += '</div>';
        });

        // Add grand total section if multiple dates
        if (sortedDates.length > 1) {
            timelineHtml += `
                <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 16px; margin: 20px -15px -15px -15px; border-radius: 8px; box-shadow: 0 4px 8px rgba(40,167,69,0.3);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 20px;">⏱️</span>
                            <span style="font-weight: 700; font-size: 16px;">Grand Total (${sortedDates.length} days)</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; font-weight: 700; font-size: 16px; backdrop-filter: blur(10px);">
                            ${grandTotal}h
                        </div>
                    </div>
                </div>
            `;
        }

        return timelineHtml;
    }

    displayValidationIssues(issues) {
        // Remove existing validation warnings
        document.getElementById('validationIssues')?.remove();

        if (issues.length === 0) return;

        const warningsHtml = `
            <div id="validationIssues" style="background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%); border: 2px solid #ff9800; border-radius: 12px; padding: 20px; margin: 20px 0; box-shadow: 0 4px 12px rgba(255, 152, 0, 0.2);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                    <span style="font-size: 24px;">⚠️</span>
                    <h4 style="margin: 0; color: #e65100; font-size: 16px;">Time Schedule Warnings</h4>
                </div>
                <div style="space-y: 10px;">
                    ${issues
                        .map(
                            issue => `
                        <div style="background: white; border-radius: 8px; padding: 12px; margin-bottom: 10px; border-left: 4px solid ${issue.type === 'time_overlap' ? '#f44336' : issue.type === 'missing_work_package_id' ? '#e91e63' : '#ff9800'};">
                            <div style="font-weight: 600; color: #d84315; margin-bottom: 4px;">
                                ${issue.type === 'time_overlap' ? '🔄 Time Overlap' : issue.type === 'missing_work_package_id' ? '🆔 Missing Work Package ID' : '⏱️ Missing Break Time'}
                            </div>
                            <div style="font-size: 14px; color: #bf360c;">
                                <strong>[${issue.entry.project}]</strong> ${issue.entry.subject}
                            </div>
                            <div style="font-size: 12px; color: #8d6e63; margin-top: 4px;">
                                ${issue.message}
                            </div>
                        </div>
                    `
                        )
                        .join('')}
                </div>
                <div style="margin-top: 15px; padding: 10px; background: #ffecb3; border-radius: 6px; font-size: 13px; color: #e65100;">
                    ${issues.some(issue => issue.type === 'missing_work_package_id') ? '� SCRUM entries require a work_package_id. Please fix these errors before processing.' : '�💡 These are warnings only. Processing will continue with the calculated times.'}
                </div>
            </div>
        `;

        // Insert before the analysis summary
        this.analysisSummary.insertAdjacentHTML('beforebegin', warningsHtml);
    }

    displayAnalysis() {
        const analysisData = this.workLogService.getAnalysisData();
        if (!analysisData) {
            return;
        }

        // Show loader while processing
        this.showAnalysisLoader();

        // Use setTimeout to allow the loader to render before processing
        setTimeout(() => {
            this.renderAnalysisContent();
        }, 100);
    }

    showAnalysisLoader() {
        this.analysisSummary.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 16px; margin-bottom: 25px;">
                <div style="display: inline-block; width: 50px; height: 50px; border: 4px solid #e3f2fd; border-top: 4px solid #1976d2; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
                <div style="font-size: 18px; font-weight: 600; color: #1976d2; margin-bottom: 8px;">Analyzing Work Log Entries...</div>
                <div style="font-size: 14px; color: #6c757d;">Processing entries and checking for duplicates</div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        this.analysisDetails.innerHTML = '';

        // Hide comment section while analysis is running
        if (this.commentSection) {
            this.commentSection.classList.add('hidden');
            this.commentSection.style.display = 'none';
        }
    }

    showNoDataMessage() {
        this.analysisSummary.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border-radius: 16px; margin-bottom: 25px; border: 2px dashed #f39c12;">
                <div style="font-size: 48px; margin-bottom: 20px;">📁</div>
                <div style="font-size: 20px; font-weight: 600; color: #d68910; margin-bottom: 12px;">No Work Log Data Available</div>
                <div style="font-size: 14px; color: #856404; margin-bottom: 20px; line-height: 1.5;">
                    Please upload a JSON file with your work log entries to continue.
                </div>
                <button id="goToUploadBtn" style="background: linear-gradient(135deg, #3498db, #2980b9); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; box-shadow: 0 3px 8px rgba(52, 152, 219, 0.3); display: inline-flex; align-items: center; gap: 8px; font-size: 14px; transition: all 0.2s ease;">
                    📤 Go to Upload Step
                </button>
            </div>
        `;
        this.analysisDetails.innerHTML = '';

        // Add event listener for the button
        const goToUploadBtn = document.getElementById('goToUploadBtn');
        if (goToUploadBtn) {
            goToUploadBtn.addEventListener('click', () => {
                this.goToStep(2);
            });
        }
    }

    showAnalysisError(errorMessage) {
        this.analysisSummary.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%); border-radius: 16px; margin-bottom: 25px; border: 2px solid #dc3545;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <div style="font-size: 20px; font-weight: 600; color: #721c24; margin-bottom: 12px;">Analysis Failed</div>
                <div style="font-size: 14px; color: #721c24; margin-bottom: 20px; line-height: 1.5;">
                    ${errorMessage}
                </div>
                <button id="retryAnalysisBtn" style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; box-shadow: 0 3px 8px rgba(220, 53, 69, 0.3); display: inline-flex; align-items: center; gap: 8px; font-size: 14px; transition: all 0.2s ease; margin-right: 10px;">
                    🔄 Retry Analysis
                </button>
                <button id="goBackToUploadBtn" style="background: linear-gradient(135deg, #6c757d, #5a6268); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; box-shadow: 0 3px 8px rgba(108, 117, 125, 0.3); display: inline-flex; align-items: center; gap: 8px; font-size: 14px; transition: all 0.2s ease;">
                    📤 Back to Upload
                </button>
            </div>
        `;
        this.analysisDetails.innerHTML = '';

        // Hide comment section during error display
        if (this.commentSection) {
            this.commentSection.classList.add('hidden');
            this.commentSection.style.display = 'none';
        }

        // Add event listeners for the buttons
        const retryAnalysisBtn = document.getElementById('retryAnalysisBtn');
        if (retryAnalysisBtn) {
            retryAnalysisBtn.addEventListener('click', () => {
                this.showAnalysisLoader();
                this.analyzeWorkLog().catch(error => {
                    console.error('Retry analysis failed:', error);
                    this.showAnalysisError(error.message);
                });
            });
        }

        const goBackToUploadBtn = document.getElementById('goBackToUploadBtn');
        if (goBackToUploadBtn) {
            goBackToUploadBtn.addEventListener('click', () => {
                this.goToStep(2);
            });
        }
    }

    renderAnalysisContent() {
        const startTimeCheck = this.workLogService.checkAndPromptForStartTime();
        if (startTimeCheck.needsStartTime) {
            this.showStartTimePrompt(startTimeCheck.entry, startTimeCheck.date);
            return;
        }

        const analysisData = this.workLogService.getAnalysisData();
        const { scrum, existing, new: newEntries, existingWorkPackages, duplicates } = analysisData;
        const total = scrum.length + existing.length + newEntries.length + (existingWorkPackages ? existingWorkPackages.length : 0) + (duplicates ? duplicates.length : 0);

        const totalHours = this.workLogService.calculateTotalTime();

        // Get unique dates from entries
        const uniqueDates = [...new Set(this.workLogEntries.map(entry => entry.entry_date))].sort();
        const dateDisplay = uniqueDates.length === 1 ? this.workLogService.formatDate(uniqueDates[0]) : `${uniqueDates.length} dates (${this.workLogService.formatDate(uniqueDates[0])} - ${this.workLogService.formatDate(uniqueDates[uniqueDates.length - 1])})`;

        // Display summary with improved styling
        this.analysisSummary.innerHTML = `
            <div class="analysis-category summary" style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border: 2px solid #1976d2; border-radius: 16px; padding: 30px; margin-bottom: 30px; box-shadow: 0 8px 24px rgba(25, 118, 210, 0.15);">
                <div style="text-align: center; margin-bottom: 25px;">
                    <h3 style="color: #1565c0; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: -0.5px;">📊 Analysis Summary</h3>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 30px; align-items: center; justify-content: space-around;">
                    <div style="text-align: center; min-width: 200px; background: rgba(255, 255, 255, 0.7); padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
                        <div style="font-size: 32px; margin-bottom: 12px;">📅</div>
                        <div style="font-size: ${uniqueDates.length === 1 ? '20px' : '16px'}; font-weight: 700; color: #0d47a1; margin-bottom: 4px;">${dateDisplay}</div>
                        <div style="font-size: 11px; color: #1976d2; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">${uniqueDates.length === 1 ? 'Date' : 'Date Range'}</div>
                    </div>
                    <div style="text-align: center; min-width: 150px; background: rgba(255, 255, 255, 0.7); padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
                        <div style="font-size: 32px; margin-bottom: 12px;">📝</div>
                        <div style="font-size: 20px; font-weight: 700; color: #0d47a1; margin-bottom: 4px;">${total}</div>
                        <div style="font-size: 11px; color: #1976d2; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Total Entries</div>
                    </div>
                    <div style="text-align: center; min-width: 150px; background: rgba(255, 255, 255, 0.7); padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
                        <div style="font-size: 32px; margin-bottom: 12px;">⏱️</div>
                        <div style="font-size: 20px; font-weight: 700; color: #0d47a1; margin-bottom: 4px;">${totalHours} hrs</div>
                        <div style="font-size: 11px; color: #1976d2; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Total Time</div>
                    </div>
                </div>
            </div>
        `;

        // Display detailed analysis
        let detailsHtml = '';

        if (scrum.length > 0) {
            detailsHtml += `
                <div class="analysis-category scrum" style="background: linear-gradient(135deg, #f3e5f5 0%, #e8eaf6 100%); border: 2px solid #7b1fa2; border-radius: 16px; padding: 25px; margin-bottom: 25px; box-shadow: 0 6px 20px rgba(123, 31, 162, 0.15);">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                        <div style="background: linear-gradient(135deg, #7b1fa2, #4a148c); color: white; padding: 10px; border-radius: 12px; font-size: 24px; box-shadow: 0 4px 12px rgba(123, 31, 162, 0.3);">📅</div>
                        <div>
                            <h4 style="color: #4a148c; margin: 0; font-size: 20px; font-weight: 700;">SCRUM ENTRIES</h4>
                            <p style="color: #6a1b9a; margin: 0; font-size: 14px;">${scrum.length} meeting${scrum.length !== 1 ? 's' : ''} scheduled</p>
                        </div>
                        <div style="margin-left: auto; background: #4a148c; color: white; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 14px;">${scrum.length}</div>
                    </div>
                    <div style="display: grid; gap: 12px;">
                        ${scrum
                            .map(entry => {
                                const timeRange = this.buildTimeRange(entry);

                                return `
                                <div style="background: rgba(255, 255, 255, 0.8); border-radius: 12px; padding: 18px; border-left: 4px solid #7b1fa2; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08); transition: transform 0.2s ease;">
                                    <div style="display: flex; justify-content: between; align-items: flex-start; gap: 15px;">
                                        <div style="flex: 1;">
                                            <div style="display: inline-block; background: linear-gradient(135deg, #7b1fa2, #4a148c); color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">${entry.project}</div>
                                            <div style="font-weight: 600; color: #263238; font-size: 15px; margin-bottom: 4px; line-height: 1.4;">${entry.subject}</div>
                                            <div style="color: #546e7a; font-size: 12px; display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                                <span style="background: #e8eaf6; color: #4a148c; padding: 2px 8px; border-radius: 8px; font-weight: 600; font-size: 10px;">WP ID: ${entry.work_package_id}</span>
                                            </div>
                                            <div style="color: #37474f; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                                <span style="font-size: 14px;">⏰</span>
                                                <span>${timeRange}</span>
                                                <span style="background: #4a148c; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600;">${entry.hours || entry.duration_hours}h</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>`;
                            })
                            .join('')}
                    </div>
                </div>
            `;
        }

        if (duplicates && duplicates.length > 0) {
            detailsHtml += `
                <div class="analysis-category duplicates" style="background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%); border: 2px solid #f57c00; border-radius: 16px; padding: 25px; margin-bottom: 25px; box-shadow: 0 6px 20px rgba(245, 124, 0, 0.15);">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                        <div style="background: linear-gradient(135deg, #f57c00, #e65100); color: white; padding: 10px; border-radius: 12px; font-size: 24px; box-shadow: 0 4px 12px rgba(245, 124, 0, 0.3);">🔄</div>
                        <div>
                            <h4 style="color: #e65100; margin: 0; font-size: 20px; font-weight: 700;">DUPLICATE WORK PACKAGES</h4>
                            <p style="color: #f57c00; margin: 0; font-size: 14px;">Time will be added to existing work packages</p>
                        </div>
                        <div style="margin-left: auto; background: #e65100; color: white; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 14px;">${duplicates.length}</div>
                    </div>
                    <div style="margin-bottom: 15px; padding: 12px; background: rgba(255, 193, 7, 0.1); border-radius: 8px; border-left: 4px solid #ffc107;">
                        <div style="font-size: 13px; color: #bf360c; font-weight: 600;">⚠️ These entries will add time to existing work packages instead of creating new ones.</div>
                    </div>
                    <div style="display: grid; gap: 12px;">
                        ${duplicates
                            .map(
                                entry => `
                                <div style="background: rgba(255, 255, 255, 0.8); border-radius: 12px; padding: 18px; border-left: 4px solid #f57c00; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);">
                                    <div style="display: inline-block; background: linear-gradient(135deg, #f57c00, #e65100); color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">${entry.project}</div>
                                    <div style="font-weight: 600; color: #263238; font-size: 15px; margin-bottom: 8px; line-height: 1.4;">${entry.subject}</div>
                                    <div style="color: #37474f; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                        <span style="background: #fff3e0; color: #e65100; padding: 2px 8px; border-radius: 8px; font-weight: 600; font-size: 10px;">Add ${entry.hours || entry.duration_hours}h to WP ID: ${entry.existing_work_package_id}</span>
                                    </div>
                                </div>
                        `
                            )
                            .join('')}
                    </div>
                </div>
            `;
        }

        if (existing.length > 0) {
            detailsHtml += `
                <div class="analysis-category existing" style="background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c8 100%); border: 2px solid #388e3c; border-radius: 16px; padding: 25px; margin-bottom: 25px; box-shadow: 0 6px 20px rgba(56, 142, 60, 0.15);">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                        <div style="background: linear-gradient(135deg, #388e3c, #2e7d32); color: white; padding: 10px; border-radius: 12px; font-size: 24px; box-shadow: 0 4px 12px rgba(56, 142, 60, 0.3);">✅</div>
                        <div>
                            <h4 style="color: #1b5e20; margin: 0; font-size: 20px; font-weight: 700;">EXISTING WORK PACKAGES</h4>
                            <p style="color: #2e7d32; margin: 0; font-size: 14px;">Time entries for existing work packages</p>
                        </div>
                        <div style="margin-left: auto; background: #2e7d32; color: white; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 14px;">${existing.length}</div>
                    </div>
                    <div style="display: grid; gap: 12px;">
                        ${existing
                            .map(entry => {
                                const timeRange = this.buildTimeRange(entry);

                                return `
                                <div style="background: rgba(255, 255, 255, 0.8); border-radius: 12px; padding: 18px; border-left: 4px solid #388e3c; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);">
                                    <div style="display: inline-block; background: linear-gradient(135deg, #388e3c, #2e7d32); color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">${entry.project}</div>
                                    <div style="font-weight: 600; color: #263238; font-size: 15px; margin-bottom: 8px; line-height: 1.4;">${entry.subject}</div>
                                    <div style="color: #546e7a; font-size: 12px; display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                        <span style="background: #e8f5e8; color: #1b5e20; padding: 2px 8px; border-radius: 8px; font-weight: 600; font-size: 10px;">WP ID: ${entry.work_package_id}</span>
                                    </div>
                                    <div style="color: #37474f; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                        <span style="font-size: 14px;">⏰</span>
                                        <span>${timeRange}</span>
                                        <span style="background: #2e7d32; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600;">${entry.hours || entry.duration_hours}h</span>
                                    </div>
                                </div>`;
                            })
                            .join('')}
                    </div>
                </div>
            `;
        }

        if (newEntries.length > 0) {
            detailsHtml += `
                <div class="analysis-category new" style="background: linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%); border: 2px solid #00796b; border-radius: 16px; padding: 25px; margin-bottom: 25px; box-shadow: 0 6px 20px rgba(0, 121, 107, 0.15);">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                        <div style="background: linear-gradient(135deg, #00796b, #004d40); color: white; padding: 10px; border-radius: 12px; font-size: 24px; box-shadow: 0 4px 12px rgba(0, 121, 107, 0.3);">🆕</div>
                        <div>
                            <h4 style="color: #004d40; margin: 0; font-size: 20px; font-weight: 700;">NEW WORK PACKAGES TO CREATE</h4>
                            <p style="color: #00796b; margin: 0; font-size: 14px;">${newEntries.length} work package${newEntries.length !== 1 ? 's' : ''} will be created</p>
                        </div>
                        <div style="margin-left: auto; background: #004d40; color: white; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 14px;">${newEntries.length}</div>
                    </div>
                    <div style="display: grid; gap: 12px;">
                        ${newEntries
                            .map(entry => {
                                const timeRange = this.buildTimeRange(entry);

                                return `
                                <div style="background: rgba(255, 255, 255, 0.8); border-radius: 12px; padding: 18px; border-left: 4px solid #00796b; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);">
                                    <div style="display: inline-block; background: linear-gradient(135deg, #00796b, #004d40); color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">${entry.project}</div>
                                    <div style="font-weight: 600; color: #263238; font-size: 15px; margin-bottom: 8px; line-height: 1.4;">${entry.subject}</div>
                                    <div style="color: #37474f; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                        <span style="font-size: 14px;">⏰</span>
                                        <span>${timeRange}</span>
                                        <span style="background: #004d40; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600;">${entry.hours || entry.duration_hours}h</span>
                                    </div>
                                </div>`;
                            })
                            .join('')}
                    </div>
                </div>
            `;
        }

        this.analysisDetails.innerHTML = detailsHtml;

        // Show comment section if there are new work packages
        if (newEntries.length > 0) {
            this.setupCommentInputs(newEntries); // Now async
            this.commentSection.classList.remove('hidden');
            this.commentSection.style.display = 'block';
        }

        // Enable process button
        this.processBtn.disabled = false;
    }

    async setupCommentInputs(newEntries) {
        if (newEntries.length > 0) {
            // Show loading state
            this.commentInputs.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <div style="font-size: 18px; margin-bottom: 10px;">⏳</div>
                    <div>Loading statuses...</div>
                </div>
            `;

            try {
                // Fetch statuses first
                let statuses;
                try {
                    statuses = await this.workLogService.fetchStatuses();
                } catch (error) {
                    // Fallback statuses if API call fails
                    statuses = [
                        { id: 1, name: 'New' },
                        { id: 2, name: 'To Do' },
                        { id: 7, name: 'In Progress' },
                        { id: 11, name: 'Developed' },
                        { id: 12, name: 'Closed' },
                        { id: 13, name: 'Rejected' },
                        { id: 14, name: 'On Hold' }
                    ];
                }

                let commentsHtml = '';
                newEntries.forEach((entry, index) => {
                    // Create status dropdown options with "In Progress" as default
                    let statusOptions = '';
                    statuses.forEach(status => {
                        // Set "In Progress" as default selected (case insensitive check)
                        const isDefault = status.name.toLowerCase().includes('progress') || status.name.toLowerCase().includes('in progress');
                        const selected = isDefault ? 'selected' : '';
                        statusOptions += `<option value="${status.id}" ${selected}>${status.name}</option>`;
                    });

                    // Generate AI-powered comment based on subject
                    const generatedComment = this.workLogService.generateSmartComment(entry.subject, entry.activity, entry.duration_hours);

                    commentsHtml += `
                        <div class="form-group" style="border: 1px solid #e0f2f1; border-radius: 12px; padding: 24px; margin-bottom: 20px; background: linear-gradient(135deg, #f8fffe 0%, #e0f2f1 100%); box-shadow: 0 2px 8px rgba(0, 121, 107, 0.08);">
                            <div style="margin-bottom: 20px;">
                                <div style="display: inline-block; background: linear-gradient(135deg, #00796b, #004d40); color: white; padding: 4px 12px; border-radius: 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                                    ${entry.project}
                                </div>
                                <h4 style="margin: 0 0 6px 0; color: #263238; font-size: 16px; line-height: 1.4;">
                                    ${entry.subject}
                                </h4>
                                <div style="color: #546e7a; font-size: 13px; display: inline-flex; align-items: center; gap: 4px; background: rgba(0, 121, 107, 0.05); padding: 2px 8px; border-radius: 12px;">
                                    <span>⏱️</span>
                                    Duration: ${entry.hours || entry.duration_hours}h
                                </div>
                            </div>

                            <div class="comments-status-grid" style="display: grid; grid-template-columns: 200px 1fr; gap: 20px; align-items: start;">
                                <!-- Status comes first -->
                                <div>
                                    <label for="status_${index}" style="display: block; margin-bottom: 8px; font-weight: 600; color: #00695c; font-size: 14px;">
                                        Status
                                    </label>
                                    <select id="status_${index}"
                                            class="comment-input"
                                            style="width: 100%; padding: 12px; border: 2px solid #b2dfdb; border-radius: 8px; background: white; font-family: inherit; font-size: 14px; color: #263238; transition: all 0.2s ease;">
                                        ${statusOptions}
                                    </select>
                                </div>

                                <!-- Comment field second -->
                                <div>
                                    <label for="comment_${index}" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-weight: 600; color: #00695c; font-size: 14px;">
                                        <span>Comment (Auto-generated)</span>
                                        <span class="regenerate-comment" data-index="${index}" style="font-size: 16px; color: #4caf50; cursor: pointer; padding: 4px; border-radius: 50%; transition: all 0.2s ease; user-select: none;" title="Generate new comment">🔄</span>
                                    </label>
                                    <textarea id="comment_${index}"
                                              class="comment-textarea"
                                              style="width: 100%; min-height: 90px; padding: 12px; border: 2px solid #b2dfdb; border-radius: 8px; resize: vertical; font-family: inherit; font-size: 14px; line-height: 1.5; transition: all 0.2s ease;"
                                              placeholder="AI-generated comment (editable)">${generatedComment}</textarea>
                                </div>
                            </div>
                        </div>
                    `;
                });
                this.commentInputs.innerHTML = commentsHtml;

                // Add event listeners after creating the HTML
                this.setupEventListeners();
                this.setupRegenerateCommentListeners(newEntries);
            } catch (error) {
                this.commentInputs.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #dc3545; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
                        <div style="font-size: 18px; margin-bottom: 10px;">❌</div>
                        <div>Error loading statuses. Please try again.</div>
                        <button class="reload-button" style="margin-top: 10px; padding: 5px 15px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Reload Page
                        </button>
                    </div>
                `;
                // Add event listener for the reload button
                this.setupReloadButtonListener();
            }
        }
    }

    setupEventListeners() {
        // Add hover effects for entry cards
        const entryCards = document.querySelectorAll('.entry-card');
        entryCards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = '0 3px 8px rgba(0,0,0,0.08)';
            });
        });

        // Add focus/blur effects for comment inputs
        const commentInputs = document.querySelectorAll('.comment-input, .comment-textarea');
        commentInputs.forEach(input => {
            input.addEventListener('focus', () => {
                input.style.borderColor = '#00796b';
                input.style.boxShadow = '0 0 0 3px rgba(0, 121, 107, 0.1)';
            });
            input.addEventListener('blur', () => {
                input.style.borderColor = '#b2dfdb';
                input.style.boxShadow = 'none';
            });
        });
    }

    setupReloadButtonListener() {
        const reloadButton = document.querySelector('.reload-button');
        if (reloadButton) {
            reloadButton.addEventListener('click', () => {
                location.reload();
            });
        }
    }

    setupRegenerateCommentListeners(newEntries) {
        // Add event listeners for regenerate comment icons
        const regenerateIcons = document.querySelectorAll('.regenerate-comment');
        regenerateIcons.forEach(icon => {
            icon.addEventListener('click', e => {
                const index = parseInt(e.target.dataset.index);
                const entry = newEntries[index];
                const commentTextarea = document.getElementById(`comment_${index}`);

                if (entry && commentTextarea) {
                    // Generate new comment
                    const newComment = this.workLogService.generateSmartComment(entry.subject, entry.activity, entry.duration_hours);
                    commentTextarea.value = newComment;

                    // Visual feedback - animate the icon
                    icon.style.color = '#2196f3';
                    icon.textContent = '✓';
                    icon.style.transform = 'scale(1.2)';

                    setTimeout(() => {
                        icon.style.color = '#4caf50';
                        icon.textContent = '🔄';
                        icon.style.transform = 'scale(1)';
                    }, 800);
                }
            });
        });
    }

    showStatusMessage(message, type = 'info', duration = 3000) {
        // Create or update status message element
        let statusElement = document.getElementById('dynamicStatus');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'dynamicStatus';
            statusElement.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 6px;
                font-weight: 500;
                z-index: 1000;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            document.body.appendChild(statusElement);
        }

        // Set colors based on type
        const colors = {
            success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' },
            error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' },
            info: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' }
        };

        const color = colors[type] || colors.info;
        statusElement.style.backgroundColor = color.bg;
        statusElement.style.borderColor = color.border;
        statusElement.style.color = color.text;
        statusElement.style.border = `1px solid ${color.border}`;
        statusElement.textContent = message;
        statusElement.style.display = 'block';

        // Auto-hide after duration
        setTimeout(() => {
            if (statusElement) {
                statusElement.style.display = 'none';
            }
        }, duration);
    }

    collectCommentData() {
        const commentData = {};
        const analysisData = this.workLogService.getAnalysisData();
        const newEntries = analysisData.new || [];

        // Collect comment and status data for new work packages
        newEntries.forEach((entry, index) => {
            const commentElement = document.getElementById(`comment_${index}`);
            const statusElement = document.getElementById(`status_${index}`);

            if (commentElement) {
                commentData[`comment_${index}`] = commentElement.value;
            }
            if (statusElement && statusElement.value) {
                commentData[`status_${index}`] = statusElement.value;
            }
        });

        return commentData;
    }

    async processEntries() {
        // Check for validation errors first
        const validationIssues = this.workLogService.calculateAllTimes();
        const hasBlockingErrors = validationIssues.some(issue => issue.type === 'missing_work_package_id');

        if (hasBlockingErrors) {
            this.showToaster('Cannot process entries: SCRUM entries require work_package_id. Please fix the errors first.', 'error', 0, true);
            if (this.processBtn) this.processBtn.disabled = false;
            return;
        }

        // Show processing loader in current step
        // this.showProcessingLoader();

        // Disable the process button to prevent multiple clicks
        if (this.processBtn) this.processBtn.disabled = true;

        // Give a short delay to show the loader before starting actual processing
        setTimeout(async () => {
            // Skip preview and go directly to processing
            await this.startActualProcessing();
        }, 500);
    }

    showProcessingLoader() {
        // Show a processing loader in the analysis summary area
        this.analysisSummary.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #e8f5e8 0%, #d4edda 100%); border: 2px solid #28a745; border-radius: 16px; margin-bottom: 25px; box-shadow: 0 8px 24px rgba(40, 167, 69, 0.15);">
                <div style="display: inline-block; width: 60px; height: 60px; border: 5px solid #c3e6cb; border-top: 5px solid #28a745; border-radius: 50%; animation: spin 1.2s linear infinite; margin-bottom: 25px;"></div>
                <div style="font-size: 20px; font-weight: 700; color: #155724; margin-bottom: 10px;">🚀 Processing All Entries...</div>
                <div style="font-size: 14px; color: #495057; margin-bottom: 20px;">Initializing OpenProject API and preparing to process your work log entries</div>
                <div style="background: rgba(255, 255, 255, 0.8); padding: 15px; border-radius: 10px; border-left: 4px solid #28a745;">
                    <div style="font-size: 13px; color: #155724; font-weight: 600;">✨ Please wait while we:</div>
                    <div style="font-size: 12px; color: #6c757d; margin-top: 8px; text-align: left;">
                        • Connect to OpenProject API<br>
                        • Validate work log entries<br>
                        • Create work packages and time entries<br>
                        • Generate final report
                    </div>
                </div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        // Clear the analysis details
        this.analysisDetails.innerHTML = '';

        // Hide comment section during processing
        if (this.commentSection) {
            this.commentSection.classList.add('hidden');
            this.commentSection.style.display = 'none';
        }
    }

    async startActualProcessing() {
        this.goToStep(4);

        if (this.processingSection) this.processingSection.style.display = 'block';
        if (this.successSection) {
            this.successSection.classList.add('hidden');
            this.successSection.style.display = 'none';
        }

        if (this.progressText) this.progressText.textContent = 'Initializing processing...';

        try {
            // Collect comment data and status selections before processing
            const commentData = this.collectCommentData();

            const result = await this.workLogService.processAllEntries(commentData, progress => {
                if (this.progressText) {
                    this.progressText.textContent = progress.message;
                }
                if (this.progressFill) {
                    const progressPercent = (progress.current / progress.total) * 100;
                    this.progressFill.style.width = `${progressPercent}%`;
                }
                if (this.progressDetails) {
                    this.progressDetails.textContent = `${progress.current}/${progress.total}`;
                }

                this.logProgress(progress.logMessage || progress.message);
            });

            this.showFinalResults(result.createdCount, result.updatedCount, result.errorCount, result.results);
        } catch (error) {
            this.logProgress(`❌ Fatal error: ${error.message}`);
            this.showToaster(`Processing failed: ${error.message}`, 'error', 0, true);
        }
    }

    logProgress(message) {
        if (!this.processingLog) return;

        const logEntry = document.createElement('div');
        logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        this.processingLog.appendChild(logEntry);
        this.processingLog.scrollTop = this.processingLog.scrollHeight;
    }

    showFinalResults(createdCount, updatedCount, errorCount, results) {
        if (this.progressText) this.progressText.textContent = 'Processing complete!';

        // Hide processing section and show success section
        // if (this.processingSection) this.processingSection.style.display = 'none';
        if (this.successSection) {
            this.successSection.classList.remove('hidden');
            this.successSection.style.display = 'block';
        }

        // Update success page stats
        this.updateSuccessStats(createdCount, updatedCount, errorCount, createdCount + updatedCount + errorCount);
    }

    updateSuccessStats(createdCount, updatedCount, errorCount, totalEntries) {
        if (!this.successStats) return;

        const totalTime = this.workLogEntries.reduce((sum, entry) => sum + (entry.duration_hours || entry.hours || 0), 0);

        this.successStats.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${totalEntries}</div>
                <div class="stat-label">Total Entries Processed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${createdCount}</div>
                <div class="stat-label">Successfully Created</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${updatedCount}</div>
                <div class="stat-label">Successfully Updated</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalTime.toFixed(1)}h</div>
                <div class="stat-label">Total Time Logged</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${errorCount}</div>
                <div class="stat-label">Failed Entries</div>
            </div>
        `;
    }

    resetAll() {
        this.resetToStep(2);
    }

    // Modal methods (if needed for comments)
    handleCommentModalOk() {
        // Implementation for modal OK
        this.commentModal.style.display = 'none';
    }

    handleCommentModalSkip() {
        // Implementation for modal Skip
        this.commentModal.style.display = 'none';
    }

    // Projects Modal methods
    async showProjectsModal() {
        if (!this.projectsModal) {
            this.showToaster('Projects modal not available', 'error');
            return;
        }

        this.projectsModal.classList.remove('hidden');
        this.projectsModal.style.display = 'block';

        if (this.projectsLoading) {
            this.projectsLoading.classList.remove('hidden');
        }
        if (this.projectsTable) {
            this.projectsTable.classList.add('hidden');
        }
        if (this.projectsError) {
            this.projectsError.classList.add('hidden');
        }

        try {
            const projects = await this.fetchProjects();
            this.renderProjectsTable(projects);

            if (this.projectsLoading) {
                this.projectsLoading.classList.add('hidden');
            }
            if (this.projectsTable) {
                this.projectsTable.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error fetching projects:', error);

            if (this.projectsLoading) {
                this.projectsLoading.classList.add('hidden');
            }
            this.showProjectsError(error.message);
        }
    }

    hideProjectsModal() {
        this.projectsModal.classList.add('hidden');
        this.projectsModal.style.display = 'none';
    }

    showProjectsError(errorMessage) {
        this.projectsError.classList.remove('hidden');

        // Update the error message
        const errorMessageElement = this.projectsError.querySelector('.error-message');
        if (errorMessageElement) {
            errorMessageElement.textContent = errorMessage;
        }

        // If it's an access token error, provide a helpful action
        if (errorMessage.includes('Access Token')) {
            const errorContainer = this.projectsError;
            errorContainer.innerHTML = `
                <span class="error-icon">⚠️</span>
                <div style="text-align: center;">
                    <div class="error-message">${errorMessage}</div>
                    <button type="button" class="btn-primary" style="margin-top: 15px; padding: 8px 16px; font-size: 12px;" onclick="this.closest('.modal').style.display='none'; document.querySelector('[data-step=\"1\"]').click();">
                        Configure Access Token
                    </button>
                </div>
            `;
        }
    }

    async fetchProjects() {
        // Ensure config is loaded
        if (!this.config) {
            this.config = await loadConfig();
        }

        if (!this.config || !this.config.CONFIG || !this.config.CONFIG.access_token) {
            throw new Error('Please configure your Access Token first');
        }
        try {
            const logger = new OpenProjectTimeLogger();
            await logger.initialize();
            const projects = await logger.getProjects();
            if (!projects.length) {
                console.warn('No projects returned from API');
            }
            return projects;
        } catch (err) {
            // Surface more actionable error detail
            throw new Error(`Failed to fetch projects: ${err.message}`);
        }
    }

    renderProjectsTable(projects) {
        this.projectsTableBody.innerHTML = '';

        if (!projects || projects.length === 0) {
            this.projectsTableBody.innerHTML = `
                <tr>
                    <td colspan="2" style="text-align: center; color: #6b7280; padding: 60px 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">📂</div>
                        <div style="font-size: 16px; font-weight: 500;">No projects found</div>
                        <div style="font-size: 14px; margin-top: 8px; opacity: 0.7;">Check your access token or contact your administrator</div>
                    </td>
                </tr>
            `;
            return;
        }

        projects.forEach((project, index) => {
            const row = document.createElement('tr');
            row.style.transition = 'all 0.2s ease';

            // Add slight stagger animation for visual appeal
            row.style.animationDelay = `${index * 50}ms`;
            row.style.animation = 'fadeInUp 0.3s ease forwards';

            row.innerHTML = `
                <td style="font-weight: 600; color: #2563eb; width: 80px;">${project.id}</td>
                <td style="font-weight: 500; color: #374151;">
                    <div style="font-size: 15px; line-height: 1.4;">${project.name || 'Unnamed Project'}</div>
                </td>
            `;
            this.projectsTableBody.appendChild(row);
        });

        // Check if scrolling is needed and add scroll indicator
        setTimeout(() => {
            const container = document.getElementById('projectsTableContainer');
            const tbody = this.projectsTableBody;
            if (container && tbody && tbody.scrollHeight > tbody.clientHeight) {
                container.classList.add('has-scroll');
            } else if (container) {
                container.classList.remove('has-scroll');
            }
        }, 100);

        // Add CSS for the animation if it doesn't exist
        if (!document.getElementById('projectTableAnimations')) {
            const style = document.createElement('style');
            style.id = 'projectTableAnimations';
            style.textContent = `
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Close current tab method
    closeCurrentTab() {
        // Show confirmation before closing
        const confirmed = confirm('Are you sure you want to close this tab? Your work has been completed.');

        if (!confirmed) {
            return;
        }

        try {
            // Check if running as Chrome extension with tabs API
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                    if (chrome.runtime.lastError) {
                        console.log('Chrome tabs API error:', chrome.runtime.lastError);
                        // Fallback to window.close()
                        window.close();
                    } else if (tabs && tabs.length > 0) {
                        chrome.tabs.remove(tabs[0].id, () => {
                            if (chrome.runtime.lastError) {
                                console.log('Error closing tab:', chrome.runtime.lastError);
                                window.close();
                            }
                        });
                    } else {
                        // No active tab found, try window.close()
                        window.close();
                    }
                });
            } else {
                // Not running as Chrome extension or tabs API not available
                window.close();
            }
        } catch (error) {
            console.log('Error in closeCurrentTab:', error);
            // Final fallback
            window.close();
        }
    }
}

// Initialize integrated options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.openProjectOptions = new IntegratedOptionsController();
});
