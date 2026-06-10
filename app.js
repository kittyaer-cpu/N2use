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

/* 後面其他程式碼不用改，保留你原本從 async function login() 開始到 init(); 的全部內容 */
