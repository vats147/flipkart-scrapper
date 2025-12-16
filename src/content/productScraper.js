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
    // Try common classes
    const highlightSelectors = [
        'div.jwbTM1 ul li',
        'div._2cM9lP ul li',
        'li._21lJbe',
        'div._2418kt ul li'
    ];

    const highlightElements = document.querySelectorAll(highlightSelectors.join(', '));
    if (highlightElements.length > 0) {
        highlightElements.forEach(li => highlights.push(li.innerText));
    } else {
        // Fallback: search by text "Highlights"
        // Flipkart often puts "Highlights" in a div, and the list in a sibling or parent container
        const allDivs = Array.from(document.querySelectorAll('div'));
        const header = allDivs.find(d => d.innerText === 'Highlights' && d.classList.length > 0);

        if (header) {
            // Look for a UL in the parent's next sibling or parent's parent
            // Case 1: Header and list are in same row container
            const row = header.closest('div.row') || header.closest('div._3k-BhJ'); // _3k-BhJ is a common row class
            if (row) {
                row.querySelectorAll('ul li').forEach(li => highlights.push(li.innerText));
            }
        }
    }

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
