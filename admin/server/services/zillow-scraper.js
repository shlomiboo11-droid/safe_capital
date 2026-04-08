/**
 * Zillow Property Image Fetcher
 *
 * Uses the "private-zillow" RapidAPI to reliably fetch property images.
 * Supports both Zillow URLs and property addresses.
 *
 * All returned URLs are Zillow CDN URLs (zillowstatic.com).
 * We store URLs, not downloaded bytes, to keep storage light.
 */

'use strict';

const RAPIDAPI_HOST = 'private-zillow.p.rapidapi.com';

/**
 * Fetch property images via RapidAPI "private-zillow" /By URL endpoint.
 *
 * @param {string} addressOrUrl - A Zillow URL or property address
 * @returns {Promise<{ images: string[], source: string }>}
 */
async function fetchZillowImages(addressOrUrl) {
  if (!addressOrUrl || typeof addressOrUrl !== 'string' || addressOrUrl.trim().length < 5) {
    throw new Error('כתובת או URL לא תקינים');
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY לא מוגדר. יש להגדיר אותו ב-.env');
  }

  const input = addressOrUrl.trim();

  // Determine which endpoint to use
  let apiUrl;
  if (input.startsWith('http')) {
    // Use /byurl endpoint for Zillow URLs
    apiUrl = `https://${RAPIDAPI_HOST}/byurl?url=${encodeURIComponent(input)}`;
  } else {
    // Use /byaddress endpoint for addresses
    apiUrl = `https://${RAPIDAPI_HOST}/byaddress?propertyaddress=${encodeURIComponent(input)}`;
  }

  let resp;
  try {
    resp = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': apiKey
      },
      signal: AbortSignal.timeout(30000)
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error('ה-API לא הגיב בזמן. נסה שוב.');
    }
    throw new Error('שגיאה בחיבור ל-API: ' + err.message);
  }

  if (resp.status === 429) {
    throw new Error('חריגה ממכסת ה-API. נסה שוב מאוחר יותר.');
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`שגיאת API (HTTP ${resp.status}): ${text.substring(0, 200)}`);
  }

  const data = await resp.json();

  // Extract images from the API response
  const images = extractImagesFromResponse(data);

  if (images.length === 0) {
    throw new Error('לא נמצאו תמונות לנכס זה. בדוק את הכתובת או ה-URL.');
  }

  return { images, source: 'rapidapi' };
}

/**
 * Extract image URLs from the private-zillow API response.
 * The API returns property data with photos in various nested structures.
 */
function extractImagesFromResponse(data) {
  const images = new Set();

  // Recursive walker — looks for zillowstatic.com image URLs anywhere in the response
  function walk(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }

    // Check common photo URL fields
    const urlFields = ['url', 'src', 'href', 'webpUrl', 'jpegUrl', 'highResUrl',
                       'fullUrl', 'mixedSrc', 'hiResLink', 'lowResLink'];

    for (const field of urlFields) {
      if (typeof obj[field] === 'string' && isZillowImageUrl(obj[field])) {
        images.add(obj[field]);
      }
    }

    // Handle "mixedSources" arrays (Zillow's photo format)
    if (Array.isArray(obj.mixedSources)) {
      for (const src of obj.mixedSources) {
        if (src && typeof src.url === 'string' && isZillowImageUrl(src.url)) {
          images.add(src.url);
        }
      }
    }

    // Handle responsivePhotos arrays
    if (Array.isArray(obj.responsivePhotos)) {
      for (const photo of obj.responsivePhotos) {
        if (photo && Array.isArray(photo.mixedSources)) {
          // Pick the highest resolution
          const best = photo.mixedSources
            .filter(s => s && s.url)
            .sort((a, b) => (b.width || 0) - (a.width || 0))[0];
          if (best) images.add(best.url);
        }
      }
    }

    // Recurse into all object values
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object') walk(obj[key]);
    }
  }

  walk(data);

  // If still no images, try a brute-force regex on the stringified JSON
  if (images.size === 0) {
    const jsonStr = JSON.stringify(data);
    const re = /https?:\/\/[^"'\s]*zillowstatic\.com[^"'\s]*\.(?:jpg|jpeg|webp|png)/gi;
    let m;
    while ((m = re.exec(jsonStr)) !== null) {
      images.add(m[0]);
    }
  }

  return Array.from(images);
}

function isZillowImageUrl(url) {
  return url.includes('zillowstatic.com') ||
         url.includes('zillow.com') && /\.(jpg|jpeg|png|webp)/.test(url);
}

module.exports = { fetchZillowImages };
