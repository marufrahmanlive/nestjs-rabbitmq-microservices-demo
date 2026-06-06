import { Controller, Get, Query, Param } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuditLog } from "@app/database";
import { Document } from "mongoose";

@Controller()
export class LogsController {
  constructor(
    @InjectModel("AuditLog")
    private readonly auditLogModel: Model<AuditLog & Document>
  ) {}

  /**
   * GET /api/logs
   * Returns audit logs as JSON with optional filters
   */
  @Get("api/logs")
  async getLogs(
    @Query("service") service?: string,
    @Query("level") level?: string,
    @Query("instanceId") instanceId?: string,
    @Query("handler") handler?: string,
    @Query("limit") limit = "100",
    @Query("skip") skip = "0"
  ) {
    const filter: any = {};
    if (service) filter.serviceName = service;
    if (level) filter.level = level;
    if (instanceId) filter.instanceId = instanceId;
    if (handler) filter.handler = { $regex: handler, $options: "i" };

    const total = await this.auditLogModel.countDocuments(filter);
    const logs = await this.auditLogModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(Math.min(parseInt(limit), 500))
      .lean();

    return { total, limit: parseInt(limit), skip: parseInt(skip), logs };
  }

  /**
   * GET /api/logs/:id
   * Get a single audit log entry by ID with full detail
   */
  @Get("api/logs/:id")
  async getLogById(@Param("id") id: string) {
    const log = await this.auditLogModel.findById(id).lean();
    if (!log) {
      return { found: false, message: `Log with id '${id}' not found` };
    }
    return { found: true, log };
  }

  /**
   * GET /api/logs/stats
   * Aggregated statistics across services
   */
  @Get("api/logs/stats")
  async getStats() {
    const stats = await this.auditLogModel.aggregate([
      {
        $group: {
          _id: { service: "$serviceName", level: "$level" },
          count: { $sum: 1 },
          latest: { $max: "$createdAt" }
        }
      },
      { $sort: { "_id.service": 1, "_id.level": 1 } }
    ]);

    const services = await this.auditLogModel.distinct("serviceName");
    const instances = await this.auditLogModel.distinct("instanceId");
    const totalLogs = await this.auditLogModel.countDocuments();
    const errorCount = await this.auditLogModel.countDocuments({
      level: "error"
    });

    return {
      totalLogs,
      errorCount,
      services,
      instances,
      breakdown: stats
    };
  }

  /**
   * GET /api/services
   * List distinct service names seen in logs
   */
  @Get("api/services")
  async getServices() {
    const services = await this.auditLogModel.distinct("serviceName");
    return { services };
  }

  /**
   * GET /api/instances
   * List distinct instance IDs seen across services
   */
  @Get("api/instances")
  async getInstances() {
    const instances = await this.auditLogModel.aggregate([
      {
        $group: {
          _id: { service: "$serviceName", instance: "$instanceId" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.service": 1 } }
    ]);
    return { instances };
  }

  /**
   * GET /
   * Returns the UI dashboard
   */
  @Get()
  getDashboard() {
    return getDashboardHtml();
  }
}

function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Audit Logs Dashboard - Microservices</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
a { color: #38bdf8; text-decoration: none; }
a:hover { text-decoration: underline; }

/* Header */
.header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 20px 32px; border-bottom: 2px solid #475569; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.header h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.5px; }
.header h1 span { color: #38bdf8; }
.stats-bar { display: flex; gap: 16px; flex-wrap: wrap; }
.stat-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 12px 18px; min-width: 100px; text-align: center; }
.stat-card .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
.stat-card .value { font-size: 1.4rem; font-weight: 700; color: #38bdf8; }
.stat-card.error .value { color: #f87171; }

/* Filters */
.filters { padding: 16px 32px; display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; background: #1e293b; border-bottom: 1px solid #334155; }
.filters label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; display: block; margin-bottom: 4px; }
.filters select, .filters input { background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #e2e8f0; padding: 8px 12px; font-size: 0.85rem; min-width: 140px; }
.filters select:focus, .filters input:focus { outline: none; border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56,189,248,0.2); }
.filters button { background: #38bdf8; color: #0f172a; border: none; border-radius: 6px; padding: 8px 20px; font-weight: 600; cursor: pointer; font-size: 0.85rem; transition: all 0.2s; }
.filters button:hover { background: #7dd3fc; }
.filters button.secondary { background: transparent; border: 1px solid #475569; color: #cbd5e1; }
.filters button.secondary:hover { border-color: #38bdf8; color: #38bdf8; }

/* Table */
.table-wrap { padding: 0 32px 32px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 8px; }
thead th { background: #1e293b; padding: 12px 14px; text-align: left; border-bottom: 2px solid #475569; font-weight: 600; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; color: #94a3b8; position: sticky; top: 0; z-index: 1; cursor: pointer; user-select: none; }
thead th:hover { color: #38bdf8; }
tbody td { padding: 10px 14px; border-bottom: 1px solid #1e293b; vertical-align: top; word-break: break-word; }
tbody tr { cursor: pointer; }
tbody tr:hover { background: #1e293b; }
tbody tr.expanded { background: #172033; border-left: 3px solid #38bdf8; }

/* Badges */
.level { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
.level-log { background: #166534; color: #4ade80; }
.level-error { background: #7f1d1d; color: #f87171; }
.level-warn { background: #78350f; color: #fbbf24; }
.level-debug { background: #1e3a5f; color: #60a5fa; }
.level-verbose { background: #334155; color: #cbd5e1; }
.service-badge { background: #334155; color: #38bdf8; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.7rem; }
.instance-badge { color: #94a3b8; font-size: 0.7rem; font-family: monospace; }
.duration { color: #a78bfa; font-weight: 600; }
.url-cell { font-family: monospace; color: #38bdf8; max-width: 250px; overflow: hidden; text-overflow: ellipsis; }
.message-cell { max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.message-cell:hover { white-space: normal; overflow: visible; }
.timestamp { font-size: 0.75rem; color: #94a3b8; white-space: nowrap; }

/* Detail Panel */
.detail-row { display: none; }
.detail-row.show { display: table-row; }
.detail-row td { padding: 16px 20px; background: #172033; }
.detail-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.detail-panel .section { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; }
.detail-panel .section h4 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; margin-bottom: 8px; }
.detail-panel .section.full-width { grid-column: 1 / -1; }
.detail-panel pre { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 10px; overflow-x: auto; font-size: 0.75rem; font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace; color: #cbd5e1; max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
.detail-panel .meta-item { display: flex; gap: 8px; font-size: 0.8rem; padding: 3px 0; border-bottom: 1px solid #1e293b; }
.detail-panel .meta-item .key { color: #94a3b8; min-width: 120px; font-weight: 600; }
.detail-panel .meta-item .val { color: #e2e8f0; word-break: break-all; }
.error-stack { border-left: 3px solid #f87171; padding-left: 10px; }
.error-stack pre { color: #fca5a5; }

/* Pagination */
.pagination { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 12px 0; }
.pagination button { background: #1e293b; border: 1px solid #475569; color: #e2e8f0; border-radius: 6px; padding: 6px 14px; cursor: pointer; font-size: 0.85rem; }
.pagination button:disabled { opacity: 0.4; cursor: default; }
.pagination button:hover:not(:disabled) { border-color: #38bdf8; }

/* Misc */
.auto-refresh { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #94a3b8; }
.auto-refresh input { accent-color: #38bdf8; }
.empty { text-align: center; padding: 40px; color: #64748b; font-size: 1.1rem; }
.meta { color: #94a3b8; font-size: 0.75rem; }
.endpoint-info { font-size: 0.68rem; color: #64748b; text-align: center; padding: 4px 32px 8px; }
</style>
</head>
<body>
<div class="header">
  <h1>&#128203; <span>Audit Logs</span> Dashboard</h1>
  <div class="stats-bar" id="statsBar"></div>
</div>
<div class="endpoint-info">
  API: <a href="/api/logs">GET /api/logs</a> |
  <a href="/api/logs/stats">GET /api/logs/stats</a> |
  <a href="/api/services">GET /api/services</a> |
  <a href="/api/instances">GET /api/instances</a>
  &nbsp;|&nbsp; Click any row to view full details (metadata, request/response data, error stack)
</div>
<div class="filters">
  <div>
    <label>Service</label>
    <select id="svcFilter"><option value="">All Services</option></select>
  </div>
  <div>
    <label>Level</label>
    <select id="lvlFilter">
      <option value="">All Levels</option>
      <option value="log">Log</option>
      <option value="error">Error</option>
      <option value="warn">Warn</option>
      <option value="debug">Debug</option>
      <option value="verbose">Verbose</option>
    </select>
  </div>
  <div>
    <label>Instance</label>
    <input id="instFilter" type="text" placeholder="Instance ID...">
  </div>
  <div>
    <label>Handler / Pattern</label>
    <input id="handlerFilter" type="text" placeholder="e.g. GET /orders, create_order">
  </div>
  <div>
    <label>&nbsp;</label>
    <button onclick="applyFilters()">&#128269; Search</button>
  </div>
  <div>
    <label>&nbsp;</label>
    <button class="secondary" onclick="resetFilters()">&#8635; Reset</button>
  </div>
  <div class="auto-refresh">
    <input type="checkbox" id="autoRefresh">
    <label for="autoRefresh" style="margin-bottom:0">Auto-refresh 5s</label>
  </div>
</div>
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th style="width:140px">Time</th>
        <th style="width:70px">Level</th>
        <th style="width:120px">Service</th>
        <th style="width:130px">Instance</th>
        <th>Handler</th>
        <th style="width:60px">Method</th>
        <th>URL / Queue</th>
        <th style="width:70px">Status</th>
        <th style="width:70px">Duration</th>
        <th>Message</th>
      </tr>
    </thead>
    <tbody id="logBody"></tbody>
  </table>
  <div class="pagination" id="pagination"></div>
</div>

<script>
let currentPage = 0;
const limit = 50;
let expandedRow = null;

async function loadServices() {
  try {
    const r = await fetch('/api/services');
    const d = await r.json();
    const sel = document.getElementById('svcFilter');
    d.services.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o); });
  } catch(e) {}
}

async function loadStats() {
  try {
    const r = await fetch('/api/logs/stats');
    const d = await r.json();
    document.getElementById('statsBar').innerHTML =
      '<div class="stat-card"><div class="label">Total Logs</div><div class="value">' + d.totalLogs + '</div></div>' +
      '<div class="stat-card error"><div class="label">Errors</div><div class="value">' + (d.errorCount || 0) + '</div></div>' +
      '<div class="stat-card"><div class="label">Services</div><div class="value">' + (d.services ? d.services.length : 0) + '</div></div>' +
      '<div class="stat-card"><div class="label">Instances</div><div class="value">' + (d.instances ? d.instances.length : 0) + '</div></div>';
  } catch(e) {}
}

function getFilters() {
  return {
    service: document.getElementById('svcFilter').value,
    level: document.getElementById('lvlFilter').value,
    instanceId: document.getElementById('instFilter').value,
    handler: document.getElementById('handlerFilter').value
  };
}

function levelClass(level) {
  const m = { log: 'level-log', error: 'level-error', warn: 'level-warn', debug: 'level-debug', verbose: 'level-verbose' };
  return m[level] || 'level-log';
}

function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
}

function formatJson(obj) {
  if (!obj) return '-';
  try { return JSON.stringify(obj, null, 2); } catch(e) { return String(obj); }
}

function truncate(s, len) {
  if (!s) return '';
  s = String(s);
  return s.length > len ? s.substring(0, len) + '...' : s;
}

function toggleDetail(logId, rowEl) {
  const detailRow = document.getElementById('detail-' + logId);
  if (!detailRow) return;

  if (expandedRow && expandedRow !== logId) {
    const old = document.getElementById('detail-' + expandedRow);
    if (old) old.classList.remove('show');
    const oldMain = document.querySelector('tr[data-logid="' + expandedRow + '"]');
    if (oldMain) oldMain.classList.remove('expanded');
  }

  if (detailRow.classList.contains('show')) {
    detailRow.classList.remove('show');
    rowEl.classList.remove('expanded');
    expandedRow = null;
  } else {
    detailRow.classList.add('show');
    rowEl.classList.add('expanded');
    expandedRow = logId;
  }
}

function buildDetailRow(log) {
  const metadata = log.metadata || {};
  const requestData = log.requestData || null;
  const responseData = log.responseData || null;
  const errorStack = log.errorStack || null;
  const hasMeta = Object.keys(metadata).length > 0;
  const hasReq = requestData && typeof requestData === 'object' && Object.keys(requestData).length > 0;
  const hasResp = responseData && typeof responseData === 'object' && Object.keys(responseData).length > 0;

  let html = '<div class="detail-panel">';

  // Meta info
  html += '<div class="section">';
  html += '<h4>&#128269; Details</h4>';
  html += '<div class="meta-item"><span class="key">Log ID:</span><span class="val">' + escHtml(log._id) + '</span></div>';
  html += '<div class="meta-item"><span class="key">Correlation ID:</span><span class="val">' + escHtml(log.correlationId || '-') + '</span></div>';
  html += '<div class="meta-item"><span class="key">Created:</span><span class="val">' + (log.createdAt ? new Date(log.createdAt).toLocaleString() : '-') + '</span></div>';
  html += '<div class="meta-item"><span class="key">Updated:</span><span class="val">' + (log.updatedAt ? new Date(log.updatedAt).toLocaleString() : '-') + '</span></div>';
  html += '</div>';

  // Metadata section
  html += '<div class="section">';
  html += '<h4>&#128451; Metadata</h4>';
  if (hasMeta) {
    html += '<pre>' + escHtml(formatJson(metadata)) + '</pre>';
  } else {
    html += '<pre style="color:#64748b">No metadata</pre>';
  }
  html += '</div>';

  // Request Data
  html += '<div class="section">';
  html += '<h4>&#128228; Request Data / Event Payload</h4>';
  if (hasReq) {
    html += '<pre>' + escHtml(formatJson(requestData)) + '</pre>';
  } else {
    html += '<pre style="color:#64748b">No request data</pre>';
  }
  html += '</div>';

  // Response Data
  html += '<div class="section">';
  html += '<h4>&#128229; Response Data</h4>';
  if (hasResp) {
    html += '<pre>' + escHtml(formatJson(responseData)) + '</pre>';
  } else {
    html += '<pre style="color:#64748b">No response data</pre>';
  }
  html += '</div>';

  // Error Stack (full-width)
  if (errorStack) {
    html += '<div class="section full-width error-stack">';
    html += '<h4>&#128165; Error Stack Trace</h4>';
    html += '<pre>' + escHtml(errorStack) + '</pre>';
    html += '</div>';
  }

  html += '</div>';
  return html;
}

async function loadLogs(page) {
  page = page || 0;
  currentPage = page;
  const f = getFilters();
  const params = new URLSearchParams({ limit: String(limit), skip: String(page * limit) });
  if (f.service) params.set('service', f.service);
  if (f.level) params.set('level', f.level);
  if (f.instanceId) params.set('instanceId', f.instanceId);
  if (f.handler) params.set('handler', f.handler);

  try {
    const r = await fetch('/api/logs?' + params.toString());
    const d = await r.json();
    renderLogs(d.logs, d.total);
    renderPagination(d.total);
  } catch(e) {
    document.getElementById('logBody').innerHTML =
      '<tr><td colspan="10" class="empty">&#9888; Error loading logs. Check if the Logs Viewer API is running.</td></tr>';
  }
}

function renderLogs(logs, total) {
  const tbody = document.getElementById('logBody');
  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty">&#128123; No audit logs found' +
      (total > 0 ? '' : '. Create some orders via the API Gateway to populate logs.') + '</td></tr>';
    return;
  }

  let mainRows = '';
  let detailRows = '';
  logs.forEach((l, idx) => {
    const logId = l._id || 'row' + idx;
    const isError = l.level === 'error';
    mainRows += '<tr data-logid="' + logId + '" onclick="toggleDetail(\'' + logId + '\', this)" style="' +
      (isError ? 'background:rgba(248,113,113,0.05)' : '') + '">' +
      '<td class="timestamp">' + escHtml(l.createdAt ? new Date(l.createdAt).toLocaleString() : '') + '</td>' +
      '<td><span class="level ' + levelClass(l.level) + '">' + escHtml(l.level) + '</span></td>' +
      '<td><span class="service-badge">' + escHtml(l.serviceName) + '</span></td>' +
      '<td><span class="instance-badge" title="' + escHtml(l.instanceId) + '">' +
        escHtml(truncate(l.instanceId, 18)) + '</span></td>' +
      '<td><span class="url-cell">' + escHtml(l.handler || '-') + '</span></td>' +
      '<td>' + escHtml(l.method || '-') + '</td>' +
      '<td class="url-cell" title="' + escHtml(l.url) + '">' + escHtml(truncate(l.url, 40)) + '</td>' +
      '<td>' + (l.statusCode != null
        ? '<span style="color:' + (l.statusCode < 400 ? '#4ade80' : '#f87171') + ';font-weight:700">' +
          l.statusCode + '</span>'
        : '-') + '</td>' +
      '<td>' + (l.durationMs != null
        ? '<span class="duration">' + l.durationMs + 'ms</span>'
        : '-') + '</td>' +
      '<td class="message-cell" title="' + escHtml(l.message) + '">' +
        (isError ? '&#10060; ' : '&#9989; ') + escHtml(truncate(l.message, 80)) + '</td>' +
      '</tr>';

    detailRows += '<tr id="detail-' + logId + '" class="detail-row"><td colspan="10">' +
      buildDetailRow(l) + '</td></tr>';
  });

  tbody.innerHTML = mainRows + detailRows;
}

function renderPagination(total) {
  const totalPages = Math.ceil(total / limit);
  const div = document.getElementById('pagination');
  div.innerHTML =
    '<button onclick="loadLogs(0)" ' + (currentPage === 0 ? 'disabled' : '') + '>&#9198; First</button>' +
    '<button onclick="loadLogs(' + (currentPage - 1) + ')" ' + (currentPage === 0 ? 'disabled' : '') + '>&#9664; Prev</button>' +
    '<span style="font-size:0.9rem;color:#94a3b8;">Page ' + (currentPage + 1) + ' of ' + (totalPages || 1) +
      ' (' + total + ' total)</span>' +
    '<button onclick="loadLogs(' + (currentPage + 1) + ')" ' + (currentPage >= totalPages - 1 ? 'disabled' : '') + '>Next &#9654;</button>' +
    '<button onclick="loadLogs(' + (totalPages - 1) + ')" ' + (currentPage >= totalPages - 1 ? 'disabled' : '') + '>Last &#9197;</button>';
}

function applyFilters() { expandedRow = null; loadLogs(0); }
function resetFilters() {
  document.getElementById('svcFilter').value = '';
  document.getElementById('lvlFilter').value = '';
  document.getElementById('instFilter').value = '';
  document.getElementById('handlerFilter').value = '';
  expandedRow = null;
  loadLogs(0);
}

// Auto-refresh
let refreshInterval;
document.getElementById('autoRefresh').addEventListener('change', function() {
  if (this.checked) {
    refreshInterval = setInterval(() => { loadLogs(currentPage); loadStats(); }, 5000);
  } else {
    clearInterval(refreshInterval);
  }
});

// Keyboard shortcut for expand/collapse
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && expandedRow) {
    const detailRow = document.getElementById('detail-' + expandedRow);
    const mainRow = document.querySelector('tr[data-logid="' + expandedRow + '"]');
    if (detailRow) detailRow.classList.remove('show');
    if (mainRow) mainRow.classList.remove('expanded');
    expandedRow = null;
  }
});

loadServices();
loadStats();
loadLogs(0);
</script>
</body>
</html>`;
}
