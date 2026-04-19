// auth.js — Abhinandan Auto Mobiles ERP v2
// Handles: login check, role-based access, staff restrictions,
//          notification bell in sidebar, logout

(function() {

  var SESSION_KEY   = 'aam_erp_session'
  // Pages staff are allowed to visit
  var STAFF_ALLOWED = ['billing.html', 'products.html']

  // ── Read session ──
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

  // ── Which page are we on? ──
  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html'
  }

  // ── Immediate access check (runs before anything else) ──
  var session = getSession()
  var page    = currentPage()

  if (!session) {
    if (page !== 'login.html') {
      window.location.replace('login.html')
    }
  } else {
    if (session.role === 'staff' && STAFF_ALLOWED.indexOf(page) === -1) {
      window.location.replace('billing.html')
    }
  }

  // ── Supabase client for notification count ──
  function getSB() {
    if (window._supabase) return window._supabase
    if (window.supabase && window.supabase.createClient) {
      window._supabase = window.supabase.createClient(
        'https://mhhnmndnolhapaoqtbxo.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oaG5tbmRub2xoYXBhb3F0YnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4Mzg4NTksImV4cCI6MjA4ODQxNDg1OX0.IMSp8vYiCln_iSuoT_H2qdeX_dP1WMhOOskDw20eJXw'
      )
      return window._supabase
    }
    return null
  }

  // ── Helper to create a notification (called from billing.html) ──
  window.AAMNotify = async function(opts) {
    // opts = { type, title, message, bill_number, amount }
    var s = getSession()
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
    } catch(e) { console.log('Notification insert error:', e) }
  }

  // ── Public API ──
  window.AAMAuth = {
    getSession : getSession,
    isOwner    : function() { var s=getSession(); return s && s.role==='owner' },
    isStaff    : function() { var s=getSession(); return s && s.role==='staff' },
    logout     : function() {
      localStorage.removeItem(SESSION_KEY)
      window.location.replace('login.html')
    },

    // ── Apply sidebar UI ──
    applyUI : function() {
      var s = getSession()
      if (!s) return

      var sidebar = document.querySelector('.sidebar')
      if (!sidebar) return

      // 1. Hide owner-only links from staff
      if (s.role === 'staff') {
        sidebar.querySelectorAll('.owner-only').forEach(function(el) {
          el.style.display = 'none'
        })
        // Hide the Records label if staff can only see Products
        // (label becomes orphaned, so hide it gracefully)
        var labels = sidebar.querySelectorAll('.sidebar-label.owner-only')
        labels.forEach(function(l){ l.style.display='none' })
        // Add a minimal label for the visible Products link
        var productsLink = sidebar.querySelector('a[href="products.html"]')
        if (productsLink) {
          var lbl = document.createElement('div')
          lbl.className = 'sidebar-label'
          lbl.innerText = 'Inventory'
          sidebar.insertBefore(lbl, productsLink)
        }
      }

      // 2. On Products page: hide Add/Edit/Delete for staff
      if (s.role === 'staff' && currentPage() === 'products.html') {
        // We inject a style that hides action buttons
        var style = document.createElement('style')
        style.innerText = [
          '.addProductBtn, #addProductBtn,',
          'button[onclick*="openEdit"], button[onclick*="deleteProduct"],',
          '.edit-btn, .delete-btn, .action-btn,',
          'td:last-child button, th:last-child',
          '{ display: none !important; }'
        ].join('\n')
        document.head.appendChild(style)
        // Also add a read-only banner
        setTimeout(function() {
          var main = document.querySelector('.main')
          if (main) {
            var banner = document.createElement('div')
            banner.style.cssText = 'background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.3);border-radius:10px;padding:10px 16px;margin-bottom:16px;font-size:13px;color:#60a5fa;font-weight:600;'
            banner.innerHTML = '👁 View Only — Staff cannot add or edit products. Contact the owner for inventory changes.'
            main.insertBefore(banner, main.firstChild)
          }
        }, 300)
      }

      // 3. Add user info bar + notification bell + logout
      var existing = document.getElementById('aam_userbar')
      if (existing) existing.remove()

      var daysLeft = Math.ceil((s.expiry - Date.now()) / (1000*60*60*24))
      var roleColor = s.role==='owner' ? '#fbbf24' : '#60a5fa'
      var roleLabel = s.role==='owner' ? '👑 Owner'  : '👷 Staff'

      var bar = document.createElement('div')
      bar.id = 'aam_userbar'
      bar.style.cssText = 'padding:12px 16px;border-top:1px solid rgba(255,255,255,0.08);margin-top:8px;'
      bar.innerHTML =
        '<div style="font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Logged in as</div>' +
        '<div style="font-size:14px;font-weight:600;color:white;margin-bottom:2px;">' + (s.full_name||s.username) + '</div>' +
        '<div style="font-size:11px;font-weight:600;color:'+roleColor+';margin-bottom:10px;">' + roleLabel + '</div>' +
        // Notification bell (owner only)
        (s.role==='owner' ?
          '<a href="dashboard.html" style="display:flex;align-items:center;gap:8px;text-decoration:none;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2);border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:12px;color:#fbbf24;font-weight:600;" id="notifBell">🔔 Notifications <span id="notifBadge" style="display:none;background:#dc2626;color:white;border-radius:10px;padding:1px 7px;font-size:11px;margin-left:auto;">0</span></a>'
          : '') +
        '<div style="font-size:10px;color:rgba(255,255,255,0.2);margin-bottom:8px;">Session: '+daysLeft+' day(s) left</div>' +
        '<button onclick="AAMAuth.logout()" style="width:100%;background:rgba(220,38,38,0.15);border:1px solid rgba(220,38,38,0.3);color:#f87171;padding:8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:\'DM Sans\',sans-serif;" onmouseover="this.style.background=\'rgba(220,38,38,0.25)\'" onmouseout="this.style.background=\'rgba(220,38,38,0.15)\'">🚪 Logout</button>'

      var bottom = sidebar.querySelector('.sidebar-bottom')
      if (bottom) sidebar.insertBefore(bar, bottom)
      else sidebar.appendChild(bar)

      // 4. Load unread notification count for owner
      if (s.role === 'owner') {
        setTimeout(function() {
          var sb = getSB()
          if (!sb) return
          sb.from('notifications').select('id', {count:'exact'}).eq('is_read', false).then(function(res) {
            var count = res.count || 0
            var badge = document.getElementById('notifBadge')
            if (badge && count > 0) {
              badge.style.display = 'inline'
              badge.innerText = count > 99 ? '99+' : count
            }
          })
        }, 1500) // wait for supabase to load
      }

      // 5. Session expiry warning
      if (daysLeft <= 3) {
        setTimeout(function() {
          var warn = document.createElement('div')
          warn.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#b45309;color:white;padding:12px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,0.4);'
          warn.innerHTML = '⚠️ Your session expires in '+daysLeft+' day(s). Please logout and log back in.'
          document.body.appendChild(warn)
          setTimeout(function(){ warn.remove() }, 7000)
        }, 2000)
      }
    }
  }

  // Auto-run UI setup after DOM is ready
  function runUI() { if (window.AAMAuth) window.AAMAuth.applyUI() }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runUI)
  } else {
    setTimeout(runUI, 0)
  }

})()
