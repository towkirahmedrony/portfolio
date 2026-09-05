import { AdminPage } from "@/components/admin/admin-page";
import { PhotoUploadField } from "@/components/admin/photo-upload-field";
import { saveAdminAvatar } from "@/lib/admin-profile-actions";
import { requireAdmin } from "@/lib/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminProfilePage() {
  const user = await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, display_name, avatar_url, phone, company_name, job_title")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AdminPage
      title="Profile"
      description="Admin account details and photo. Only authenticated admins can upload or replace this image."
    >
      <section className="rounded-3xl border border-card-border bg-card p-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Full name</dt>
            <dd className="text-foreground">{profile?.full_name || user.displayName}</dd>
          </div>
          <div>
            <dt className="text-muted">Display name</dt>
            <dd className="text-foreground">{profile?.display_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Email</dt>
            <dd className="text-foreground">{user.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Phone</dt>
            <dd className="text-foreground">{profile?.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Company</dt>
            <dd className="text-foreground">{profile?.company_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Job title</dt>
            <dd className="text-foreground">{profile?.job_title || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <PhotoUploadField
              folder="profile"
              entityId={user.id}
              currentUrl={profile?.avatar_url}
              label="Profile photo"
              hint="Upload from your gallery or files. Saved to this admin account immediately."
              persist={saveAdminAvatar}
            />
          </div>
        </dl>
      </section>
    </AdminPage>
  );
}
