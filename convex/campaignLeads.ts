import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const addLeads = mutation({
  args: {
    campaignId: v.id("campaigns"),
    leadIds: v.array(v.id("leads")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let added = 0;

    for (const leadId of args.leadIds) {
      // Check if already added to avoid duplicates
      const existing = await ctx.db
        .query("campaignLeads")
        .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
        .filter((q) => q.eq(q.field("leadId"), leadId))
        .first();

      if (!existing) {
        await ctx.db.insert("campaignLeads", {
          campaignId: args.campaignId,
          leadId,
          addedAt: now,
        });
        added++;
      }
    }

    // Update campaign lead count
    const campaign = await ctx.db.get(args.campaignId);
    if (campaign) {
      await ctx.db.patch(args.campaignId, {
        leadCount: campaign.leadCount + added,
        updatedAt: Date.now(),
      });
    }

    return { added };
  },
});

export const getByCampaign = query({
  args: {
    campaignId: v.id("campaigns"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const campaignLeadsPage = await ctx.db
      .query("campaignLeads")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Enrich with lead data
    const enrichedPage = {
      ...campaignLeadsPage,
      page: await Promise.all(
        campaignLeadsPage.page.map(async (cl) => {
          const lead = await ctx.db.get(cl.leadId);
          return { ...cl, lead };
        })
      ),
    };

    return enrichedPage;
  },
});

export const removeLead = mutation({
  args: {
    campaignId: v.id("campaigns"),
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("campaignLeads")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("leadId"), args.leadId))
      .first();

    if (record) {
      await ctx.db.delete(record._id);

      // Update campaign lead count
      const campaign = await ctx.db.get(args.campaignId);
      if (campaign && campaign.leadCount > 0) {
        await ctx.db.patch(args.campaignId, {
          leadCount: campaign.leadCount - 1,
          updatedAt: Date.now(),
        });
      }
    }
  },
});
