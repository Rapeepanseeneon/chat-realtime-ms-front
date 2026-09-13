import { redirect } from "next/navigation";
import { BrandLogo } from "../../../components/BrandLogo";
import { ProfileForm } from "../../../components/ProfileForm";
import { getCurrentUser } from "../../../lib/auth";

export default async function EditProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="site-shell">
      <section className="auth-card" aria-labelledby="profile-title">
        <div className="auth-brand">
          <BrandLogo decorative />
          <span>Pb Messenger</span>
        </div>
        <p className="eyebrow">Your account</p>
        <h1 id="profile-title">Edit Profile</h1>
        <p className="card-copy">
          Keep your display name and email address up to date.
        </p>
        <ProfileForm username={user.username} email={user.email} />
      </section>
    </main>
  );
}
