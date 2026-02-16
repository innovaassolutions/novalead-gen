# Cold Email Domain Strategy

## Core Principle

Your main domain (`innovaas.co`) and product domains should **never** send cold email. If a cold domain gets flagged/blacklisted, it's disposable — your real brand stays untouched.

## Domain Strategy for NovaVoice (as example)

You want **3-5 lookalike domains per product** for inbox rotation. The domains should look credible but be clearly separate:

| Domain | Purpose |
|---|---|
| `novavoiceai.com` | Primary cold outreach |
| `getnovavoice.com` | Secondary rotation |
| `trynovavoice.com` | Tertiary rotation |
| `novavoice.io` | Additional rotation |
| `novavoicehq.com` | Additional rotation |

Each domain gets **2-3 email accounts** (e.g., `todd@`, `hello@`, `team@`), giving you 6-15 sending accounts per product at 30-50 sends/day each.

## Naming Patterns That Work

Pick 2-3 patterns and apply across all products:

```
get[product].com      → getnovavoice.com, getnovacrm.com
try[product].com      → trynovavoice.com, trynovacrm.com
[product]ai.com       → novavoiceai.com, novacrmai.com
[product]hq.com       → novavoicehq.com, novacrmhq.com
use[product].com      → usenovavoice.com, usenovacrm.com
[product].io           → novavoice.io, novacrm.io (if available)
```

## Across All Products

| Product | Cold Domains (3-5 each) |
|---|---|
| NovaVoice | novavoiceai.com, getnovavoice.com, trynovavoice.com |
| NovaCRM | novacrmai.com, getnovacrm.com, trynovacrm.com |
| NovaKMS | novakmsai.com, getnovakms.com, trynovakms.com |
| NovaPredict | novapredictai.com, getnovapredict.com, trynovapredict.com |

That's ~12-20 domains total. At ~$10/year each, it's $120-200/year.

## Important Setup Steps

1. **DNS records** — Set up SPF, DKIM, and DMARC on every cold domain (Instantly guides you through this)
2. **Redirect** — Point each cold domain's website to your real product page (e.g., `novavoiceai.com` → `innovaas.co/novavoice`). This adds legitimacy if prospects check
3. **Warmup first** — Add all accounts to Instantly's warmup pool for 2-3 weeks before sending any campaigns
4. **Stagger purchases** — Don't register all domains on the same day from the same registrar. Spread across a few days/registrars
5. **Google Workspace** — Best provider for cold email accounts ($7/user/mo). Outlook/Microsoft 365 also works

## What This Means for LeadGen

In the LeadGen app, when you create a campaign targeting, say, dental practices for NovaVoice, you'd configure it in Instantly with the `novavoiceai.com` sending accounts. The LeadGen system pushes leads to Instantly via API — it doesn't need to know about the domains. That's all managed on Instantly's side (account linking, rotation, warmup).
