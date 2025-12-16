chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrape_product") {
        try {
            const data = scrapeProductDetails();
            sendResponse({ success: true, data });
        } catch (error) {
            console.error("Scraping error:", error);
            sendResponse({ success: false, error: error.message });
        }
    }
});

function scrapeProductDetails() {
    // 1. Title
    const title = document.querySelector('h1.CEn5rD')?.innerText
        || document.querySelector('h1.yhB1nd')?.innerText
        || document.title;

    // 2. Pricing
    const currentPrice = document.querySelector('div.hZ3P6w')?.innerText || document.querySelector('div._30jeq3')?.innerText || "";
    const originalPrice = document.querySelector('div.kRYCnD')?.innerText || document.querySelector('div._3I9_wc')?.innerText || "";
    const discount = document.querySelector('div.HQe8jr')?.innerText || document.querySelector('div._3Ay6Sb')?.innerText || "";

    // 3. Ratings & Reviews
    const rating = document.querySelector('div.MKiFS6')?.innerText || document.querySelector('div._3LWZlK')?.innerText || "";
    const reviewCountText = document.querySelector('span.PvbNMB')?.innerText || document.querySelector('span._2_R_DZ')?.innerText || "";

    // 4. Seller
    const seller = document.querySelector('#sellerName span span')?.innerText || document.querySelector('div._1RLviY')?.innerText || "";

    // 5. Description
    let description = document.querySelector('div.cdXR5N')?.innerText
        || document.querySelector('div._1mXcCf')?.innerText
        || document.querySelector('div.R0cy0y')?.innerText
        || document.querySelector('div.tUTk_J div:nth-child(2)')?.innerText
        || "";

    // Fallback: Find "Description" label and get content relative to it
    if (!description) {
        const headers = Array.from(document.querySelectorAll('div'));
        const descHeader = headers.find(el => el.innerText.trim() === 'Description' && el.className.length > 5); // simple check to avoid generic divs
        if (descHeader && descHeader.nextElementSibling) {
            description = descHeader.nextElementSibling.innerText;
        }
    }

    // 6. Highlights
    let highlights = [];

    // Strategy 1: Known classes
    const highlightSelectors = [
        'div.key-features-content ul li', // Example, unlikely to exist but legacy
        'div._2cM9lP ul li',
        'div.x-v-m ul li',
        'li._21lJbe',
        'div._2418kt ul li'
    ];

    document.querySelectorAll(highlightSelectors.join(', ')).forEach(li => {
        const text = li.innerText.trim();
        if (text) highlights.push(text);
    });

    // Strategy 2: Text-based approximation (If Strategy 1 failed or returned empty)
    if (highlights.length === 0) {
        // Find all elements looking like a header with "Highlights"
        const potentialHeaders = Array.from(document.querySelectorAll('*')).filter(el =>
            el.children.length === 0 &&
            el.innerText.trim() === 'Highlights' &&
            el.tagName !== 'SCRIPT' &&
            el.tagName !== 'STYLE'
        );

        for (const header of potentialHeaders) {
            // Go up a few levels to find a container that also holds a UL
            let parent = header.parentElement;
            let found = false;
            for (let i = 0; i < 5 && parent; i++) {
                const list = parent.querySelector('ul');
                if (list) {
                    list.querySelectorAll('li').forEach(li => highlights.push(li.innerText.trim()));
                    if (highlights.length > 0) {
                        found = true;
                        break;
                    }
                }
                parent = parent.parentElement;
            }
            if (found) break;
        }
    }

    // Deduplicate
    highlights = [...new Set(highlights)];

    // 7. Specifications (Table)
    const specs = {};

    // Add Price info
    if (currentPrice) specs['Price'] = currentPrice;
    if (originalPrice) specs['MRP'] = originalPrice;
    if (discount) specs['Discount'] = discount;
    if (description) specs['Description'] = description;

    // Add generic info
    if (seller) specs['Seller'] = seller;
    if (rating) specs['Rating'] = rating;
    if (reviewCountText) specs['Reviews'] = reviewCountText;

    // Parse actual spec tables (overwrites highlight keys if duplicate, usually specs are more standard)
    const specRows = document.querySelectorAll('tr.v1Jif8, tr._1s_Smc');
    specRows.forEach(row => {
        const key = row.querySelector('td:first-child')?.innerText;
        const value = row.querySelector('td:nth-child(2)')?.innerText;
        if (key && value) {
            // We overwrite highlights if table has same key (usually table is more reliable)
            specs[key] = value;
        }
    });

    // 8. Images
    const imageUrls = new Set();

    // Thumbnails (High priority)
    document.querySelectorAll('ul.f67RGv img, ul._3GnUWp img, ul.q6DClP img').forEach(img => {
        let src = img.src || img.getAttribute('src');
        if (src) {
            // Convert low-res thumbnail URL to high-res
            const highRes = src.replace(/\/image\/\d+\/\d+\//, '/image/1280/1280/');
            imageUrls.add(highRes);
        }
    });

    // Main Image (Fallback or addition)
    document.querySelectorAll('img.UCc1lI, img._396cs4, img._2r_T1I').forEach(img => {
        let src = img.src;
        if (src) imageUrls.add(src.replace(/\/image\/\d+\/\d+\//, '/image/1280/1280/'));
    });

    return {
        title,
        price: currentPrice,
        description,
        specifications: specs,
        highlights,
        images: Array.from(imageUrls),
        url: window.location.href
    };
}
