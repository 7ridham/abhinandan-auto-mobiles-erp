// auth.js — Abhinandan Auto Mobiles ERP v5
// ROOT FIX: auth.js now loads its own Supabase instance independently
// so settings, notifications, and business details always work on every page

(function () {
  'use strict'

  var SESSION_KEY   = 'aam_erp_session'
  var THEME_KEY     = 'aam_erp_theme'
  var BIZ_CACHE_KEY = 'aam_biz_cache'
  var STAFF_ALLOWED = ['billing.html', 'products.html']
  var SB_URL = 'https://mhhnmndnolhapaoqtbxo.supabase.co'
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oaG5tbmRub2xoYXBhb3F0YnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mzg4NTksImV4cCI6MjA4ODQxNDg1OX0.IMSp8vYiCln_iSuoT_H2qdeX_dP1WMhOOskDw20eJXw'

  // ── 1. Apply theme BEFORE DOM renders ──
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

  // ── 3. Access control ──
  var session = getSession()
  var page    = currentPage()
  if (!session) {
    if (page !== 'login.html') window.location.replace('login.html')
  } else {
    if (session.role === 'staff' && STAFF_ALLOWED.indexOf(page) === -1) {
      window.location.replace('billing.html')
    }
  }

  // ── 4. Auth.js owns its own Supabase instance ──
  // This is stored separately as window._authSB so it never conflicts
  // with the page's own supabase module import
  var _authSBReady = false
  var _authSBCallbacks = []
  var _authSB = null

  function getAuthSB() {
    return _authSB
  }

  // Load Supabase UMD script for auth.js's exclusive use
  function loadAuthSupabase() {
    // If already loaded by the page (UMD style), reuse it
    if (window.supabase && window.supabase.createClient && !_authSB) {
      _authSB = window.supabase.createClient(SB_URL, SB_KEY)
      _authSBReady = true
      _authSBCallbacks.forEach(function(cb){ try{ cb() }catch(e){} })
      _authSBCallbacks = []
      return
    }

    // If already initialized
    if (_authSB) return

    // Load fresh UMD script
    var script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'
    script.onload = function () {
      _authSB = window.supabase.createClient(SB_URL, SB_KEY)
      // Also expose as window._supabase for billing pages that need it
      if (!window._supabase) window._supabase = _authSB
      _authSBReady = true
      _authSBCallbacks.forEach(function(cb){ try{ cb() }catch(e){} })
      _authSBCallbacks = []
    }
    script.onerror = function() {
      console.error('Auth.js: Failed to load Supabase')
    }
    document.head.appendChild(script)
  }

  // Run a function once Supabase is ready
  function withSB(fn) {
    if (_authSBReady && _authSB) {
      fn(_authSB)
    } else {
      _authSBCallbacks.push(function(){ fn(_authSB) })
      if (!_authSB) loadAuthSupabase()
    }
  }

  // Start loading immediately
  loadAuthSupabase()

  // ── 5. Notification helper ──
  // Called from billing.html after a bill is saved
  window.AAMNotify = function (opts) {
    var s = getSession()
    withSB(function(sb) {
      sb.from('notifications').insert([{
        type:        opts.type        || 'bill',
        title:       opts.title       || 'Activity',
        message:     opts.message     || '',
        done_by:     s ? (s.full_name || s.username) : 'Unknown',
        bill_number: opts.bill_number || null,
        amount:      opts.amount      || 0,
        is_read:     false
      }]).then(function(res){
        if (res.error) console.warn('Notification error:', res.error.message)
      })
    })
  }

  // ── 6. Business details ──
  function loadAndApplyBusiness() {
    var cached = {}
    try { cached = JSON.parse(localStorage.getItem(BIZ_CACHE_KEY) || '{}') } catch (e) {}
    if (cached.biz_name) applyBusinessToDOM(cached)

    withSB(function(sb) {
      sb.from('settings').select('key,value').then(function(res) {
        if (res.data && res.data.length) {
          var biz = {}
          res.data.forEach(function (r) { biz[r.key] = r.value })
          localStorage.setItem(BIZ_CACHE_KEY, JSON.stringify(biz))
          applyBusinessToDOM(biz)
        }
      })
    })
  }

  function applyBusinessToDOM(biz) {
    if (!biz.biz_name) return
    document.querySelectorAll('.bill-company-name, .pur-company-name, .inv-company, .rcpt-company, .stmt-company').forEach(function (el) {
      el.textContent = biz.biz_name
    })
    var subs = document.querySelectorAll('.bill-company-sub, .pur-company-sub')
    var lines = []
    if (biz.biz_address) lines.push(biz.biz_address)
    if (biz.biz_phone1)  lines.push(biz.biz_phone1)
    if (biz.biz_phone2)  lines.push(biz.biz_phone2)
    subs.forEach(function (el, i) {
      if (lines[i] !== undefined) el.textContent = lines[i]
    })
    document.querySelectorAll('.stmt-sub, .rcpt-sub').forEach(function (el) {
      var text = biz.biz_address || ''
      if (biz.biz_phone1) text += (text ? '  |  ' : '') + biz.biz_phone1
      el.textContent = text
    })
  }

  // ── 7. Settings CSS ──
  function injectSettingsCSS() {
    if (document.getElementById('aam_settings_css')) return
    var style = document.createElement('style')
    style.id  = 'aam_settings_css'
    style.textContent = `
      #aamSettingsOverlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.80);z-index:99000;overflow-y:auto;padding:20px;backdrop-filter:blur(12px);}
      #aamSettingsBox{background:linear-gradient(135deg,#0d1117,#0f172a);border:1px solid rgba(255,255,255,0.12);border-radius:20px;max-width:700px;margin:30px auto;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.7);}
      html.light-theme #aamSettingsBox{background:linear-gradient(135deg,#f0f4ff,#ffffff);border-color:rgba(0,0,0,0.1);}
      #aamSettingsBox .sh{background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:22px 28px;display:flex;justify-content:space-between;align-items:center;}
      #aamSettingsBox .sh h2{font-family:'Playfair Display',serif;font-size:20px;color:white;margin:0;}
      #aamSettingsBox .sh .sc{color:rgba(255,255,255,0.65);font-size:13px;margin-top:3px;}
      #aamSettingsBox .sh button{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;padding:7px 16px;border-radius:8px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;box-shadow:none;transition:background 0.2s;}
      #aamSettingsBox .sh button:hover{background:rgba(255,255,255,0.25);transform:none;}
      #aamSettingsBox .stabs{display:flex;background:rgba(0,0,0,0.25);overflow-x:auto;border-bottom:1px solid rgba(255,255,255,0.06);}
      html.light-theme #aamSettingsBox .stabs{background:rgba(0,0,0,0.04);border-bottom-color:rgba(0,0,0,0.08);}
      #aamSettingsBox .stab{padding:13px 20px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.4);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;background:none;border-radius:0;box-shadow:none;transition:all 0.2s;border-left:none;border-right:none;border-top:none;}
      html.light-theme #aamSettingsBox .stab{color:rgba(15,23,42,0.45);}
      #aamSettingsBox .stab:hover{color:white;background:rgba(255,255,255,0.06);transform:none;box-shadow:none;}
      html.light-theme #aamSettingsBox .stab:hover{color:#0f172a;background:rgba(0,0,0,0.04);}
      #aamSettingsBox .stab.active{color:white;border-bottom-color:#3b82f6;background:rgba(59,130,246,0.1);}
      html.light-theme #aamSettingsBox .stab.active{color:#1e3a5f;border-bottom-color:#2563eb;background:rgba(37,99,235,0.07);}
      #aamSettingsBox .spanel{padding:24px 28px;display:none;}
      #aamSettingsBox .spanel.active{display:block;}
      #aamSettingsBox .sf{margin-bottom:16px;}
      #aamSettingsBox .sf label{display:block;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:7px;}
      html.light-theme #aamSettingsBox .sf label{color:#475569;}
      #aamSettingsBox .sf input,#aamSettingsBox .sf select,#aamStaffPwSection input,#aamStaffPwSection select{width:100%;padding:11px 14px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.07);color:white;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;margin-bottom:0;transition:border-color 0.2s;}
      html.light-theme #aamSettingsBox .sf input,html.light-theme #aamSettingsBox .sf select,html.light-theme #aamStaffPwSection input,html.light-theme #aamStaffPwSection select{background:white;color:#0f172a;border-color:rgba(0,0,0,0.15);}
      #aamSettingsBox .sf input:focus,#aamStaffPwSection input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.15);}
      #aamSettingsBox .sr{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
      #aamSettingsBox .ssave{background:linear-gradient(135deg,#059669,#10b981);border:none;color:white;padding:11px 26px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;box-shadow:0 4px 14px rgba(5,150,105,0.3);transition:all 0.2s;}
      #aamSettingsBox .ssave:hover{background:linear-gradient(135deg,#047857,#059669);transform:translateY(-1px);}
      #aamSettingsBox .scancel{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.75);padding:11px 22px;border-radius:8px;font-size:14px;cursor:pointer;font-family:'DM Sans',sans-serif;box-shadow:none;transition:background 0.2s;}
      html.light-theme #aamSettingsBox .scancel{background:rgba(0,0,0,0.06);border-color:rgba(0,0,0,0.12);color:#334155;}
      #aamSettingsBox .scancel:hover{background:rgba(255,255,255,0.14);transform:none;}
      .aam-smsg{padding:11px 15px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:16px;display:none;}
      .aam-smsg.ok{background:rgba(5,150,105,0.15);color:#34d399;border:1px solid rgba(5,150,105,0.3);}
      .aam-smsg.err{background:rgba(220,38,38,0.12);color:#f87171;border:1px solid rgba(220,38,38,0.3);}
      .aam-session-box{margin-bottom:20px;padding:16px 18px;background:rgba(255,255,255,0.05);border-radius:10px;border:1px solid rgba(255,255,255,0.09);}
      html.light-theme .aam-session-box{background:rgba(0,0,0,0.04);border-color:rgba(0,0,0,0.09);}
      .aam-session-box .albl{font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;font-weight:700;}
      html.light-theme .aam-session-box .albl{color:#64748b;}
      .aam-session-box .ainfo{font-size:13px;color:rgba(255,255,255,0.65);line-height:2.0;}
      html.light-theme .aam-session-box .ainfo{color:#334155;}
      .aam-session-box .ainfo strong{color:white;}
      html.light-theme .aam-session-box .ainfo strong{color:#0f172a;}
      .aam-section-head{font-size:11px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06);}
      html.light-theme .aam-section-head{color:#64748b;border-bottom-color:rgba(0,0,0,0.08);}
      .aam-staff-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
      html.light-theme .aam-staff-card{background:rgba(0,0,0,0.03);border-color:rgba(0,0,0,0.08);}
      .aam-staff-card .sc-name{font-size:14px;font-weight:600;color:white;flex:1;min-width:100px;}
      html.light-theme .aam-staff-card .sc-name{color:#0f172a;}
      .aam-staff-card .sc-user{font-size:12px;color:rgba(255,255,255,0.4);}
      html.light-theme .aam-staff-card .sc-user{color:#64748b;}
      .sc-role{font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;}
      .sc-role.owner{background:rgba(251,191,36,0.15);color:#fbbf24;}
      .sc-role.staff{background:rgba(96,165,250,0.15);color:#60a5fa;}
      .aam-health-row{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:8px;margin-bottom:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);}
      html.light-theme .aam-health-row{background:rgba(0,0,0,0.03);border-color:rgba(0,0,0,0.06);}
      .aam-health-row .hl{font-size:13px;color:rgba(255,255,255,0.65);}
      html.light-theme .aam-health-row .hl{color:#334155;}
      .aam-health-row .hv{font-size:13px;font-weight:700;}
      #aamStaffPwSection{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;margin-top:18px;}
      html.light-theme #aamStaffPwSection{background:rgba(0,0,0,0.03);border-color:rgba(0,0,0,0.08);}
      .theme-toggle-wrap{display:flex;gap:12px;}
      .theme-option{flex:1;padding:18px 14px;border-radius:12px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);cursor:pointer;text-align:center;transition:all 0.2s;font-family:'DM Sans',sans-serif;}
      html.light-theme .theme-option{border-color:rgba(0,0,0,0.1);background:rgba(0,0,0,0.03);}
      .theme-option.selected{border-color:#3b82f6;background:rgba(59,130,246,0.12);}
      .theme-option .to-icon{font-size:30px;margin-bottom:8px;}
      .theme-option .to-label{font-size:14px;font-weight:700;color:rgba(255,255,255,0.75);}
      html.light-theme .theme-option .to-label{color:rgba(15,23,42,0.75);}
      .theme-option.selected .to-label{color:white;}
      html.light-theme .theme-option.selected .to-label{color:#1e3a5f;}
    `
    document.head.appendChild(style)
  }

  // ── 8. Build settings modal HTML ──
  function buildSettingsModal() {
    if (document.getElementById('aamSettingsOverlay')) return
    var s   = getSession()
    var isO = s && s.role === 'owner'

    var html = `
    <div id="aamSettingsOverlay" onclick="if(event.target===this)AAMAuth.closeSettings()">
      <div id="aamSettingsBox">
        <div class="sh">
          <div>
            <h2>Settings</h2>
            <div class="sc">Logged in as <strong>${s ? (s.full_name || s.username) : '—'}</strong> &nbsp;·&nbsp;
              <span style="color:${isO ? '#fbbf24' : '#60a5fa'};">${isO ? 'Owner' : 'Staff'}</span>
            </div>
          </div>
          <button onclick="AAMAuth.closeSettings()">Close</button>
        </div>
        <div class="stabs">
          <button class="stab active" onclick="AAMAuth.showTab('account')">Account</button>
          ${isO ? '<button class="stab" onclick="AAMAuth.showTab(\'business\')">Business</button>' : ''}
          ${isO ? '<button class="stab" onclick="AAMAuth.showTab(\'staff\')">Staff</button>' : ''}
          <button class="stab" onclick="AAMAuth.showTab('theme')">Theme</button>
          ${isO ? '<button class="stab" onclick="AAMAuth.showTab(\'health\')">System</button>' : ''}
        </div>

        <!-- ACCOUNT TAB -->
        <div class="spanel active" id="stab_account">
          <div class="aam-smsg" id="smsg_account"></div>
          <div class="aam-session-box">
            <div class="albl">Session Info</div>
            <div class="ainfo" id="aam_session_info"></div>
          </div>
          ${isO ? `
          <div class="aam-section-head">Change My Password</div>
          <div class="sf"><label>Current Password</label><input type="password" id="aam_cur_pw" placeholder="Enter current password"></div>
          <div class="sr">
            <div class="sf"><label>New Password</label><input type="password" id="aam_new_pw" placeholder="New password"></div>
            <div class="sf"><label>Confirm New Password</label><input type="password" id="aam_new_pw2" placeholder="Confirm new password"></div>
          </div>
          <div style="display:flex;gap:10px;margin-top:4px;">
            <button class="ssave" onclick="AAMAuth.savePassword()">Save Password</button>
            <button class="scancel" onclick="AAMAuth.logout()">Logout</button>
          </div>
          ` : `
          <div style="padding:12px 16px;background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);border-radius:10px;font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:16px;line-height:1.6;">
            Password changes are managed by the owner. Contact Abhinandan for a password reset.
          </div>
          <button class="scancel" onclick="AAMAuth.logout()" style="width:100%;text-align:center;justify-content:center;">Logout</button>
          `}
        </div>

        ${isO ? `
        <!-- BUSINESS TAB -->
        <div class="spanel" id="stab_business">
          <div class="aam-smsg" id="smsg_business"></div>
          <div class="aam-section-head">Business Details (Appear on all bills)</div>
          <div class="sf"><label>Business Name</label><input type="text" id="aam_biz_name" placeholder="e.g. Abhinandan Auto Mobiles"></div>
          <div class="sf"><label>Address</label><input type="text" id="aam_biz_addr" placeholder="Street / Village / City"></div>
          <div class="sr">
            <div class="sf"><label>Primary Phone</label><input type="text" id="aam_biz_ph1" placeholder="+91 98700 37002"></div>
            <div class="sf"><label>Secondary Phone</label><input type="text" id="aam_biz_ph2" placeholder="Optional"></div>
          </div>
          <div class="sf"><label>GSTIN (optional)</label><input type="text" id="aam_biz_gstin" placeholder="e.g. 24AAAAA0000A1Z5" style="text-transform:uppercase;"></div>
          <button class="ssave" onclick="AAMAuth.saveBusiness()">Save Business Details</button>
        </div>

        <!-- STAFF TAB -->
        <div class="spanel" id="stab_staff">
          <div class="aam-smsg" id="smsg_staff"></div>
          <div class="aam-section-head">Current Staff</div>
          <div id="aam_staff_list" style="margin-bottom:20px;"><div style="color:rgba(255,255,255,0.3);font-size:13px;">Loading...</div></div>

          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;margin-bottom:0;">
            <div class="aam-section-head">Add New Staff</div>
            <div class="sr">
              <div class="sf"><label>Full Name</label><input type="text" id="aam_new_name" placeholder="e.g. Ramesh Kumar"></div>
              <div class="sf"><label>Username</label><input type="text" id="aam_new_uname" placeholder="e.g. ramesh1"></div>
            </div>
            <div class="sr">
              <div class="sf"><label>Password</label><input type="password" id="aam_new_upw" placeholder="Min 6 characters"></div>
              <div class="sf"><label>Role</label>
                <select id="aam_new_role" style="color:white;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.12);border-radius:8px;padding:11px 14px;width:100%;margin-bottom:0;">
                  <option value="staff">Staff (Billing only)</option>
                  <option value="owner">Owner (Full access)</option>
                </select>
              </div>
            </div>
            <div style="display:flex;gap:10px;margin-top:4px;">
              <button class="ssave" onclick="AAMAuth.addStaff()">Add User</button>
              <button class="scancel" onclick="AAMAuth.loadStaffList()">Refresh</button>
            </div>
          </div>

          <div id="aamStaffPwSection">
            <div class="aam-section-head" style="margin-top:0;">Reset Any Staff Password</div>
            <div class="aam-smsg" id="smsg_staffpw"></div>
            <div class="sf">
              <label>Select Staff Member</label>
              <select id="aam_reset_staff_select" style="color:white;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.12);border-radius:8px;padding:11px 14px;width:100%;margin-bottom:0;">
                <option value="">-- Select staff --</option>
              </select>
            </div>
            <div class="sr" style="margin-top:12px;">
              <div class="sf"><label>New Password</label><input type="password" id="aam_reset_pw" placeholder="New password"></div>
              <div class="sf"><label>Confirm Password</label><input type="password" id="aam_reset_pw2" placeholder="Confirm"></div>
            </div>
            <button class="ssave" onclick="AAMAuth.resetStaffPassword()">Reset Password</button>
          </div>
        </div>
        ` : ''}

        <!-- THEME TAB -->
        <div class="spanel" id="stab_theme">
          <div class="aam-section-head">Display Theme</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:20px;">Your preference is saved and applied immediately across all pages.</div>
          <div class="theme-toggle-wrap">
            <div class="theme-option" id="theme_dark" onclick="AAMAuth.setTheme('dark')">
              <div class="to-icon">🌙</div>
              <div class="to-label">Dark Theme</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">Deep navy glass</div>
            </div>
            <div class="theme-option" id="theme_light" onclick="AAMAuth.setTheme('light')">
              <div class="to-icon">☀️</div>
              <div class="to-label">Light Theme</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">Clean & bright</div>
            </div>
          </div>
          <div id="theme_applied_msg" style="display:none;margin-top:16px;padding:11px 15px;border-radius:8px;background:rgba(52,211,153,0.12);color:#34d399;font-size:13px;font-weight:600;border:1px solid rgba(52,211,153,0.25);">Theme applied!</div>
        </div>

        ${isO ? `
        <!-- SYSTEM HEALTH TAB -->
        <div class="spanel" id="stab_health">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
            <div class="aam-section-head" style="margin-bottom:0;">System Health Check</div>
            <button onclick="AAMAuth.loadHealth()" style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);color:#60a5fa;padding:7px 16px;font-size:12px;border-radius:8px;box-shadow:none;font-family:'DM Sans',sans-serif;">Refresh</button>
          </div>
          <div id="aam_health_body"><div style="color:rgba(255,255,255,0.3);font-size:13px;padding:20px;text-align:center;">Click Refresh to run health check</div></div>
        </div>
        ` : ''}

      </div>
    </div>`

    document.body.insertAdjacentHTML('beforeend', html)
  }

  // ── 9. Public AAMAuth API ──
  window.AAMAuth = {
    getSession : getSession,
    isOwner    : function () { var s = getSession(); return s && s.role === 'owner' },
    isStaff    : function () { var s = getSession(); return s && s.role === 'staff' },
    logout     : function () { localStorage.removeItem(SESSION_KEY); window.location.replace('login.html') },
    closeSettings : function() {
      var el = document.getElementById('aamSettingsOverlay')
      if (el) el.style.display = 'none'
    },
    showTab : showSettingsTab,

    openSettings : function () {
      var overlay = document.getElementById('aamSettingsOverlay')
      if (!overlay) return
      overlay.style.display = 'block'

      var s = getSession()
      if (s) {
        var daysLeft = Math.ceil((s.expiry - Date.now()) / (1000 * 60 * 60 * 24))
        var info = document.getElementById('aam_session_info')
        if (info) info.innerHTML =
          'Username: <strong>' + s.username + '</strong><br>' +
          'Role: <strong style="color:' + (s.role === 'owner' ? '#fbbf24' : '#60a5fa') + ';">' + (s.role === 'owner' ? 'Owner' : 'Staff') + '</strong><br>' +
          'Logged in: <strong>' + new Date(s.loginTime || Date.now()).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) + '</strong><br>' +
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

    savePassword : function () {
      var s = getSession()
      if (!s || s.role !== 'owner') return

      var showMsg = function (type, text) {
        var el = document.getElementById('smsg_account')
        if (!el) return
        el.className = 'aam-smsg ' + type; el.innerText = text; el.style.display = 'block'
        setTimeout(function () { el.style.display = 'none' }, 5000)
      }

      var curPw = (document.getElementById('aam_cur_pw') || {}).value || ''
      var newPw = (document.getElementById('aam_new_pw') || {}).value || ''
      var newP2 = (document.getElementById('aam_new_pw2') || {}).value || ''

      if (!curPw || !newPw || !newP2) return showMsg('err', 'Please fill all three password fields')
      if (newPw !== newP2) return showMsg('err', 'New passwords do not match')
      if (newPw.length < 6) return showMsg('err', 'New password must be at least 6 characters')

      withSB(function(sb) {
        sb.from('users')
          .select('id')
          .eq('username', s.username)
          .eq('password', curPw)
          .eq('is_active', true)
          .single()
          .then(function(check) {
            if (check.error || !check.data) return showMsg('err', 'Current password is incorrect')
            return sb.from('users').update({ password: newPw }).eq('username', s.username)
          })
          .then(function(upd) {
            if (!upd) return
            if (upd.error) return showMsg('err', 'Error saving: ' + upd.error.message)
            showMsg('ok', 'Password updated successfully!')
            ;['aam_cur_pw','aam_new_pw','aam_new_pw2'].forEach(function (id) {
              var el = document.getElementById(id); if (el) el.value = ''
            })
          })
          .catch(function(e){ showMsg('err', 'Error: ' + e.message) })
      })
    },

    saveBusiness : function () {
      var showMsg = function (type, text) {
        var el = document.getElementById('smsg_business')
        if (!el) return
        el.className = 'aam-smsg ' + type; el.innerText = text; el.style.display = 'block'
        setTimeout(function () { el.style.display = 'none' }, 5000)
      }

      var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : '' }
      var name  = g('aam_biz_name')
      var addr  = g('aam_biz_addr')
      var ph1   = g('aam_biz_ph1')
      var ph2   = g('aam_biz_ph2')
      var gstin = g('aam_biz_gstin').toUpperCase()

      if (!name) return showMsg('err', 'Business name cannot be empty')

      withSB(function(sb) {
        var rows = [
          { key: 'biz_name',    value: name  },
          { key: 'biz_address', value: addr  },
          { key: 'biz_phone1',  value: ph1   },
          { key: 'biz_phone2',  value: ph2   },
          { key: 'biz_gstin',   value: gstin }
        ]

        // Save all rows sequentially
        var saveNext = function(i) {
          if (i >= rows.length) {
            var biz = { biz_name: name, biz_address: addr, biz_phone1: ph1, biz_phone2: ph2, biz_gstin: gstin }
            localStorage.setItem(BIZ_CACHE_KEY, JSON.stringify(biz))
            applyBusinessToDOM(biz)
            showMsg('ok', 'Business details saved! All future bills will use these details.')
            return
          }
          sb.from('settings')
            .upsert({ key: rows[i].key, value: rows[i].value }, { onConflict: 'key' })
            .then(function(res) {
              if (res.error) { showMsg('err', 'Error saving: ' + res.error.message); return }
              saveNext(i + 1)
            })
            .catch(function(e){ showMsg('err', 'Error: ' + e.message) })
        }
        saveNext(0)
      })
    },

    loadStaffList : function () {
      var container = document.getElementById('aam_staff_list')
      if (!container) return
      container.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:13px;">Loading staff...</div>'

      withSB(function(sb) {
        sb.from('users')
          .select('id,username,full_name,role,is_active')
          .order('role')
          .order('full_name')
          .then(function(res) {
            if (res.error || !res.data) {
              container.innerHTML = '<div style="color:#f87171;font-size:13px;">Error: ' + (res.error ? res.error.message : 'No data') + '<br><small style="opacity:0.6;">If this says RLS error, run the SQL policy fix in Supabase dashboard</small></div>'
              return
            }

            var s = getSession()

            // Populate reset dropdown
            var resetSelect = document.getElementById('aam_reset_staff_select')
            if (resetSelect) {
              resetSelect.innerHTML = '<option value="">-- Select staff member --</option>'
              res.data.forEach(function (u) {
                var opt = document.createElement('option')
                opt.value = u.id
                opt.innerText = (u.full_name || u.username) + ' (@' + u.username + ')  —  ' + (u.role === 'owner' ? 'Owner' : 'Staff')
                resetSelect.appendChild(opt)
              })
            }

            if (!res.data.length) {
              container.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:13px;">No users found</div>'
              return
            }

            container.innerHTML = res.data.map(function (u) {
              var isMe = s && s.username === u.username
              return '<div class="aam-staff-card">' +
                '<div style="flex:1;">' +
                  '<div class="sc-name">' + (u.full_name || u.username) + (isMe ? ' <span style="font-size:11px;color:#60a5fa;">(you)</span>' : '') + '</div>' +
                  '<div class="sc-user">@' + u.username + '  ·  ' + (u.is_active ? '<span style="color:#34d399;">Active</span>' : '<span style="color:#f87171;">Disabled</span>') + '</div>' +
                '</div>' +
                '<span class="sc-role ' + u.role + '">' + (u.role === 'owner' ? 'Owner' : 'Staff') + '</span>' +
                (!isMe ? '<button onclick="AAMAuth.toggleActive(\'' + u.id + '\',\'' + u.username + '\',' + u.is_active + ')" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.65);padding:5px 12px;font-size:11px;border-radius:6px;box-shadow:none;font-family:\'DM Sans\',sans-serif;cursor:pointer;">' + (u.is_active ? 'Disable' : 'Enable') + '</button>' : '') +
                (!isMe && u.role !== 'owner' ? '<button onclick="AAMAuth.deleteStaff(\'' + u.id + '\',\'' + (u.full_name || u.username).replace(/'/g,"") + '\')" style="background:rgba(220,38,38,0.15);border:1px solid rgba(220,38,38,0.25);color:#f87171;padding:5px 12px;font-size:11px;border-radius:6px;box-shadow:none;font-family:\'DM Sans\',sans-serif;cursor:pointer;">Remove</button>' : '') +
              '</div>'
            }).join('')
          })
          .catch(function(e){
            container.innerHTML = '<div style="color:#f87171;font-size:13px;">Connection error: ' + e.message + '</div>'
          })
      })
    },

    addStaff : function () {
      var showMsg = function (type, text) {
        var el = document.getElementById('smsg_staff')
        if (!el) return
        el.className = 'aam-smsg ' + type; el.innerText = text; el.style.display = 'block'
        setTimeout(function () { el.style.display = 'none' }, 5000)
      }

      var name  = (document.getElementById('aam_new_name')  || {}).value || ''
      var uname = ((document.getElementById('aam_new_uname') || {}).value || '').toLowerCase().trim()
      var pw    = (document.getElementById('aam_new_upw')   || {}).value || ''
      var role  = (document.getElementById('aam_new_role')  || {}).value || 'staff'

      if (!name.trim())     return showMsg('err', 'Enter full name')
      if (!uname)           return showMsg('err', 'Enter a username')
      if (uname.length < 3) return showMsg('err', 'Username must be at least 3 characters')
      if (pw.length < 6)    return showMsg('err', 'Password must be at least 6 characters')

      withSB(function(sb) {
        sb.from('users')
          .insert([{ username: uname, password: pw, role: role, full_name: name.trim(), is_active: true }])
          .then(function(res) {
            if (res.error) {
              if (res.error.code === '23505' || res.error.message.indexOf('unique') !== -1)
                return showMsg('err', 'Username "' + uname + '" already exists')
              return showMsg('err', 'Error: ' + res.error.message)
            }
            showMsg('ok', 'User "' + name.trim() + '" created! They can login with: ' + uname)
            ;['aam_new_name','aam_new_uname','aam_new_upw'].forEach(function (id) {
              var el = document.getElementById(id); if (el) el.value = ''
            })
            window.AAMAuth.loadStaffList()
          })
          .catch(function(e){ showMsg('err', 'Error: ' + e.message) })
      })
    },

    resetStaffPassword : function () {
      var showMsg = function (type, text) {
        var el = document.getElementById('smsg_staffpw')
        if (!el) return
        el.className = 'aam-smsg ' + type; el.innerText = text; el.style.display = 'block'
        setTimeout(function () { el.style.display = 'none' }, 5000)
      }

      var staffId = (document.getElementById('aam_reset_staff_select') || {}).value || ''
      var newPw   = (document.getElementById('aam_reset_pw')  || {}).value || ''
      var newPw2  = (document.getElementById('aam_reset_pw2') || {}).value || ''

      if (!staffId)      return showMsg('err', 'Select a staff member')
      if (newPw.length < 6) return showMsg('err', 'Password must be at least 6 characters')
      if (newPw !== newPw2) return showMsg('err', 'Passwords do not match')

      withSB(function(sb) {
        sb.from('users')
          .update({ password: newPw })
          .eq('id', staffId)
          .then(function(res) {
            if (res.error) return showMsg('err', 'Error: ' + res.error.message)
            showMsg('ok', 'Password reset successfully!')
            ;['aam_reset_pw','aam_reset_pw2'].forEach(function (id) {
              var el = document.getElementById(id); if (el) el.value = ''
            })
            var sel = document.getElementById('aam_reset_staff_select')
            if (sel) sel.value = ''
          })
          .catch(function(e){ showMsg('err', 'Error: ' + e.message) })
      })
    },

    toggleActive : function (id, username, currentlyActive) {
      withSB(function(sb) {
        sb.from('users')
          .update({ is_active: !currentlyActive })
          .eq('id', id)
          .then(function() { window.AAMAuth.loadStaffList() })
      })
    },

    deleteStaff : function (id, name) {
      if (!confirm('Remove "' + name + '"? They will no longer be able to login.')) return
      withSB(function(sb) {
        sb.from('users')
          .delete()
          .eq('id', id)
          .then(function() { window.AAMAuth.loadStaffList() })
      })
    },

    loadHealth : function () {
      var container = document.getElementById('aam_health_body')
      if (!container) return
      container.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:13px;padding:10px;text-align:center;">Running checks...</div>'

      function row(label, val, color) {
        return '<div class="aam-health-row"><span class="hl">' + label + '</span><span class="hv" style="color:' + (color || '#34d399') + ';">' + val + '</span></div>'
      }

      withSB(function(sb) {
        Promise.all([
          sb.from('inventory').select('id', {count:'exact', head:true}),
          sb.from('customers').select('id', {count:'exact', head:true}),
          sb.from('merchants').select('id', {count:'exact', head:true}),
          sb.from('sales').select('id', {count:'exact', head:true}),
          sb.from('purchases').select('id', {count:'exact', head:true}),
          sb.from('notifications').select('id', {count:'exact', head:true}).eq('is_read', false),
          sb.from('inventory').select('id', {count:'exact', head:true}).lte('quantity', 5),
          sb.from('users').select('id', {count:'exact', head:true}).eq('is_active', true)
        ]).then(function(results) {
          var inv  = results[0].count || 0
          var cust = results[1].count || 0
          var mer  = results[2].count || 0
          var sal  = results[3].count || 0
          var pur  = results[4].count || 0
          var unrd = results[5].count || 0
          var low  = results[6].count || 0
          var usrs = results[7].count || 0

          container.innerHTML =
            row('Database connection', 'Connected', '#34d399') +
            row('Total products', inv.toLocaleString('en-IN'), inv >= 100 ? '#34d399' : '#fbbf24') +
            row('Total customers', cust.toLocaleString('en-IN'), '#60a5fa') +
            row('Total merchants', mer.toLocaleString('en-IN'), '#60a5fa') +
            row('Total sales bills', sal.toLocaleString('en-IN'), '#60a5fa') +
            row('Total purchase bills', pur.toLocaleString('en-IN'), '#a78bfa') +
            row('Low stock items (≤5)', low > 0 ? low + ' items need restocking' : 'All good', low > 0 ? '#fbbf24' : '#34d399') +
            row('Unread notifications', unrd > 0 ? unrd + ' pending' : 'All clear', unrd > 10 ? '#f87171' : '#34d399') +
            row('Active users', usrs.toLocaleString('en-IN'), '#60a5fa') +
            row('Capacity', inv + '/20,000 products', inv > 20000 ? '#f87171' : '#34d399') +
            row('Session', 'Valid', '#34d399')
        }).catch(function(e){
          container.innerHTML = row('Error', e.message, '#f87171')
        })
      })
    },

    // Called on every page to build sidebar UI
    applyUI : function () {
      var s = getSession()
      if (!s) return
      var sidebar = document.querySelector('.sidebar')
      if (!sidebar) return

      injectSettingsCSS()

      // Hide owner-only links from staff
      if (s.role === 'staff') {
        sidebar.querySelectorAll('.owner-only').forEach(function (el) { el.style.display = 'none' })
        var pLink = sidebar.querySelector('a[href="products.html"]')
        if (pLink && !document.getElementById('aam_inv_label')) {
          var lbl = document.createElement('div')
          lbl.className = 'sidebar-label'; lbl.id = 'aam_inv_label'; lbl.innerText = 'Inventory'
          sidebar.insertBefore(lbl, pLink)
        }
      }

      // Products page read-only for staff
      if (s.role === 'staff' && currentPage() === 'products.html') {
        var st = document.createElement('style')
        st.innerText = 'button.add-btn,button[onclick*="openEdit"],button[onclick*="deleteProduct"],.edit-btn,.delete-btn{display:none!important;}'
        document.head.appendChild(st)
        setTimeout(function () {
          var main = document.querySelector('.main')
          if (main && !document.getElementById('aam_ro_banner')) {
            var b = document.createElement('div')
            b.id = 'aam_ro_banner'
            b.style.cssText = 'background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.3);border-radius:10px;padding:10px 16px;margin-bottom:16px;font-size:13px;color:#60a5fa;font-weight:600;'
            b.innerText = 'View Only — Contact the owner to add or edit products.'
            main.insertBefore(b, main.firstChild)
          }
        }, 400)
      }

      // Remove any old settings button
      var oldBtn = document.getElementById('aam_settings_btn')
      if (oldBtn) oldBtn.remove()

      // Build settings button
      var daysLeft  = Math.ceil((s.expiry - Date.now()) / (1000 * 60 * 60 * 24))
      var roleColor = s.role === 'owner' ? '#fbbf24' : '#60a5fa'
      var avatarBg  = s.role === 'owner' ? 'linear-gradient(135deg,#1e3a5f,#2563eb)' : 'linear-gradient(135deg,#1e293b,#475569)'

      var settingsBtn = document.createElement('div')
      settingsBtn.id = 'aam_settings_btn'
      settingsBtn.style.cssText = 'padding:8px 10px 0;'
      settingsBtn.innerHTML =
        '<button onclick="AAMAuth.openSettings()" style="' +
          'width:100%;display:flex;align-items:center;gap:10px;' +
          'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);' +
          'border-radius:10px;padding:10px 12px;cursor:pointer;' +
          'font-family:\'DM Sans\',sans-serif;text-align:left;box-shadow:none;transition:all 0.2s;"' +
          ' onmouseover="this.style.background=\'rgba(255,255,255,0.11)\'"' +
          ' onmouseout="this.style.background=\'rgba(255,255,255,0.06)\'">' +
          '<div style="width:34px;height:34px;border-radius:50%;background:' + avatarBg + ';' +
            'display:flex;align-items:center;justify-content:center;' +
            'font-size:14px;font-weight:700;color:white;flex-shrink:0;">' +
            (s.full_name || s.username || 'U')[0].toUpperCase() +
          '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (s.full_name || s.username) + '</div>' +
            '<div style="font-size:11px;color:' + roleColor + ';font-weight:600;">' + (s.role === 'owner' ? 'Owner' : 'Staff') + '</div>' +
          '</div>' +
          '<div style="font-size:15px;color:rgba(255,255,255,0.4);">&#9881;</div>' +
        '</button>'

      // Insert BEFORE sidebar-bottom (between last nav link and version)
      var bottom = sidebar.querySelector('.sidebar-bottom')
      if (bottom) sidebar.insertBefore(settingsBtn, bottom)
      else sidebar.appendChild(settingsBtn)

      // Build modal
      buildSettingsModal()

      // Load business details for print
      setTimeout(loadAndApplyBusiness, 800)

      // Session expiry warning
      if (daysLeft <= 5) {
        setTimeout(function () {
          var warn = document.createElement('div')
          warn.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#b45309;color:white;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,0.4);cursor:pointer;'
          warn.innerText = 'Session expires in ' + daysLeft + ' day(s) — open Settings to renew'
          warn.onclick = function () { warn.remove(); window.AAMAuth.openSettings() }
          document.body.appendChild(warn)
          setTimeout(function () { if (warn.parentNode) warn.remove() }, 8000)
        }, 2500)
      }
    }
  }

  // Settings tab switcher
  function showSettingsTab(tabName) {
    document.querySelectorAll('#aamSettingsBox .stab').forEach(function (t) { t.classList.remove('active') })
    document.querySelectorAll('#aamSettingsBox .spanel').forEach(function (p) { p.classList.remove('active') })
    var panel = document.getElementById('stab_' + tabName)
    if (panel) panel.classList.add('active')
    document.querySelectorAll('#aamSettingsBox .stab').forEach(function (t) {
      if (t.getAttribute('onclick') && t.getAttribute('onclick').indexOf("'" + tabName + "'") !== -1) t.classList.add('active')
    })
    if (tabName === 'health') window.AAMAuth.loadHealth()
    if (tabName === 'staff')  window.AAMAuth.loadStaffList()
  }

  // Auto-run
  function runUI() { if (window.AAMAuth) window.AAMAuth.applyUI() }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runUI)
  else setTimeout(runUI, 0)

})()
