# Conrad Cruz Real Estate Services — Website

Brokerage website for Conrad Cruz Real Estate Services, a Utah real estate brokerage led by Matt Strong (Principal Broker).

## Structure

```
index.html              Single-page site (inline CSS/JS)
llms.txt                AI crawler content file
robots.txt              Search engine directives
sitemap.xml             XML sitemap
netlify.toml            Netlify build + headers config
netlify/functions/
  listings.js           Serverless function — fetches live MLS listings
assets/
  logo-full.png         Full lockup logo
  logo-mark.png         Icon mark only
  logo-workmark.png     Wordmark + sub-label
  headshot-matt.jpg     Matt Strong headshot
```

## Deploy

Deployed via GitHub → Netlify auto-deploy on push to `main`.

## Environment Variables (Netlify Dashboard)

| Variable | Description |
|---|---|
| `WFRMLS_API_TOKEN` | Bearer token for WFRMLS RESO Web API (UtahRealEstate.com). **Never commit this.** |

Set in Netlify → Site settings → Environment variables.

## MLS Integration

The `listings.js` function queries the WFRMLS RESO Web API for active listings under office MLS ID `7110` (Conrad Cruz Real Estate Services). Results are cached in-memory for 15 minutes and edge-cached via `Cache-Control` headers.

The front end calls `/api/listings` (redirected to the Netlify function) on page load and renders a card grid. If the API is unavailable or unconfigured, the site degrades gracefully to an empty-state message.
