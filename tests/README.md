# ToDo Application Tests

The included [Playwright](https://playwright.dev/) smoke test will hit the ToDo app web endpoint, create, and delete an item.

## Run Tests

The endpoint it hits will be discovered in this order:

1. Value of `REACT_APP_WEB_BASE_URL` environment variable
1. Value of `REACT_APP_WEB_BASE_URL` found in default .azure environment
1. Defaults to `http://localhost:3000`

To run the tests:

1. CD to /tests
1. Run `npm i && npx playwright install`
1. Run `npx playwright test`

You can use the `--headed` flag to open a browser when running the tests.

## Debug Tests

Add the `--debug` flag to run with debugging enabled. You can find out more info here: https://playwright.dev/docs/next/test-cli#reference

```bash
npx playwright test --debug
```

More debugging references: https://playwright.dev/docs/debug and https://playwright.dev/docs/trace-viewer

## FleetPass Invoice Downloader

A Playwright-powered helper script lives at `tests/scripts/download-fleetpass-invoice.js`. It logs into FleetPass, navigates to the invoice list, and downloads a matching invoice. Credentials and matching criteria are supplied via environment variables or CLI flags.

### Setup

1. `cd tests`
2. Install dependencies and browsers once: `npm install && npx playwright install`
3. Create a `.env` file (optional) with:

   ```dotenv
   FLEETPASS_USERNAME=your_username
   FLEETPASS_PASSWORD=your_password
   FLEETPASS_INVOICE_NUMBER=12345678
   # Optional tweaks
   # FLEETPASS_DOWNLOAD_DIR=./downloads
   # FLEETPASS_HEADLESS=false
   ```

### Usage

- Run with npm script (loads `.env` automatically via `dotenv`):

  ```bash
  npm run download:fleetpass
  ```

- Or pass parameters directly:

  ```bash
  node ./scripts/download-fleetpass-invoice.js \
    --username your_username \
    --password your_password \
    --invoice-number 12345678 \
    --download-dir ./invoices
  ```

### Advanced configuration

- Override login/endpoints: `--login-url`, `--invoices-url`
- Match by date or a custom locator: `--invoice-date 2025-09` or `--invoice-row-selector "tr:has-text('September 2025')"`
- Provide alternative form/download selectors if FleetPass markup differs: `--username-selectors "#userId,input[name='UserId']"`
- Add `--headless false` or `--slowmo 250` for debugging, `--debug` to log the selectors used

Downloaded files default to `tests/downloads/` with a descriptive filename. Existing files are never overwritten; numeric suffixes are appended when needed.