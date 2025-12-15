chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "download_image") {
        chrome.downloads.download({
            url: request.url,
            filename: `flipkart-images/${request.filename}`
        }, (downloadId) => {
            sendResponse({ downloadId });
        });
        return true; // async response
    }
});

// Allow side panel to open on icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
