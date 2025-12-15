import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Download, Play, Square, Copy, Image as ImageIcon, Power, Loader2, Check, Eye } from 'lucide-react'
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

function App() {
  const [currentTab, setCurrentTab] = useState(null)
  const [mode, setMode] = useState('unknown') // 'search' | 'product' | 'unknown'
  const [isActive, setIsActive] = useState(true)

  // Search State
  const [scraping, setScraping] = useState(false)
  const [scrapedProducts, setScrapedProducts] = useState([])

  // Product State
  const [productData, setProductData] = useState(null)
  const [loading, setLoading] = useState(false)

  // Image Selection State
  const [selectedImages, setSelectedImages] = useState(new Set())
  const [showImages, setShowImages] = useState(false)

  useEffect(() => {
    // Load active state
    chrome.storage.local.get(['extensionActive', 'scrapedProductData'], (result) => {
      // Default to true if not set
      setIsActive(result.extensionActive !== false)
      if (result.scrapedProductData) {
        setProductData(result.scrapedProductData)
        // Auto-select all images on load
        if (result.scrapedProductData.images) {
          setSelectedImages(new Set(result.scrapedProductData.images));
        }
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
    if (!isActive) return;
    const csvContent = "data:text/csv;charset=utf-8,"
      + ["Title,URL,ID"].join(",") + "\n"
      + scrapedProducts.map(e => `"${e.title.replace(/"/g, '""')}","${e.url}","${e.id}"`).join("\n");

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
    if (!productData) return;
    const text = Object.entries(productData.specifications).map(([k, v]) => `${k}: ${v}`).join('\n')
    navigator.clipboard.writeText(text)
    alert("Specifications copied to clipboard!")
  }

  const downloadImages = () => {
    if (!productData?.images || selectedImages.size === 0) {
      alert("No images selected!");
      return;
    }

    // We send a message to background script to handle downloads to avoid CORS or permission issues if any
    Array.from(selectedImages).forEach((url, index) => {
      chrome.runtime.sendMessage({
        action: "download_image",
        url: url,
        filename: `${productData.title.substring(0, 20).replace(/[^a-z0-9]/gi, '_')}_${index + 1}.jpg`
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

  return (
    <div className="w-full min-h-screen p-4 bg-background text-foreground overflow-auto">
      <Card className="border-none shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                Flipkart Extension
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                  v1.0.0
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
        <CardContent>
          <div className={cn("transition-opacity duration-200", isActive ? "opacity-100" : "opacity-50 pointer-events-none select-none grayscale")}>
            {mode === 'search' && (
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
                  {scrapedProducts.map((p, i) => (
                    <div key={i} className="truncate border-b border-border py-1">
                      {i + 1}. {p.title}
                    </div>
                  ))}
                  {scrapedProducts.length === 0 && <span className="text-muted-foreground">No products scraped yet.</span>}
                </div>
              </div>
            )}

            {mode === 'product' && (
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
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-bold leading-tight">{productData.title}</h2>
                      <p className="text-xl font-semibold text-primary mt-2">{productData.price} <span className="text-sm text-muted-foreground font-normal line-through ml-2">{productData.specifications?.MRP}</span> <span className="text-sm text-green-600 ml-1">{productData.specifications?.Discount}</span></p>
                    </div>

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

                    {showImages && productData.images && (
                      <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm" onClick={toggleSelectAllImages}>
                              {selectedImages.size === productData.images.length ? <Square className="h-4 w-4 mr-2 fill-current" /> : <Square className="h-4 w-4 mr-2" />}
                              {selectedImages.size === productData.images.length ? 'Deselect All' : 'Select All'}
                            </Button>
                          </div>
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleImageSelection(img);
                                  }}
                                >
                                  {selectedImages.has(img) && <Check className="h-3 w-3 text-primary-foreground" />}
                                </div>
                              </div>

                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="h-8 w-8 rounded-full"
                                  onClick={() => window.open(img, '_blank')}
                                  title="Preview Full Size"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableBody>
                          {productData.highlights && productData.highlights.length > 0 && (
                            <TableRow>
                              <TableCell className="w-[140px] font-medium bg-muted/30 align-top pt-4">Highlights</TableCell>
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

                          {Object.entries(productData.specifications || {}).map(([key, value]) => (
                            <TableRow key={key}>
                              <TableCell className="w-[140px] font-medium bg-muted/30">{key}</TableCell>
                              <TableCell>{value}</TableCell>
                              <TableCell className="w-[50px] text-right">
                                <CopyButton text={value} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <Button onClick={clearProductData} variant="secondary" className="w-full">
                      Clear Results
                    </Button>
                  </div>
                )}
              </div>
            )}

            {mode === 'unknown' && (
              <div className="text-center p-8 text-muted-foreground">
                Please navigate to a Flipkart Search or Product page.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
