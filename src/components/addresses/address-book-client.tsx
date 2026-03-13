"use client";

import { useEffect, useRef, useState } from "react";
import type { AddressValidationResult, SavedAddressSummary } from "@/lib/domain-types";
import { COUNTRY_OPTIONS } from "@/lib/countries";

type AddressDraft = {
  label: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  isDefault: boolean;
};

function emptyDraft(): AddressDraft {
  return {
    label: "",
    name: "",
    company: "",
    phone: "",
    email: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    countryCode: "US",
    isDefault: false
  };
}

function toDraft(address?: SavedAddressSummary | null): AddressDraft {
  if (!address) {
    return emptyDraft();
  }

  return {
    label: address.label,
    name: address.name,
    company: address.company ?? "",
    phone: address.phone ?? "",
    email: address.email ?? "",
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    isDefault: address.isDefault
  };
}

export function AddressBookClient({ initialAddresses }: { initialAddresses: SavedAddressSummary[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [selectedId, setSelectedId] = useState(initialAddresses[0]?.id ?? "new");
  const [draft, setDraft] = useState<AddressDraft>(toDraft(initialAddresses[0] ?? null));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [validation, setValidation] = useState<AddressValidationResult | null>(null);
  const [validationPending, setValidationPending] = useState(false);
  const [postalLookupMessage, setPostalLookupMessage] = useState<string | null>(null);
  const lastPostalLookup = useRef("");

  const selected = addresses.find((address) => address.id === selectedId) ?? null;

  function chooseAddress(id: string) {
    if (id === "new") {
      setSelectedId("new");
      setDraft(emptyDraft());
      setMessage(null);
      setValidation(null);
      return;
    }

    const next = addresses.find((address) => address.id === id);
    if (!next) {
      return;
    }

    setSelectedId(id);
    setDraft(toDraft(next));
    setMessage(null);
    setValidation(null);
  }

  function updateField<K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) {
    setValidation(null);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    const countryCode = draft.countryCode.trim().toUpperCase();
    const postalCode = draft.postalCode.trim();
    const lookupKey = `${countryCode}:${postalCode}`;

    if (postalCode.length < 3 || lastPostalLookup.current === lookupKey) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const response = await fetch(`/api/postal-lookup?countryCode=${encodeURIComponent(countryCode)}&postalCode=${encodeURIComponent(postalCode)}`);
      const body = await response.json().catch(() => null);
      lastPostalLookup.current = lookupKey;

      if (!response.ok || !body?.location) {
        setPostalLookupMessage(null);
        return;
      }

      setDraft((current) => {
        if (current.countryCode.trim().toUpperCase() !== countryCode || current.postalCode.trim() !== postalCode) {
          return current;
        }

        return {
          ...current,
          city: body.location.city,
          state: body.location.state || current.state,
          countryCode: body.location.countryCode || current.countryCode
        };
      });
      setPostalLookupMessage(`Auto-filled ${body.location.city}${body.location.state ? `, ${body.location.state}` : ""} from postal code.`);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [draft.countryCode, draft.postalCode]);

  async function validateAddress() {
    setValidationPending(true);
    setMessage(null);
    setValidation(null);

    const response = await fetch("/api/address-validation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        address: {
          name: draft.name,
          company: draft.company,
          line1: draft.line1,
          line2: draft.line2,
          city: draft.city,
          state: draft.state,
          postalCode: draft.postalCode,
          countryCode: draft.countryCode
        }
      })
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.validation) {
      setMessage(body?.message ?? `Address validation failed with status ${response.status}.`);
      setValidationPending(false);
      return;
    }

    setValidation(body.validation as AddressValidationResult);
    setValidationPending(false);
  }

  function applyCandidate(index: number) {
    const candidate = validation?.candidates[index];
    if (!candidate) {
      return;
    }

    setDraft((current) => ({
      ...current,
      line1: candidate.line1,
      line2: candidate.line2 ?? "",
      city: candidate.city,
      state: candidate.state,
      postalCode: candidate.postalCodeExtended
        ? `${candidate.postalCode}-${candidate.postalCodeExtended}`
        : candidate.postalCode,
      countryCode: candidate.countryCode
    }));
  }

  async function saveAddress() {
    setPending(true);
    setMessage(null);

    const response = await fetch(selected ? `/api/addresses/${selected.id}` : "/api/addresses", {
      method: selected ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(draft)
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.address) {
      setMessage(body?.message ?? `Address save failed with status ${response.status}.`);
      setPending(false);
      return;
    }

    const saved = body.address as SavedAddressSummary;
    setAddresses((current) => {
      const withoutCurrent = current.filter((address) => address.id !== saved.id).map((address) => ({
        ...address,
        isDefault: saved.isDefault ? false : address.isDefault
      }));
      return [saved, ...withoutCurrent].sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || right.createdAt.localeCompare(left.createdAt));
    });
    setSelectedId(saved.id);
    setDraft(toDraft(saved));
    setMessage(body.message ?? "Address saved.");
    setPending(false);
  }

  async function removeAddress() {
    if (!selected) {
      return;
    }

    setPending(true);
    setMessage(null);

    const response = await fetch(`/api/addresses/${selected.id}`, {
      method: "DELETE"
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(body?.message ?? `Address delete failed with status ${response.status}.`);
      setPending(false);
      return;
    }

    const remaining = addresses.filter((address) => address.id !== selected.id);
    setAddresses(remaining);
    setSelectedId(remaining[0]?.id ?? "new");
    setDraft(toDraft(remaining[0] ?? null));
    setMessage(body?.message ?? "Address deleted.");
    setPending(false);
  }

  return (
    <section className="section grid-2">
      <div className="card">
        <p className="eyebrow">Address book</p>
        <h2>Saved ship-to addresses</h2>
        <p className="muted">Store common recipients once, mark a default, and reuse them later from the dashboard.</p>
        <div className="actions">
          <button className="button" type="button" onClick={() => chooseAddress("new")}>New address</button>
        </div>
        <div className="table" style={{ marginTop: "16px" }}>
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Recipient</th>
                <th>Destination</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {addresses.length ? addresses.map((address) => (
                <tr key={address.id} onClick={() => chooseAddress(address.id)} style={{ cursor: "pointer", background: address.id === selectedId ? "rgba(210, 163, 77, 0.12)" : undefined }}>
                  <td>{address.label}</td>
                  <td>
                    <div>{address.name}</div>
                    {address.company ? <div className="muted">{address.company}</div> : null}
                  </td>
                  <td>{address.city}, {address.state} {address.postalCode}</td>
                  <td>{address.isDefault ? "Yes" : "-"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4}>No saved addresses yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow">{selected ? "Edit address" : "New address"}</p>
        <h2>{selected ? draft.label || selected.label : "Create saved address"}</h2>
        <div className="form-grid">
          <label className="field"><span>Label</span><input value={draft.label} onChange={(event) => updateField("label", event.target.value)} placeholder="Amazon returns, Office, Warehouse B" /></label>
          <label className="field"><span>Recipient name</span><input value={draft.name} onChange={(event) => updateField("name", event.target.value)} /></label>
          <label className="field"><span>Company</span><input value={draft.company} onChange={(event) => updateField("company", event.target.value)} /></label>
          <label className="field"><span>Phone</span><input value={draft.phone} onChange={(event) => updateField("phone", event.target.value)} /></label>
          <label className="field"><span>Email</span><input value={draft.email} onChange={(event) => updateField("email", event.target.value)} /></label>
          <label className="field">
            <span>Country</span>
            <select value={draft.countryCode} onChange={(event) => updateField("countryCode", event.target.value.toUpperCase())}>
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="field"><span>Line 1</span><input value={draft.line1} onChange={(event) => updateField("line1", event.target.value)} /></label>
          <label className="field"><span>Line 2</span><input value={draft.line2} onChange={(event) => updateField("line2", event.target.value)} /></label>
          <label className="field"><span>City</span><input value={draft.city} onChange={(event) => updateField("city", event.target.value)} /></label>
          <label className="field"><span>State</span><input value={draft.state} onChange={(event) => updateField("state", event.target.value)} /></label>
          <label className="field"><span>Postal code</span><input value={draft.postalCode} onChange={(event) => updateField("postalCode", event.target.value)} /></label>
          <label className="field"><span>Default recipient</span><select value={draft.isDefault ? "yes" : "no"} onChange={(event) => updateField("isDefault", event.target.value === "yes")}><option value="no">No</option><option value="yes">Yes</option></select></label>
        </div>
        {postalLookupMessage ? <p className="muted">{postalLookupMessage}</p> : null}
        <div className="actions">
          <button className="button" type="button" onClick={validateAddress} disabled={pending || validationPending}>
            {validationPending ? "Validating..." : "Validate address"}
          </button>
          <button className="button primary" type="button" onClick={saveAddress} disabled={pending}>{pending ? "Saving..." : selected ? "Save changes" : "Create address"}</button>
          {selected ? <button className="button" type="button" onClick={removeAddress} disabled={pending}>Delete address</button> : null}
        </div>
        {validation ? (
          <div className="card" style={{ marginTop: "16px", background: "rgba(255, 250, 240, 0.55)" }}>
            <p className="eyebrow">Address validation</p>
            <h3 style={{ marginTop: 0 }}>
              {validation.status === "valid"
                ? "Address validated"
                : validation.status === "ambiguous"
                  ? "Suggested address matches found"
                  : validation.status === "invalid"
                    ? "Address not recognized"
                    : "Validation needs review"}
            </h3>
            {validation.classification ? <p className="muted">Classification: {validation.classification}</p> : null}
            {validation.alerts.map((alert) => (
              <p key={alert} className="muted">{alert}</p>
            ))}
            {validation.candidates.length ? (
              <div className="table" style={{ marginTop: "16px" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Suggested address</th>
                      <th>Classification</th>
                      <th>Apply</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.candidates.map((candidate, index) => (
                      <tr key={`${candidate.line1}-${candidate.postalCode}-${index}`}>
                        <td>
                          <div>{candidate.line1}</div>
                          {candidate.line2 ? <div>{candidate.line2}</div> : null}
                          <div className="muted">
                            {candidate.city}, {candidate.state} {candidate.postalCodeExtended ? `${candidate.postalCode}-${candidate.postalCodeExtended}` : candidate.postalCode}
                          </div>
                        </td>
                        <td>{candidate.classification ?? "-"}</td>
                        <td>
                          <button className="button" type="button" onClick={() => applyCandidate(index)}>
                            Use suggestion
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
        {message ? <p className="muted">{message}</p> : null}
      </div>
    </section>
  );
}
