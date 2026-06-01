let allLinks = [];
let activeFilter = 'all';
let searchQuery = '';

const themeBtn = document.getElementById('themeBtn');
const extractBtn = document.getElementById('extractBtn');
const searchInp = document.getElementById('searchInp');
const listContainer = document.getElementById('listContainer');
const controlsWrapper = document.getElementById('controlsWrapper');
const statsGrid = document.getElementById('statsGrid');
const actionRow = document.getElementById('actionRow');

// Theme Switcher
const savedTheme = localStorage.getItem('ms-theme') || 'dark';
document.documentElement.dataset.theme = savedTheme;
themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

themeBtn.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme;
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('ms-theme', next);
  themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
});

// Search and Tab Filter inputs
searchInp.addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase().trim();
  renderLinks();
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeFilter = tab.dataset.filter;
    renderLinks();
  });
});

// Scanner Trigger
extractBtn.addEventListener('click', async () => {
  extractBtn.textContent = 'Scanning DOM Resources...';
  extractBtn.classList.add('loading');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || tab.url.startsWith('chrome://')) {
      showError("Cannot scan protected browser tabs.");
      resetBtn();
      return;
    }

    // `allFrames: true` ব্যবহার করে সমস্ত সাব-ফ্রেম এবং ক্রস-অরিজিন আইফ্রেম স্ক্যান করা হচ্ছে
    chrome.scripting.executeScript(
      { target: { tabId: tab.id, allFrames: true }, function: universalMediaScanner },
      (results) => {
        resetBtn();
        if (results && results.length > 0) {
          const merged = [];
          const seen = new Set();
          
          // বিভিন্ন ফ্রেম থেকে পাওয়া ফলাফলগুলোকে ডুপ্লিকেট ছাড়া মার্জ করা
          results.forEach(frameResult => {
            if (frameResult && Array.isArray(frameResult.result)) {
              frameResult.result.forEach(item => {
                if (item && item.url && !seen.has(item.url)) {
                  seen.add(item.url);
                  merged.push(item);
                }
              });
            }
          });

          allLinks = merged;
          toggleDashboard(allLinks.length > 0);
          updateStats();
          renderLinks();
        } else {
          toggleDashboard(false);
          showError("No media elements recovered from this page.");
        }
      }
    );
  } catch (err) {
    resetBtn();
    showError("Extraction crash. Refresh page and try again.");
  }
});

function resetBtn() {
  extractBtn.textContent = '🚀 Deep Scan Webpage';
  extractBtn.classList.remove('loading');
}

function toggleDashboard(hasData) {
  controlsWrapper.classList.toggle('hidden', !hasData);
  statsGrid.classList.toggle('hidden', !hasData);
  actionRow.classList.toggle('hidden', !hasData);
}

function updateStats() {
  document.getElementById('videoCount').textContent = allLinks.filter(l => l.type === 'video').length;
  document.getElementById('iframeCount').textContent = allLinks.filter(l => l.type === 'iframe').length;
  document.getElementById('imageCount').textContent = allLinks.filter(l => l.type === 'image').length;
  document.getElementById('audioCount').textContent = allLinks.filter(l => l.type === 'audio').length;
}

function renderLinks() {
  listContainer.innerHTML = '';
  
  const filtered = allLinks.filter(link => {
    const matchesFilter = activeFilter === 'all' || link.type === activeFilter;
    const matchesSearch = link.url.toLowerCase().includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📡</div><p>No matches found.</p></div>`;
    return;
  }

  filtered.forEach((link, i) => {
    const card = document.createElement('div');
    card.className = 'link-card';
    card.style.animationDelay = `${Math.min(i * 20, 150)}ms`;

    // টেক্সট ট্রাঙ্কেশন বা সংক্ষিপ্ত রূপ
    const displayUrl = link.url.length > 50 ? link.url.substring(0, 47) + '...' : link.url;
    let typeLabel = link.type === 'video' ? '📹 Video' : link.type === 'iframe' ? '🔗 iFrame' : link.type === 'image' ? '🖼️ Image' : '🎵 Audio';

    // ১. প্রিভিউ জেনারেশন লজিক
    let previewHTML = '';
    if (link.type === 'image') {
      previewHTML = `<img src="${link.url}" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\'icon-placeholder\'>🖼️</span>';" />`;
    } else if (link.type === 'video') {
      // ভিডিওর ক্ষেত্রে মাউস হোভার করলে (Play) এবং মাউস সরালে (Pause) হবে
      previewHTML = `
        <video src="${link.url}" muted preload="metadata" loop onmouseover="this.play().catch(e=>{})" onmouseout="this.pause()">
        </video>
        <span class="icon-placeholder" style="position:absolute; font-size:9px; bottom:2px; right:2px; background:rgba(0,0,0,0.6); padding:1px 3px; border-radius:3px; color:#fff;">▶</span>
      `;
    } else if (link.type === 'audio') {
      previewHTML = `<span class="icon-placeholder">🎵</span>`;
    } else {
      previewHTML = `<span class="icon-placeholder">🔗</span>`;
    }

    card.innerHTML = `
      <div class="preview-box">
        ${previewHTML}
      </div>
      <div class="card-info">
        <div class="card-top">
          <span class="badge ${link.type}">${typeLabel}</span>
        </div>
        <div class="url-text" title="${link.url}">${displayUrl}</div>
        <div class="card-actions">
          <button class="mini-btn copy-single">Copy</button>
          <button class="mini-btn open-single">Open</button>
        </div>
      </div>
    `;

    card.querySelector('.copy-single').addEventListener('click', (e) => {
      navigator.clipboard.writeText(link.url).then(() => {
        e.target.textContent = 'Copied!';
        e.target.classList.add('copied');
        setTimeout(() => { e.target.textContent = 'Copy'; e.target.classList.remove('copied'); }, 1200);
      });
    });

    card.querySelector('.open-single').addEventListener('click', () => {
      chrome.tabs.create({ url: link.url });
    });

    listContainer.appendChild(card);
  });
}

// Bulk Actions Logic
document.getElementById('copyAllBtn').addEventListener('click', (e) => {
  const visible = allLinks.filter(link => {
    const matchesFilter = activeFilter === 'all' || link.type === activeFilter;
    const matchesSearch = link.url.toLowerCase().includes(searchQuery);
    return matchesFilter && matchesSearch;
  }).map(l => l.url).join('\n');

  if (!visible) return;
  navigator.clipboard.writeText(visible).then(() => {
    e.target.textContent = '✅ Copied to Clipboard!';
    e.target.classList.add('success');
    setTimeout(() => { e.target.textContent = '📋 Copy Filtered'; e.target.classList.remove('success'); }, 1500);
  });
});

document.getElementById('clearBtn').addEventListener('click', () => {
  toggleDashboard(false);
  allLinks = [];
  listContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🛰️</div><p>Cleared. Ready for fresh deep scan.</p></div>`;
});

function showError(msg) {
  listContainer.innerHTML = `<div class="empty-state" style="color:#ff4a5a;"><div class="empty-state-icon">⚠️</div><p>${msg}</p></div>`;
}

/* ── DOM INJECTED MULTI-SCANNER ENGINE ── */
function universalMediaScanner() {
  const extracted = [];
  const trackedUrls = new Set();

  const pushItem = (url, type) => {
    if (!url || url.startsWith('javascript:') || url === 'about:blank' || url.startsWith('data:image')) return;
    
    try {
      // ২. স্ট্যান্ডার্ড URL কনস্ট্রাক্টর ব্যবহার করে রিলেটিভ ইউআরএল অ্যাবসলিউট লিংকে রূপান্তর
      url = new URL(url, document.baseURI || window.location.href).href;
    } catch(e) {
      return;
    }
    
    if (trackedUrls.has(url)) return;
    trackedUrls.add(url);
    extracted.push({ url, type });
  };

  // 1. VIDEOS DETECTOR
  document.querySelectorAll('video').forEach(v => {
    if (v.src) pushItem(v.src, 'video');
    v.querySelectorAll('source').forEach(s => { if (s.src) pushItem(s.src, 'video'); });
  });

  // 2. EMBED / IFRAMES DETECTOR
  document.querySelectorAll('iframe').forEach(f => {
    try { if (f.src) pushItem(f.src, 'iframe'); } catch(e) {}
  });

  // 3. IMAGES & BACKGROUND IMAGES & YOUTUBE THUMBNAILS
  document.querySelectorAll('img').forEach(img => {
    let src = img.src || img.getAttribute('data-src') || img.currentSrc;
    if (src) pushItem(src, 'image');
  });

  // ৩. সিএসএস ব্যাকগ্রাউন্ড ইমেজ সনাক্তকরণ
  document.querySelectorAll('*').forEach(el => {
    try {
      const bg = window.getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none' && bg.startsWith('url(')) {
        const cleanUrl = bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
        pushItem(cleanUrl, 'image');
      }
    } catch(e) {}
  });
  
  // YouTube Thumbnail Extractor
  const ytMatch = window.location.href.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/);
  if (ytMatch && ytMatch[1]) {
    pushItem(`https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`, 'image');
  }

  // 4. AUDIO / SOUNDTRACK DETECTOR
  document.querySelectorAll('audio').forEach(a => {
    if (a.src) pushItem(a.src, 'audio');
    a.querySelectorAll('source').forEach(s => { if (s.src) pushItem(s.src, 'audio'); });
  });

  return extracted;
}             
