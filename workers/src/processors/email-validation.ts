import { promises as dns } from "dns";
import { ConvexClient } from "../convex-client";
import { logger } from "../utils/logger";

// Well-known email providers that indicate valid MX infrastructure
const KNOWN_PROVIDERS = [
  "google.com",
  "googlemail.com",
  "outlook.com",
  "microsoft.com",
  "office365.us",
  "protection.outlook.com",
  "pphosted.com",
  "mimecast.com",
  "barracudanetworks.com",
  "messagelabs.com",
  "protonmail.ch",
  "zoho.com",
  "secureserver.net",
  "emailsrvr.com",
];

// Common disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwaway.email",
  "yopmail.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "dispostable.com",
  "temp-mail.org",
  "fakeinbox.com",
  "trashmail.com",
  "maildrop.cc",
  "10minutemail.com",
  "mailnesia.com",
  "mintemail.com",
  "tempinbox.com",
  "mohmal.com",
  "burpcollaborator.net",
  "mailcatch.com",
]);

// RFC 5322 email regex (simplified but robust)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

interface ValidationResult {
  email: string;
  isValid: boolean;
  score: number;
  formatValid: boolean;
  hasMxRecords: boolean;
  isKnownProvider: boolean;
  isDisposable: boolean;
  mxRecords: string[];
  details: string;
}

async function validateEmail(email: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    email,
    isValid: false,
    score: 0,
    formatValid: false,
    hasMxRecords: false,
    isKnownProvider: false,
    isDisposable: false,
    mxRecords: [],
    details: "",
  };

  // Step 1: Format validation (20 points)
  if (!EMAIL_REGEX.test(email)) {
    result.details = "Invalid email format";
    return result;
  }
  result.formatValid = true;
  result.score += 20;

  // Extract domain
  const domain = email.split("@")[1].toLowerCase();

  // Step 2: Disposable domain check (20 points if NOT disposable)
  if (DISPOSABLE_DOMAINS.has(domain)) {
    result.isDisposable = true;
    result.details = `Disposable email domain: ${domain}`;
    // formatValid but disposable, score stays at 20
    return result;
  }
  result.score += 20;

  // Step 3: DNS MX record lookup (40 points)
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      result.hasMxRecords = true;
      result.mxRecords = mxRecords
        .sort((a, b) => a.priority - b.priority)
        .map((mx) => mx.exchange.toLowerCase());
      result.score += 40;

      // Step 4: Known provider check (20 points)
      const isKnown = result.mxRecords.some((mx) =>
        KNOWN_PROVIDERS.some((provider) => mx.includes(provider))
      );
      if (isKnown) {
        result.isKnownProvider = true;
        result.score += 20;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // DNS lookup can fail for various reasons: NXDOMAIN, timeout, etc.
    if (message.includes("ENOTFOUND") || message.includes("ENODATA")) {
      result.details = `No MX records found for domain: ${domain}`;
    } else if (message.includes("ETIMEOUT")) {
      result.details = `DNS timeout for domain: ${domain}`;
      // Give partial credit on timeout since domain might be valid
      result.score += 10;
    } else {
      result.details = `DNS lookup error for ${domain}: ${message}`;
    }
  }

  // Determine overall validity (threshold: 40 = format valid + not disposable)
  result.isValid = result.score >= 40;

  if (!result.details) {
    const parts = [];
    if (result.formatValid) parts.push("format OK");
    if (result.hasMxRecords) parts.push(`${result.mxRecords.length} MX record(s)`);
    if (result.isKnownProvider) parts.push("known provider");
    if (!result.isDisposable) parts.push("not disposable");
    result.details = parts.join(", ");
  }

  return result;
}

export async function processEmailValidation(client: ConvexClient, job: any): Promise<any> {
  const { leadId, email } = job.payload;

  logger.info(`Validating email: ${email}`);

  const result = await validateEmail(email);

  logger.info(
    `Email ${email}: score=${result.score}, valid=${result.isValid} (${result.details})`
  );

  // Update the lead status based on validation result
  const newStatus = result.isValid ? "validated" : "invalid";
  await client.updateLeadStatus(leadId, newStatus, {
    emailValidation: {
      score: result.score,
      formatValid: result.formatValid,
      hasMxRecords: result.hasMxRecords,
      isKnownProvider: result.isKnownProvider,
      isDisposable: result.isDisposable,
      mxRecords: result.mxRecords,
      details: result.details,
      validatedAt: Date.now(),
    },
  });

  return {
    email,
    score: result.score,
    isValid: result.isValid,
    details: result.details,
  };
}
