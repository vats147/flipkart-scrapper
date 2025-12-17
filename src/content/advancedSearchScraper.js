// Advanced Search Scraper for Flipkart
// Wrapped in IIFE to avoid variable collisions with other content scripts
(function () {
    let isAdvancedScraping = false;
    let pagesCrawled = 0;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "start_advanced_scraping") {
            isAdvancedScraping = true;
            pagesCrawled = 0;
            scrapeAdvancedPage();
            sendResponse({ status: "started" });
        } else if (request.action === "stop_advanced_scraping") {
            isAdvancedScraping = false;
            sendResponse({ status: "stopped" });
        }
        return true;
    });

    async function scrapeAdvancedPage() {
        if (!isAdvancedScraping) return;

        // For now, scrape ONE PAGE ONLY for testing
        pagesCrawled++;
        const products = scrapeCurrentPageAdvanced();

        console.log(`[Advanced Scraper] Scraped ${products.length} products from page ${pagesCrawled}`);

        // Send products to UI
        chrome.runtime.sendMessage({
            action: "advanced_update",
            products: products,
            pagesCrawled: pagesCrawled
        });

        // For now, stop after one page (as requested for testing)
        // TODO: Later add logic to click "Next" button and continue
        chrome.runtime.sendMessage({
            action: "advanced_scraping_finished",
            pagesCrawled: pagesCrawled
        });
        isAdvancedScraping = false;
    }

    function scrapeCurrentPageAdvanced() {
        const products = [];

        // Find all product containers with data-id attribute
        const productContainers = document.querySelectorAll('div[data-id]');
        console.log(`[Advanced Scraper] Found ${productContainers.length} product containers`);

        productContainers.forEach(container => {
            try {
                // Extract data-id
                const id = container.getAttribute('data-id');
                if (!id) return;

                // Extract name from the title attribute of the link
                // Selector: a.pIpigb[title]
                const titleLink = container.querySelector('a.pIpigb[title]');
                const name = titleLink?.getAttribute('title')?.trim() || 'Unknown Product';

                // Extract image
                // Selector: img.UCc1lI
                const imgElement = container.querySelector('img.UCc1lI');
                const image = imgElement?.getAttribute('src') || '';

                // Extract price (listing price)
                // Selector: div.hZ3P6w
                const priceElement = container.querySelector('div.hZ3P6w');
                const price = priceElement?.innerText?.trim() || 'N/A';

                // Extract URL
                const urlLink = container.querySelector('a.GnxRXv[href]');
                const rawUrl = urlLink?.getAttribute('href') || '';
                const url = rawUrl ? (rawUrl.startsWith('http') ? rawUrl : `https://www.flipkart.com${rawUrl}`) : '';

                // Only add if we have valid data
                if (id && name !== 'Unknown Product') {
                    products.push({
                        id: id,
                        name: name,
                        image: image,
                        price: price,
                        url: url
                    });
                }
            } catch (error) {
                console.error('[Advanced Scraper] Error scraping product:', error);
            }
        });

        return products;
    }

    // Function to find and click Next button (for future use)
    function findNextButton() {
        try {
            // Selector: a.jgg0SZ containing "Next"
            const nextLinks = document.querySelectorAll('a.jgg0SZ');
            for (let link of nextLinks) {
                if (link.innerText?.trim().toLowerCase() === 'next') {
                    return link;
                }
            }
            return null;
        } catch (error) {
            console.error('[Advanced Scraper] Error finding next button:', error);
            return null;
        }
    }

    console.log('[Advanced Scraper] Content script loaded');
})();
