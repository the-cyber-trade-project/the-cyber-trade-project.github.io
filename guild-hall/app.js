/**
 * Cybersecurity Craft Guild (CCG) Dispatch Hall Client Engine
 */

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

class GuildHallApp {
  constructor() {
    this.members = [];
    this.requisitions = [];
    this.referralSlips = [];
    this.selectedRequisition = null;
  }

  async init() {
    this.bindNavigation();
    await this.loadData();
  }

  bindNavigation() {
    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", e => {
        e.preventDefault();
        const tab = item.getAttribute("data-tab");
        this.switchTab(tab);
      });
    });
  }

  switchTab(tabId) {
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

    const nav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    const pane = document.getElementById(`tab-${tabId}`);
    if (nav) nav.classList.add("active");
    if (pane) pane.classList.add("active");

    const titles = {
      "dispatch-queue": ["Out-of-Work Registers & FIFO Dispatch Hall", "Pillar VI: Neutral bilateral hiring queue enforcing FIFO chronological seniority without recruiter bypass."],
      "requisitions": ["PEC Employer Labor Requisitions", "Formal labor demands submitted by Participating Employer Council organizations."],
      "referral-workbench": ["Guild Dispatch Officer Referral Desk", "Neutral verification matching qualifying FIFO candidates to active employer requisitions."],
      "referral-history": ["Bilateral Dispatch Referral Slips", "Tamper-evident referral orders issued to PEC employers."]
    };

    if (titles[tabId]) {
      document.getElementById("current-tab-title").textContent = titles[tabId][0];
      document.getElementById("current-tab-desc").textContent = titles[tabId][1];
    }
  }

  async loadData() {
    try {
      const res = await fetch("data/mock_guild_data.json");
      const data = await res.json();
      
      this.members = (data.practitioners || []).map(p => ({
        trade_id: p.trade_id,
        name: p.name,
        tier: p.tier,
        license_status: p.license_status || "Active",
        total_verified_hours: p.total_verified_hours || 0,
        active_endorsements: p.active_endorsements || [],
        assigned_jatc_local: p.assigned_jatc_local || "LOCAL-101",
        work_modality_preference: p.work_modality_preference || "Any Modality",
        relocation_willingness: p.relocation_willingness || "Resident Local Only",
        security_clearance: p.security_clearance || "Public Trust / Commercial Unclassified",
        is_seeking_placement: p.is_seeking_placement ?? true,
        days_seeking_placement: p.days_seeking_placement ?? Math.floor(Math.random() * 45),
        dispatch_book: p.dispatch_book || "Book 1 (Resident)",
        seeking_mor_role: p.seeking_mor_role ?? false,
        mor_availability: p.mor_availability || "Not Seeking MoR"
      }));

      this.members.sort((a, b) => b.days_seeking_placement - a.days_seeking_placement);

      this.requisitions = data.labor_requisitions || [
        {
          requisition_id: "REQ-2026-9001",
          employer_pec_id: "PEC-EMP-2026-0001",
          employer_name: "Apex Defense Systems (Div 1)",
          local_id: "LOCAL-101",
          required_tier: "Licensed Journeyman",
          required_endorsement: "SE-APP",
          work_modality: "Hybrid",
          clearance_required: "Public Trust / Commercial Unclassified",
          date_submitted: "2026-09-01",
          status: "PENDING",
          requires_mor: false
        }
      ];

      this.referralSlips = [];
      this.renderAll();
    } catch (err) {
      console.error("Failed to load guild mock data:", err);
    }
  }

  renderAll() {
    this.renderQueue();
    this.renderRequisitions();
    this.renderWorkbenchSelect();
    this.renderReferralSlips();
    this.updateBadges();
  }
  renderQueue() {
    const tbody = document.getElementById("queue-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const localFilter = document.getElementById("filter-local")?.value || "ALL";
    const bookFilter = document.getElementById("filter-book")?.value || "ALL";
    const tierFilter = document.getElementById("filter-tier")?.value || "ALL";
    const modFilter = document.getElementById("filter-modality")?.value || "ALL";

    const filtered = this.members.filter(m => {
      if (!m.is_seeking_placement) return false;
      if (localFilter !== "ALL" && m.assigned_jatc_local !== localFilter) return false;
      if (bookFilter !== "ALL" && m.dispatch_book !== bookFilter) return false;
      if (tierFilter !== "ALL" && !m.tier.toLowerCase().includes(tierFilter.toLowerCase())) return false;
      if (modFilter !== "ALL" && m.work_modality_preference !== "Any Modality" && !m.work_modality_preference.includes(modFilter)) return false;
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-muted);">No candidates currently active matching selected filters.</td></tr>`;
      return;
    }

    filtered.forEach((m, idx) => {
      const tr = document.createElement("tr");
      const agingAlert = m.days_seeking_placement >= 30;
      const rankBadge = idx === 0 
        ? `<span class="badge badge-active" style="background:#10b981; color:#fff;">#1 TOP</span>` 
        : `#${idx + 1}`;

      const endorsements = m.active_endorsements.map(e => `<span class="badge badge-subtle" style="font-size:10px; margin-right:4px;">${escapeHTML(e)}</span>`).join("");

      tr.innerHTML = `
        <td style="font-weight:700;">${rankBadge}</td>
        <td>
          <strong>${escapeHTML(m.name)}</strong><br>
          <span style="font-size:11px; font-family:monospace; color:var(--text-muted);">${escapeHTML(m.trade_id)}</span>
        </td>
        <td>
          <span class="badge badge-primary">${escapeHTML(m.tier)}</span>
          <div style="margin-top:4px;">${endorsements}</div>
        </td>
        <td>${escapeHTML(m.assigned_jatc_local)}</td>
        <td><span class="badge badge-subtle">${escapeHTML(m.dispatch_book)}</span></td>
        <td>
          <strong style="${agingAlert ? 'color:#ef4444;' : ''}">${m.days_seeking_placement} days</strong>
          ${agingAlert ? '<br><span class="badge" style="background:rgba(239,68,68,0.2); color:#ef4444; font-size:9px;">AGING &gt;= 30d</span>' : ''}
        </td>
        <td>
          <span style="font-size:11px;">${escapeHTML(m.work_modality_preference)}</span><br>
          <span style="font-size:10px; color:var(--text-muted);">${escapeHTML(m.security_clearance)}</span>
        </td>
        <td style="font-family:monospace;">${m.total_verified_hours.toLocaleString()} hrs</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="window.app.quickDispatch('${escapeHTML(m.trade_id)}')">Match</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  filterQueue() {
    this.renderQueue();
  }


  updateBadges() {
    const queueCount = this.members.filter(m => m.is_seeking_placement).length;
    const reqCount = this.requisitions.filter(r => r.status === "PENDING").length;
    document.getElementById("badge-queue-count").textContent = queueCount;
    document.getElementById("badge-req-count").textContent = reqCount;
    document.getElementById("badge-slip-count").textContent = this.referralSlips.length;
  }

  renderRequisitions() {
    const tbody = document.getElementById("requisitions-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (this.requisitions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No labor requisitions on file.</td></tr>`;
      return;
    }

    this.requisitions.forEach(r => {
      const tr = document.createElement("tr");
      const statusClass = r.status === "PENDING" ? "badge-active" : (r.status === "REFERRED" ? "badge-success" : "badge-subtle");
      tr.innerHTML = `
        <td style="font-family:monospace; font-weight:700;">${escapeHTML(r.requisition_id)}</td>
        <td>
          <strong>${escapeHTML(r.employer_name)}</strong><br>
          <span style="font-size:11px; font-family:monospace; color:var(--text-muted);">${escapeHTML(r.employer_pec_id)}</span>
        </td>
        <td>${escapeHTML(r.local_id)}</td>
        <td>
          <span class="badge badge-primary">${escapeHTML(r.required_tier)}</span>
          ${r.required_endorsement && r.required_endorsement !== 'None' ? `<span class="badge badge-subtle" style="font-size:10px; margin-left:4px;">${escapeHTML(r.required_endorsement)}</span>` : ''}
        </td>
        <td>
          <span style="font-size:11px;">${escapeHTML(r.work_modality)}</span><br>
          <span style="font-size:10px; color:var(--text-muted);">${escapeHTML(r.clearance_required)}</span>
        </td>
        <td><span class="badge ${statusClass}">${escapeHTML(r.status)}</span></td>
        <td>
          ${r.status === "PENDING" 
            ? `<button class="btn btn-primary btn-sm" onclick="window.app.startDispatchWorkbench('${escapeHTML(r.requisition_id)}')">Evaluate Queue</button>`
            : `<span style="font-size:11px; color:var(--text-muted);">Assigned to ${escapeHTML(r.dispatched_trade_id || 'Worker')}</span>`}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderWorkbenchSelect() {
    const select = document.getElementById("workbench-requisition-select");
    if (!select) return;
    select.innerHTML = '<option value="">-- Choose Requisition to Evaluate --</option>';
    this.requisitions.filter(r => r.status === "PENDING").forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.requisition_id;
      opt.textContent = `${r.requisition_id} - ${r.employer_name} (${r.required_tier})`;
      select.appendChild(opt);
    });
  }

  startDispatchWorkbench(reqId) {
    this.switchTab("referral-workbench");
    const select = document.getElementById("workbench-requisition-select");
    if (select) {
      select.value = reqId;
      this.loadWorkbenchRequisition();
    }
  }

  loadWorkbenchRequisition() {
    const select = document.getElementById("workbench-requisition-select");
    const reqId = select?.value;
    const details = document.getElementById("workbench-req-details");
    const list = document.getElementById("workbench-candidates-list");
    const alerts = document.getElementById("workbench-alerts");

    if (!reqId) {
      if (details) details.style.display = "none";
      if (list) list.innerHTML = '<p class="text-muted">Select a requisition on the left to evaluate matching candidates.</p>';
      if (alerts) alerts.style.display = "none";
      return;
    }

    const req = this.requisitions.find(r => r.requisition_id === reqId);
    if (!req) return;

    if (details) {
      details.style.display = "block";
      details.innerHTML = `
        <h5 style="margin-bottom:6px; color:var(--accent-cyan);">${escapeHTML(req.employer_name)}</h5>
        <div style="font-size:12px; line-height:1.6;">
          <strong>ID:</strong> ${escapeHTML(req.requisition_id)}<br>
          <strong>PEC ID:</strong> ${escapeHTML(req.employer_pec_id)}<br>
          <strong>Local:</strong> ${escapeHTML(req.local_id)}<br>
          <strong>Required Tier:</strong> ${escapeHTML(req.required_tier)}<br>
          <strong>Endorsement:</strong> ${escapeHTML(req.required_endorsement || 'None')}<br>
          <strong>Modality:</strong> ${escapeHTML(req.work_modality)} | <strong>Clearance:</strong> ${escapeHTML(req.clearance_required)}<br>
          <strong>Submitted:</strong> ${escapeHTML(req.date_submitted)}
        </div>
      `;
    }

    const matching = this.members.filter(m => {
      if (!m.is_seeking_placement) return false;
      if (req.local_id && req.local_id !== "ALL" && m.assigned_jatc_local !== req.local_id && m.relocation_willingness !== "National / Willing to Relocate") return false;
      if (!m.tier.toLowerCase().includes(req.required_tier.toLowerCase()) && !req.required_tier.toLowerCase().includes(m.tier.toLowerCase())) return false;
      if (req.required_endorsement && req.required_endorsement !== "None" && !m.active_endorsements.includes(req.required_endorsement)) return false;
      return true;
    });

    const aging = matching.filter(m => m.days_seeking_placement >= 30);
    if (alerts) {
      if (aging.length > 0) {
        alerts.style.display = "block";
        alerts.innerHTML = `<strong>QUEUE AGING ALERT:</strong> ${aging.length} candidate(s) waiting 30+ days. FIFO dispatch officer intervention required.`;
      } else {
        alerts.style.display = "none";
      }
    }

    if (list) {
      if (matching.length === 0) {
        list.innerHTML = `<div style="padding:16px; background:rgba(0,0,0,0.2); border-radius:6px; color:var(--text-muted);">ZERO MATCHES: No candidates currently active on out-of-work list matching tier and endorsement requirements.</div>`;
        return;
      }

      list.innerHTML = "";
      matching.forEach((m, idx) => {
        const item = document.createElement("div");
        item.style.cssText = "padding:12px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;";
        item.innerHTML = `
          <div>
            <span class="badge ${idx === 0 ? 'badge-active' : 'badge-subtle'}" style="${idx === 0 ? 'background:#10b981; color:#fff;' : ''}">FIFO #${idx + 1}</span>
            <strong style="margin-left:6px;">${escapeHTML(m.name)}</strong> (${escapeHTML(m.trade_id)})<br>
            <span style="font-size:11px; color:var(--text-secondary);">${escapeHTML(m.tier)} | ${m.days_seeking_placement} days on queue | ${escapeHTML(m.dispatch_book)}</span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.app.executeReferral('${escapeHTML(req.requisition_id)}', '${escapeHTML(m.trade_id)}')">Issue Referral Slip</button>
        `;
        list.appendChild(item);
      });
    }
  }

  executeReferral(reqId, tradeId) {
    const req = this.requisitions.find(r => r.requisition_id === reqId);
    const cand = this.members.find(m => m.trade_id === tradeId);
    if (!req || !cand) return;

    let wagePct = 100;
    const tl = cand.tier.toLowerCase();
    if (tl.includes("tier 1")) wagePct = 50;
    else if (tl.includes("tier 2")) wagePct = 60;
    else if (tl.includes("tier 3")) wagePct = 70;
    else if (tl.includes("tier 4")) wagePct = 80;
    else if (tl.includes("master")) wagePct = 135;

    const slip = {
      referral_id: `REF-${req.requisition_id}-${cand.trade_id}`,
      requisition_id: req.requisition_id,
      employer_pec_id: req.employer_pec_id,
      candidate_trade_id: cand.trade_id,
      candidate_name: cand.name,
      tier: cand.tier,
      wage_step_percentage: wagePct,
      dispatching_officer_id: "OFFICER-DISPATCH-CCG",
      referral_date: "2026-09-03",
      status: "ISSUED"
    };

    this.referralSlips.push(slip);

    cand.is_seeking_placement = false;
    cand.days_seeking_placement = 0;

    req.status = "REFERRED";
    req.dispatched_trade_id = cand.trade_id;

    this.renderAll();
    this.switchTab("referral-history");
  }

  renderReferralSlips() {
    const tbody = document.getElementById("slips-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (this.referralSlips.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-muted);">No referral slips issued yet this session.</td></tr>`;
      return;
    }

    this.referralSlips.forEach(s => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-family:monospace; font-weight:700;">${escapeHTML(s.referral_id)}</td>
        <td style="font-family:monospace;">${escapeHTML(s.requisition_id)}</td>
        <td>${escapeHTML(s.employer_pec_id)}</td>
        <td><strong>${escapeHTML(s.candidate_name)}</strong><br><span style="font-size:10px; font-family:monospace; color:var(--text-muted);">${escapeHTML(s.candidate_trade_id)}</span></td>
        <td><span class="badge badge-primary">${escapeHTML(s.tier)}</span></td>
        <td><strong>${s.wage_step_percentage}% RJPB</strong></td>
        <td>${escapeHTML(s.dispatching_officer_id)}</td>
        <td>${escapeHTML(s.referral_date)}</td>
        <td><span class="badge badge-active">${escapeHTML(s.status)}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  openRequisitionModal() {
    const modal = document.getElementById("modal-requisition");
    if (modal) modal.style.display = "flex";
  }

  closeRequisitionModal() {
    const modal = document.getElementById("modal-requisition");
    if (modal) modal.style.display = "none";
  }

  handleRequisitionSubmit(e) {
    e.preventDefault();
    const pecSelect = document.getElementById("modal-pec-id");
    const pecId = pecSelect.value;
    const pecText = pecSelect.options[pecSelect.selectedIndex].text;
    const employerName = pecText.split(":")[1]?.trim() || pecId;

    const newReq = {
      requisition_id: `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      employer_pec_id: pecId,
      employer_name: employerName,
      local_id: document.getElementById("modal-local-id").value,
      required_tier: document.getElementById("modal-tier").value,
      required_endorsement: document.getElementById("modal-endorsement").value,
      work_modality: document.getElementById("modal-modality").value,
      clearance_required: "Public Trust / Commercial Unclassified",
      date_submitted: "2026-09-03",
      status: "PENDING",
      requires_mor: false
    };

    this.requisitions.unshift(newReq);
    this.closeRequisitionModal();
    this.renderAll();
    this.switchTab("requisitions");
  }

  quickDispatch(tradeId) {
    this.switchTab("requisitions");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new GuildHallApp();
  window.app.init();
});

