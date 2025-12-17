// Seller Portal Automation for Flipkart
// This script runs on seller.flipkart.com to automate product listing
(function () {
    let isLatching = false;
    let currentIndex = 0;
    let products = [];
    let settings = {};
    let results = [];

    console.log('[Seller Automation] Content script loaded on seller.flipkart.com');

    // Check if latching is active on page load
    chrome.storage.local.get(['latchingActive', 'latchingProducts', 'latchingSettings', 'latchingIndex'], async (result) => {
        if (result.latchingActive && result.latchingProducts && result.latchingProducts.length > 0) {
            console.log('[Seller Automation] Latching is active, starting automation...');
            isLatching = true;
            products = result.latchingProducts;
            settings = result.latchingSettings || {};
            currentIndex = result.latchingIndex || 0;
            results = [];

            // Wait for page to fully load
            await waitForElement('[data-testid="searchBox"]', 10000);

            // Start processing products
            await processNextProduct();
        }
    });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'stop_latching') {
            isLatching = false;
            console.log('[Seller Automation] Latching stopped by user');
            sendResponse({ status: 'stopped' });
        }
        return true;
    });

    async function processNextProduct() {
        if (!isLatching || currentIndex >= products.length) {
            console.log('[Seller Automation] Latching complete!');
            chrome.storage.local.set({
                latchingActive: false,
                latchingResults: results
            });
            return;
        }

        const product = products[currentIndex];
        console.log(`[Seller Automation] Processing product ${currentIndex + 1}/${products.length}: ${product.name}`);

        // Update progress in storage
        chrome.storage.local.set({ latchingIndex: currentIndex });

        try {
            // Step 1: Enter product URL in search box
            const searchInput = document.querySelector('[data-testid="searchBox"] input[data-testid="test-input"]');
            if (!searchInput) {
                console.error('[Seller Automation] Search input not found');
                results.push({ product: product.name, status: 'ERROR', message: 'Search input not found' });
                currentIndex++;
                await processNextProduct();
                return;
            }

            // Clear and enter URL
            searchInput.focus();
            searchInput.value = '';
            searchInput.value = product.url;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));

            await delay(500);

            // Step 2: Click search icon
            const searchIcon = document.querySelector('[data-testid="searchIcon"]');
            if (searchIcon) {
                searchIcon.click();
                console.log('[Seller Automation] Clicked search button');
            } else {
                console.error('[Seller Automation] Search icon not found');
                results.push({ product: product.name, status: 'ERROR', message: 'Search icon not found' });
                currentIndex++;
                await processNextProduct();
                return;
            }

            // Step 3: Wait for results
            await delay(3000);

            // Step 4: Check product status - ALREADY SELLING, APPLY FOR APPROVAL, or START SELLING
            const alreadySelling = document.querySelector('.primaryActionBar a.disabled.startSelling, .primaryActionBar a.alreadySelling');
            const applyForApproval = document.querySelector('.primaryActionBar a.applyForApprovalLink:not(.startSelling), .primaryActionBar a[href*="apply"]');
            const startSelling = document.querySelector('.primaryActionBar a.startSelling.listingsModalLink:not(.disabled)');

            // Check for ALREADY SELLING first
            if (alreadySelling && alreadySelling.textContent.includes('ALREADY SELLING')) {
                console.log('[Seller Automation] Product already selling - skipping');
                results.push({ product: product.name, status: 'ALREADY_SELLING', message: 'Already listed, skipped' });

                // Move to next product
                currentIndex++;
                await delay(1000);
                await goBackToSearch();
                await processNextProduct();
                return;
            }

            if (applyForApproval && applyForApproval.textContent.includes('APPLY FOR APPROVAL')) {
                console.log('[Seller Automation] Product needs approval');
                results.push({ product: product.name, status: 'NEEDS_APPROVAL', message: 'Brand approval required' });

                // Move to next product
                currentIndex++;
                await delay(1000);
                await goBackToSearch();
                await processNextProduct();
                return;
            }

            if (startSelling) {
                console.log('[Seller Automation] Clicking START SELLING');
                startSelling.click();

                // Wait for form to appear
                await waitForElement('form#latch-on-form', 5000);
                await delay(1000);

                // Fill the form
                await fillListingForm(product);

                results.push({ product: product.name, status: 'LISTED', message: 'Form filled successfully' });

                // Move to next product
                currentIndex++;
                await delay(2000);
                await goBackToSearch();
                await processNextProduct();
                return;
            }

            // No action found
            console.log('[Seller Automation] No action button found for this product');
            results.push({ product: product.name, status: 'UNKNOWN', message: 'No action button found' });
            currentIndex++;
            await delay(1000);
            await goBackToSearch();
            await processNextProduct();

        } catch (error) {
            console.error('[Seller Automation] Error processing product:', error);
            results.push({ product: product.name, status: 'ERROR', message: error.message });
            currentIndex++;
            await processNextProduct();
        }
    }

    async function fillListingForm(product) {
        console.log('[Seller Automation] Filling form with settings:', settings);

        // Extract price from scraped data (remove ₹ and commas)
        const priceNum = parseFloat((product.price || '0').replace(/[₹,]/g, '').trim()) || 0;

        // Listing Information
        await setInputValue('#sku_id', settings.skuPrefix + (product.id || Date.now()));

        // Status Details
        await setSelectValue('#listing_status', settings.listingStatus || 'ACTIVE');

        // Price Details
        const mrp = priceNum * (settings.mrpMultiplier || 1);
        const sellingPrice = priceNum * (settings.sellingPriceMultiplier || 1);
        await setInputValue('#mrp', Math.round(mrp));
        await setInputValue('#flipkart_selling_price', Math.round(sellingPrice));
        await setSelectValue('#minimum_order_quantity', settings.minOrderQty || '1');

        // Inventory Details
        await setSelectValue('#service_profile', 'NON_FBF');
        await setSelectValue('#procurement_type', settings.procurementType || 'REGULAR');
        await setInputValue('#shipping_days', settings.procurementSLA || '2');
        await setInputValue('#stock_size', settings.stock || '10');

        // Shipping Provider
        await setSelectValue('#shipping_provider', 'FLIPKART');

        // Handling Fees (optional)
        if (settings.localHandlingFee) await setInputValue('#local_shipping_fee_from_buyer', settings.localHandlingFee);
        if (settings.zonalHandlingFee) await setInputValue('#zonal_shipping_fee_from_buyer', settings.zonalHandlingFee);
        if (settings.nationalHandlingFee) await setInputValue('#national_shipping_fee_from_buyer', settings.nationalHandlingFee);

        // Package Details
        if (settings.length) await setInputValue('input[name="length_p0"]', settings.length);
        if (settings.breadth) await setInputValue('input[name="breadth_p0"]', settings.breadth);
        if (settings.height) await setInputValue('input[name="height_p0"]', settings.height);
        if (settings.weight) await setInputValue('input[name="weight_p0"]', settings.weight);

        // Tax Details
        if (settings.hsn) await setInputValue('#hsn', settings.hsn);
        if (settings.luxuryCess) await setInputValue('#luxury_cess', settings.luxuryCess);
        await setSelectValue('#tax_code', settings.taxCode || 'GST_18');

        // Manufacturing Details
        await setSelectValue('#country_of_origin', settings.countryOfOrigin || 'IN');
        if (settings.manufacturerDetails) await setTextareaValue('#manufacturer_details', settings.manufacturerDetails);
        if (settings.packerDetails) await setTextareaValue('#packer_details', settings.packerDetails);
        if (settings.importerDetails) await setTextareaValue('#importer_details', settings.importerDetails);

        console.log('[Seller Automation] Form filled successfully');

        // Note: NOT auto-submitting for safety. User can review and submit manually.
        // To auto-submit, uncomment below:
        // const submitBtn = document.querySelector('form#latch-on-form button[type="submit"]');
        // if (submitBtn) submitBtn.click();
    }

    async function setInputValue(selector, value) {
        const input = document.querySelector(selector);
        if (input && value !== undefined && value !== '') {
            input.focus();
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            await delay(100);
        }
    }

    async function setSelectValue(selector, value) {
        const select = document.querySelector(selector);
        if (select && value) {
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            await delay(100);
        }
    }

    async function setTextareaValue(selector, value) {
        const textarea = document.querySelector(selector);
        if (textarea && value) {
            textarea.focus();
            textarea.value = value;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            await delay(100);
        }
    }

    async function goBackToSearch() {
        // Click back icon or navigate back to listings page
        const backIcon = document.querySelector('[data-testid="backIcon"]');
        if (backIcon) {
            backIcon.click();
            await delay(1000);
        }

        // Wait for search box to reappear
        await waitForElement('[data-testid="searchBox"]', 5000);
        await delay(500);
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitForElement(selector, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = document.querySelector(selector);
            if (el) return el;
            await delay(200);
        }
        console.warn(`[Seller Automation] Element ${selector} not found within ${timeout}ms`);
        return null;
    }
})();
