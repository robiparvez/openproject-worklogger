// Background service worker for OpenProject Time Logger
chrome.runtime.onInstalled.addListener(details => {
    console.log('OpenProject Time Logger extension installed/updated', details);

    // Generate and set dynamic icons
    generateAndSetIcons();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('OpenProject Time Logger extension started');
    generateAndSetIcons();
});

// Handle extension icon click - open options page
chrome.action.onClicked.addListener(tab => {
    chrome.runtime.openOptionsPage();
});

async function generateAndSetIcons() {
    const sizes = [16, 32, 48, 128];
    const imageDataForSizes = {};

    for (const size of sizes) {
        imageDataForSizes[size] = createIcon(size);
    }

    try {
        await chrome.action.setIcon({ imageData: imageDataForSizes });
        console.log('Dynamic icons set successfully');
    } catch (error) {
        console.warn('Failed to set dynamic icons:', error);
    }
}

function createIcon(size) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background - OpenProject blue
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, 0, size, size);

    // Add rounded corners effect for larger sizes
    if (size >= 32) {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.roundRect(0, 0, size, size, size * 0.125);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    // Text - "OP" for OpenProject
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(size * 0.45)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OP', size / 2, size / 2 + size * 0.02);

    // Add small time/clock indicator for larger sizes
    if (size >= 48) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = size * 0.02;
        ctx.beginPath();
        ctx.arc(size * 0.8, size * 0.2, size * 0.08, 0, 2 * Math.PI);
        ctx.stroke();

        // Clock hands
        ctx.lineWidth = size * 0.015;
        ctx.beginPath();
        ctx.moveTo(size * 0.8, size * 0.2);
        ctx.lineTo(size * 0.8, size * 0.15);
        ctx.moveTo(size * 0.8, size * 0.2);
        ctx.lineTo(size * 0.84, size * 0.18);
        ctx.stroke();
    }

    return ctx.getImageData(0, 0, size, size);
}

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);

    switch (message.type) {
        case 'GET_CONFIG':
            // Could be used for config synchronization if needed
            break;
        case 'LOG_ERROR':
            console.error('Extension error:', message.error);
            break;
        default:
            console.log('Unknown message type:', message.type);
    }

    sendResponse({ success: true });
});

// Initialize on script load (in case the service worker was already running)
generateAndSetIcons();
