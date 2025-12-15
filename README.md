# Flipkart Scraper & Helper Extension

A powerful Chrome extension to scrape product details, images, and track prices from Flipkart. It works on both Search Results pages and individual Product pages.

## Features
- **Search Page Scraping**: Extracts product search results into a CSV.
- **Product Page Details**: Scrapes detailed info including Price, MRP, Discount, Seller, Description, and Specifications.
- **Highlights**: Extracts key highlights like Material, Dimensions, etc.
- **Image Downloader**: Gallery view to preview, select, and download high-quality product images.
- **Features**: Copy individual specs to clipboard, download images, clean UI.

## Installation

### Method 1: Quick Install (For Users)
1. Download the file `flipkart-extension-build.zip` from this repository.
2. Unzip the file. You will get a folder named `dist`.
3. Open Google Chrome and go to `chrome://extensions/`.
4. Enable **"Developer mode"** in the top-right corner.
5. Click **"Load unpacked"**.
6. Select the `dist` folder you just extracted.
7. The extension "Flipkart Scraper & Helper" is now installed!

### Method 2: For Developers (Source Code)
1. Clone this repository.
2. Run `npm install` to install dependencies.
3. Run `npm run build` to build the extension.
4. Load the `dist` folder in Chrome Extensions as described above.

## Usage
5. **Product Mode**: Open a specific product page. Click "Get Product Details". View specs, copy them, or download all images.

## Development
- Run `npm install` to install dependencies.
- Run `npm run build` to rebuild the extension after changes.
