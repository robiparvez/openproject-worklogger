// Configuration storage matching config.py structure exactly
export const CONFIG = {
    base_url: 'https://pm.reddotdigitalltd.com',
    access_token: '',
    accountable_user_id: '',
    assignee_user_id: ''
};

export const PROJECT_MAPPINGS = {
    'BD-TICKET': 151,
    'COMMON-SLASH-LEARNING-AND-UPSKILLING': 141,
    'COMMON-SLASH-RFS-AND-DEMO-SUPPORT': 140,
    'COMMON-SLASH-RESEARCH-AND-DEVELOPMENT-R-AND-D': 138,
    'COMMON-SLASH-GENERAL-PURPOSE-AND-MEETINGS-HR-ACTIVITY': 132,
    ELEARNING: 130,
    'INFO360-1': 129,
    'GENERAL-PROJECT-TASKS-MEETING-AND-SCRUM': 115,
    'ROBI-HR4U': 68,
    JBL: 67,
    CBL: 66,
    SEBL: 65,
    IDCOL: 64,
    HRIS: 63,
    'NEXT-GENERATION-PROVISING-SYSTEM-NGPS': 41,
    'IOT-AND-FWA': 21
};

// Activity mappings are fixed and match log.py
export const ACTIVITY_MAPPINGS = {
    Development: 3,
    Support: 5,
    Meeting: 14,
    Testing: 4,
    Specification: 2,
    Other: 6,
    'Change Request': 15,
    Management: 16
};

export const DEFAULT_TIMEZONE = 'Asia/Dhaka';

export async function loadConfig() {
    return new Promise(resolve => {
        chrome.storage.local.get(['config'], result => {
            const savedConfig = result.config || {};

            // Merge saved config with defaults, giving priority to saved values
            const mergedConfig = {
                CONFIG: {
                    ...CONFIG,
                    ...(savedConfig.CONFIG || {})
                },
                PROJECT_MAPPINGS: {
                    ...PROJECT_MAPPINGS,
                    ...(savedConfig.PROJECT_MAPPINGS || {})
                },
                ACTIVITY_MAPPINGS: {
                    ...ACTIVITY_MAPPINGS,
                    ...(savedConfig.ACTIVITY_MAPPINGS || {})
                },
                DEFAULT_TIMEZONE: savedConfig.DEFAULT_TIMEZONE || DEFAULT_TIMEZONE
            };

            resolve(mergedConfig);
        });
    });
}

export async function saveConfig(config) {
    return new Promise(resolve => {
        chrome.storage.local.set({ config: config }, () => resolve(true));
    });
}

export async function updateProjectMappings(newMappings) {
    // Update the in-memory PROJECT_MAPPINGS
    Object.keys(PROJECT_MAPPINGS).forEach(key => delete PROJECT_MAPPINGS[key]);
    Object.assign(PROJECT_MAPPINGS, newMappings);

    // Also update in storage
    const config = await new Promise(resolve => {
        chrome.storage.local.get(['config'], result => {
            resolve(result.config || {});
        });
    });

    config.PROJECT_MAPPINGS = newMappings;

    return new Promise(resolve => {
        chrome.storage.local.set({ config: config }, () => resolve(true));
    });
}
