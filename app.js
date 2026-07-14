import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection, query, orderBy,
  onSnapshot, serverTimestamp, updateDoc, deleteDoc, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const fb = initializeApp(firebaseConfig);
const db = getFirestore(fb);

const stores = ['板橋大遠百','樹林','中和','南港','汐止','天母','比漾','忠孝'];

const fines = [
  ['防盜檢查缺失', 50],
  ['盤點當日未結案', 50],
  ['盤點未過帳', 50],
  ['立牌、海報未準時更換', 50],
  ['巡檢行政缺失', 50],
  ['十萬以上筆筆拍未上傳', 200],
  ['AI稽核申訴完未達100分', 300],
  ['內稽原始分數未達85分', 300]
];

const rewards = [
  ['內稽原始分數達95分', 1000],
  ['區內總門號達成100%', 3000]
];

let state = {
  user: null,
  tab: 'home',
  records: [],
  fund: [],
  users: [],
  settings: { fundBalance: 200 }
};

const $ = s => document.querySelector(s);
const app = $('#app');

async function init() {
  try {
    const settingsSnap = await getDoc(doc(db, 'meta', 'settings'));
    if (!settingsSnap.exists()) {
      await setDoc(doc(db, 'meta', 'settings'), {
        fundBalance: 200,
        createdAt: serverTimestamp()
      });
    }

    const adminSnap = await getDoc(doc(db, 'users', '5052'));
    if (!adminSnap.exists()) {
      await setDoc(doc(db, 'users', '5052'), {
        employeeId: '5052',
        name: '佩佩',
        password: '5052',
        role: 'admin',
        active: true,
        createdAt: serverTimestamp()
      });
    }

    renderLogin();
  } catch (err) {
    console.error(err);
    app.innerHTML = `
      <div class="login">
        <div class="login-card">
          <img class="logo" src="./logo.png">
          <h1>北二獎懲基金App</h1>
          <p>Firebase 連線失敗，請確認 Firestore 規則與 firebase-config.js。</p>
        </div>
      </div>
    `;
  }
}

function renderLogin() {
  app.innerHTML = `
    <div class="login">
      <div class="login-card">
        <img class="logo" src="./logo.png">
        <h1>北二獎懲基金App</h1>
        <div class="sub">一起努力・一起成長 🌱</div>

        <div class="field">
          <label>員編</label>
          <input id="emp" inputmode="numeric" placeholder="例如 5052">
        </div>

        <div class="field">
          <label>密碼</label>
          <input id="pwd" type="password" placeholder="預設與員編相同">
        </div>

        <button id="loginBtn" style="width:100%">登入</button>
        <p class="small muted">🍃 每一份努力都會長成森林</p>
      </div>
    </div>
  `;

  $('#loginBtn').onclick = login;
}

async function login() {
  const id = $('#emp').value.trim();
  const pwd = $('#pwd').value.trim();

  if (!id || !pwd) return alert('請輸入員編與密碼');

  const snap = await getDoc(doc(db, 'users', id));
  if (!snap.exists()) return alert('找不到此員編');

  const u = snap.data();
  if (!u.active) return alert('此帳號已停用');
  if (u.password !== pwd) return alert('密碼錯誤');

  state.user = u;
  subscribe();
}

function subscribe() {
  onSnapshot(query(collection(db, 'records'), orderBy('createdAt', 'desc')), s => {
    state.records = s.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });

  onSnapshot(query(collection(db, 'fundLedger'), orderBy('createdAt', 'desc')), s => {
    state.fund = s.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });

  onSnapshot(collection(db, 'users'), s => {
    state.users = s.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });

  onSnapshot(doc(db, 'meta', 'settings'), s => {
    if (s.exists()) state.settings = s.data();
    render();
  });
}

function money(n) {
  return Number(n || 0).toLocaleString('zh-TW');
}

function getStoreName(record) {
  const raw = String(record.store || record.storeName || '').trim();
  if (!raw) return '未指定門市';

  const matched = stores.find(s => raw === s || raw.includes(s) || s.includes(raw));
  return matched || raw;
}

function totals() {
  const fine = state.records
    .filter(r => r.type === 'fine')
    .reduce((a, b) => a + (+b.amount || 0), 0);

  const reward = state.records
    .filter(r => r.type === 'reward')
    .reduce((a, b) => a + (+b.amount || 0), 0);

  const income = state.fund
    .filter(r => r.kind === 'income')
    .reduce((a, b) => a + (+b.amount || 0), 0);

  const expense = state.fund
    .filter(r => r.kind === 'expense')
    .reduce((a, b) => a + (+b.amount || 0), 0);

  return {
    fine,
    reward,
    income,
    expense,
    balance: (state.settings.fundBalance || 0) + fine + reward + income - expense
  };
}

function storeFineTotals() {
  const result = {};
  stores.forEach(store => {
    result[store] = { store, total: 0, count: 0, records: [] };
  });

  state.records
    .filter(r => r.type === 'fine')
    .forEach(r => {
      const store = getStoreName(r);
      if (!result[store]) result[store] = { store, total: 0, count: 0, records: [] };

      result[store].total += (+r.amount || 0);
      result[store].count += 1;
      result[store].records.push(r);
    });

  return Object.values(result);
}

function isAdmin() {
  return state.user?.role === 'admin';
}

function shell(content) {
  app.innerHTML = `
    <div class="wrap">
      <div class="top">
        <div class="brand">
          <img src="./logo.png">
          <div>
            <b>北二獎懲基金App</b>
            <div class="small muted">${state.user?.name || ''}・${state.user?.employeeId || ''}</div>
          </div>
        </div>
        <button class="secondary" onclick="location.reload()">登出</button>
      </div>
      ${content}
    </div>

    <div class="nav">
      ${[
        ['home','🏠 首頁'],
        ['fine','🏪 罰款'],
        ['reward','⭐ 獎勵'],
        ['fund','💰 基金'],
        ['history','📜 紀錄'],
        ['admin','⚙️ 管理']
      ].map(x => `
        <button class="${state.tab === x[0] ? 'active' : ''}" data-tab="${x[0]}">${x[1]}</button>
      `).join('')}
    </div>
  `;

  document.querySelectorAll('[data-tab]').forEach(b => {
    b.onclick = () => {
      state.tab = b.dataset.tab;
      render();
    };
  });
}

function render() {
  if (!state.user) return;

  const t = totals();

  if (state.tab === 'home') {
    const storeTotals = storeFineTotals();

    return shell(`
      <div class="grid">
        <div class="card"><div>本月罰款</div><div class="stat">$${money(t.fine)}</div></div>
        <div class="card"><div>本月獎勵</div><div class="stat">$${money(t.reward)}</div></div>
        <div class="card"><div>基金支出</div><div class="stat">$${money(t.expense)}</div></div>
        <div class="card"><div>預估區基金</div><div class="stat">$${money(t.balance)}</div></div>
      </div>

      <div class="card">
        <h3>🏪 門市罰款加總</h3>
        ${storeTotals.map(s => `
          <div class="row">
            <div>
              <b>${s.store}</b>
              <div class="small muted">${s.count} 筆罰款</div>
            </div>
            <div><b>$${money(s.total)}</b></div>
          </div>
        `).join('')}
      </div>
    `);
  }

  if (state.tab === 'fine') {
    shell(`
      <div class="card">
        <h2>🏪 門市罰款</h2>
        <div class="field">
          <label>選擇門市</label>
          <select id="store">
            ${stores.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>

        <div class="actions">
          ${fines.map(f => `
            <button class="fine" data-fine="${f[0]}" data-amt="${f[1]}">
              ${f[0]}<br>-$${f[1]}
            </button>
          `).join('')}
        </div>
      </div>
    `);
    return bindFine();
  }

  if (state.tab === 'reward') {
    shell(`
      <div class="card">
        <h2>⭐ 整區獎勵</h2>
        <div class="actions">
          ${rewards.map(r => `
            <button class="reward" data-reward="${r[0]}" data-amt="${r[1]}">
              ${r[0]}<br>+$${r[1]}
            </button>
          `).join('')}
        </div>
      </div>
    `);
    return bindReward();
  }

  if (state.tab === 'fund') {
    shell(`
      <div class="card">
        <h2>💰 區基金帳本</h2>
        <div class="stat">目前預估 $${money(t.balance)}</div>

        <div class="grid">
          <div class="field">
            <label>類型</label>
            <select id="kind">
              <option value="income">收入</option>
              <option value="expense">支出</option>
            </select>
          </div>

          <div class="field">
            <label>金額</label>
            <input id="amt" inputmode="numeric">
          </div>
        </div>

        <div class="field">
          <label>備註</label>
          <input id="note" placeholder="例如：購買聚餐用品">
        </div>

        <button id="addFund">新增帳本紀錄</button>
      </div>

      <div class="list">
        ${state.fund.map(r => row(
          `${r.kind === 'income' ? '收入' : '支出'} $${money(r.amount)}`,
          r.note || '',
          r.id,
          'fundLedger'
        )).join('')}
      </div>
    `);
    return bindFund();
  }

  if (state.tab === 'history') {
    const storeTotals = storeFineTotals();
    const fineRecords = state.records.filter(r => r.type === 'fine');
    const rewardRecords = state.records.filter(r => r.type === 'reward');

    shell(`
      <div class="card">
        <h2>📜 獎懲紀錄</h2>
        <button id="exportImg" class="gold">匯出門市罰款總結圖 PNG</button>
        ${isAdmin() ? '<button id="closeMonth" class="danger">本月結算並歸零</button>' : ''}
      </div>

      <div id="receipt" class="receipt">
        <h2>北二獎懲基金結算</h2>
        <p>結算日期：${new Date().toLocaleDateString('zh-TW')}</p>

        <div class="kpi">
          <div><b>總罰款</b><br>$${money(t.fine)}</div>
          <div><b>總獎勵</b><br>$${money(t.reward)}</div>
          <div><b>區基金</b><br>$${money(t.balance)}</div>
        </div>

        <hr>

        <h3>🏪 門市罰款總結</h3>
        ${storeTotals.map(s => `
          <div class="row receipt-row">
            <div>
              <b>${s.store}</b>
              <div class="small muted">${s.count} 筆罰款</div>
            </div>
            <div><b>$${money(s.total)}</b></div>
          </div>
        `).join('')}

        <hr>

        <h3>📌 各門市罰款明細</h3>
        ${storeTotals.map(s => `
          <div class="store-detail">
            <h4>${s.store}｜$${money(s.total)}｜${s.count} 筆</h4>
            ${s.records.length ? s.records.map(r => `
              <p>・${r.reason}｜$${money(r.amount)}｜${r.createdByName || ''}</p>
            `).join('') : '<p class="small muted">本月無罰款</p>'}
          </div>
        `).join('')}

        <hr>

        <h3>⭐ 整區獎勵明細</h3>
        ${rewardRecords.length ? rewardRecords.map(r => `
          <p>獎勵｜整區｜${r.reason}｜$${money(r.amount)}｜${r.createdByName || ''}</p>
        `).join('') : '<p>目前沒有獎勵紀錄</p>'}
      </div>

      <div class="card">
        <h3>🏪 門市罰款加總</h3>
        ${storeTotals.map(s => `
          <div class="row">
            <div>
              <b>${s.store}</b>
              <div class="small muted">${s.count} 筆</div>
            </div>
            <div><b>$${money(s.total)}</b></div>
          </div>
        `).join('')}
      </div>

      <div class="list">
        ${state.records.map(r => row(
          `${r.type === 'fine' ? '罰款' : '獎勵'} $${money(r.amount)}`,
          `${r.type === 'fine' ? getStoreName(r) : '整區'}｜${r.reason}`,
          r.id,
          'records'
        )).join('')}
      </div>
    `);
    return bindHistory();
  }

  if (state.tab === 'admin') {
    shell(isAdmin() ? adminHtml() : `
      <div class="card">
        <h2>⚙️ 管理中心</h2>
        <p>只有管理員可以使用。</p>
      </div>
    `);
    return bindAdmin();
  }
}

function row(title, sub, id, col) {
  return `
    <div class="row">
      <div>
        <b>${title}</b>
        <div class="small muted">${sub || ''}</div>
      </div>
      ${isAdmin() ? `<button class="secondary" data-del="${id}" data-col="${col}">刪除</button>` : ''}
    </div>
  `;
}

function bindDelete() {
  document.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = async () => {
      if (confirm('確定刪除？')) {
        await deleteDoc(doc(db, b.dataset.col, b.dataset.del));
      }
    };
  });
}

function bindFine() {
  document.querySelectorAll('[data-fine]').forEach(b => {
    b.onclick = async () => {
      await addDoc(collection(db, 'records'), {
        type: 'fine',
        store: $('#store').value,
        reason: b.dataset.fine,
        amount: +b.dataset.amt,
        createdBy: state.user.employeeId,
        createdByName: state.user.name,
        createdAt: serverTimestamp()
      });
      alert('已新增罰款紀錄');
    };
  });
}

function bindReward() {
  document.querySelectorAll('[data-reward]').forEach(b => {
    b.onclick = async () => {
      await addDoc(collection(db, 'records'), {
        type: 'reward',
        store: '整區',
        reason: b.dataset.reward,
        amount: +b.dataset.amt,
        createdBy: state.user.employeeId,
        createdByName: state.user.name,
        createdAt: serverTimestamp()
      });
      alert('已新增獎勵紀錄');
    };
  });
}

function bindFund() {
  bindDelete();

  $('#addFund').onclick = async () => {
    const amount = +$('#amt').value;

    if (!amount) return alert('請輸入金額');

    await addDoc(collection(db, 'fundLedger'), {
      kind: $('#kind').value,
      amount,
      note: $('#note').value,
      createdBy: state.user.employeeId,
      createdByName: state.user.name,
      createdAt: serverTimestamp()
    });

    alert('已新增基金帳本紀錄');
  };
}

function bindHistory() {
  bindDelete();

  $('#exportImg').onclick = async () => {
    const receipt = document.querySelector('#receipt');

    if (!receipt) return alert('找不到結算內容');

    try {
      const canvas = await html2canvas(receipt, {
        backgroundColor: '#f8f4e8',
        scale: 2,
        useCORS: true
      });

      const link = document.createElement('a');
      link.download = `北二門市罰款總結_${new Date().toLocaleDateString('zh-TW').replaceAll('/', '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
      alert('匯出失敗，請重新整理後再試一次');
    }
  };

  const btn = $('#closeMonth');
  if (btn) btn.onclick = closeMonth;
}

async function closeMonth() {
  if (!confirm('確定本月結算？會把本月獎懲加進區基金，並清空本月獎懲紀錄。')) return;

  const t = totals();
  const storesSummary = storeFineTotals();

  await addDoc(collection(db, 'settlements'), {
    fine: t.fine,
    reward: t.reward,
    balanceAfter: t.balance,
    storesSummary,
    records: state.records,
    createdBy: state.user.employeeId,
    createdByName: state.user.name,
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, 'meta', 'settings'), {
    fundBalance: t.balance
  });

  const batch = writeBatch(db);
  state.records.forEach(r => batch.delete(doc(db, 'records', r.id)));
  await batch.commit();

  alert('結算完成，已歸零本月獎懲。');
}

function adminHtml() {
  return `
    <div class="card">
      <h2>⚙️ 管理中心</h2>

      <div class="grid">
        <div class="field">
          <label>員編</label>
          <input id="newId">
        </div>

        <div class="field">
          <label>姓名</label>
          <input id="newName">
        </div>
      </div>

      <div class="field">
        <label>權限</label>
        <select id="newRole">
          <option value="staff">一般</option>
          <option value="admin">管理員</option>
        </select>
      </div>

      <button id="addUser">新增帳號｜預設密碼=員編</button>
    </div>

    <div class="list">
      ${state.users.map(u => `
        <div class="row">
          <div>
            <b>${u.name}</b>
            <div class="small muted">${u.employeeId}｜${u.role}</div>
          </div>
          ${u.employeeId === '5052' ? '' : `<button class="secondary" data-userdel="${u.employeeId}">刪除</button>`}
        </div>
      `).join('')}
    </div>
  `;
}

function bindAdmin() {
  if (!isAdmin()) return;

  $('#addUser').onclick = async () => {
    const id = $('#newId').value.trim();
    const name = $('#newName').value.trim();

    if (!id || !name) return alert('請輸入員編與姓名');

    await setDoc(doc(db, 'users', id), {
      employeeId: id,
      name,
      password: id,
      role: $('#newRole').value,
      active: true,
      createdAt: serverTimestamp()
    });

    alert('已新增帳號');
  };

  document.querySelectorAll('[data-userdel]').forEach(b => {
    b.onclick = async () => {
      if (confirm('刪除此帳號？')) {
        await deleteDoc(doc(db, 'users', b.dataset.userdel));
      }
    };
  });
}

init();
