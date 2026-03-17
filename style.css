/* ============================================================
   FAMILY TREE — STYLESHEET
   Aesthetic: Warm parchment meets elegant dark-mode.
   ============================================================ */

/* ---------- CSS VARIABLES ---------- */
:root {
  --bg:        #0f1117;
  --bg2:       #1a1d2e;
  --card:      #242740;
  --border:    #353858;
  --accent:    #d4a843;
  --accent2:   #e8c875;
  --text:      #e8e6f0;
  --text-muted:#9b98b0;
  --danger:    #e05c5c;
  --success:   #4caf7d;
  --node-bg:   #2c3058;
  --node-hover:#3a3f70;
  --link:      rgba(212,168,67,0.35);
  --shadow:    0 8px 32px rgba(0,0,0,0.5);
  --radius:    12px;
  --font-display: 'Playfair Display', Georgia, serif;
  --font-body:    'Mulish', sans-serif;
}

/* ---------- RESET ---------- */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;overflow:hidden;}
body{
  font-family:var(--font-body);
  background:var(--bg);
  color:var(--text);
  overscroll-behavior:none;
  -webkit-tap-highlight-color:transparent;
  user-select:none;
}

/* ---------- SCROLLBAR ---------- */
::-webkit-scrollbar{width:6px;height:6px;}
::-webkit-scrollbar-track{background:var(--bg2);}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}

/* ---------- HEADER ---------- */
.app-header{
  position:fixed;top:0;left:0;right:0;
  height:56px;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 16px;
  background:rgba(15,17,23,0.95);
  backdrop-filter:blur(12px);
  border-bottom:1px solid var(--border);
  z-index:900;
}
.header-left{display:flex;align-items:center;gap:10px;}
.logo-icon{font-size:22px;}
.app-title{
  font-family:var(--font-display);
  font-size:1.2rem;
  font-weight:700;
  color:var(--accent);
  letter-spacing:0.03em;
}
.header-right{display:flex;align-items:center;gap:10px;}

/* ---------- SEARCH ---------- */
.search-wrapper{position:relative;display:flex;align-items:center;}
.search-input{
  width:200px;
  padding:7px 36px 7px 12px;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:20px;
  color:var(--text);
  font-family:var(--font-body);
  font-size:0.85rem;
  outline:none;
  transition:border-color 0.2s,width 0.3s;
}
.search-input:focus{border-color:var(--accent);width:260px;}
.search-btn{
  position:absolute;right:8px;
  background:none;border:none;cursor:pointer;
  font-size:14px;color:var(--text-muted);
}
.search-results{
  position:absolute;top:calc(100% + 6px);left:0;right:0;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:10px;
  box-shadow:var(--shadow);
  z-index:1000;
  max-height:280px;
  overflow-y:auto;
  display:none;
}
.search-results.open{display:block;}
.search-result-item{
  padding:9px 14px;
  cursor:pointer;
  font-size:0.85rem;
  border-bottom:1px solid var(--border);
  transition:background 0.15s;
}
.search-result-item:last-child{border-bottom:none;}
.search-result-item:hover,.search-result-item:focus{background:var(--node-hover);}
.search-result-sub{font-size:0.75rem;color:var(--text-muted);margin-top:2px;}

/* ---------- ADMIN BUTTON ---------- */
.admin-btn{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:8px;
  color:var(--text-muted);
  width:36px;height:36px;
  font-size:18px;cursor:pointer;
  transition:border-color 0.2s,color 0.2s;
}
.admin-btn:hover{border-color:var(--accent);color:var(--accent);}

/* ---------- TREE CANVAS ---------- */
.tree-container{
  position:fixed;
  top:56px;left:0;right:0;bottom:0;
  overflow:hidden;
  cursor:grab;
}
.tree-container.grabbing{cursor:grabbing;}

/* SVG links layer */
.links-svg{
  position:absolute;
  top:0;left:0;
  pointer-events:none;
  z-index:1;
  overflow:visible;
}
.tree-link{
  fill:none;
  stroke:var(--link);
  stroke-width:1.5;
}

/* Nodes layer */
.nodes-container{
  position:absolute;
  top:0;left:0;
  z-index:2;
  transform-origin:0 0;
}

/* ---------- TREE NODE ---------- */
.tree-node{
  position:absolute;
  width:130px;
  padding:10px 12px;
  background:var(--node-bg);
  border:1px solid var(--border);
  border-radius:10px;
  text-align:center;
  cursor:pointer;
  transition:transform 0.15s,border-color 0.15s,background 0.15s,box-shadow 0.15s;
  box-shadow:0 2px 8px rgba(0,0,0,0.3);
  will-change:transform;
}
.tree-node:hover{
  background:var(--node-hover);
  border-color:var(--accent);
  transform:translateY(-2px);
  box-shadow:0 6px 20px rgba(212,168,67,0.2);
}
.tree-node.highlighted{
  border-color:var(--accent2);
  background:#3a3020;
  box-shadow:0 0 20px rgba(232,200,117,0.4);
}
.tree-node.long-pressed{
  border-color:var(--accent);
  background:var(--node-hover);
}
.node-name{
  font-family:var(--font-display);
  font-size:0.78rem;
  font-weight:600;
  color:var(--text);
  line-height:1.3;
  word-break:break-word;
}

/* ---------- LOADING OVERLAY ---------- */
.loading-overlay{
  position:fixed;inset:0;
  background:var(--bg);
  display:flex;align-items:center;justify-content:center;
  z-index:9999;
  transition:opacity 0.5s;
}
.loading-overlay.hidden{opacity:0;pointer-events:none;}
.loader-inner{text-align:center;}
.tree-loader{
  font-size:48px;
  display:block;
  animation:pulse 1.4s ease-in-out infinite;
}
@keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
.loader-inner p{margin-top:12px;color:var(--text-muted);font-size:0.9rem;}

/* ---------- DETAILS SIDE PANEL ---------- */
.overlay{
  position:fixed;inset:0;
  background:rgba(0,0,0,0.5);
  z-index:800;
  opacity:0;pointer-events:none;
  transition:opacity 0.25s;
}
.overlay.active{opacity:1;pointer-events:all;}
.side-panel{
  position:fixed;top:56px;right:-360px;bottom:0;
  width:340px;max-width:90vw;
  background:var(--bg2);
  border-left:1px solid var(--border);
  z-index:801;
  transition:right 0.3s cubic-bezier(0.4,0,0.2,1);
  overflow-y:auto;
  padding:20px;
}
.side-panel.open{right:0;}
.panel-close{
  position:absolute;top:14px;right:14px;
  background:none;border:none;
  color:var(--text-muted);font-size:18px;
  cursor:pointer;
  transition:color 0.2s;
}
.panel-close:hover{color:var(--text);}
.panel-avatar{
  width:64px;height:64px;
  background:var(--card);
  border:2px solid var(--accent);
  border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:26px;
  margin:0 auto 16px;
}
.panel-name{
  font-family:var(--font-display);
  font-size:1.3rem;
  font-weight:700;
  text-align:center;
  color:var(--accent);
  margin-bottom:20px;
}
.detail-row{
  display:flex;align-items:flex-start;gap:10px;
  padding:10px 0;
  border-bottom:1px solid var(--border);
}
.detail-row:last-child{border-bottom:none;}
.detail-icon{font-size:16px;margin-top:1px;flex-shrink:0;}
.detail-label{font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;}
.detail-value{font-size:0.88rem;color:var(--text);margin-top:2px;}

/* ---------- CONTEXT MENU ---------- */
.context-menu{
  position:fixed;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:10px;
  box-shadow:var(--shadow);
  z-index:950;
  min-width:170px;
  overflow:hidden;
  opacity:0;transform:scale(0.9);
  pointer-events:none;
  transition:opacity 0.15s,transform 0.15s;
  transform-origin:top left;
}
.context-menu.visible{opacity:1;transform:scale(1);pointer-events:all;}
.ctx-item{
  display:flex;align-items:center;gap:10px;
  padding:12px 16px;
  cursor:pointer;
  font-size:0.88rem;
  transition:background 0.15s;
}
.ctx-item:hover{background:var(--node-hover);}
.ctx-icon{font-size:16px;}

/* ---------- MODAL ---------- */
.modal-backdrop{
  position:fixed;inset:0;
  background:rgba(0,0,0,0.65);
  z-index:1000;
  display:flex;align-items:center;justify-content:center;
  opacity:0;pointer-events:none;
  transition:opacity 0.2s;
}
.modal-backdrop.open{opacity:1;pointer-events:all;}
.modal{
  background:var(--bg2);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:28px;
  width:100%;max-width:420px;
  max-height:90vh;overflow-y:auto;
  position:relative;
  transform:translateY(20px);
  transition:transform 0.25s;
  box-shadow:var(--shadow);
}
.modal-backdrop.open .modal{transform:translateY(0);}
.modal-close{
  position:absolute;top:14px;right:14px;
  background:none;border:none;color:var(--text-muted);
  font-size:18px;cursor:pointer;transition:color 0.2s;
}
.modal-close:hover{color:var(--text);}
.modal-title{
  font-family:var(--font-display);
  font-size:1.15rem;
  font-weight:700;
  color:var(--accent);
  margin-bottom:20px;
}

/* ---------- FORM ELEMENTS ---------- */
.form-group{margin-bottom:14px;}
.form-label{
  display:block;
  font-size:0.78rem;color:var(--text-muted);
  text-transform:uppercase;letter-spacing:0.07em;
  margin-bottom:6px;
}
.form-input,.form-textarea{
  width:100%;
  padding:9px 12px;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:8px;
  color:var(--text);
  font-family:var(--font-body);
  font-size:0.88rem;
  outline:none;
  transition:border-color 0.2s;
}
.form-input:focus,.form-textarea:focus{border-color:var(--accent);}
.form-textarea{resize:vertical;min-height:80px;}
.btn-primary{
  width:100%;padding:11px;
  background:var(--accent);
  border:none;border-radius:8px;
  color:#1a1400;
  font-family:var(--font-body);
  font-size:0.9rem;font-weight:700;
  cursor:pointer;
  transition:background 0.2s,transform 0.1s;
  margin-top:4px;
}
.btn-primary:hover{background:var(--accent2);}
.btn-primary:active{transform:scale(0.98);}
.required-star{color:var(--danger);}

/* ---------- ADMIN PANEL ---------- */
.admin-backdrop{
  position:fixed;inset:0;
  background:rgba(0,0,0,0.65);
  z-index:1100;
  display:flex;align-items:flex-start;justify-content:center;
  padding-top:56px;
  opacity:0;pointer-events:none;
  transition:opacity 0.2s;
}
.admin-backdrop.open{opacity:1;pointer-events:all;}
.admin-panel{
  background:var(--bg2);
  border:1px solid var(--border);
  border-top:none;
  width:100%;max-width:680px;
  max-height:calc(100vh - 56px);
  overflow-y:auto;
  position:relative;
}
.admin-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:16px 20px;
  border-bottom:1px solid var(--border);
  position:sticky;top:0;background:var(--bg2);z-index:1;
}
.admin-header h2{
  font-family:var(--font-display);
  font-size:1.1rem;color:var(--accent);
}
.admin-login{
  display:flex;flex-direction:column;gap:12px;
  padding:28px;max-width:300px;margin:0 auto;
}
.admin-hint{font-size:0.8rem;color:var(--text-muted);text-align:center;}
.admin-content{padding:16px;}
.admin-tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;}
.tab-btn{
  padding:7px 16px;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:20px;
  color:var(--text-muted);
  font-family:var(--font-body);
  font-size:0.82rem;cursor:pointer;
  transition:all 0.2s;
}
.tab-btn.active{background:var(--accent);border-color:var(--accent);color:#1a1400;font-weight:700;}
.request-card{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:10px;
  padding:14px 16px;
  margin-bottom:10px;
}
.request-card-title{
  font-family:var(--font-display);
  font-size:0.95rem;
  color:var(--text);
  margin-bottom:8px;
}
.request-meta{font-size:0.78rem;color:var(--text-muted);margin-bottom:10px;line-height:1.6;}
.request-actions{display:flex;gap:8px;flex-wrap:wrap;}
.btn-approve{
  padding:6px 16px;
  background:var(--success);
  border:none;border-radius:6px;
  color:#fff;font-family:var(--font-body);
  font-size:0.82rem;font-weight:700;cursor:pointer;
  transition:opacity 0.2s;
}
.btn-approve:hover{opacity:0.85;}
.btn-reject{
  padding:6px 16px;
  background:var(--danger);
  border:none;border-radius:6px;
  color:#fff;font-family:var(--font-body);
  font-size:0.82rem;font-weight:700;cursor:pointer;
  transition:opacity 0.2s;
}
.btn-reject:hover{opacity:0.85;}
.empty-state{
  text-align:center;color:var(--text-muted);
  padding:32px;font-size:0.9rem;
}

/* ---------- TOAST ---------- */
.toast{
  position:fixed;bottom:24px;left:50%;
  transform:translateX(-50%) translateY(20px);
  background:var(--card);
  border:1px solid var(--border);
  border-radius:20px;
  padding:10px 20px;
  font-size:0.85rem;
  color:var(--text);
  box-shadow:var(--shadow);
  z-index:9999;
  opacity:0;
  transition:opacity 0.3s,transform 0.3s;
  pointer-events:none;
  white-space:nowrap;
}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0);}

/* ---------- ZOOM CONTROLS ---------- */
.zoom-controls{
  position:fixed;bottom:20px;right:16px;
  display:flex;flex-direction:column;gap:6px;
  z-index:500;
}
.zoom-btn{
  width:40px;height:40px;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:8px;
  color:var(--text);font-size:20px;
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  transition:border-color 0.2s;
}
.zoom-btn:hover{border-color:var(--accent);}

/* ---------- RESPONSIVE ---------- */
@media(max-width:600px){
  .app-title{font-size:1rem;}
  .search-input{width:130px;}
  .search-input:focus{width:170px;}
  .side-panel{width:100%;right:-100%;}
}
