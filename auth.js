// auth.js — Abhinandan Auto Mobiles ERP
// Include this file in every page: <script src="auth.js"></script>
// It handles: session check, auto-redirect, role restrictions, logout button

(function() {

  var SESSION_KEY  = 'aam_erp_session'
  var SESSION_DAYS = 30
  var STAFF_ALLOWED = ['billing.html', 'purchase-billing.html']

  // ─── Read current session ───
  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return null
      var s = JSON.parse(raw)
      if (!s || !s.expiry) return null
      if (Date.now() > s.expiry) {
        localStorage.removeItem(SESSION_KEY)
        return null
      }
      return s
    } catch(e) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
  }

  // ─── Which page are we on? ───
  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html'
  }

  // ─── Immediate access check (runs before page renders) ───
  var session = getSession()
  var page    = currentPage()

  if (!session) {
    // Not logged in → go to login
    if (page !== 'login.html') {
      window.location.replace('login.html')
    }
  } else {
    // Staff trying to open an owner-only page → send to billing
    if (session.role === 'staff' && STAFF_ALLOWED.indexOf(page) === -1) {
      window.location.replace('billing.html')
    }
  }

  // ─── Public helpers ───
  window.AAMAuth = {
    getSession   : getSession,
    isOwner      : function() { var s=getSession(); return s && s.role==='owner' },
    isStaff      : function() { var s=getSession(); return s && s.role==='staff' },
    logout       : function() {
      localStorage.removeItem(SESSION_KEY)
      window.location.replace('login.html')
    },

    // ─── Build the sidebar user bar + hide owner-only links for staff ───
    applyUI : function() {
      var s = getSession()
      if (!s) return

      var sidebar = document.querySelector('.sidebar')
      if (!sidebar) return

      // 1. Add user info + logout button above sidebar-bottom
      var existing = document.getElementById('aam_userbar')
      if (existing) existing.remove()

      var bar = document.createElement('div')
      bar.id = 'aam_userbar'
      bar.style.cssText = [
        'padding:12px 16px',
        'border-top:1px solid rgba(255,255,255,0.08)',
        'margin-top:8px'
      ].join(';')

      var roleColor  = s.role === 'owner' ? '#fbbf24' : '#60a5fa'
      var roleLabel  = s.role === 'owner' ? '👑 Owner'  : '👷 Staff'
      var daysLeft   = Math.ceil((s.expiry - Date.now()) / (1000*60*60*24))

      bar.innerHTML =
        '<div style="font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Logged in as</div>' +
        '<div style="font-size:14px;font-weight:600;color:white;margin-bottom:2px;">' + (s.full_name || s.username) + '</div>' +
        '<div style="font-size:11px;font-weight:600;color:' + roleColor + ';margin-bottom:10px;letter-spacing:0.5px;">' + roleLabel + '</div>' +
        '<div style="font-size:10px;color:rgba(255,255,255,0.2);margin-bottom:10px;">Session: ' + daysLeft + ' day(s) left</div>' +
        '<button onclick="AAMAuth.logout()" style="width:100%;background:rgba(220,38,38,0.15);border:1px solid rgba(220,38,38,0.3);color:#f87171;padding:8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:\'DM Sans\',sans-serif;transition:background 0.2s;" onmouseover="this.style.background=\'rgba(220,38,38,0.25)\'" onmouseout="this.style.background=\'rgba(220,38,38,0.15)\'">🚪 Logout</button>'

      var bottom = sidebar.querySelector('.sidebar-bottom')
      if (bottom) {
        sidebar.insertBefore(bar, bottom)
      } else {
        sidebar.appendChild(bar)
      }

      // 2. For staff: hide all elements with class "owner-only"
      if (s.role === 'staff') {
        sidebar.querySelectorAll('.owner-only').forEach(function(el) {
          el.style.display = 'none'
        })
      }

      // 3. Session expiry warning (shows 3 days before expiry)
      if (daysLeft <= 3) {
        setTimeout(function() {
          var warn = document.createElement('div')
          warn.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#b45309;color:white;padding:12px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,0.4);'
          warn.innerHTML = '⚠️ Session expires in ' + daysLeft + ' day(s).<br>Please logout and login again.'
          document.body.appendChild(warn)
          setTimeout(function() { warn.remove() }, 6000)
        }, 2000)
      }
    }
  }

  // Run UI setup after page DOM is ready
  function runUI() { if (window.AAMAuth) window.AAMAuth.applyUI() }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runUI)
  } else {
    runUI()
  }

})()
