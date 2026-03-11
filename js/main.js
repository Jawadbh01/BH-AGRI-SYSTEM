/* BH Agriculture System - main.js v4
   Complete rewrite - clean, modular, realistic
*/
(function () {
  const STORAGE_KEY = 'bh_agri_v4';
  const SESSION_KEY = 'bh_agri_session';
  const THEME_KEY   = 'bh_agri_theme';

  function today() { return new Date().toISOString().slice(0, 10); }
  function formatPKR(n) { return '₨ ' + Number(n || 0).toLocaleString('en-PK'); }
  function nextId(arr) { return (arr && arr.length) ? Math.max(...arr.map(x => x.id || 0)) + 1 : 1; }

  function emptyDb() {
    return {
      users: [{ id: 1, username: 'Jawad', password: '1214', role: 'admin', createdAt: today() }],
      farmers: [],
      expenses: [],
      loans: [],
      inventory: {
        fuel:      [{ id:1,name:'Diesel',unit:'Liters',quantity:0,lastUpdated:today() },{ id:2,name:'Petrol',unit:'Liters',quantity:0,lastUpdated:today() }],
        seeds:     [{ id:1,name:'Wheat Seeds',unit:'KG',quantity:0,lastUpdated:today() },{ id:2,name:'Rice Seeds',unit:'KG',quantity:0,lastUpdated:today() },{ id:3,name:'Fertilizer (Urea)',unit:'Bags',quantity:0,lastUpdated:today() },{ id:4,name:'Pesticide',unit:'Liters',quantity:0,lastUpdated:today() }],
        warehouse: [{ id:1,name:'Wheat',unit:'Maunds',quantity:0,lastUpdated:today() },{ id:2,name:'Rice',unit:'Maunds',quantity:0,lastUpdated:today() },{ id:3,name:'Cotton',unit:'Maunds',quantity:0,lastUpdated:today() }],
        tractors:  []
      }
    };
  }

  // Storage
  function save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  function load() {
    try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : (() => { const d = emptyDb(); save(d); return d; })(); }
    catch(e) { const d = emptyDb(); save(d); return d; }
  }

  // Auth
  function getSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch(e) { return null; } }
  function isLoggedIn() { return !!getSession(); }
  function getCurrentUser() { return getSession(); }
  function login(username, password) {
    const user = (load().users || []).find(u => u.username === username && u.password === password);
    if (!user) return false;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, username: user.username, role: user.role }));
    return true;
  }
  function signup(username, password) {
    if (!username || !password) return { ok: false, msg: 'Username and password required' };
    const d = load();
    d.users = d.users || [];
    if (d.users.find(u => u.username.toLowerCase() === username.toLowerCase())) return { ok: false, msg: 'Username already taken' };
    d.users.push({ id: nextId(d.users), username, password, role: 'user', createdAt: today() });
    save(d); return { ok: true };
  }
  function logout() { sessionStorage.removeItem(SESSION_KEY); }

  // Theme
  function getTheme() { return localStorage.getItem(THEME_KEY) || 'light'; }
  function applyTheme(t) { localStorage.setItem(THEME_KEY, t); document.body.classList.toggle('dark', t === 'dark'); }
  function toggleTheme() { applyTheme(getTheme() === 'dark' ? 'light' : 'dark'); }

  // Farmers
  function addFarmer({ name, crop, area, phone }) {
    if (!name || !name.trim()) return { ok: false, msg: 'Farmer name is required' };
    const d = load(); d.farmers = d.farmers || [];
    d.farmers.push({ id: nextId(d.farmers), name: name.trim(), crop: crop||'', area: area||'', phone: phone||'', incomes: [], createdAt: today() });
    save(d); return { ok: true };
  }
  function updateFarmer(id, patch) { const d = load(); const f = d.farmers.find(x=>x.id===id); if(f){ Object.assign(f,patch); save(d); } }
  function deleteFarmer(id) { const d = load(); d.farmers=d.farmers.filter(f=>f.id!==id); d.expenses=(d.expenses||[]).filter(e=>e.farmerId!==id); d.loans=(d.loans||[]).filter(l=>l.farmerId!==id); save(d); }
  function getFarmer(id) { return load().farmers.find(f=>f.id===id)||null; }
  function getAllFarmers() { return load().farmers||[]; }

  // Income
  function addIncome(farmerId, { amount, note, date }) {
    if (!amount || Number(amount) <= 0) return { ok: false, msg: 'Enter a valid amount' };
    const d = load(); const f = d.farmers.find(x=>x.id===farmerId); if(!f) return { ok:false, msg:'Farmer not found' };
    f.incomes = f.incomes||[];
    f.incomes.push({ id: nextId(f.incomes), amount: Number(amount), note: note||'', date: date||today() });
    save(d); return { ok: true };
  }
  function deleteIncome(farmerId, incomeId) { const d=load(); const f=d.farmers.find(x=>x.id===farmerId); if(f){ f.incomes=(f.incomes||[]).filter(i=>i.id!==incomeId); save(d); } }
  function updateIncome(farmerId, incomeId, patch) { const d=load(); const f=d.farmers.find(x=>x.id===farmerId); if(f){ const i=(f.incomes||[]).find(x=>x.id===incomeId); if(i){ Object.assign(i,patch); save(d); } } }

  // Expenses
  function addExpense({ farmerId, category, amount, note, date }) {
    if (!amount || Number(amount) <= 0) return { ok: false, msg: 'Enter a valid amount' };
    const d = load(); d.expenses = d.expenses||[];
    d.expenses.push({ id: nextId(d.expenses), farmerId: Number(farmerId), category: category||'Other', amount: Number(amount), note: note||'', date: date||today() });
    save(d); return { ok: true };
  }
  function deleteExpense(id) { const d=load(); d.expenses=d.expenses.filter(e=>e.id!==id); save(d); }
  function updateExpense(id, patch) { const d=load(); const e=(d.expenses||[]).find(x=>x.id===id); if(e){ Object.assign(e,patch); save(d); } }
  function getExpensesForFarmer(farmerId) { return (load().expenses||[]).filter(e=>e.farmerId===Number(farmerId)); }

  // Loans
  function addLoan({ farmerId, amount, note, date }) {
    if (!amount || Number(amount) <= 0) return { ok: false, msg: 'Enter a valid amount' };
    if (!farmerId) return { ok: false, msg: 'Select a farmer' };
    const d = load(); d.loans = d.loans||[];
    d.loans.push({ id: nextId(d.loans), farmerId: Number(farmerId), amount: Number(amount), paid: 0, note: note||'', date: date||today(), repayments: [] });
    save(d); return { ok: true };
  }
  function addRepayment(loanId, { amount, date, note }) {
    if (!amount || Number(amount) <= 0) return { ok: false, msg: 'Enter a valid amount' };
    const d = load(); const loan=(d.loans||[]).find(l=>l.id===loanId); if(!loan) return { ok:false, msg:'Loan not found' };
    loan.repayments = loan.repayments||[];
    loan.repayments.push({ id: nextId(loan.repayments), amount: Number(amount), date: date||today(), note: note||'' });
    loan.paid = loan.repayments.reduce((s,r)=>s+Number(r.amount),0);
    save(d); return { ok: true };
  }
  function deleteLoan(id) { const d=load(); d.loans=(d.loans||[]).filter(l=>l.id!==id); save(d); }
  function getLoansForFarmer(farmerId) { return (load().loans||[]).filter(l=>l.farmerId===Number(farmerId)); }
  function getAllLoans() { return load().loans||[]; }

  // Inventory
  function getInventory() { return load().inventory || emptyDb().inventory; }
  function addInventoryItem(category, { name, unit, quantity }) {
    if (!name||!name.trim()) return { ok:false, msg:'Name required' };
    const d=load(); d.inventory=d.inventory||emptyDb().inventory; d.inventory[category]=d.inventory[category]||[];
    d.inventory[category].push({ id: nextId(d.inventory[category]), name: name.trim(), unit: unit||'Units', quantity: Number(quantity)||0, lastUpdated: today() });
    save(d); return { ok: true };
  }
  function updateInventoryItem(category, id, patch) {
    const d=load(); const item=(d.inventory[category]||[]).find(x=>x.id===id);
    if(item){ Object.assign(item,patch); item.lastUpdated=today(); save(d); }
    return { ok: true };
  }
  function deleteInventoryItem(category, id) { const d=load(); if(d.inventory&&d.inventory[category]){ d.inventory[category]=d.inventory[category].filter(x=>x.id!==id); save(d); } }

  // Stats
  function getStats() {
    const d = load();
    let totalIncome=0, totalExpense=0, totalLoanGiven=0, totalLoanPaid=0;
    (d.farmers||[]).forEach(f => { totalIncome += (f.incomes||[]).reduce((s,i)=>s+Number(i.amount||0),0); });
    (d.expenses||[]).forEach(e => { totalExpense += Number(e.amount||0); });
    (d.loans||[]).forEach(l => { totalLoanGiven += Number(l.amount||0); totalLoanPaid += Number(l.paid||0); });
    return { farmerCount:(d.farmers||[]).length, totalIncome, totalExpense, netProfit:totalIncome-totalExpense, totalLoanGiven, totalLoanPaid, totalLoanPending:totalLoanGiven-totalLoanPaid };
  }

  // Reports
  const Report = {
    printOverall() {
      const d=load(); const expenses=d.expenses||[]; let tInc=0,tExp=0;
      const rows=(d.farmers||[]).map(f=>{
        const inc=(f.incomes||[]).reduce((s,i)=>s+Number(i.amount||0),0);
        const exp=expenses.filter(e=>e.farmerId===f.id).reduce((s,e)=>s+Number(e.amount||0),0);
        tInc+=inc; tExp+=exp;
        return `<tr><td>${f.name}</td><td>${f.crop||'-'}</td><td>${f.area||'-'}</td><td>₨${inc.toLocaleString()}</td><td>₨${exp.toLocaleString()}</td><td style="color:${inc-exp>=0?'green':'red'}">₨${(inc-exp).toLocaleString()}</td></tr>`;
      }).join('');
      const html=`<html><head><title>Overall Report</title><style>body{font-family:Arial;padding:20px}h1{color:#2e7d32;text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px}th{background:#e8f5e9}tfoot td{font-weight:bold;background:#f1f8e9}</style></head><body><h1>🌾 BH Agriculture — Overall Report</h1><p style="text-align:center;color:#666">Generated: ${new Date().toLocaleString()}</p><table><thead><tr><th>Farmer</th><th>Crop</th><th>Area</th><th>Income</th><th>Expense</th><th>Profit</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3"><strong>TOTAL</strong></td><td>₨${tInc.toLocaleString()}</td><td>₨${tExp.toLocaleString()}</td><td>₨${(tInc-tExp).toLocaleString()}</td></tr></tfoot></table><script>window.onload=()=>window.print();<\/script></body></html>`;
      const w=window.open('','_blank'); w.document.write(html); w.document.close();
    },
    printFarmer(id) {
      const d=load(); const f=d.farmers.find(x=>x.id===id); if(!f) return alert('Not found');
      const incomes=f.incomes||[]; const expenses=(d.expenses||[]).filter(e=>e.farmerId===id); const loans=(d.loans||[]).filter(l=>l.farmerId===id);
      const iT=incomes.reduce((s,i)=>s+Number(i.amount||0),0), eT=expenses.reduce((s,e)=>s+Number(e.amount||0),0);
      const lT=loans.reduce((s,l)=>s+Number(l.amount||0),0), lP=loans.reduce((s,l)=>s+Number(l.paid||0),0);
      const incRows=incomes.map(i=>`<tr><td>${i.date}</td><td>${i.note||'-'}</td><td>₨${Number(i.amount).toLocaleString()}</td></tr>`).join('')||'<tr><td colspan="3">No incomes</td></tr>';
      const expRows=expenses.map(e=>`<tr><td>${e.date}</td><td>${e.category}</td><td>${e.note||'-'}</td><td>₨${Number(e.amount).toLocaleString()}</td></tr>`).join('')||'<tr><td colspan="4">No expenses</td></tr>';
      const loanRows=loans.map(l=>`<tr><td>${l.date}</td><td>${l.note||'-'}</td><td>₨${Number(l.amount).toLocaleString()}</td><td>₨${Number(l.paid||0).toLocaleString()}</td><td>₨${(l.amount-(l.paid||0)).toLocaleString()}</td></tr>`).join('')||'<tr><td colspan="5">No loans</td></tr>';
      const html=`<html><head><title>${f.name} Report</title><style>body{font-family:Arial;padding:20px}h1,h2{color:#2e7d32}table{width:100%;border-collapse:collapse;margin-bottom:16px}th,td{border:1px solid #ccc;padding:8px}th{background:#e8f5e9}.sum{background:#f9fbe7;padding:12px;border-radius:6px;margin:12px 0}</style></head><body><h1>👨‍🌾 ${f.name} — Report</h1><p>Crop: <b>${f.crop||'-'}</b> | Area: <b>${f.area||'-'}</b> | Phone: <b>${f.phone||'-'}</b></p><p>Generated: ${new Date().toLocaleString()}</p><div class="sum">Income: ₨${iT.toLocaleString()} | Expense: ₨${eT.toLocaleString()} | Profit: <span style="color:${iT-eT>=0?'green':'red'}">₨${(iT-eT).toLocaleString()}</span> | Loan Pending: ₨${(lT-lP).toLocaleString()}</div><h2>💰 Incomes</h2><table><thead><tr><th>Date</th><th>Note</th><th>Amount</th></tr></thead><tbody>${incRows}</tbody></table><h2>💸 Expenses</h2><table><thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Amount</th></tr></thead><tbody>${expRows}</tbody></table><h2>🏦 Loans</h2><table><thead><tr><th>Date</th><th>Note</th><th>Loan</th><th>Paid</th><th>Pending</th></tr></thead><tbody>${loanRows}</tbody></table><script>window.onload=()=>window.print();<\/script></body></html>`;
      const w=window.open('','_blank'); w.document.write(html); w.document.close();
    }
  };

  // Shared UI helpers
  window.renderDashboard = function() {
    const s = getStats();
    const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    set('statFarmers', s.farmerCount);
    set('statIncome',  formatPKR(s.totalIncome));
    set('statExpense', formatPKR(s.totalExpense));
    set('statProfit',  formatPKR(s.netProfit));
    set('statLoans',   formatPKR(s.totalLoanPending));
    const d=load(); const expenses=d.expenses||[];
    const labels=(d.farmers||[]).map(f=>f.name);
    const profits=(d.farmers||[]).map(f=>{ const inc=(f.incomes||[]).reduce((s,i)=>s+Number(i.amount||0),0); const exp=expenses.filter(e=>e.farmerId===f.id).reduce((s,e)=>s+Number(e.amount||0),0); return inc-exp; });
    const ctx=document.getElementById('profitChart');
    if(ctx&&window.Chart){ if(window._profitChart) window._profitChart.destroy(); window._profitChart=new Chart(ctx.getContext('2d'),{type:'bar',data:{labels,datasets:[{label:'Profit (PKR)',data:profits,backgroundColor:profits.map(v=>v>=0?'#66bb6a':'#ef5350'),borderRadius:6}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}}); }
    renderFarmerCards();
  };

  window.renderFarmerCards = function(filter='') {
    const container=document.getElementById('farmerList'); if(!container) return;
    const d=load();
    const farmers=(d.farmers||[]).filter(f=>{ if(!filter) return true; const q=filter.toLowerCase(); return (f.name||'').toLowerCase().includes(q)||(f.crop||'').toLowerCase().includes(q); });
    if(farmers.length===0){ container.innerHTML=`<div class="empty-state"><div style="font-size:48px">👨‍🌾</div><p>No farmers yet. Add your first farmer!</p></div>`; return; }
    container.innerHTML='';
    farmers.forEach(f=>{
      const inc=(f.incomes||[]).reduce((s,i)=>s+Number(i.amount||0),0);
      const exp=(d.expenses||[]).filter(e=>e.farmerId===f.id).reduce((s,e)=>s+Number(e.amount||0),0);
      const profit=inc-exp;
      const loanPending=(d.loans||[]).filter(l=>l.farmerId===f.id).reduce((s,l)=>s+Number(l.amount||0)-Number(l.paid||0),0);
      const card=document.createElement('div'); card.className='farmer-card';
      card.innerHTML=`<div class="farmer-card-header"><div class="farmer-avatar">${f.name.charAt(0).toUpperCase()}</div><div><div class="farmer-name">${f.name}</div><div class="farmer-meta">${f.crop?'🌾 '+f.crop:''} ${f.area?'• 📐 '+f.area:''}</div></div></div><div class="farmer-stats"><div class="fstat"><span class="fstat-label">💰 Income</span><span class="fstat-value" style="color:#2e7d32">${formatPKR(inc)}</span></div><div class="fstat"><span class="fstat-label">💸 Expense</span><span class="fstat-value" style="color:#c62828">${formatPKR(exp)}</span></div><div class="fstat"><span class="fstat-label">📈 Profit</span><span class="fstat-value" style="color:${profit>=0?'#2e7d32':'#c62828'}">${formatPKR(profit)}</span></div>${loanPending>0?`<div class="fstat"><span class="fstat-label">🏦 Loan Due</span><span class="fstat-value" style="color:#e65100">${formatPKR(loanPending)}</span></div>`:''}</div><div class="farmer-actions"><button class="btn btn-sm" onclick="window.location='farmer.html?id=${f.id}'">👁 View</button><button class="btn btn-sm" style="background:#f0f4f0;color:#333" onclick="Report.printFarmer(${f.id})">🖨 Print</button><button class="btn btn-sm btn-danger" onclick="if(confirm('Delete ${f.name} and all records?')){ BH.deleteFarmer(${f.id}); renderDashboard(); }">🗑 Delete</button></div>`;
      container.appendChild(card);
    });
  };

  window.renderFarmersTable = function(filter='') {
    const tbody=document.querySelector('#farmerTable tbody'); if(!tbody) return;
    const d=load();
    const farmers=(d.farmers||[]).filter(f=>!filter||(`${f.name} ${f.crop}`).toLowerCase().includes(filter.toLowerCase()));
    tbody.innerHTML='';
    if(farmers.length===0){ tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:#999">No farmers yet. Add one above!</td></tr>'; return; }
    farmers.forEach(f=>{
      const inc=(f.incomes||[]).reduce((s,i)=>s+Number(i.amount||0),0);
      const exp=(d.expenses||[]).filter(e=>e.farmerId===f.id).reduce((s,e)=>s+Number(e.amount||0),0);
      const tr=document.createElement('tr');
      tr.innerHTML=`<td><strong>${f.name}</strong>${f.phone?'<br><small style="color:#888">📞 '+f.phone+'</small>':''}</td><td>${f.crop||'-'}</td><td>${f.area||'-'}</td><td><span style="color:#2e7d32">${formatPKR(inc)}</span> / <span style="color:#c62828">${formatPKR(exp)}</span></td><td class="row" style="gap:4px"><button class="btn btn-sm" onclick="window.location='farmer.html?id=${f.id}'">👁 View</button><button class="btn btn-sm btn-danger" onclick="if(confirm('Delete ${f.name}?')){ BH.deleteFarmer(${f.id}); renderFarmersTable(); }">🗑</button></td>`;
      tbody.appendChild(tr);
    });
  };

  window.fillFarmerSelect = function(id) {
    const sel=document.getElementById(id); if(!sel) return;
    sel.innerHTML='<option value="">-- Select Farmer --</option>';
    getAllFarmers().forEach(f=>sel.innerHTML+=`<option value="${f.id}">${f.name}</option>`);
  };

  // Expose
  window.BH = { isLoggedIn, login, signup, logout, getCurrentUser, toggleTheme, applyTheme, getTheme, addFarmer, updateFarmer, deleteFarmer, getFarmer, getAllFarmers, addIncome, deleteIncome, updateIncome, addExpense, deleteExpense, updateExpense, getExpensesForFarmer, addLoan, addRepayment, deleteLoan, getLoansForFarmer, getAllLoans, getInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, getStats, getData:load, saveData:save, resetData(){ save(emptyDb()); }, formatPKR, today, init(){ load(); applyTheme(getTheme()); } };
  window.Report = Report;
  document.addEventListener('DOMContentLoaded', () => applyTheme(getTheme()));
})();
