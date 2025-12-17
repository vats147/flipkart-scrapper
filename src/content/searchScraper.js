// Search Scraper for Flipkart
// Wrapped in IIFE to avoid variable collisions with other content scripts
(function () {
    let isScraping = false;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "start_search_scraping") {
            isScraping = true;
            scrapeAllPages();
            sendResponse({ status: "started" });
        } else if (request.action === "stop_search_scraping") {
            isScraping = false;
            sendResponse({ status: "stopped" });
        }
    });

    async function scrapeAllPages() {
        let totalLinks = [];

        while (isScraping) {
            const links = scrapeCurrentPage();
            if (links.length === 0) {
                console.log("[Search Scraper] No links found, stopping.");
                break;
            }

            totalLinks = [...totalLinks, ...links];

            // Save current progress
            chrome.storage.local.set({ scannedProducts: totalLinks });
            chrome.runtime.sendMessage({ action: "update_count", count: totalLinks.length });

            const nextBtn = findNextButton();
            if (nextBtn) {
                nextBtn.click();
                await new Promise(r => setTimeout(r, 3000)); // Wait 3 seconds
            } else {
                console.log("[Search Scraper] No next button, finishing.");
                break;
            }
        }

        chrome.runtime.sendMessage({ action: "scraping_finished", total: totalLinks.length });
        isScraping = false;
    }

    function scrapeCurrentPage() {
        // Utilizing the class valid in the snippet provided
        const anchors = document.querySelectorAll('a.GnxRXv');
        const products = [];

        anchors.forEach(a => {
            products.push({
                url: a.href,
                title: a.querySelector('img')?.alt || a.title || "Unknown Product",
                id: a.href.split('pid=')[1]?.split('&')[0] || "unknown"
            });
        });

        // Fallback if class changes but we are on search page
        if (products.length === 0) {
            // Try finding any link that looks like a product
            const allLinks = document.querySelectorAll('a[href*="/p/"]');
            allLinks.forEach(a => {
                if (!products.find(p => p.url === a.href)) {
                    products.push({
                        url: a.href,
                        title: a.innerText || "Unknown Product",
                        id: a.href.split('pid=')[1]?.split('&')[0] || "unknown"
                    });
                }
            });
        }

        return products;
    }

    function findNextButton() {
        // Look for a link with text "Next"
        const links = document.querySelectorAll('a, span');
        for (let link of links) {
            if (link.innerText?.includes("Next")) {
                return link;
            }
        }
        return null;
    }

    console.log('[Search Scraper] Content script loaded');
})();
