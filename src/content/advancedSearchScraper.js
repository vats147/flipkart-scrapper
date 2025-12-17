// Advanced Search Scraper for Flipkart
// Wrapped in IIFE to avoid variable collisions with other content scripts
(function () {
    let isAdvancedScraping = false;
    let pagesCrawled = 0;
    let maxPagesToScrape = 1; // Default to 1 page

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "start_advanced_scraping") {
            isAdvancedScraping = true;
            pagesCrawled = 0;
            maxPagesToScrape = request.maxPages || 1; // Get maxPages from request
            console.log(`[Advanced Scraper] Starting with maxPages: ${maxPagesToScrape}`);
            scrapeAllPagesAdvanced();
            sendResponse({ status: "started" });
        } else if (request.action === "stop_advanced_scraping") {
            isAdvancedScraping = false;
            sendResponse({ status: "stopped" });
        }
        return true;
    });

    async function scrapeAllPagesAdvanced() {
        if (!isAdvancedScraping) return;

        let allProducts = [];

        while (isAdvancedScraping) {
            pagesCrawled++;
            console.log(`[Advanced Scraper] Scraping page ${pagesCrawled} of ${maxPagesToScrape}...`);

            // Scrape current page
            const products = scrapeCurrentPageAdvanced();
            console.log(`[Advanced Scraper] Found ${products.length} products on page ${pagesCrawled}`);

            // If no products found, stop
            if (products.length === 0) {
                console.log('[Advanced Scraper] No products found on this page. Stopping.');
                break;
            }

            // Add to all products
            allProducts = [...allProducts, ...products];

            // Send update to popup
            chrome.runtime.sendMessage({
                action: "advanced_update",
                products: products,
                pagesCrawled: pagesCrawled,
                totalProducts: allProducts.length
            });

            // Check if we've reached maxPages limit
            if (pagesCrawled >= maxPagesToScrape) {
                console.log(`[Advanced Scraper] Reached maxPages limit (${maxPagesToScrape}). Stopping.`);
                break;
            }

            // Look for Next button
            const nextBtn = findNextButton();
            if (nextBtn && isAdvancedScraping) {
                console.log('[Advanced Scraper] Clicking Next button...');
                nextBtn.click();

                // Wait for page to load (2 seconds)
                await new Promise(r => setTimeout(r, 2000));

                // Wait for the container to appear (additional check)
                await waitForContainer();
            } else {
                console.log('[Advanced Scraper] No Next button found. Finished scraping.');
                break;
            }
        }

        // Send finished message
        chrome.runtime.sendMessage({
            action: "advanced_scraping_finished",
            pagesCrawled: pagesCrawled,
            totalProducts: allProducts.length
        });
        isAdvancedScraping = false;
        console.log(`[Advanced Scraper] Completed! Total: ${allProducts.length} products from ${pagesCrawled} pages.`);
    }

    function scrapeCurrentPageAdvanced() {
        const products = [];

        // Use the exact selector that works: .lvJbLV.col-12-12
        const containers = document.querySelectorAll('.lvJbLV.col-12-12');
        console.log(`[Advanced Scraper] Found ${containers.length} containers`);

        containers.forEach((container) => {
            // Find all items with data-id
            const items = container.querySelectorAll('[data-id]');

            items.forEach((item) => {
                try {
                    // Get data-id
                    const id = item.getAttribute('data-id') || '';

                    // Get title from .pIpigb
                    const titleEl = item.querySelector('.pIpigb');
                    const title = titleEl
                        ? (titleEl.getAttribute('title') || titleEl.textContent?.trim())
                        : 'N/A';

                    // Get image from img.UCc1lI
                    const imgEl = item.querySelector('img.UCc1lI');
                    const image = imgEl ? imgEl.getAttribute('src') : '';

                    // Get price from .hZ3P6w
                    const priceEl = item.querySelector('.hZ3P6w');
                    const price = priceEl ? priceEl.textContent?.trim() : 'N/A';

                    // Get MRP from .kRYCnD
                    const mrpEl = item.querySelector('.kRYCnD');
                    const mrp = mrpEl ? mrpEl.textContent?.trim() : '';

                    // Get URL from first link
                    const linkEl = item.querySelector('a[href*="/p/"]');
                    const rawUrl = linkEl?.getAttribute('href') || '';
                    const url = rawUrl ? (rawUrl.startsWith('http') ? rawUrl : `https://www.flipkart.com${rawUrl}`) : '';

                    // Only add if we have valid title and price
                    if (title !== 'N/A' && price !== 'N/A' && id) {
                        products.push({
                            id: id,
                            name: title,
                            image: image,
                            price: price,
                            originalMrp: mrp,
                            url: url
                        });
                    }
                } catch (error) {
                    console.error('[Advanced Scraper] Error scraping item:', error);
                }
            });
        });

        return products;
    }

    function findNextButton() {
        try {
            // Look for the Next button with class jgg0SZ
            const nextLink = document.querySelector('a.jgg0SZ');
            if (nextLink) {
                // Verify it contains "Next" text
                const text = nextLink.textContent?.trim().toLowerCase();
                if (text === 'next' || nextLink.querySelector('span')?.textContent?.trim().toLowerCase() === 'next') {
                    return nextLink;
                }
            }

            // Fallback: Look for any link/span with "Next" text
            const allLinks = document.querySelectorAll('nav.iu0OAI a');
            for (let link of allLinks) {
                if (link.textContent?.trim().toLowerCase() === 'next') {
                    return link;
                }
            }

            return null;
        } catch (error) {
            console.error('[Advanced Scraper] Error finding next button:', error);
            return null;
        }
    }

    async function waitForContainer() {
        // Wait up to 5 seconds for the container to appear
        for (let i = 0; i < 10; i++) {
            const container = document.querySelector('.lvJbLV.col-12-12');
            if (container) {
                return true;
            }
            await new Promise(r => setTimeout(r, 500));
        }
        console.log('[Advanced Scraper] Container not found after waiting');
        return false;
    }

    console.log('[Advanced Scraper] Content script loaded');
})();
