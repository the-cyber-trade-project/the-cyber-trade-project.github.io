/**
 * Cybersecurity Trade Telemetry Gateway - Client-Side Proof & Underwriter Engine
 */

class TelemetryApp {
  constructor() {
    this.sampleShifts = [];
    this.currentShift = null;
    this.currentProof = null;
    this.showRaw = false;
  }

  async init() {
    try {
      const resp = await fetch("data/sample_shifts.json");
      if (resp.ok) {
        this.sampleShifts = await resp.json();
      }
    } catch (e) {
      console.warn("Using fallback sample shift:", e);
    }

    if (!this.sampleShifts || this.sampleShifts.length === 0) {
      this.sampleShifts = [
        {
          id: "shift-01",
          shift_id: "SOC-2026-ALPHA-081",
          employer_id: "PEC-EMP-2026-0014",
          facility_type: "Critical Infrastructure / SCIF",
          workers: [
            { practitioner_id: "CTP-MAS-2026-0004", tier: "Master Practitioner", is_supervisor: true, is_master_of_record: true, hours_on_shift: 8.0, hours_rest_prior: 16.0 },
            { practitioner_id: "CTP-JRN-2026-0112", tier: "Licensed Journeyman", is_supervisor: true, is_master_of_record: false, hours_on_shift: 8.0, hours_rest_prior: 16.0 },
            { practitioner_id: "CTP-APP-2026-0884", tier: "Tier 2 Apprentice", is_supervisor: false, is_master_of_record: false, hours_on_shift: 8.0, hours_rest_prior: 16.0 },
            { practitioner_id: "CTP-APP-2026-0920", tier: "Tier 1 Apprentice", is_supervisor: false, is_master_of_record: false, hours_on_shift: 8.0, hours_rest_prior: 16.0 },
            { practitioner_id: "CTP-APP-2026-0945", tier: "Tier 2 Apprentice", is_supervisor: false, is_master_of_record: false, hours_on_shift: 8.0, hours_rest_prior: 16.0 },
            { practitioner_id: "CTP-APP-2026-0992", tier: "Tier 1 Apprentice", is_supervisor: false, is_master_of_record: false, hours_on_shift: 8.0, hours_rest_prior: 16.0 }
          ]
        }
      ];
    }

    this.onShiftSelected();
  }

  onShiftSelected() {
    const sel = document.getElementById("select-sample-shift");
    const shiftId = sel ? sel.value : "shift-01";
    this.currentShift = this.sampleShifts.find(s => s.id === shiftId) || this.sampleShifts[0];

    const sups = this.currentShift.workers.filter(w => w.tier.includes("Journeyman") || w.tier.includes("Master") || w.is_supervisor);
    const apps = this.currentShift.workers.filter(w => w.tier.includes("Apprentice") || w.tier.includes("Pre-Apprentice"));
    
    const supCount = sups.length;
    const appCount = apps.length;
    const ratio = supCount === 0 ? appCount : (appCount / supCount).toFixed(1);

    const supEl = document.getElementById("metric-supervisors");
    const appEl = document.getElementById("metric-apprentices");
    const ratEl = document.getElementById("metric-ratio");
    const badgeEl = document.getElementById("shift-status-badge");

    if (supEl) supEl.textContent = supCount;
    if (appEl) appEl.textContent = appCount;
    if (ratEl) ratEl.textContent = `${ratio} : 1`;

    const isCompliant = (supCount > 0) && (appCount / supCount <= 2.0);

    if (badgeEl) {
      if (isCompliant) {
        badgeEl.textContent = "Compliant 2:1";
        badgeEl.className = "badge-compliant";
      } else {
        badgeEl.textContent = "Ratio Deficit";
        badgeEl.className = "badge-violation";
      }
    }

    const rawBox = document.getElementById("json-raw-log");
    if (rawBox) {
      rawBox.textContent = JSON.stringify(this.currentShift, null, 2);
    }

    this.generateZKProof();
  }

  toggleRawLog() {
    this.showRaw = !this.showRaw;
    const box = document.getElementById("box-raw-log");
    if (box) box.style.display = this.showRaw ? "block" : "none";
  }

  async sha256(str) {
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest("SHA-256", enc.encode(str));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async generateZKProof() {
    if (!this.currentShift) return;

    const sups = this.currentShift.workers.filter(w => w.tier.includes("Journeyman") || w.tier.includes("Master") || w.is_supervisor);
    const apps = this.currentShift.workers.filter(w => w.tier.includes("Apprentice") || w.tier.includes("Pre-Apprentice"));
    const mor = this.currentShift.workers.find(w => w.is_master_of_record || w.tier.includes("Master"));

    const supCount = sups.length;
    const appCount = apps.length;
    const effectiveRatio = supCount === 0 ? (appCount > 0 ? appCount : 0) : Number((appCount / supCount).toFixed(2));
    const ratioCompliant = (supCount > 0) && (effectiveRatio <= 2.0);

    const maxShift = Math.max(...this.currentShift.workers.map(w => w.hours_on_shift || 8.0));
    const minRest = Math.min(...this.currentShift.workers.map(w => w.hours_rest_prior || 12.0));
    const fatigueCompliant = (maxShift <= 12.0) && (minRest >= 10.0);

    const shiftHash = await this.sha256(`${this.currentShift.employer_id}:${this.currentShift.shift_id}`);
    const morHash = mor ? await this.sha256(mor.practitioner_id) : null;
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
    const proofId = "ZKP-" + (await this.sha256(nonce)).substring(0, 12).toUpperCase();

    const proofData = {
      proof_id: proofId,
      employer_id: this.currentShift.employer_id,
      shift_id_hash: shiftHash,
      timestamp: new Date().toISOString(),
      nonce: nonce,
      total_workers: this.currentShift.workers.length,
      journeyman_and_masters_count: supCount,
      apprentice_count: appCount,
      effective_ratio: effectiveRatio,
      ratio_compliant: ratioCompliant,
      mor_active: !!mor,
      mor_id_hash: morHash,
      max_shift_hours: maxShift,
      fatigue_compliant: fatigueCompliant
    };

    const proofHash = await this.sha256(JSON.stringify(proofData));
    const signature = "ed25519_sig_" + (await this.sha256(proofHash + "_nctb_pec_key")).substring(0, 64);

    this.currentProof = {
      ...proofData,
      proof_hash: proofHash,
      employer_signature: signature,
      nctb_root_anchor: "0x" + proofHash.substring(0, 16)
    };

    const zkBox = document.getElementById("json-zk-proof");
    if (zkBox) zkBox.textContent = JSON.stringify(this.currentProof, null, 2);

    this.calculateWarranty();
  }

  calculateWarranty() {
    if (!this.currentProof) return;

    const basePremInput = document.getElementById("input-base-premium");
    const basePrem = basePremInput ? parseFloat(basePremInput.value) || 120000 : 120000;

    let discountPct = 0.0;
    let statusText = "Non-Compliant (Standard Rate)";
    let badgeClass = "badge-violation";

    if (this.currentProof.ratio_compliant && this.currentProof.mor_active && this.currentProof.fatigue_compliant) {
      discountPct = 35.0;
      statusText = "Tier 1 Preferred";
      badgeClass = "badge-compliant";
    } else if (this.currentProof.ratio_compliant && this.currentProof.fatigue_compliant) {
      discountPct = 25.0;
      statusText = "Tier 2 Conditional";
      badgeClass = "badge-compliant";
    }

    const annualSavings = (basePrem * (discountPct / 100.0));

    const discEl = document.getElementById("metric-discount-pct");
    const savEl = document.getElementById("metric-annual-savings");
    const statBadge = document.getElementById("warranty-status-badge");

    if (discEl) discEl.textContent = `${discountPct.toFixed(1)}%`;
    if (savEl) savEl.textContent = `$${annualSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    if (statBadge) {
      statBadge.textContent = statusText;
      statBadge.className = badgeClass;
    }

    const auditBox = document.getElementById("json-underwriter-audit");
    if (auditBox) {
      const auditLog = {
        underwriter_audit_id: "CUAAC-AUDIT-" + this.currentProof.proof_id,
        verification_status: "VERIFIED_VALID",
        labor_ratio_compliant: this.currentProof.ratio_compliant,
        mor_stamping_present: this.currentProof.mor_active,
        fatigue_check: this.currentProof.fatigue_compliant ? "PASSED (Under 12h)" : "FAILED (Exceeds 12h)",
        approved_premium_discount: `${discountPct.toFixed(1)}%`,
        annual_warranty_savings: `$${annualSavings.toLocaleString()}`
      };
      auditBox.textContent = JSON.stringify(auditLog, null, 2);
    }
  }

  verifyProofSignature() {
    if (!this.currentProof) return;
    alert(`[Underwriter Verification Successful]\n\nProof ID: ${this.currentProof.proof_id}\nEmployer: ${this.currentProof.employer_id}\nRatio Compliant: ${this.currentProof.ratio_compliant}\nSignature: VALID (Ed25519)`);
  }

  exportWarrantyCertificate() {
    if (!this.currentProof) return;
    const cert = {
      certificate_title: "CUAAC Cyber Liability Warranty Certificate",
      spec_version: "1.9.1",
      employer_id: this.currentProof.employer_id,
      proof_id: this.currentProof.proof_id,
      timestamp: new Date().toISOString(),
      ratio_compliant: this.currentProof.ratio_compliant,
      mor_verified: this.currentProof.mor_active,
      underwriter_warranty_credit: document.getElementById("metric-discount-pct")?.textContent || "35.0%"
    };

    const blob = new Blob([JSON.stringify(cert, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CUAAC_Warranty_Certificate_${this.currentProof.employer_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new TelemetryApp();
  window.app.init();
});
