// Seller Portal Automation for Flipkart
// This script runs on seller.flipkart.com to automate product listing
(function () {
    let isLatching = false;
    let skipCurrent = false;
    let currentIndex = 0;
    let products = [];
    let settings = {};
    let results = [];
    let logPanel = null;
    let logContent = null;
    let progressText = null;

    console.log('[Seller Automation] Content script loaded on seller.flipkart.com');

    // Create floating log panel
    function createLogPanel() {
        if (logPanel) return;

        logPanel = document.createElement('div');
        logPanel.id = 'flipkart-automation-panel';
        logPanel.innerHTML = `
            <style>
                #flipkart-automation-panel {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 350px;
                    max-height: 400px;
                    background: #1a1a2e;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    z-index: 999999;
                    font-family: 'Segoe UI', Arial, sans-serif;
                    color: #fff;
                    overflow: hidden;
                }
                #flipkart-automation-panel .panel-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 12px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                #flipkart-automation-panel .panel-title {
                    font-weight: 600;
                    font-size: 14px;
                }
                #flipkart-automation-panel .panel-progress {
                    font-size: 12px;
                    opacity: 0.9;
                }
                #flipkart-automation-panel .panel-buttons {
                    display: flex;
                    gap: 8px;
                    padding: 10px 16px;
                    background: rgba(255,255,255,0.05);
                }
                #flipkart-automation-panel .panel-btn {
                    flex: 1;
                    padding: 8px 12px;
                    border: none;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                #flipkart-automation-panel .btn-skip {
                    background: #f59e0b;
                    color: #000;
                }
                #flipkart-automation-panel .btn-skip:hover {
                    background: #d97706;
                }
                #flipkart-automation-panel .btn-stop {
                    background: #ef4444;
                    color: #fff;
                }
                #flipkart-automation-panel .btn-stop:hover {
                    background: #dc2626;
                }
                #flipkart-automation-panel .panel-logs {
                    max-height: 250px;
                    overflow-y: auto;
                    padding: 12px 16px;
                    font-size: 11px;
                    line-height: 1.6;
                }
                #flipkart-automation-panel .log-entry {
                    padding: 4px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                #flipkart-automation-panel .log-time {
                    color: #888;
                    margin-right: 8px;
                }
                #flipkart-automation-panel .log-success { color: #22c55e; }
                #flipkart-automation-panel .log-warning { color: #f59e0b; }
                #flipkart-automation-panel .log-error { color: #ef4444; }
                #flipkart-automation-panel .log-info { color: #3b82f6; }
            </style>
            <div class="panel-header">
                <div>
                    <div class="panel-title">🚀 Seller Automation</div>
                    <div class="panel-progress" id="automation-progress">Initializing...</div>
                </div>
            </div>
            <div class="panel-buttons">
                <button class="panel-btn btn-skip" id="btn-skip-product">⏭️ Skip Current</button>
                <button class="panel-btn btn-stop" id="btn-stop-automation">⏹️ Stop All</button>
            </div>
            <div class="panel-logs" id="automation-logs"></div>
        `;
        document.body.appendChild(logPanel);

        logContent = document.getElementById('automation-logs');
        progressText = document.getElementById('automation-progress');

        // Button handlers
        document.getElementById('btn-skip-product').addEventListener('click', () => {
            skipCurrent = true;
            addLog('User requested to skip current product', 'warning');
        });

        document.getElementById('btn-stop-automation').addEventListener('click', () => {
            isLatching = false;
            addLog('Automation stopped by user', 'error');
            chrome.storage.local.set({ latchingActive: false });
            setTimeout(() => {
                if (logPanel) logPanel.remove();
            }, 2000);
        });
    }

    function addLog(message, type = 'info') {
        console.log(`[Seller Automation] ${message}`);
        if (!logContent) return;

        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `<span class="log-time">${time}</span><span class="log-${type}">${message}</span>`;
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    function updateProgress(current, total, status = '') {
        if (progressText) {
            progressText.textContent = `${current}/${total} products ${status}`;
        }
    }

    // Check if latching is active on page load
    chrome.storage.local.get(['latchingActive', 'latchingProducts', 'latchingSettings', 'latchingIndex', 'latchingResults'], async (result) => {
        if (result.latchingActive && result.latchingProducts && result.latchingProducts.length > 0) {
            createLogPanel();
            addLog('Automation started!', 'success');

            isLatching = true;
            products = result.latchingProducts;
            settings = result.latchingSettings || {};
            currentIndex = result.latchingIndex || 0;
            results = result.latchingResults || [];

            if (currentIndex > 0) {
                addLog(`Resuming from product ${currentIndex + 1}...`, 'info');
            }

            updateProgress(currentIndex, products.length, '- Loading...');

            // Wait for page to fully load
            addLog('Waiting for page to load...', 'info');
            await waitForElement('[data-testid="searchBox"]', 10000);
            addLog('Page ready!', 'success');

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
        // Check for skip request
        if (skipCurrent) {
            skipCurrent = false;
            addLog(`Skipped product: ${products[currentIndex]?.name?.substring(0, 30)}...`, 'warning');
            results.push({ product: products[currentIndex]?.name, status: 'SKIPPED', message: 'Skipped by user' });
            currentIndex++;
        }

        if (!isLatching || currentIndex >= products.length) {
            addLog('✅ Automation complete!', 'success');
            updateProgress(products.length, products.length, '- Done!');
            chrome.storage.local.set({
                latchingActive: false,
                latchingResults: results
            });
            return;
        }

        const product = products[currentIndex];
        const shortName = (product.name || 'Unknown').substring(0, 35);

        updateProgress(currentIndex + 1, products.length, `- Processing`);
        addLog(`📦 [${currentIndex + 1}/${products.length}] ${shortName}...`, 'info');

        // Update progress in storage
        chrome.storage.local.set({ latchingIndex: currentIndex });

        try {
            // Step 1: Enter product URL in search box
            const searchInput = document.querySelector('[data-testid="searchBox"] input[data-testid="test-input"]');
            if (!searchInput) {
                addLog('❌ Search input not found', 'error');
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
            addLog('Pasting product URL...', 'info');

            await delay(500);

            // Check for skip during delay
            if (skipCurrent) { await processNextProduct(); return; }

            // Step 2: Click search icon
            const searchIcon = document.querySelector('[data-testid="searchIcon"]');
            if (searchIcon) {
                searchIcon.click();
                addLog('🔍 Searching...', 'info');
            } else {
                addLog('❌ Search icon not found', 'error');
                results.push({ product: product.name, status: 'ERROR', message: 'Search icon not found' });
                currentIndex++;
                await processNextProduct();
                return;
            }

            // Step 3: Wait for results
            await delay(3000);

            // Check for skip during delay
            if (skipCurrent) { await processNextProduct(); return; }

            // Step 4: Check product status - ALREADY SELLING, APPLY FOR APPROVAL, or START SELLING
            const alreadySelling = document.querySelector('.primaryActionBar a.disabled.startSelling, .primaryActionBar a.alreadySelling');
            const applyForApproval = document.querySelector('.primaryActionBar a.applyForApprovalLink:not(.startSelling), .primaryActionBar a[href*="apply"]');
            const startSelling = document.querySelector('.primaryActionBar a.startSelling.listingsModalLink:not(.disabled)');

            // Check for ALREADY SELLING first
            if (alreadySelling && alreadySelling.textContent.includes('ALREADY SELLING')) {
                addLog('⚪ Already selling - skipped', 'warning');
                results.push({ product: product.name, status: 'ALREADY_SELLING', message: 'Already listed, skipped' });

                // Move to next product
                currentIndex++;
                await delay(1000);
                await goBackToSearch();
                await processNextProduct();
                return;
            }

            if (applyForApproval && applyForApproval.textContent.includes('APPLY FOR APPROVAL')) {
                addLog('🔒 Needs brand approval - skipped', 'warning');
                results.push({ product: product.name, status: 'NEEDS_APPROVAL', message: 'Brand approval required' });

                // Move to next product
                currentIndex++;
                await delay(1000);
                await goBackToSearch();
                await processNextProduct();
                return;
            }

            if (startSelling) {
                addLog('🟢 START SELLING found - clicking...', 'success');
                startSelling.click();

                // Wait for form to appear
                await waitForElement('form#latch-on-form', 5000);
                await delay(1000);

                // Check for skip during delay
                if (skipCurrent) { await processNextProduct(); return; }

                // Fill the form
                addLog('📝 Filling listing form...', 'info');
                await fillListingForm(product);

                addLog('✅ Form filled successfully!', 'success');
                results.push({ product: product.name, status: 'LISTED', message: 'Form filled successfully' });

                // Move to next product
                currentIndex++;
                await delay(2000);
                await goBackToSearch();
                await processNextProduct();
                return;
            }

            // No action found
            addLog('❓ No action button found', 'warning');
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

        addLog('💾 Submitting form...', 'info');

        // Try multiple selectors for the submit button
        const submitBtn = document.querySelector('form#latch-on-form button[type="submit"]') ||
            document.querySelector('button[type="submit"].styles__Button-sc-141aa9u-0') ||
            Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Start Selling') || b.textContent.includes('Submit'));

        if (submitBtn) {
            submitBtn.click();
            addLog('✅ Clicked Submit!', 'success');
            await delay(2000); // Wait for submission
        } else {
            addLog('❌ Submit button not found!', 'error');
        }
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
        addLog('⬅️ Navigating back to listings page...', 'info');

        // Save current state before navigation
        chrome.storage.local.set({
            latchingIndex: currentIndex,
            latchingActive: isLatching,
            latchingResults: results
        });

        // Navigate to the listings page directly
        window.location.href = 'https://seller.flipkart.com/index.html#dashboard/listingsInProgress';

        // The page will reload and the script will pick up from latchingIndex
        // No need to wait here as page will refresh
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
