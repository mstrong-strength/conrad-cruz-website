// Conrad Cruz Real Estate Services — Live MLS Listings
// Fetches active listings for office 7110 from WFRMLS RESO Web API
// Adapted from arv-engine/mls_client.py pattern

const RESO_BASE = "https://resoapi.utahrealestate.com/reso/odata";

// In-memory cache: { data, timestamp }
let cache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Fields we need from the Property endpoint
const SELECT_FIELDS = [
  "ListingKeyNumeric",
  "ListPrice",
  "StandardStatus",
  "BedroomsTotal",
  "BathroomsTotalInteger",
  "LivingArea",
  "PropertySubType",
  "PropertyType",
  "UnparsedAddress",
  "City",
  "StateOrProvince",
  "PostalCode",
  "ListAgentFullName",
  "ListOfficeMlsId",
].join(",");

function formatPrice(price) {
  if (!price && price !== 0) return "";
  return "$" + price.toLocaleString("en-US");
}

function formatNumber(n) {
  if (!n && n !== 0) return "";
  return n.toLocaleString("en-US");
}

// Map PropertySubType to human-readable label
function humanPropertyType(subType, propType) {
  const label = subType || propType || "";
  const map = {
    "Single Family Residence": "Single Family",
    "Residential Income": "Multi-Family",
    "Condominium": "Condo",
    "Townhouse": "Townhouse",
  };
  return map[label] || label || "Residential";
}

// Build the public UtahRealEstate.com listing URL
function publicUrl(listingKey) {
  return `https://www.utahrealestate.com/${listingKey}`;
}

async function fetchListings(token) {
  // StandardStatus uses flags-enum syntax per RESO spec — must use 'has' not 'eq'
  const filter = [
    "ListOfficeMlsId eq '7110'",
    "StandardStatus has Odata.Models.StandardStatus'Active'",
  ].join(" and ");

  const params = new URLSearchParams({
    $filter: filter,
    $select: SELECT_FIELDS,
    $expand: "Media($select=MediaURL,PreferredPhotoYN;$filter=PreferredPhotoYN eq true;$top=1)",
    $orderby: "ListPrice desc",
    $top: "20",
  });

  const url = `${RESO_BASE}/Property?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`RESO API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.value || [];
}

function transformListings(raw) {
  return raw.map((listing) => {
    // Extract preferred photo URL from expanded Media
    const media = listing.Media || [];
    const preferredPhoto = media.find((m) => m.PreferredPhotoYN === true) || media[0];
    const photoUrl = preferredPhoto ? preferredPhoto.MediaURL : null;

    const address = (listing.UnparsedAddress || "").trim();
    const city = (listing.City || "").trim();
    const state = (listing.StateOrProvince || "UT").trim();
    const zip = (listing.PostalCode || "").trim();

    return {
      listingKey: String(listing.ListingKeyNumeric || ""),
      mlsNumber: String(listing.ListingKeyNumeric || ""),
      address: address,
      city: city,
      state: state,
      zip: zip,
      price: listing.ListPrice || 0,
      priceFormatted: formatPrice(listing.ListPrice),
      status: listing.StandardStatus || "Active",
      beds: listing.BedroomsTotal || 0,
      baths: listing.BathroomsTotalInteger || 0,
      sqft: listing.LivingArea || 0,
      sqftFormatted: formatNumber(listing.LivingArea),
      propertyType: humanPropertyType(listing.PropertySubType, listing.PropertyType),
      propertyTypeRaw: listing.PropertySubType || listing.PropertyType || "",
      listingAgent: listing.ListAgentFullName || "",
      photoUrl: photoUrl,
      photoAlt: `${address}, ${city}`,
      publicUrl: publicUrl(listing.ListingKeyNumeric),
    };
  });
}

exports.handler = async function () {
  // Check cache first
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=900",
      },
      body: JSON.stringify(cache.data),
    };
  }

  const token = process.env.WFRMLS_API_TOKEN;

  if (!token) {
    console.error("WFRMLS_API_TOKEN not configured");
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "error",
        message: "API not configured",
        listings: [],
      }),
    };
  }

  try {
    const raw = await fetchListings(token);
    const listings = transformListings(raw);

    const result = {
      status: "ok",
      count: listings.length,
      listings: listings,
    };

    // Update cache
    cache = { data: result, timestamp: now };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=900",
      },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("Listings fetch failed:", err.message);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "error",
        message: "Listings temporarily unavailable",
        listings: [],
      }),
    };
  }
};
