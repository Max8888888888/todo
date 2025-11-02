#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { chromium } = require("@playwright/test");

dotenv.config();

const DEFAULT_USERNAME_SELECTORS = [
  "input[name='username']",
  "input#username",
  "input[name='userName']",
  "input[name='UserName']",
  "input[name='email']",
  "input#email",
  "input[name='user']"
];

const DEFAULT_PASSWORD_SELECTORS = [
  "input[name='password']",
  "input#password",
  "input[name='Password']",
  "input[name='pass']"
];

const DEFAULT_SUBMIT_SELECTORS = [
  "button[type='submit']",
  "input[type='submit']",
  "button:has-text('Sign In')",
  "button:has-text('Log In')",
  "button:has-text('Login')"
];

const DEFAULT_INVOICE_TABLE_SELECTORS = [
  "table",
  "table.invoices",
  "table#invoices"
];

const DEFAULT_DOWNLOAD_SELECTORS = [
  "a:has-text('Download')",
  "a[download]",
  "button:has-text('Download')",
  "button[title*='Download']"
];

const DEFAULT_OPTIONS = {
  baseUrl: "https://portal.fleetpass.com",
  loginPath: "/Account/Login",
  invoicesPath: "/Account/Invoices",
  headless: true,
  slowMo: 0,
  navigationTimeout: 45000,
  actionTimeout: 20000,
  downloadTimeout: 60000,
  usernameSelectors: DEFAULT_USERNAME_SELECTORS,
  passwordSelectors: DEFAULT_PASSWORD_SELECTORS,
  submitSelectors: DEFAULT_SUBMIT_SELECTORS,
  invoiceTableSelectors: DEFAULT_INVOICE_TABLE_SELECTORS,
  downloadSelectors: DEFAULT_DOWNLOAD_SELECTORS,
  waitForPostLogin: 8000,
  invoiceRowSelector: null,
  extraLog: false
};

function parseArgs(argv) {
  const result = {};
  let i = 0;
  while (i < argv.length) {
    const current = argv[i];
    if (!current.startsWith("--")) {
      i += 1;
      continue;
    }

    const [rawKey, rawValue] = current.replace(/^--/, "").split("=", 2);
    const key = rawKey.trim();
    if (rawValue !== undefined) {
      result[key] = rawValue;
      i += 1;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      i += 2;
    } else {
      result[key] = true;
      i += 1;
    }
  }

  return result;
}

function splitList(value) {
  if (!value) {
    return null;
  }

  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).toLowerCase().trim();
  if (["1", "true", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function toNumber(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function ensureAbsoluteDirectory(dirPath) {
  const resolved = path.isAbsolute(dirPath)
    ? dirPath
    : path.resolve(process.cwd(), dirPath);
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function ensureProtocol(url) {
  if (!url) {
    return url;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `https://${url}`;
}

function buildUrl(base, pathOrUrl) {
  if (!pathOrUrl) {
    return ensureProtocol(base);
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const normalizedBase = ensureProtocol(base);
  return new URL(pathOrUrl, normalizedBase.endsWith("/") ? normalizedBase : `${normalizedBase}/`).toString();
}

function escapeForHasText(value) {
  return String(value).replace(/"/g, '\\"');
}

function withFallback(list, fallback) {
  return list && list.length > 0 ? list : fallback;
}

function composeOptions() {
  const argv = parseArgs(process.argv.slice(2));
  const options = { ...DEFAULT_OPTIONS };

  options.baseUrl = argv["base-url"] || process.env.FLEETPASS_BASE_URL || options.baseUrl;
  options.loginPath = argv["login-path"] || process.env.FLEETPASS_LOGIN_PATH || options.loginPath;
  options.invoicesPath = argv["invoices-path"] || process.env.FLEETPASS_INVOICES_PATH || options.invoicesPath;
  options.loginUrl = argv["login-url"] || process.env.FLEETPASS_LOGIN_URL || null;
  options.invoicesUrl = argv["invoices-url"] || process.env.FLEETPASS_INVOICES_URL || null;
  options.username = argv.username || process.env.FLEETPASS_USERNAME;
  options.password = argv.password || process.env.FLEETPASS_PASSWORD;
  options.invoiceNumber = argv["invoice-number"] || process.env.FLEETPASS_INVOICE_NUMBER || null;
  options.invoiceDate = argv["invoice-date"] || process.env.FLEETPASS_INVOICE_DATE || null;
  options.invoiceRowSelector = argv["invoice-row-selector"] || process.env.FLEETPASS_INVOICE_ROW_SELECTOR || null;
  options.invoiceDownloadSelector = argv["invoice-download-selector"] || process.env.FLEETPASS_INVOICE_DOWNLOAD_SELECTOR || null;
  options.downloadDir = ensureAbsoluteDirectory(
    argv["download-dir"] || process.env.FLEETPASS_DOWNLOAD_DIR || path.join(process.cwd(), "downloads")
  );
  options.outputFilename = argv["output-filename"] || process.env.FLEETPASS_OUTPUT_FILENAME || null;
  options.headless = parseBoolean(argv.headless ?? process.env.FLEETPASS_HEADLESS, options.headless);
  options.slowMo = toNumber(argv.slowmo ?? process.env.FLEETPASS_SLOWMO, options.slowMo);
  options.navigationTimeout = toNumber(
    argv["navigation-timeout"] ?? process.env.FLEETPASS_NAVIGATION_TIMEOUT,
    options.navigationTimeout
  );
  options.actionTimeout = toNumber(
    argv["action-timeout"] ?? process.env.FLEETPASS_ACTION_TIMEOUT,
    options.actionTimeout
  );
  options.downloadTimeout = toNumber(
    argv["download-timeout"] ?? process.env.FLEETPASS_DOWNLOAD_TIMEOUT,
    options.downloadTimeout
  );
  options.waitForPostLogin = toNumber(
    argv["post-login-wait"] ?? process.env.FLEETPASS_POST_LOGIN_WAIT,
    options.waitForPostLogin
  );
  options.extraLog = parseBoolean(
    argv.debug ?? process.env.FLEETPASS_DEBUG ?? options.extraLog,
    options.extraLog
  );

  options.usernameSelectors = withFallback(
    splitList(argv["username-selectors"] || process.env.FLEETPASS_USERNAME_SELECTORS),
    options.usernameSelectors
  );
  options.passwordSelectors = withFallback(
    splitList(argv["password-selectors"] || process.env.FLEETPASS_PASSWORD_SELECTORS),
    options.passwordSelectors
  );
  options.submitSelectors = withFallback(
    splitList(argv["submit-selectors"] || process.env.FLEETPASS_SUBMIT_SELECTORS),
    options.submitSelectors
  );
  options.invoiceTableSelectors = withFallback(
    splitList(argv["invoice-table-selectors"] || process.env.FLEETPASS_INVOICE_TABLE_SELECTORS),
    options.invoiceTableSelectors
  );
  options.downloadSelectors = withFallback(
    splitList(argv["download-selectors"] || process.env.FLEETPASS_DOWNLOAD_SELECTORS),
    options.downloadSelectors
  );

  options.loginUrl = buildUrl(options.baseUrl, options.loginUrl || options.loginPath);
  options.invoicesUrl = buildUrl(options.baseUrl, options.invoicesUrl || options.invoicesPath);

  if (!options.username) {
    throw new Error("Missing FleetPass username. Provide --username or set FLEETPASS_USERNAME");
  }

  if (!options.password) {
    throw new Error("Missing FleetPass password. Provide --password or set FLEETPASS_PASSWORD");
  }

  if (!options.invoiceNumber && !options.invoiceDate && !options.invoiceRowSelector) {
    throw new Error(
      "Provide at least one of --invoice-number, --invoice-date, or --invoice-row-selector to identify the invoice"
    );
  }

  return options;
}

async function fillFirstMatching(page, selectors, value, description, log) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const count = await locator.count();
    if (count > 0) {
      if (log) {
        console.log(`Using ${description} selector: ${selector}`);
      }
      await locator.scrollIntoViewIfNeeded();
      await locator.click({ clickCount: 3, delay: 50 });
      await locator.fill(value);
      return selector;
    }
  }

  throw new Error(`Unable to locate ${description}. Tried: ${selectors.join(", ")}`);
}

async function clickFirstMatching(page, selectors, description, log) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const count = await locator.count();
    if (count > 0) {
      if (log) {
        console.log(`Clicking ${description} using selector: ${selector}`);
      }
      await locator.scrollIntoViewIfNeeded();
      await locator.click();
      return selector;
    }
  }

  throw new Error(`Unable to trigger ${description}. Tried: ${selectors.join(", ")}`);
}

async function waitForTable(page, selectors, timeout) {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, {
        timeout,
        state: "visible"
      });
      return selector;
    } catch (err) {
      // ignore and try next selector
    }
  }

  throw new Error(`Failed to locate invoice table. Tried: ${selectors.join(", ")}`);
}

async function locateInvoiceRow(page, options) {
  if (options.invoiceRowSelector) {
    const locator = page.locator(options.invoiceRowSelector).first();
    if ((await locator.count()) === 0) {
      throw new Error(`Custom invoice row selector returned no results: ${options.invoiceRowSelector}`);
    }
    return locator;
  }

  const searchValue = options.invoiceNumber || options.invoiceDate;
  const escaped = escapeForHasText(searchValue);
  const candidate = page.locator(`tr:has-text("${escaped}")`).first();
  if ((await candidate.count()) === 0) {
    throw new Error(`Could not find an invoice row containing: ${searchValue}`);
  }
  return candidate;
}

async function triggerDownload(page, rowLocator, options) {
  const selectors = options.invoiceDownloadSelector
    ? [options.invoiceDownloadSelector]
    : options.downloadSelectors;

  for (const selector of selectors) {
    const candidate = rowLocator.locator(selector).first();
    if ((await candidate.count()) > 0) {
      if (options.extraLog) {
        console.log(`Triggering download using row-scoped selector: ${selector}`);
      }
      const downloadPromise = page.waitForEvent("download", {
        timeout: options.downloadTimeout
      });
      await candidate.click();
      return await downloadPromise;
    }
  }

  for (const selector of selectors) {
    const candidate = page.locator(selector).first();
    if ((await candidate.count()) > 0) {
      if (options.extraLog) {
        console.log(`Triggering download using page-scoped selector: ${selector}`);
      }
      const downloadPromise = page.waitForEvent("download", {
        timeout: options.downloadTimeout
      });
      await candidate.click();
      return await downloadPromise;
    }
  }

  throw new Error(`Unable to find a download control. Tried: ${selectors.join(", ")}`);
}

function resolveFilename(options, suggested) {
  if (options.outputFilename) {
    return options.outputFilename;
  }

  if (options.invoiceNumber) {
    return `fleetpass-invoice-${options.invoiceNumber}.pdf`;
  }

  if (options.invoiceDate) {
    return `fleetpass-invoice-${options.invoiceDate.replace(/\s+/g, "-")}.pdf`;
  }

  if (suggested) {
    return suggested;
  }

  return `fleetpass-invoice-${Date.now()}.pdf`;
}

function uniquePath(baseDir, fileName) {
  const sanitized = fileName.replace(/[\/\\]/g, "_");
  let candidate = path.join(baseDir, sanitized);
  let counter = 1;
  const parsed = path.parse(candidate);
  while (fs.existsSync(candidate)) {
    candidate = path.join(parsed.dir, `${parsed.name}-${counter}${parsed.ext}`);
    counter += 1;
  }
  return candidate;
}

async function downloadInvoice(page, options) {
  await waitForTable(page, options.invoiceTableSelectors, options.navigationTimeout);
  const rowLocator = await locateInvoiceRow(page, options);
  await rowLocator.scrollIntoViewIfNeeded();
  const download = await triggerDownload(page, rowLocator, options);
  const targetPath = uniquePath(options.downloadDir, resolveFilename(options, download.suggestedFilename()));
  await download.saveAs(targetPath);
  console.log(`Invoice saved to ${targetPath}`);
}

async function login(page, options) {
  console.log(`Navigating to FleetPass login page: ${options.loginUrl}`);
  await page.goto(options.loginUrl, { waitUntil: "networkidle", timeout: options.navigationTimeout });

  await fillFirstMatching(
    page,
    options.usernameSelectors,
    options.username,
    "username field",
    options.extraLog
  );

  await fillFirstMatching(
    page,
    options.passwordSelectors,
    options.password,
    "password field",
    options.extraLog
  );

  await clickFirstMatching(page, options.submitSelectors, "login submit button", options.extraLog);

  if (options.waitForPostLogin > 0) {
    await page.waitForTimeout(options.waitForPostLogin);
  }

  const currentUrl = page.url();
  if (currentUrl.includes("login") || currentUrl === options.loginUrl) {
    const errorBanner = page.locator(".error, .validation-summary-errors");
    if ((await errorBanner.count()) > 0) {
      const message = (await errorBanner.first().innerText()).trim();
      throw new Error(`Login appears to have failed. Server message: ${message}`);
    }
  }
}

async function navigateToInvoices(page, options) {
  console.log(`Navigating to invoice page: ${options.invoicesUrl}`);
  await page.goto(options.invoicesUrl, {
    waitUntil: "networkidle",
    timeout: options.navigationTimeout
  });
}

async function run(options) {
  const browser = await chromium.launch({
    headless: options.headless,
    slowMo: Number.isFinite(options.slowMo) && options.slowMo > 0 ? options.slowMo : undefined
  });

  const context = await browser.newContext({ acceptDownloads: true });
  context.setDefaultTimeout(options.actionTimeout);

  const page = await context.newPage();

  try {
    await login(page, options);
    await navigateToInvoices(page, options);
    await downloadInvoice(page, options);
  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    const options = composeOptions();
    await run(options);
  } catch (err) {
    console.error("Failed to download FleetPass invoice:");
    console.error(err.message || err);
    if (process.env.FLEETPASS_DEBUG_STACK === "1" || process.env.FLEETPASS_DEBUG_STACK === "true") {
      console.error(err);
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  process.exitCode = 1;
});
