"use client";

import { useEffect, useState } from "react";
import {
  listAllCampaignsForAdmin,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from "@/lib/firestore/campaigns";
import type { Campaign, ProductMedia } from "@/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MediaUploader } from "@/components/admin/MediaUploader";

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [linkHref, setLinkHref] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Shop now");
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setCampaigns(await listAllCampaignsForAdmin());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createCampaign({
        title,
        subtitle,
        imageUrl: media[0]?.url,
        linkHref,
        ctaLabel,
        startsAt: startsAt ? new Date(startsAt).getTime() : null,
        endsAt: endsAt ? new Date(endsAt).getTime() : null,
        enabled: true,
        sortOrder: campaigns.length,
      });
      setTitle("");
      setSubtitle("");
      setLinkHref("");
      setMedia([]);
      setStartsAt("");
      setEndsAt("");
      setShowForm(false);
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Campaigns &amp; banners</h1>
          <p className="text-sm text-ink-muted">
            Promotional banners shown on the homepage. Scheduled by date, toggled on/off anytime.
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ New campaign"}</Button>
      </div>

      {showForm ? (
        <form onSubmit={handleCreate} className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
          <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm" />
          <input placeholder="Subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm" />
          <div className="grid gap-2 sm:grid-cols-2">
            <input placeholder="Link (e.g. /shop?category=deals)" value={linkHref} onChange={(e) => setLinkHref(e.target.value)} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
            <input placeholder="Button label" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="rounded-card border border-surface-muted px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-ink-muted">
              Starts (optional)
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 w-full rounded-card border border-surface-muted px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-ink-muted">
              Ends (optional)
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-1 w-full rounded-card border border-surface-muted px-3 py-2 text-sm" />
            </label>
          </div>
          <MediaUploader folder="campaigns" media={media} onChange={setMedia} />
          <Button type="submit" size="sm" loading={creating}>Create campaign</Button>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet." description="Create one to feature it on the homepage." />
      ) : (
        <ul className="space-y-2">
          {campaigns.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-card border border-surface-muted bg-surface p-4">
              <div>
                <p className="font-medium text-ink">{c.title}</p>
                <p className="text-xs text-ink-muted">
                  {c.startsAt ? new Date(c.startsAt).toLocaleDateString() : "starts now"} →{" "}
                  {c.endsAt ? new Date(c.endsAt).toLocaleDateString() : "no end date"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    await updateCampaign(c.id, { enabled: !c.enabled });
                    refresh();
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${c.enabled ? "bg-brand-light text-brand-dark" : "bg-surface-muted text-ink-muted"}`}
                >
                  {c.enabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  onClick={async () => {
                    await deleteCampaign(c.id);
                    refresh();
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
