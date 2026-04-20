// auth.js — Abhinandan Auto Mobiles ERP v3
// Features: Session management, role access, settings panel,
//           light/dark theme, staff management, business details

(function () {
  'use strict'

  var SESSION_KEY   = 'aam_erp_session'
  var THEME_KEY     = 'aam_erp_theme'
  var BIZ_CACHE_KEY = 'aam_biz_cache'
  var STAFF_ALLOWED = ['billing.html', 'products.html']
  var SB_URL = 'https://mhhnmndnolhapaoqtbxo.supabase.co'
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oaG5tbmRub2xoYXBhb3F0YnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mzg4NTksImV4cCI6MjA4ODQxNDg1OX0.IMSp8vYiCln_iSuoT_H2qdeX_dP1WMhOOskDw20eJXw'

  // ── 1. Apply theme BEFORE DOM renders (prevents flash) ──
  ;(function () {
    var t = localStorage.getItem(THEME_KEY) || 'dark'
    if (t === 'light') document.documentElement.classList.add('light-theme')
    else document.documentElement.classList.remove('light-theme')
  })()

  // ── 2. Session helpers ──
  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return null
      var s = JSON.parse(raw)
      if (!s || !s.expiry) return null
      if (Date.now() > s.expiry) { localStorage.removeItem(SESSION_KEY); return null }
      return s
    } catch (e) { localStorage.removeItem(SESSION_KEY); return null }
  }

  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html'
  }

  // ── 3. Access control — runs immediately ──
  var session = getSession()
  var page    = currentPage()
  if (!session) {
    if (page !== 'login.html') window.location.replace('login.html')
  } else {
    if (session.role === 'staff' && STAFF_ALLOWED.indexOf(page) === -1) {
      window.location.replace('billing.html')
    }
  }

  // ── 4. Supabase helper ──
  function getSB() {
    if (window._supabase) return window._supabase
    if (window.supabase && window.supabase.createClient) {
      window._supabase = window.supabase.createClient(SB_URL, SB_KEY)
      return window._supabase
    }
    return null
  }

  // ── 5. Notification helper (used by billing pages) ──
  window.AAMNotify = async function (opts) {
    var s  = getSession()
    var sb = getSB()
    if (!sb) return
    try {
      await sb.from('notifications').insert([{
        type:        opts.type        || 'bill',
        title:       opts.title       || 'Activity',
        message:     opts.message     || '',
        done_by:     s ? (s.full_name || s.username) : 'Staff',
        bill_number: opts.bill_number || null,
        amount:      opts.amount      || 0,
        is_read:     false
      }])
    } catch (e) { /* silent */ }
  }

  // ── 6. Business details: load from Supabase, cache, apply to page ──
  async function loadAndApplyBusiness() {
    // Use cache immediately (fast load)
    var cached = {}
    try { cached = JSON.parse(localStorage.getItem(BIZ_CACHE_KEY) || '{}') } catch (e) {}
    if (cached.biz_name) applyBusinessToDOM(cached)

    // Fetch fresh from Supabase in background
    var sb = getSB()
    if (!sb) return
    try {
      var res = await sb.from('settings').select('key,value')
      if (res.data && res.data.length) {
        var biz = {}
        res.data.forEach(function (r) { biz[r.key] = r.value })
        localStorage.setItem(BIZ_CACHE_KEY, JSON.stringify(biz))
        applyBusinessToDOM(biz)
      }
    } catch (e) {}
  }

  function applyBusinessToDOM(biz) {
    if (!biz.biz_name) return
    // Update company name in all print areas
    document.querySelectorAll('.bill-company-name, .pur-company-name, .inv-company, .rcpt-company, .stmt-company').forEach(function (el) {
      el.textContent = biz.biz_name
    })
    // Update address/phone sub-lines
    var subs = document.querySelectorAll('.bill-company-sub, .pur-company-sub')
    var lines = []
    if (biz.biz_address) lines.push(biz.biz_address)
    if (biz.biz_phone1)  lines.push(biz.biz_phone1)
    if (biz.biz_phone2)  lines.push(biz.biz_phone2)
    subs.forEach(function (el, i) {
      if (lines[i] !== undefined) el.textContent = lines[i]
    })
    // Update statement/receipt sub lines too
    document.querySelectorAll('.stmt-sub, .rcpt-sub').forEach(function (el) {
      var text = biz.biz_address || ''
      if (biz.biz_phone1) text += (text ? '  |  ' : '') + biz.biz_phone1
      el.textContent = text
    })
  }

  // ── 7. Inject settings modal CSS ──
  function injectSettingsCSS() {
    if (document.getElementById('aam_settings_css')) return
    var style = document.createElement('style')
    style.id  = 'aam_settings_css'
    style.textContent = [
      // Overlay
      '#aamSettingsOverlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99000;overflow-y:auto;padding:20px;backdrop-filter:blur(8px);}',
      '#aamSettingsBox{background:linear-gradient(135deg,#0d1117,#0f172a);border:1px solid rgba(255,255,255,0.12);border-radius:20px;max-width:680px;margin:30px auto;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.6);}',
      'html.light-theme #aamSettingsBox{background:linear-gradient(135deg,#f8faff,#ffffff);border:1px solid rgba(0,0,0,0.1);}',
      // Header
      '#aamSettingsBox .sh{background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:22px 28px;display:flex;justify-content:space-between;align-items:center;}',
      '#aamSettingsBox .sh h2{font-family:"Playfair Display",serif;font-size:20px;color:white;margin:0;}',
      '#aamSettingsBox .sh .sc{color:rgba(255,255,255,0.6);font-size:13px;margin-top:3px;}',
      '#aamSettingsBox .sh button{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:white;padding:7px 14px;border-radius:8px;font-size:13px;cursor:pointer;font-family:"DM Sans",sans-serif;box-shadow:none;}',
      '#aamSettingsBox .sh button:hover{background:rgba(255,255,255,0.25);transform:none;}',
      // Tabs
      '#aamSettingsBox .stabs{display:flex;background:rgba(0,0,0,0.2);overflow-x:auto;}',
      'html.light-theme #aamSettingsBox .stabs{background:rgba(0,0,0,0.05);}',
      '#aamSettingsBox .stab{padding:12px 18px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.45);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;background:none;border-radius:0;box-shadow:none;transition:all 0.2s;border-left:none;border-right:none;border-top:none;}',
      'html.light-theme #aamSettingsBox .stab{color:rgba(30,41,59,0.45);}',
      '#aamSettingsBox .stab:hover{color:white;background:rgba(255,255,255,0.05);transform:none;box-shadow:none;}',
      'html.light-theme #aamSettingsBox .stab:hover{color:#1e293b;background:rgba(0,0,0,0.04);}',
      '#aamSettingsBox .stab.active{color:white;border-bottom-color:#3b82f6;background:rgba(59,130,246,0.1);}',
      'html.light-theme #aamSettingsBox .stab.active{color:#1e3a5f;}',
      '#aamSettingsBox .stab:disabled{opacity:0.3;cursor:not-allowed;}',
      // Tab content
      '#aamSettingsBox .spanel{padding:24px 28px;display:none;}',
      '#aamSettingsBox .spanel.active{display:block;}',
      // Field
      '#aamSettingsBox .sf{margin-bottom:16px;}',
      '#aamSettingsBox .sf label{display:block;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:6px;}',
      'html.light-theme #aamSettingsBox .sf label{color:rgba(30,41,59,0.5);}',
      '#aamSettingsBox .sf input{width:100%;padding:10px 14px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:white;font-size:14px;font-family:"DM Sans",sans-serif;outline:none;margin-bottom:0;}',
      'html.light-theme #aamSettingsBox .sf input{background:white;color:#1e293b;border-color:rgba(0,0,0,0.12);}',
      '#aamSettingsBox .sf input:focus{border-color:#3b82f6;}',
      // Rows
      '#aamSettingsBox .sr{display:grid;grid-template-columns:1fr 1fr;gap:14px;}',
      // Save button
      '#aamSettingsBox .ssave{background:linear-gradient(135deg,#059669,#10b981);border:none;color:white;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:"DM Sans",sans-serif;box-shadow:0 4px 14px rgba(5,150,105,0.3);}',
      '#aamSettingsBox .ssave:hover{background:linear-gradient(135deg,#047857,#059669);transform:translateY(-1px);}',
      '#aamSettingsBox .scancel{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);padding:10px 20px;border-radius:8px;font-size:14px;cursor:pointer;font-family:"DM Sans",sans-serif;box-shadow:none;}',
      'html.light-theme #aamSettingsBox .scancel{background:rgba(0,0,0,0.06);border-color:rgba(0,0,0,0.12);color:#1e293b;}',
      // Message
      '#aamSettingsBox .smsg{padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:16px;display:none;}',
      '#aamSettingsBox .smsg.ok{background:rgba(5,150,105,0.15);color:#34d399;border:1px solid rgba(5,150,105,0.25);}',
      '#aamSettingsBox .smsg.err{background:rgba(220,38,38,0.1);color:#f87171;border:1px solid rgba(220,38,38,0.25);}',
      // Theme toggle
      '.theme-toggle-wrap{display:flex;gap:12px;}',
      '.theme-option{flex:1;padding:16px;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);cursor:pointer;text-align:center;transition:all 0.2s;font-family:"DM Sans",sans-serif;}',
      'html.light-theme .theme-option{border-color:rgba(0,0,0,0.1);background:rgba(0,0,0,0.03);}',
      '.theme-option.selected{border-color:#3b82f6;background:rgba(59,130,246,0.12);}',
      '.theme-option .to-icon{font-size:28px;margin-bottom:8px;}',
      '.theme-option .to-label{font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);}',
      'html.light-theme .theme-option .to-label{color:rgba(30,41,59,0.7);}',
      '.theme-option.selected .to-label{color:white;}',
      'html.light-theme .theme-option.selected .to-label{color:#1e293b;}',
      // Staff list
      '.staff-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;}',
      'html.light-theme .staff-card{background:rgba(0,0,0,0.03);border-color:rgba(0,0,0,0.08);}',
      '.staff-card .sc-name{font-size:14px;font-weight:600;color:white;flex:1;}',
      'html.light-theme .staff-card .sc-name{color:#1e293b;}',
      '.staff-card .sc-role{font-size:11px;font-weight:600;padding:2px 10px;border-radius:10px;}',
      '.sc-role.owner{background:rgba(251,191,36,0.15);color:#fbbf24;}',
      '.sc-role.staff{background:rgba(96,165,250,0.15);color:#60a5fa;}',
      '.staff-card .sc-user{font-size:12px;color:rgba(255,255,255,0.4);}',
      'html.light-theme .staff-card .sc-user{color:rgba(30,41,59,0.45);}',
      // Health
      '.health-row{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:8px;margin-bottom:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);}',
      'html.light-theme .health-row{background:rgba(0,0,0,0.03);border-color:rgba(0,0,0,0.06);}',
      '.health-row .hl{font-size:13px;color:rgba(255,255,255,0.65);}',
      'html.light-theme .health-row .hl{color:rgba(30,41,59,0.65);}',
      '.health-row .hv{font-size:13px;font-weight:600;}'
    ].join('\n')
    document.head.appendChild(style)
  }

  // ── 8. Build and inject settings modal HTML ──
  function buildSettingsModal() {
    if (document.getElementById('aamSettingsOverlay')) return
    var s   = getSession()
    var isO = s && s.role === 'owner'

    var html = '<div id="aamSettingsOverlay" onclick="if(event.target===this)AAMAuth.closeSettings()">' +
      '<div id="aamSettingsBox">' +
        // Header
        '<div class="sh">' +
          '<div>' +
            '<h2>Settings</h2>' +
            '<div class="sc">Logged in as <strong>' + (s ? (s.full_name || s.username) : '—') + '</strong> &nbsp;·&nbsp; ' +
              '<span style="color:' + (isO ? '#fbbf24' : '#60a5fa') + ';">' + (isO ? 'Owner' : 'Staff') + '</span>' +
            '</div>' +
          '</div>' +
          '<button onclick="AAMAuth.closeSettings()">✕ Close</button>' +
        '</div>' +
        // Tabs
        '<div class="stabs">' +
          '<button class="stab active" onclick="AAMAuth.showTab(\'account\')">Account</button>' +
          (isO ? '<button class="stab" onclick="AAMAuth.showTab(\'business\')">Business</button>' : '') +
          (isO ? '<button class="stab" onclick="AAMAuth.showTab(\'staff\')">Staff</button>' : '') +
          '<button class="stab" onclick="AAMAuth.showTab(\'theme\')">Theme</button>' +
          (isO ? '<button class="stab" onclick="AAMAuth.showTab(\'health\')">System</button>' : '') +
        '</div>' +

        // TAB 1: Account
        '<div class="spanel active" id="stab_account">' +
          '<div class="smsg" id="smsg_account"></div>' +
          '<div style="margin-bottom:20px;padding:14px 18px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.08);">' +
            '<div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Session Info</div>' +
            '<div id="aam_session_info" style="font-size:13px;color:rgba(255,255,255,0.65);line-height:1.8;"></div>' +
          '</div>' +
          '<div style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Change My Password</div>' +
          '<div class="sf"><label>Current Password</label><input type="password" id="aam_cur_pw" placeholder="Enter current password"></div>' +
          '<div class="sr">' +
            '<div class="sf"><label>New Password</label><input type="password" id="aam_new_pw" placeholder="New password"></div>' +
            '<div class="sf"><label>Confirm New Password</label><input type="password" id="aam_new_pw2" placeholder="Confirm new password"></div>' +
          '</div>' +
          '<div style="display:flex;gap:10px;margin-top:8px;">' +
            '<button class="ssave" onclick="AAMAuth.savePassword()">Save Password</button>' +
            '<button class="scancel" onclick="AAMAuth.logout()">Logout</button>' +
          '</div>' +
        '</div>' +

        // TAB 2: Business (owner only)
        (isO ? '<div class="spanel" id="stab_business">' +
          '<div class="smsg" id="smsg_business"></div>' +
          '<div style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:16px;line-height:1.5;">These details appear on all printed bills. Changes apply immediately from the next bill you print.</div>' +
          '<div class="sf"><label>Business Name</label><input type="text" id="aam_biz_name" placeholder="e.g. Abhinandan Auto Mobiles"></div>' +
          '<div class="sf"><label>Address</label><input type="text" id="aam_biz_addr" placeholder="Street / Village / City"></div>' +
          '<div class="sr">' +
            '<div class="sf"><label>Primary Phone</label><input type="text" id="aam_biz_ph1" placeholder="+91 98700 37002"></div>' +
            '<div class="sf"><label>Secondary Phone (optional)</label><input type="text" id="aam_biz_ph2" placeholder="Leave blank if none"></div>' +
          '</div>' +
          '<div class="sf"><label>GSTIN (optional)</label><input type="text" id="aam_biz_gstin" placeholder="e.g. 24AAAAA0000A1Z5" style="text-transform:uppercase;"></div>' +
          '<div style="margin-top:8px;">' +
            '<button class="ssave" onclick="AAMAuth.saveBusiness()">Save Business Details</button>' +
          '</div>' +
        '</div>' : '') +

        // TAB 3: Staff (owner only)
        (isO ? '<div class="spanel" id="stab_staff">' +
          '<div class="smsg" id="smsg_staff"></div>' +
          '<div id="aam_staff_list" style="margin-bottom:20px;"><div style="color:rgba(255,255,255,0.3);font-size:13px;">Loading staff...</div></div>' +
          '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;">' +
            '<div style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">Add New Staff / Edit User</div>' +
            '<div class="sr">' +
              '<div class="sf"><label>Full Name</label><input type="text" id="aam_new_name" placeholder="e.g. Ramesh Kumar"></div>' +
              '<div class="sf"><label>Username (login ID)</label><input type="text" id="aam_new_uname" placeholder="e.g. ramesh1" style="text-transform:lowercase;"></div>' +
            '</div>' +
            '<div class="sr">' +
              '<div class="sf"><label>Password</label><input type="password" id="aam_new_upw" placeholder="Set a password"></div>' +
              '<div class="sf"><label>Role</label>' +
                '<select id="aam_new_role" style="color:white;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;width:100%;margin-bottom:0;">' +
                  '<option value="staff">Staff (Billing only)</option>' +
                  '<option value="owner">Owner (Full access)</option>' +
                '</select>' +
              '</div>' +
            '</div>' +
            '<div style="margin-top:8px;display:flex;gap:10px;">' +
              '<button class="ssave" onclick="AAMAuth.addStaff()">Add User</button>' +
              '<button class="scancel" onclick="AAMAuth.loadStaffList()">Refresh List</button>' +
            '</div>' +
          '</div>' +
        '</div>' : '') +

        // TAB 4: Theme
        '<div class="spanel" id="stab_theme">' +
          '<div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:20px;">Choose how the ERP looks. Your preference is saved and applies immediately.</div>' +
          '<div class="theme-toggle-wrap">' +
            '<div class="theme-option" id="theme_dark" onclick="AAMAuth.setTheme(\'dark\')">' +
              '<div class="to-icon">🌙</div>' +
              '<div class="to-label">Dark Theme</div>' +
              '<div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:4px;">Current default</div>' +
            '</div>' +
            '<div class="theme-option" id="theme_light" onclick="AAMAuth.setTheme(\'light\')">' +
              '<div class="to-icon">☀️</div>' +
              '<div class="to-label">Light Theme</div>' +
              '<div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:4px;">Soft blue-grey tones</div>' +
            '</div>' +
          '</div>' +
          '<div id="theme_applied_msg" style="display:none;margin-top:16px;padding:10px 14px;border-radius:8px;background:rgba(52,211,153,0.12);color:#34d399;font-size:13px;font-weight:600;border:1px solid rgba(52,211,153,0.25);">Theme applied!</div>' +
        '</div>' +

        // TAB 5: System Health (owner only)
        (isO ? '<div class="spanel" id="stab_health">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">' +
            '<div style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">System Health Check</div>' +
            '<button onclick="AAMAuth.loadHealth()" style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);color:#60a5fa;padding:7px 14px;font-size:12px;border-radius:8px;box-shadow:none;">Refresh</button>' +
          '</div>' +
          '<div id="aam_health_body"><div style="color:rgba(255,255,255,0.3);font-size:13px;padding:20px;text-align:center;">Click Refresh to run health check</div></div>' +
        '</div>' : '') +

      '</div>' + // #aamSettingsBox
    '</div>'    // #aamSettingsOverlay

    document.body.insertAdjacentHTML('beforeend', html)
  }

  // ── 9. Public AAMAuth API ──
  window.AAMAuth = {
    getSession : getSession,
    isOwner    : function () { var s = getSession(); return s && s.role === 'owner' },
    isStaff    : function () { var s = getSession(); return s && s.role === 'staff' },
    logout     : function () { localStorage.removeItem(SESSION_KEY); window.location.replace('login.html') },
    closeSettings : closeSettings,
    showTab       : showSettingsTab,

    openSettings : function () {
      var overlay = document.getElementById('aamSettingsOverlay')
      if (!overlay) return
      overlay.style.display = 'block'

      // Populate session info
      var s = getSession()
      if (s) {
        var daysLeft = Math.ceil((s.expiry - Date.now()) / (1000 * 60 * 60 * 24))
        var info = document.getElementById('aam_session_info')
        if (info) info.innerHTML =
          'Username: <strong style="color:white;">' + s.username + '</strong><br>' +
          'Role: <strong style="color:' + (s.role === 'owner' ? '#fbbf24' : '#60a5fa') + ';">' + (s.role === 'owner' ? 'Owner' : 'Staff') + '</strong><br>' +
          'Logged in: <strong style="color:white;">' + new Date(s.loginTime || Date.now()).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) + '</strong><br>' +
          'Session expires in: <strong style="color:' + (daysLeft <= 7 ? '#fbbf24' : '#34d399') + ';">' + daysLeft + ' day(s)</strong>'
      }

      // Populate business fields if owner
      if (s && s.role === 'owner') {
        var biz = {}
        try { biz = JSON.parse(localStorage.getItem(BIZ_CACHE_KEY) || '{}') } catch (e) {}
        var f = function (id, val) { var el = document.getElementById(id); if (el) el.value = val || '' }
        f('aam_biz_name',  biz.biz_name)
        f('aam_biz_addr',  biz.biz_address)
        f('aam_biz_ph1',   biz.biz_phone1)
        f('aam_biz_ph2',   biz.biz_phone2)
        f('aam_biz_gstin', biz.biz_gstin)
      }

      // Mark current theme
      var t = localStorage.getItem(THEME_KEY) || 'dark'
      var dtEl = document.getElementById('theme_dark')
      var ltEl = document.getElementById('theme_light')
      if (dtEl) dtEl.className = 'theme-option' + (t === 'dark' ? ' selected' : '')
      if (ltEl) ltEl.className = 'theme-option' + (t === 'light' ? ' selected' : '')

      // Load staff list if owner
      if (s && s.role === 'owner') window.AAMAuth.loadStaffList()

      showSettingsTab('account')
    },

    setTheme : function (theme) {
      localStorage.setItem(THEME_KEY, theme)
      if (theme === 'light') document.documentElement.classList.add('light-theme')
      else document.documentElement.classList.remove('light-theme')
      var dtEl = document.getElementById('theme_dark')
      var ltEl = document.getElementById('theme_light')
      if (dtEl) dtEl.className = 'theme-option' + (theme === 'dark' ? ' selected' : '')
      if (ltEl) ltEl.className = 'theme-option' + (theme === 'light' ? ' selected' : '')
      var msg = document.getElementById('theme_applied_msg')
      if (msg) { msg.style.display = 'block'; setTimeout(function () { msg.style.display = 'none' }, 2000) }
    },

    savePassword : async function () {
      var s     = getSession()
      var sb    = getSB()
      var curPw = (document.getElementById('aam_cur_pw') || {}).value || ''
      var newPw = (document.getElementById('aam_new_pw') || {}).value || ''
      var newP2 = (document.getElementById('aam_new_pw2') || {}).value || ''

      var showMsg = function (type, text) {
        var el = document.getElementById('smsg_account')
        if (!el) return
        el.className = 'smsg ' + type; el.innerText = text; el.style.display = 'block'
        setTimeout(function () { el.style.display = 'none' }, 4000)
      }

      if (!curPw || !newPw || !newP2) return showMsg('err', 'Please fill all three password fields')
      if (newPw !== newP2) return showMsg('err', 'New passwords do not match')
      if (newPw.length < 6) return showMsg('err', 'New password must be at least 6 characters')
      if (!s || !sb) return showMsg('err', 'Session error — please reload')

      // Verify current password
      var check = await sb.from('users').select('id').eq('username', s.username).eq('password', curPw).eq('is_active', true).single()
      if (check.error || !check.data) return showMsg('err', 'Current password is wrong')

      // Update
      var upd = await sb.from('users').update({ password: newPw }).eq('username', s.username)
      if (upd.error) return showMsg('err', 'Error saving: ' + upd.error.message)

      showMsg('ok', 'Password updated! It takes effect immediately.')
      ;['aam_cur_pw','aam_new_pw','aam_new_pw2'].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.value = ''
      })
    },

    saveBusiness : async function () {
      var sb = getSB()
      var showMsg = function (type, text) {
        var el = document.getElementById('smsg_business')
        if (!el) return
        el.className = 'smsg ' + type; el.innerText = text; el.style.display = 'block'
        setTimeout(function () { el.style.display = 'none' }, 4000)
      }

      var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : '' }
      var name  = g('aam_biz_name')
      var addr  = g('aam_biz_addr')
      var ph1   = g('aam_biz_ph1')
      var ph2   = g('aam_biz_ph2')
      var gstin = g('aam_biz_gstin').toUpperCase()

      if (!name) return showMsg('err', 'Business name cannot be empty')
      if (!sb) return showMsg('err', 'Connection error')

      var rows = [
        { key: 'biz_name',    value: name  },
        { key: 'biz_address', value: addr  },
        { key: 'biz_phone1',  value: ph1   },
        { key: 'biz_phone2',  value: ph2   },
        { key: 'biz_gstin',   value: gstin }
      ]

      var err = null
      for (var i = 0; i < rows.length; i++) {
        var res = await sb.from('settings').upsert({ key: rows[i].key, value: rows[i].value })
        if (res.error) { err = res.error.message; break }
      }

      if (err) return showMsg('err', 'Error: ' + err)

      var biz = { biz_name: name, biz_address: addr, biz_phone1: ph1, biz_phone2: ph2, biz_gstin: gstin }
      localStorage.setItem(BIZ_CACHE_KEY, JSON.stringify(biz))
      applyBusinessToDOM(biz)
      showMsg('ok', 'Business details saved! Bills will show updated info.')
    },

    loadStaffList : async function () {
      var container = document.getElementById('aam_staff_list')
      var sb = getSB()
      if (!container) return
      container.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:13px;">Loading...</div>'
      if (!sb) { container.innerHTML = '<div style="color:#f87171;font-size:13px;">Connection error</div>'; return }

      var res = await sb.from('users').select('id,username,full_name,role,is_active').order('role').order('full_name')
      if (res.error || !res.data) { container.innerHTML = '<div style="color:#f87171;font-size:13px;">Error loading staff</div>'; return }

      var s = getSession()
      container.innerHTML = res.data.map(function (u) {
        var isMe = s && s.username === u.username
        return '<div class="staff-card">' +
          '<div>' +
            '<div class="sc-name">' + (u.full_name || u.username) + (isMe ? ' <span style="font-size:11px;color:rgba(255,255,255,0.35);">(you)</span>' : '') + '</div>' +
            '<div class="sc-user">@' + u.username + ' &nbsp;·&nbsp; ' + (u.is_active ? '<span style="color:#34d399;">Active</span>' : '<span style="color:#f87171;">Inactive</span>') + '</div>' +
          '</div>' +
          '<span class="sc-role ' + u.role + '">' + (u.role === 'owner' ? 'Owner' : 'Staff') + '</span>' +
          (!isMe ? '<button onclick="AAMAuth.toggleActive(' + u.id + ',\'' + u.username + '\',' + u.is_active + ')" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);padding:5px 10px;font-size:11px;border-radius:6px;box-shadow:none;">' + (u.is_active ? 'Disable' : 'Enable') + '</button>' : '') +
          (!isMe && u.role !== 'owner' ? '<button onclick="AAMAuth.deleteStaff(' + u.id + ',\'' + (u.full_name || u.username) + '\')" style="background:rgba(220,38,38,0.15);border:1px solid rgba(220,38,38,0.25);color:#f87171;padding:5px 10px;font-size:11px;border-radius:6px;box-shadow:none;">Remove</button>' : '') +
        '</div>'
      }).join('') || '<div style="color:rgba(255,255,255,0.3);font-size:13px;">No users found</div>'
    },

    addStaff : async function () {
      var sb = getSB()
      var showMsg = function (type, text) {
        var el = document.getElementById('smsg_staff')
        if (!el) return
        el.className = 'smsg ' + type; el.innerText = text; el.style.display = 'block'
        setTimeout(function () { el.style.display = 'none' }, 4000)
      }
      var name  = (document.getElementById('aam_new_name')  || {}).value || ''
      var uname = ((document.getElementById('aam_new_uname') || {}).value || '').toLowerCase().trim()
      var pw    = (document.getElementById('aam_new_upw')   || {}).value || ''
      var role  = (document.getElementById('aam_new_role')  || {}).value || 'staff'

      if (!name.trim())  return showMsg('err', 'Enter full name')
      if (!uname)        return showMsg('err', 'Enter a username')
      if (uname.length < 3) return showMsg('err', 'Username must be at least 3 characters')
      if (!pw || pw.length < 6) return showMsg('err', 'Password must be at least 6 characters')
      if (!sb) return showMsg('err', 'Connection error')

      var res = await sb.from('users').insert([{ username: uname, password: pw, role: role, full_name: name.trim(), is_active: true }])
      if (res.error) {
        if (res.error.message.indexOf('unique') !== -1 || res.error.code === '23505') return showMsg('err', 'Username "' + uname + '" already exists. Choose a different one.')
        return showMsg('err', 'Error: ' + res.error.message)
      }

      showMsg('ok', 'User "' + name.trim() + '" added! They can login immediately with username: ' + uname)
      ;['aam_new_name','aam_new_uname','aam_new_upw'].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.value = ''
      })
      window.AAMAuth.loadStaffList()
    },

    toggleActive : async function (id, username, currentlyActive) {
      var sb = getSB()
      if (!sb) return
      await sb.from('users').update({ is_active: !currentlyActive }).eq('id', id)
      window.AAMAuth.loadStaffList()
    },

    deleteStaff : async function (id, name) {
      if (!confirm('Remove "' + name + '"? They will no longer be able to login.')) return
      var sb = getSB()
      if (!sb) return
      await sb.from('users').delete().eq('id', id)
      window.AAMAuth.loadStaffList()
    },

    loadHealth : async function () {
      var container = document.getElementById('aam_health_body')
      if (!container) return
      container.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:13px;padding:10px;text-align:center;">Running checks...</div>'
      var sb = getSB()
      if (!sb) { container.innerHTML = '<div style="color:#f87171;font-size:13px;">Supabase not loaded</div>'; return }

      function row(label, val, color) {
        return '<div class="health-row"><span class="hl">' + label + '</span><span class="hv" style="color:' + (color || '#34d399') + ';">' + val + '</span></div>'
      }

      try {
        var results = await Promise.all([
          sb.from('inventory').select('id', {count:'exact', head:true}),
          sb.from('customers').select('id', {count:'exact', head:true}),
          sb.from('merchants').select('id', {count:'exact', head:true}),
          sb.from('sales').select('id', {count:'exact', head:true}),
          sb.from('purchases').select('id', {count:'exact', head:true}),
          sb.from('notifications').select('id', {count:'exact', head:true}).eq('is_read', false),
          sb.from('inventory').select('id', {count:'exact', head:true}).lte('quantity', 5),
          sb.from('users').select('id', {count:'exact', head:true}).eq('is_active', true)
        ])

        var inv  = results[0].count || 0
        var cust = results[1].count || 0
        var mer  = results[2].count || 0
        var sal  = results[3].count || 0
        var pur  = results[4].count || 0
        var unrd = results[5].count || 0
        var low  = results[6].count || 0
        var usrs = results[7].count || 0

        var html =
          row('Database connection', '✓ Connected', '#34d399') +
          row('Total products in inventory', inv.toLocaleString('en-IN'), inv >= 1000 ? '#34d399' : '#fbbf24') +
          row('Total customers', cust.toLocaleString('en-IN'), '#60a5fa') +
          row('Total merchants', mer.toLocaleString('en-IN'), '#60a5fa') +
          row('Total sales bills', sal.toLocaleString('en-IN'), '#60a5fa') +
          row('Total purchase bills', pur.toLocaleString('en-IN'), '#a78bfa') +
          row('Low stock items (≤5 qty)', low > 0 ? low + ' items need restocking' : '0 — All good', low > 0 ? '#fbbf24' : '#34d399') +
          row('Unread notifications', unrd > 0 ? unrd + ' pending' : '0 — All read', unrd > 10 ? '#f87171' : '#34d399') +
          row('Active users', usrs.toLocaleString('en-IN'), '#60a5fa') +
          row('System capacity (20k products)', inv <= 20000 ? 'OK (' + inv + '/20,000)' : 'Over limit!', inv > 20000 ? '#f87171' : '#34d399') +
          row('Session status', 'Valid', '#34d399')

        container.innerHTML = html
      } catch (e) {
        container.innerHTML = '<div class="health-row"><span class="hl">Database connection</span><span class="hv" style="color:#f87171;">Error: ' + e.message + '</span></div>'
      }
    },

    // ── Apply sidebar UI (called on every page) ──
    applyUI : function () {
      var s = getSession()
      if (!s) return
      var sidebar = document.querySelector('.sidebar')
      if (!sidebar) return

      injectSettingsCSS()

      // 1. Hide owner-only links from staff
      if (s.role === 'staff') {
        sidebar.querySelectorAll('.owner-only').forEach(function (el) { el.style.display = 'none' })
        // Add Inventory label above Products link
        var pLink = sidebar.querySelector('a[href="products.html"]')
        if (pLink && !document.getElementById('aam_inv_label')) {
          var lbl = document.createElement('div')
          lbl.className = 'sidebar-label'; lbl.id = 'aam_inv_label'; lbl.innerText = 'Inventory'
          sidebar.insertBefore(lbl, pLink)
        }
      }

      // 2. Products page: staff sees read-only banner
      if (s.role === 'staff' && currentPage() === 'products.html') {
        var st = document.createElement('style')
        st.innerText = '#addProductBtn,button[onclick*="openEdit"],button[onclick*="deleteProduct"],.edit-btn,.delete-btn,td:last-child button,th:last-child{display:none!important;}'
        document.head.appendChild(st)
        setTimeout(function () {
          var main = document.querySelector('.main')
          if (main && !document.getElementById('aam_ro_banner')) {
            var b = document.createElement('div')
            b.id = 'aam_ro_banner'
            b.style.cssText = 'background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.3);border-radius:10px;padding:10px 16px;margin-bottom:16px;font-size:13px;color:#60a5fa;font-weight:600;'
            b.innerHTML = 'View Only — You can check stock levels but cannot add or edit products. Contact the owner for inventory changes.'
            main.insertBefore(b, main.firstChild)
          }
        }, 400)
      }

      // 3. Remove old user bar if exists
      var oldBar = document.getElementById('aam_userbar')
      if (oldBar) oldBar.remove()

      // 4. Build settings button at bottom of sidebar
      var settingsBtn = document.createElement('div')
      settingsBtn.id = 'aam_settings_btn'
      settingsBtn.style.cssText = 'padding:8px 10px 0;'

      var daysLeft = Math.ceil((s.expiry - Date.now()) / (1000 * 60 * 60 * 24))
      var roleColor = s.role === 'owner' ? '#fbbf24' : '#60a5fa'

      settingsBtn.innerHTML =
        '<button onclick="AAMAuth.openSettings()" style="' +
          'width:100%;display:flex;align-items:center;gap:10px;' +
          'background:rgba(255,255,255,0.06);' +
          'border:1px solid rgba(255,255,255,0.1);' +
          'border-radius:10px;padding:10px 12px;cursor:pointer;' +
          'font-family:\'DM Sans\',sans-serif;text-align:left;' +
          'box-shadow:none;transition:all 0.2s;' +
        '"' +
        ' onmouseover="this.style.background=\'rgba(255,255,255,0.1)\'"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,0.06)\'">' +
          '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,' +
            (s.role === 'owner' ? '#1e3a5f,#2563eb' : '#1e293b,#475569') +
          ');display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;">' +
            (s.full_name || s.username || 'U')[0].toUpperCase() +
          '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (s.full_name || s.username) + '</div>' +
            '<div style="font-size:11px;color:' + roleColor + ';font-weight:600;">' + (s.role === 'owner' ? 'Owner' : 'Staff') + '</div>' +
          '</div>' +
          '<div style="font-size:16px;color:rgba(255,255,255,0.4);">⚙</div>' +
        '</button>'

      // Notification bell for owner (below settings button)
      if (s.role === 'owner') {
        var notifRow = document.createElement('div')
        notifRow.style.cssText = 'padding:6px 10px 0;'
        notifRow.innerHTML =
          '<a href="dashboard.html" id="notifBell" style="display:flex;align-items:center;gap:8px;text-decoration:none;padding:8px 12px;border-radius:10px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.15);font-size:12px;color:#fbbf24;font-weight:600;">🔔 Notifications <span id="notifBadge" style="display:none;background:#dc2626;color:white;border-radius:10px;padding:1px 7px;font-size:11px;margin-left:auto;">0</span></a>'
        settingsBtn.appendChild(notifRow)

        // Load unread count
        setTimeout(function () {
          var sb2 = getSB(); if (!sb2) return
          sb2.from('notifications').select('id', {count:'exact'}).eq('is_read', false).then(function (res) {
            var cnt = res.count || 0
            var b = document.getElementById('notifBadge')
            if (b && cnt > 0) { b.style.display = 'inline'; b.innerText = cnt > 99 ? '99+' : cnt }
          })
        }, 1500)
      }

      var bottom = sidebar.querySelector('.sidebar-bottom')
      if (bottom) sidebar.insertBefore(settingsBtn, bottom)
      else sidebar.appendChild(settingsBtn)

      // 5. Build modal (injected once)
      buildSettingsModal()

      // 6. Load business details for print areas
      setTimeout(loadAndApplyBusiness, 500)

      // 7. Session expiry warning
      if (daysLeft <= 5) {
        setTimeout(function () {
          var warn = document.createElement('div')
          warn.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#b45309;color:white;padding:12px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,0.4);cursor:pointer;'
          warn.innerHTML = 'Session expires in ' + daysLeft + ' day(s). Open Settings → Account to stay logged in.'
          warn.onclick = function () { warn.remove(); window.AAMAuth.openSettings() }
          document.body.appendChild(warn)
          setTimeout(function () { if (warn.parentNode) warn.remove() }, 8000)
        }, 2500)
      }
    }
  }

  // ── 10. Settings tab switcher ──
  function showSettingsTab(tabName) {
    var tabs   = document.querySelectorAll('#aamSettingsBox .stab')
    var panels = document.querySelectorAll('#aamSettingsBox .spanel')
    tabs.forEach(function (t) { t.classList.remove('active') })
    panels.forEach(function (p) { p.classList.remove('active') })
    var panel = document.getElementById('stab_' + tabName)
    if (panel) panel.classList.add('active')
    // Mark tab button active
    tabs.forEach(function (t) {
      if (t.getAttribute('onclick') && t.getAttribute('onclick').indexOf(tabName) !== -1) t.classList.add('active')
    })
    // Auto-load health when that tab opens
    if (tabName === 'health') window.AAMAuth.loadHealth()
  }

  function closeSettings() {
    var el = document.getElementById('aamSettingsOverlay')
    if (el) el.style.display = 'none'
  }

  // ── 11. Auto-run ──
  function runUI() { if (window.AAMAuth) window.AAMAuth.applyUI() }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runUI)
  else setTimeout(runUI, 0)

})()
