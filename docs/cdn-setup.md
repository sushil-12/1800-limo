# Putting CloudFront in front of www.1800limo.com

The site is served by Apache on one EC2 instance (`18.116.160.146`, us-east-2)
and DNS is on Route 53. CloudFront takes the static bundles off that box and
serves them from edge locations close to the visitor. Apache stays the origin,
and `src/.htaccess` keeps deciding redirects, 404s and crawler headers.

## Before you start

- Deploy a build made with `npm run build-aws` first. It writes the `.br`/`.gz`
  files and the `Cache-Control` headers that CloudFront relies on.
- Check that the origin's TLS certificate covers `www.1800limo.com` and
  `1800limo.com`. It already does today.

## 1. Certificate (ACM, region **us-east-1**)

CloudFront only accepts certificates from us-east-1. Request a public
certificate for `1800limo.com` and `www.1800limo.com`, then validate it with the
"Create records in Route 53" button.

## 2. Origin hostname

CloudFront needs a DNS name for the origin, not an IP address. In Route 53, add:

| Name | Type | Value |
|---|---|---|
| `origin.1800limo.com` | A | `18.116.160.146` |

## 3. Distribution

| Setting | Value |
|---|---|
| Origin domain | `origin.1800limo.com` |
| Origin protocol | **HTTPS only** |
| Alternate domain names | `www.1800limo.com`, `1800limo.com` |
| Certificate | the one from step 1 |
| Viewer protocol policy | Redirect HTTP to HTTPS |
| Compress objects automatically | Yes |
| Default root object | *(leave empty, Apache handles `/`)* |

**Default behaviour (`*`)**
- Cache policy: `UseOriginCacheControlHeaders`
- Origin request policy: `AllViewer`
- Allowed methods: `GET, HEAD, OPTIONS`

You don't need separate behaviours for the bundles. Apache already sends
`max-age=31536000, immutable` for hashed files and `no-cache` for `index.html`,
and the cache policy above follows those headers.

### Why the Host header must be forwarded (`AllViewer`)

`.htaccess` decides almost everything from the `Host` header:

- `1800limo.com` → 301 to `www`.
- Any host that isn't `(www.)1800limo.com` is treated as **staging**. It gets
  `X-Robots-Tag: noindex` on every page and a `Disallow: /` robots.txt.

If CloudFront sent `origin.1800limo.com` as the Host, Apache would label the
whole live site as staging, and Google would drop it from search. `AllViewer`
forwards the visitor's real Host, which avoids that. It also means the origin
certificate is checked against `www.1800limo.com`, which it covers.

## 4. Switch DNS

Change these two Route 53 records to **A — Alias → the CloudFront distribution**:

- `www.1800limo.com`
- `1800limo.com`

Leave `api.1800limo.com` and every other record as they are.

## 5. Check it

```bash
# Served by CloudFront, compressed, cached for a year
curl -sI -H 'Accept-Encoding: br' https://www.1800limo.com/main.<hash>.js \
  | grep -iE 'x-cache|content-encoding|cache-control'

# Shell is not cached; no noindex on production
curl -sI https://www.1800limo.com/fleet | grep -iE 'cache-control|x-robots'

# Bare host still redirects; Apple's file still served raw
curl -sI https://1800limo.com/fleet | grep -i location
curl -sI https://1800limo.com/.well-known/apple-app-site-association | grep -i content-type
```

The second request for a bundle should show `x-cache: Hit from cloudfront`.
Then run PageSpeed Insights again.

## Deploys

You don't need to invalidate the cache after a deploy. Bundle names change on
every build, and `index.html` is always revalidated. Only invalidate (`/*`) if
you replace a file under `src/assets` without renaming it and need the change
visible before its 1-day cache expires.
