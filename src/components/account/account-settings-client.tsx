"use client";

import { useState } from "react";

type Props = {
  profile: {
    id: string;
    email: string;
    name: string;
    companyName: string | null;
  };
};

export function AccountSettingsClient({ profile }: Props) {
  const [name, setName] = useState(profile.name);
  const [companyName, setCompanyName] = useState(profile.companyName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile() {
    setProfileMessage(null);
    setSavingProfile(true);

    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        companyName
      })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setProfileMessage(payload?.message ?? `Profile update failed with status ${response.status}.`);
      setSavingProfile(false);
      return;
    }

    setProfileMessage(payload?.message ?? "Profile updated.");
    setSavingProfile(false);
  }

  async function changePassword() {
    setPasswordMessage(null);
    setSavingPassword(true);

    const response = await fetch("/api/account/password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setPasswordMessage(payload?.message ?? `Password update failed with status ${response.status}.`);
      setSavingPassword(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setPasswordMessage(payload?.message ?? "Password updated.");
    setSavingPassword(false);
  }

  return (
    <section className="section grid-2">
      <div className="card">
        <p className="eyebrow">Profile</p>
        <h2>Account details</h2>
        <div className="form-grid">
          <label className="field">
            <span>Contact name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">
            <span>Company</span>
            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          </label>
          <label className="field">
            <span>Email</span>
            <input value={profile.email} disabled />
          </label>
        </div>
        <div className="actions">
          <button className="button primary" type="button" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save profile"}
          </button>
        </div>
        {profileMessage ? <p className="muted">{profileMessage}</p> : null}
      </div>

      <div className="card">
        <p className="eyebrow">Security</p>
        <h2>Change password</h2>
        <div className="form-grid">
          <label className="field">
            <span>Current password</span>
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </label>
          <label className="field">
            <span>New password</span>
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </label>
        </div>
        <div className="actions">
          <button className="button primary" type="button" onClick={changePassword} disabled={savingPassword}>
            {savingPassword ? "Updating..." : "Update password"}
          </button>
        </div>
        {passwordMessage ? <p className="muted">{passwordMessage}</p> : null}
      </div>
    </section>
  );
}
