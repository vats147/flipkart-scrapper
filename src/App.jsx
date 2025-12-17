import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Download, Play, Square, Copy, Image as ImageIcon, Power, Loader2, Check, Eye, ChevronDown, ChevronUp, Package, Search, Database, Settings } from 'lucide-react'
import { cn } from "@/lib/utils" // Assuming cn utility is available

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy Value"}
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
};

const AccordionItem = ({ title, children, defaultOpen = false, count }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg overflow-hidden bg-card mb-3 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{title}</span>
          {count !== undefined && <span className="text-xs text-muted-foreground">({count})</span>}
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="p-0 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

function App() {
  const [currentTab, setCurrentTab] = useState(null)
  const [mode, setMode] = useState('unknown') // 'search' | 'product' | 'unknown'
  const [activeTab, setActiveTab] = useState('auto') // 'auto' | 'product' | 'search' | 'scraper'
  const [isActive, setIsActive] = useState(true)

  // Search State (existing)
  const [scraping, setScraping] = useState(false)
  const [scrapedProducts, setScrapedProducts] = useState([])

  // Product State (existing)
  const [productData, setProductData] = useState(null)
  const [loading, setLoading] = useState(false)

  // Image Selection State (existing)
  const [selectedImages, setSelectedImages] = useState(new Set())
  const [showImages, setShowImages] = useState(false)

  // Advanced Search State (NEW)
  const [advancedScraping, setAdvancedScraping] = useState(false)
  const [advancedProducts, setAdvancedProducts] = useState([])
  const [pagesCrawled, setPagesCrawled] = useState(0)
  const [maxPages, setMaxPages] = useState(1) // Limit pages to scrape
  const [showSettings, setShowSettings] = useState(false)

  // Latching State
  const [isLatching, setIsLatching] = useState(false)
  const [latchingProgress, setLatchingProgress] = useState({ current: 0, total: 0, status: '' })

  // Seller Form Settings (for auto-fill)
  const [sellerSettings, setSellerSettings] = useState({
    // Listing Info
    skuPrefix: 'SKU-',
    listingStatus: 'ACTIVE',

    // Price Details
    mrpMultiplier: 1.0, // Multiply scraped price by this
    sellingPriceMultiplier: 1.0,
    minOrderQty: '1',

    // Inventory Details
    fulfillmentBy: 'NON_FBF',
    procurementType: 'REGULAR',
    procurementSLA: '2',
    stock: '10',

    // Shipping
    shippingProvider: 'FLIPKART',
    localHandlingFee: '',
    zonalHandlingFee: '',
    nationalHandlingFee: '',

    // Package Details
    length: '',
    breadth: '',
    height: '',
    weight: '',

    // Tax Details
    hsn: '',
    luxuryCess: '',
    taxCode: 'GST_18',

    // Manufacturing Details
    countryOfOrigin: 'IN',
    manufacturerDetails: '',
    packerDetails: '',
    importerDetails: ''
  })

  useEffect(() => {
    // Load active state and seller settings
    chrome.storage.local.get(['extensionActive', 'scrapedProductData', 'sellerSettings'], (result) => {
      // Default to true if not set
      setIsActive(result.extensionActive !== false)
      if (result.scrapedProductData) {
        setProductData(result.scrapedProductData)
        // Auto-select all images on load
        if (result.scrapedProductData.images) {
          setSelectedImages(new Set(result.scrapedProductData.images));
        }
      }
      // Load saved seller settings
      if (result.sellerSettings) {
        setSellerSettings(prev => ({ ...prev, ...result.sellerSettings }));
      }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        setCurrentTab(tabs[0])
        const url = tabs[0].url;

        // Product page detection (Flipkart URLs usually have /p/ or /P/ or are notably different from search)
        // Search pages ALWAYS have /search
        if (url.includes('/search')) {
          setMode('search')
        } else if (url.includes('/p/') || url.includes('/P/')) {
          setMode('product')
        }
      }
    })

    // Listen for messages from content script
    const messageListener = (message) => {
      // Existing search scraper messages
      if (message.action === "update_count") {
        setScrapedProducts(prev => {
          // Avoid duplicates
          const exists = prev.find(p => p.id === message.data.id);
          if (exists) return prev;
          return [...prev, message.data]
        })
      } else if (message.action === "scraping_finished") {
        setScraping(false)
      }
      // NEW: Advanced search scraper messages
      else if (message.action === "advanced_update") {
        setAdvancedProducts(prev => [...prev, ...message.products]);
        setPagesCrawled(message.pagesCrawled);
      } else if (message.action === "advanced_scraping_finished") {
        setAdvancedScraping(false);
        setPagesCrawled(message.pagesCrawled || pagesCrawled);
      }
    }
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, [])

  const toggleActive = (checked) => {
    const newState = checked; // Use the 'checked' parameter directly
    setIsActive(newState);
    chrome.storage.local.set({ extensionActive: newState });
    if (!newState && scraping) { // Stop scraping if extension is deactivated
      stopScraping();
    }
  }

  const sendMessageToTab = (message, callback) => {
    if (currentTab?.id) {
      chrome.tabs.sendMessage(currentTab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("Communication error:", chrome.runtime.lastError.message);
          alert("Connection failed. Please REFRESH the Flipkart page and try again.");
          setScraping(false); // Reset state if failed
          setLoading(false);
          return;
        }
        if (callback) callback(response);
      });
    }
  }

  const startScraping = () => {
    if (!isActive) return;
    setScraping(true)
    setScrapedProducts([])
    chrome.storage.local.set({ scannedProducts: [] })
    sendMessageToTab({ action: "start_search_scraping" })
  }

  const stopScraping = () => {
    setScraping(false)
    sendMessageToTab({ action: "stop_search_scraping" })
  }

  const downloadCSV = () => {
    if (!isActive || scrapedProducts.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8,"
      + ["Title,URL,ID"].join(",") + "\n"
      + scrapedProducts
        .filter(e => e && e.title) // Filter out undefined/null entries
        .map(e => `"${(e.title || '').replace(/"/g, '""')}","${e.url || ''}","${e.id || ''}"`)
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "flipkart_products.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const clearProductData = () => {
    setProductData(null);
    setSelectedImages(new Set());
    setShowImages(false);
    chrome.storage.local.remove(['scrapedProductData']);
  };

  const scrapeProduct = () => {
    if (!isActive) return;
    setLoading(true)
    // Clear old data first to avoid confusion
    setProductData(null);
    setSelectedImages(new Set());
    chrome.storage.local.remove(['scrapedProductData']);

    sendMessageToTab({ action: "scrape_product" }, (response) => {
      setLoading(false)
      if (response && response.success) {
        setProductData(response.data)
        // Auto-select all images
        if (response.data.images) {
          setSelectedImages(new Set(response.data.images));
        }
        // Save to storage
        chrome.storage.local.set({ scrapedProductData: response.data });
      }
    })
  }

  const copySpecs = () => {
    if (!productData?.specifications) return;
    const text = Object.entries(productData.specifications).map(([k, v]) => `${k}: ${v}`).join('\n')
    navigator.clipboard.writeText(text)
    alert("Specifications copied to clipboard!")
  }

  const downloadImages = () => {
    if (!productData?.images || selectedImages.size === 0) {
      alert("No images selected!");
      return;
    }

    // Get safe filename from title or use default
    const safeTitle = (productData?.title || 'product').substring(0, 20).replace(/[^a-z0-9]/gi, '_');

    // We send a message to background script to handle downloads to avoid CORS or permission issues if any
    Array.from(selectedImages).forEach((url, index) => {
      chrome.runtime.sendMessage({
        action: "download_image",
        url: url,
        filename: `${safeTitle}_${index + 1}.jpg`
      })
    })
    alert(`Downloading ${selectedImages.size} images...Check your downloads folder.`);
  }

  const toggleImageSelection = (url) => {
    const newSet = new Set(selectedImages);
    if (newSet.has(url)) {
      newSet.delete(url);
    } else {
      newSet.add(url);
    }
    setSelectedImages(newSet);
  }

  const toggleSelectAllImages = () => {
    if (selectedImages.size === productData.images.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(productData.images));
    }
  }

  // ========== NEW: Advanced Scraping Functions ==========
  const startAdvancedScraping = () => {
    if (!isActive) return;
    setAdvancedScraping(true);
    setAdvancedProducts([]);
    setPagesCrawled(0);
    sendMessageToTab({ action: "start_advanced_scraping", maxPages: maxPages });
  }

  const stopAdvancedScraping = () => {
    setAdvancedScraping(false);
    sendMessageToTab({ action: "stop_advanced_scraping" });
  }

  const downloadAdvancedCSV = () => {
    if (!isActive || advancedProducts.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8,"
      + ["Name,Image,Price,URL,ID"].join(",") + "\n"
      + advancedProducts
        .filter(e => e && e.name) // Filter out undefined/null entries
        .map(e =>
          `"${(e.name || '').replace(/"/g, '""')}","${e.image || ''}","${(e.price || '').replace(/"/g, '""')}","${e.url || ''}","${e.id || ''}"`
        ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "flipkart_advanced_search.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Helper to update seller settings
  const updateSellerSetting = (key, value) => {
    setSellerSettings(prev => {
      const updated = { ...prev, [key]: value };
      // Auto-save to storage
      chrome.storage.local.set({ sellerSettings: updated });
      return updated;
    });
  }

  // Start Latching - opens seller portal and begins automation
  const startLatching = () => {
    if (advancedProducts.length === 0) {
      alert('No products to latch. Run scraping first!');
      return;
    }

    // Save products and settings to storage for the seller content script
    chrome.storage.local.set({
      latchingProducts: advancedProducts,
      latchingSettings: sellerSettings,
      latchingIndex: 0,
      latchingActive: true
    }, () => {
      setIsLatching(true);
      setLatchingProgress({ current: 0, total: advancedProducts.length, status: 'Opening seller portal...' });

      // Open seller portal in new tab
      chrome.tabs.create({
        url: 'https://seller.flipkart.com/index.html#dashboard/listingsInProgress'
      });
    });
  }

  const stopLatching = () => {
    setIsLatching(false);
    chrome.storage.local.set({ latchingActive: false });
    setLatchingProgress({ current: 0, total: 0, status: 'Stopped' });
  }

  // Determine which view to show based on activeTab
  const showView = activeTab === 'auto' ? mode : activeTab;

  return (
    <div className="w-full min-h-screen p-4 bg-background text-foreground overflow-auto">
      <Card className="border-none shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                Flipkart Extension
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                  v1.1.0
                </span>
              </CardTitle>
              <CardDescription>
                {isActive
                  ? (mode === 'search' ? 'Search Page Detected' : mode === 'product' ? 'Product Page Detected' : 'Navigate to Flipkart')
                  : 'Extension is Deactivated'
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
              <Switch checked={isActive} onCheckedChange={toggleActive} />
            </div>
          </div>
        </CardHeader>

        {/* NEW: Tab Navigation */}
        <div className="px-6 flex gap-1 border-b bg-muted/20">
          <button
            onClick={() => setActiveTab('product')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              (activeTab === 'product' || (activeTab === 'auto' && mode === 'product'))
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Package className="h-4 w-4" />
            Product
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              (activeTab === 'search' || (activeTab === 'auto' && mode === 'search'))
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Search className="h-4 w-4" />
            Search
          </button>
          <button
            onClick={() => setActiveTab('scraper')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'scraper'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Database className="h-4 w-4" />
            Scraper
          </button>
        </div>

        <CardContent className="pt-4">
          <div className={cn("transition-opacity duration-200", isActive ? "opacity-100" : "opacity-50 pointer-events-none select-none grayscale")}>
            {showView === 'search' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {!scraping ? (
                    <Button onClick={startScraping} className="w-full">
                      <Play className="mr-2 h-4 w-4" /> Start Scraping
                    </Button>
                  ) : (
                    <Button onClick={stopScraping} variant="destructive" className="w-full">
                      <Square className="mr-2 h-4 w-4" /> Stop
                    </Button>
                  )}
                  {scrapedProducts.length > 0 && (
                    <Button onClick={downloadCSV} variant="outline" className="w-full">
                      <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                  )}
                </div>

                <div className="text-sm font-medium">Found: {scrapedProducts.length} products</div>

                <div className="bg-muted p-2 rounded-md h-[200px] overflow-auto text-xs font-mono">
                  {scrapedProducts
                    .filter(p => p && p.title)
                    .map((p, i) => (
                      <div key={i} className="truncate border-b border-border py-1">
                        {i + 1}. {p.title || 'Unknown'}
                      </div>
                    ))}
                  {scrapedProducts.length === 0 && <span className="text-muted-foreground">No products scraped yet.</span>}
                </div>
              </div>
            )}

            {showView === 'product' && (
              <div className="space-y-6">
                {!productData ? (
                  <div className="text-center py-10 space-y-4">
                    <p className="text-muted-foreground">Navigate to a Flipkart product page to start.</p>
                    <Button onClick={scrapeProduct} disabled={loading} size="lg" className="w-full">
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                      Get Product Details
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Header */}
                    <div>
                      <h2 className="text-lg font-bold leading-tight line-clamp-2">{productData.title}</h2>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-bold text-primary">{productData.price}</span>
                        {productData.specifications?.MRP && (
                          <span className="text-sm text-muted-foreground line-through">{productData.specifications.MRP}</span>
                        )}
                        {productData.specifications?.Discount && (
                          <span className="text-sm font-medium text-green-600">{productData.specifications.Discount}</span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" onClick={copySpecs} className="w-full">
                        <Copy className="mr-2 h-4 w-4" /> Copy All
                      </Button>
                      <Button
                        variant={showImages ? "secondary" : "outline"}
                        onClick={() => setShowImages(!showImages)}
                        className="w-full"
                      >
                        <ImageIcon className="mr-2 h-4 w-4" /> {showImages ? 'Hide Images' : `Show Images (${productData.images?.length || 0})`}
                      </Button>
                    </div>

                    {/* Images Section */}
                    {showImages && productData.images && (
                      <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                        <div className="flex justify-between items-center">
                          <Button variant="ghost" size="sm" onClick={toggleSelectAllImages}>
                            {selectedImages.size === productData.images.length ? <Square className="h-4 w-4 mr-2 fill-current" /> : <Square className="h-4 w-4 mr-2" />}
                            {selectedImages.size === productData.images.length ? 'Deselect All' : 'Select All'}
                          </Button>
                          <Button size="sm" onClick={downloadImages} disabled={selectedImages.size === 0}>
                            <Download className="h-4 w-4 mr-2" /> Download ({selectedImages.size})
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {productData.images.map((img, idx) => (
                            <div key={idx} className="group relative aspect-square border rounded-md overflow-hidden bg-white shadow-sm hover:shadow-md transition-all">
                              <img src={img} alt={`Product ${idx}`} className="object-contain w-full h-full p-1" />
                              <div className="absolute top-2 right-2 z-10">
                                <div
                                  className={cn("h-5 w-5 rounded border border-primary bg-white flex items-center justify-center cursor-pointer hover:bg-muted", selectedImages.has(img) && "bg-primary border-primary")}
                                  onClick={(e) => { e.stopPropagation(); toggleImageSelection(img); }}
                                >
                                  {selectedImages.has(img) && <Check className="h-3 w-3 text-primary-foreground" />}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sections Logic */}
                    {(() => {
                      const specs = productData.specifications || {};
                      const group1Keys = ['Price', 'MRP', 'Discount', 'Depth', 'Width', 'Height', 'Weight', 'Length', 'Dimensions'];
                      const group2Keys = ['Model Number', 'Model Name', 'Material', 'Color', 'Items Included', 'Sales Package', 'Type', 'Occasion', 'Sub-Type', 'Suitable For', 'Ideal Location', 'Fabric', 'Pattern', 'Style Code', 'Secondary Color', 'Neck', 'Sleeve'];

                      const group1 = {};
                      const group2 = {};
                      const group3 = {};

                      // Helper to render table rows
                      const renderRows = (obj) => Object.entries(obj).map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell className="w-[140px] font-medium bg-muted/30 text-xs">{key}</TableCell>
                          <TableCell className="text-sm">{value}</TableCell>
                          <TableCell className="w-[50px] text-right">
                            <CopyButton text={value} />
                          </TableCell>
                        </TableRow>
                      ));

                      // Sort specs into groups
                      Object.entries(specs).forEach(([key, value]) => {
                        if (group1Keys.includes(key)) group1[key] = value;
                        else if (group2Keys.includes(key)) group2[key] = value;
                        else group3[key] = value;
                      });

                      return (
                        <div className="space-y-1">
                          {/* Section 1: Price & Package */}
                          <AccordionItem title="Price & Package Details" defaultOpen={true} count={Object.keys(group1).length}>
                            <Table>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="w-[140px] font-medium bg-muted/30 text-xs">Selling Price</TableCell>
                                  <TableCell className="text-sm font-bold">{productData.price}</TableCell>
                                  <TableCell className="w-[50px] text-right"><CopyButton text={productData.price} /></TableCell>
                                </TableRow>
                                {renderRows(group1)}
                              </TableBody>
                            </Table>
                          </AccordionItem>

                          {/* Section 2: Product Specs */}
                          <AccordionItem title="Product Specifications" defaultOpen={false} count={Object.keys(group2).length}>
                            <Table>
                              <TableBody>
                                {renderRows(group2)}
                                {Object.keys(group2).length === 0 && <div className="p-4 text-center text-muted-foreground text-sm">No specific product details found.</div>}
                              </TableBody>
                            </Table>
                          </AccordionItem>

                          {/* Section 3: Additional Details & Highlights */}
                          <AccordionItem title="Additional Description & Highlights" defaultOpen={false} count={(productData.highlights?.length || 0) + Object.keys(group3).length}>
                            <Table>
                              <TableBody>
                                {/* Highlights */}
                                {productData.highlights && productData.highlights.length > 0 && (
                                  <TableRow>
                                    <TableCell className="w-[140px] font-medium bg-muted/30 align-top pt-4 text-xs">Highlights</TableCell>
                                    <TableCell colSpan={2} className="p-0">
                                      <ul className="divide-y border-l">
                                        {productData.highlights.map((hl, idx) => (
                                          <li key={idx} className="flex items-center justify-between p-2 pl-4 hover:bg-muted/50 group">
                                            <span className="text-sm pr-2">{hl}</span>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                              <CopyButton text={hl} />
                                            </div>
                                          </li>
                                        ))}
                                      </ul>
                                    </TableCell>
                                  </TableRow>
                                )}
                                {/* Remaining Specs */}
                                {renderRows(group3)}
                                {/* Description Text if not in specs */}
                                {!specs['Description'] && productData.description && (
                                  <TableRow>
                                    <TableCell className="w-[140px] font-medium bg-muted/30 align-top pt-4 text-xs">Description</TableCell>
                                    <TableCell colSpan={2} className="text-sm p-4">{productData.description}</TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </AccordionItem>
                        </div>
                      );
                    })()}

                    <Button onClick={clearProductData} variant="secondary" className="w-full mt-4">
                      Clear Results
                    </Button>
                  </div>
                )}
              </div>
            )}

            {showView === 'unknown' && (
              <div className="text-center p-8 text-muted-foreground">
                Please navigate to a Flipkart Search or Product page.
              </div>
            )}

            {/* NEW: Scraper Tab UI */}
            {activeTab === 'scraper' && (
              <div className="space-y-4">
                {/* Controls */}
                <div className="flex gap-2">
                  {!advancedScraping ? (
                    <Button onClick={startAdvancedScraping} className="w-full">
                      <Play className="mr-2 h-4 w-4" /> Start Scraping
                    </Button>
                  ) : (
                    <Button onClick={stopAdvancedScraping} variant="destructive" className="w-full">
                      <Square className="mr-2 h-4 w-4" /> Stop
                    </Button>
                  )}
                  {advancedProducts.length > 0 && (
                    <Button onClick={downloadAdvancedCSV} variant="outline" className="w-full">
                      <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                  )}
                  <Button onClick={() => setShowSettings(!showSettings)} variant="ghost" size="icon">
                    <Settings className={cn("h-4 w-4", showSettings && "text-primary")} />
                  </Button>
                </div>

                {/* Max Pages Input */}
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-muted-foreground">Max Pages:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={maxPages}
                    onChange={(e) => setMaxPages(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 border rounded text-center"
                  />
                  <span className="text-muted-foreground text-xs">(~{maxPages * 40} products)</span>
                </div>

                {/* Latching Button */}
                {advancedProducts.length > 0 && !advancedScraping && (
                  <div className="space-y-2">
                    {!isLatching ? (
                      <Button onClick={startLatching} className="w-full bg-green-600 hover:bg-green-700">
                        <Play className="mr-2 h-4 w-4" /> Start Latching ({advancedProducts.length} products)
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Button onClick={stopLatching} variant="destructive" className="w-full">
                          <Square className="mr-2 h-4 w-4" /> Stop Latching
                        </Button>
                        <div className="text-xs text-center text-muted-foreground">
                          {latchingProgress.status} ({latchingProgress.current}/{latchingProgress.total})
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Settings Form */}
                {showSettings && (
                  <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Seller Form Settings
                    </h3>

                    {/* Listing Info */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Listing Info</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs">SKU Prefix</label>
                          <input
                            type="text"
                            value={sellerSettings.skuPrefix}
                            onChange={(e) => updateSellerSetting('skuPrefix', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                            placeholder="SKU-"
                          />
                        </div>
                        <div>
                          <label className="text-xs">Status</label>
                          <select
                            value={sellerSettings.listingStatus}
                            onChange={(e) => updateSellerSetting('listingStatus', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Price Details */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Price Details</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs">MRP (₹)</label>
                          <input
                            type="number"
                            value={sellerSettings.defaultMrp || ''}
                            onChange={(e) => updateSellerSetting('defaultMrp', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                            placeholder="Leave empty to use scraped"
                          />
                        </div>
                        <div>
                          <label className="text-xs">Selling Price (₹)</label>
                          <input
                            type="number"
                            value={sellerSettings.defaultSellingPrice || ''}
                            onChange={(e) => updateSellerSetting('defaultSellingPrice', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                            placeholder="Leave empty to use scraped"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Inventory */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Inventory</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs">Stock</label>
                          <input
                            type="number"
                            value={sellerSettings.stock}
                            onChange={(e) => updateSellerSetting('stock', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs">Procurement SLA (days)</label>
                          <input
                            type="number"
                            value={sellerSettings.procurementSLA}
                            onChange={(e) => updateSellerSetting('procurementSLA', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Package Details */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Package Details</div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-xs">L (cm)</label>
                          <input
                            type="number"
                            value={sellerSettings.length}
                            onChange={(e) => updateSellerSetting('length', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs">B (cm)</label>
                          <input
                            type="number"
                            value={sellerSettings.breadth}
                            onChange={(e) => updateSellerSetting('breadth', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs">H (cm)</label>
                          <input
                            type="number"
                            value={sellerSettings.height}
                            onChange={(e) => updateSellerSetting('height', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs">Wt (Kg)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={sellerSettings.weight}
                            onChange={(e) => updateSellerSetting('weight', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tax Details */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Tax Details</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs">HSN Code</label>
                          <input
                            type="text"
                            value={sellerSettings.hsn}
                            onChange={(e) => updateSellerSetting('hsn', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs">Tax Code</label>
                          <select
                            value={sellerSettings.taxCode}
                            onChange={(e) => updateSellerSetting('taxCode', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            <option value="GST_0">GST_0</option>
                            <option value="GST_3">GST_3</option>
                            <option value="GST_5">GST_5</option>
                            <option value="GST_18">GST_18</option>
                            <option value="GST_40">GST_40</option>
                            <option value="GST_APPAREL">GST_APPAREL</option>
                            <option value="GST_Footwear">GST_Footwear</option>
                            <option value="GST_Old_12_New_0">GST_Old_12_New_0</option>
                            <option value="GST_Old_12_New_5">GST_Old_12_New_5</option>
                            <option value="GST_Old_12_new_18">GST_Old_12_new_18</option>
                            <option value="GST_Old_18_New_0">GST_Old_18_New_0</option>
                            <option value="GST_Old_18_New_5">GST_Old_18_New_5</option>
                            <option value="GST_Old_18_New_40">GST_Old_18_New_40</option>
                            <option value="GST_Old_28_New_5">GST_Old_28_New_5</option>
                            <option value="GST_Old_28_New_18">GST_Old_28_New_18</option>
                            <option value="GST_Old_28_New_40">GST_Old_28_New_40</option>
                            <option value="GST_Old_5_New_0">GST_Old_5_New_0</option>
                            <option value="GST_Old_5_New_18">GST_Old_5_New_18</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Manufacturing Details */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Manufacturing Details</div>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs">Country of Origin</label>
                          <select
                            value={sellerSettings.countryOfOrigin}
                            onChange={(e) => updateSellerSetting('countryOfOrigin', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            <option value="IN">India</option>
                            <option value="CN">China</option>
                            <option value="US">USA</option>
                            <option value="JP">Japan</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs">Manufacturer Details</label>
                          <textarea
                            value={sellerSettings.manufacturerDetails}
                            onChange={(e) => updateSellerSetting('manufacturerDetails', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm h-16 resize-none"
                            placeholder="Name, Address..."
                          />
                        </div>
                        <div>
                          <label className="text-xs">Packer Details</label>
                          <textarea
                            value={sellerSettings.packerDetails}
                            onChange={(e) => updateSellerSetting('packerDetails', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm h-16 resize-none"
                            placeholder="Name, Address..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{advancedProducts.length}</div>
                    <div className="text-xs text-muted-foreground">Products Found</div>
                  </div>
                  <div className="bg-blue-100 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{pagesCrawled}</div>
                    <div className="text-xs text-muted-foreground">Pages Crawled</div>
                  </div>
                </div>

                {/* Table Display */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[60px]">Image</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-[80px] text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {advancedProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            No products scraped yet. Click "Start Scraping" to begin.
                          </TableCell>
                        </TableRow>
                      ) : (
                        advancedProducts
                          .filter(p => p && p.name) // Filter out undefined entries
                          .map((p, i) => (
                            <TableRow key={(p.id || '') + i} className="hover:bg-muted/30">
                              <TableCell className="p-2">
                                {p.image ? (
                                  <img
                                    src={p.image}
                                    alt=""
                                    className="h-12 w-12 object-contain rounded bg-white border"
                                  />
                                ) : (
                                  <div className="h-12 w-12 bg-muted rounded flex items-center justify-center text-xs">N/A</div>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                <a
                                  href={p.url || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline line-clamp-2"
                                  title={p.name || ''}
                                >
                                  {p.name || 'Unknown'}
                                </a>
                              </TableCell>
                              <TableCell className="text-right font-bold text-sm">
                                {p.price || 'N/A'}
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Status */}
                {advancedScraping && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scraping page {pagesCrawled}...
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
