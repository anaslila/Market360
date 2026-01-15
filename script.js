<script>
class Market360V35 {
  constructor() {
    this.webAppUrl = 'https://script.google.com/macros/s/AKfycbyqHc-e2FFfOeOgzgpnZoLQmal7DKVD8kMC_eZw8EFO3w_8ATE7QPSj1caWkZx0qnNI/exec';
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.deferredPrompt = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadData();
    this.initPWA();
    this.initDarkMode();
    this.initSearch();
    this.updateMarketStatus();
    this.startAutoRefresh();
  }

  bindEvents() {
    // Bottom navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        if (tab) {
          document.querySelectorAll('.nav-item, .tab-content').forEach(el => el.classList.remove('active'));
          e.currentTarget.classList.add('active');
          document.getElementById(tab).classList.add('active');
        }
      });
    });

    // Bouncy glass cards - tap to expand
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.stock-card');
      if (card && !e.target.closest('.expand-btn')) {
        card.classList.toggle('expanded');
      }
    });

    // Explicit expand button
    document.addEventListener('click', (e) => {
      if (e.target.closest('.expand-btn')) {
        e.stopPropagation();
        const card = e.target.closest('.stock-card');
        card.classList.toggle('expanded');
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        this.loadData();
      }
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('stockSearch').focus();
      }
    });
  }

  initPWA() {
    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      document.getElementById('installBtn').classList.add('show');
    });

    document.getElementById('installBtn').addEventListener('click', async () => {
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          document.getElementById('installBtn').classList.remove('show');
        }
        this.deferredPrompt = null;
      }
    });

    window.addEventListener('appinstalled', () => {
      document.getElementById('installBtn').classList.remove('show');
    });
  }

  initDarkMode() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
      document.body.classList.add('dark');
      document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    }

    document.getElementById('themeToggle').addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const isDark = document.body.classList.contains('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      document.getElementById('themeToggle').innerHTML = 
        isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });
  }

  initSearch() {
    const searchInput = document.getElementById('stockSearch');
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('.stock-card').forEach(card => {
        const name = card.querySelector('.stock-name')?.textContent.toLowerCase() || '';
        const symbol = card.querySelector('.stock-symbol')?.textContent.toLowerCase() || '';
        card.style.display = (name.includes(query) || symbol.includes(query)) ? 'block' : 'none';
      });
    });
  }

  updateMarketStatus() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST offset
    const istTime = new Date(now.getTime() + istOffset);
    
    const day = istTime.getDay();
    const hour = istTime.getHours();
    const minute = istTime.getMinutes();
    
    // Market hours: Mon-Fri 9:15 AM - 3:30 PM IST
    const isMarketDay = day >= 1 && day <= 5;
    const isMarketTime = hour > 9 || (hour === 9 && minute >= 15)) && 
                        (hour < 15 || (hour === 15 && minute <= 30));
    
    const status = isMarketDay && isMarketTime ? '🟢 LIVE' : '🔴 CLOSED';
    document.getElementById('nse-status').textContent = status;
    document.getElementById('bse-status').textContent = status;
    
    // Update every minute
    setInterval(() => this.updateMarketStatus(), 60000);
  }

  async loadData() {
    try {
      console.log('🔄 Loading Market360 v3.5...');
      const response = await fetch(`${this.webAppUrl}?action=getAllStockData`);
      const data = await response.json();
      
      if (data.success !== false) {
        this.renderAllTabs(data);
        this.updateStats(data);
      } else {
        this.showErrorState();
      }
    } catch (error) {
      console.error('❌ Load failed:', error);
      this.showErrorState();
    }
  }

  renderAllTabs(data) {
    ['intraday', 'shortterm', 'longterm'].forEach(tab => {
      this.renderStocks(tab, data[tab] || []);
    });
  }

  renderStocks(tab, stocks) {
    const container = document.getElementById(`${tab}Stocks`);
    
    if (!stocks || stocks.length === 0) {
      container.innerHTML = this.getEmptyState(tab);
      return;
    }
    
    container.innerHTML = stocks.map((stock, index) => 
      this.createStockCard(stock, index)
    ).join('');
  }

  createStockCard(stock, index) {
    const rowData = Array.isArray(stock) ? stock : Object.values(stock);
    const [date, symbol, company, entry, target, stopLoss, status, trader, sector, currentPrice, profitLossRaw] = rowData;
    
    const profitLoss = parseFloat(profitLossRaw) || 0;
    const isPositive = profitLoss >= 0;
    const pnlClass = isPositive ? 'pnl-positive' : 'pnl-negative';
    const statusText = (status || 'ACTIVE').toString().toUpperCase();

    return `
      <div class="stock-card" style="animation-delay: ${index * 0.08}s">
        <div class="stock-header">
          <div class="stock-title">
            <div class="stock-name">${this.escapeHtml(company || 'N/A')}</div>
            <div class="stock-symbol">${this.escapeHtml(symbol || 'N/A')}</div>
          </div>
          <div class="card-controls">
            <div class="status-badge">${statusText}</div>
            <button class="expand-btn" title="Toggle details">
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
        </div>
        <div class="card-summary">
          <div class="price-grid">
            <div class="price-item">
              <div class="price-label">Entry</div>
              <div class="price-value">${this.formatPrice(entry)}</div>
            </div>
            <div class="price-item">
              <div class="price-label">Target</div>
              <div class="price-value">${this.formatPrice(target)}</div>
            </div>
            <div class="price-item">
              <div class="price-label">Stop Loss</div>
              <div class="price-value">${this.formatPrice(stopLoss)}</div>
            </div>
            <div class="price-item ${pnlClass}">
              <div class="price-label">P&L</div>
              <div class="price-value">${isPositive ? '+' : ''}${profitLoss.toFixed(1)}%</div>
            </div>
          </div>
        </div>
        <div class="card-details">
          <div class="stock-footer">
            <div><i class="fas fa-user footer-icon"></i>${this.escapeHtml(trader || 'Expert')}</div>
            <div><i class="fas fa-calendar footer-icon"></i>${this.formatDate(date)}</div>
          </div>
        </div>
      </div>
    `;
  }

  updateStats(data) {
    const totalCalls = (data.intraday?.length || 0) + (data.shortterm?.length || 0) + (data.longterm?.length || 0);
    
    let activeCalls = 0;
    let positivePnls = 0, totalPnls = 0;
    const uniqueTraders = new Set();

    [data.intraday, data.shortterm, data.longterm].forEach(tabData => {
      if (tabData) {
        activeCalls += tabData.filter(stock => {
          const row = Array.isArray(stock) ? stock : Object.values(stock);
          return (row[6] || '').toString().toLowerCase().includes('active');
        }).length;
        
        tabData.forEach(stock => {
          const row = Array.isArray(stock) ? stock : Object.values(stock);
          const pnl = parseFloat(row[10]);
          const trader = row[7];
          
          if (!isNaN(pnl)) {
            totalPnls++;
            if (pnl > 0) positivePnls++;
          }
          if (trader) uniqueTraders.add(trader.toString());
        });
      }
    });

    const winRate = totalPnls > 0 ? Math.round((positivePnls / totalPnls) * 100) : 0;

    document.getElementById('totalStocks').textContent = totalCalls;
    document.getElementById('activeStocks').textContent = activeCalls;
    document.getElementById('winRate').textContent = `${winRate}%`;
    document.getElementById('traders').textContent = uniqueTraders.size || 0;
  }

  getEmptyState(tab) {
    const icons = { intraday: 'fa-bolt', shortterm: 'fa-chart-line', longterm: 'fa-calendar-alt' };
    const names = { intraday: 'Intraday', shortterm: 'Short Term', longterm: 'Long Term' };
    
    return `
      <div class="empty-state">
        <i class="fas ${icons[tab]}"></i>
        <h3>No ${names[tab]} Calls</h3>
        <p>Expert recommendations will appear here</p>
      </div>
    `;
  }

  showErrorState() {
    ['intraday', 'shortterm', 'longterm'].forEach(tab => {
      document.getElementById(`${tab}Stocks`).innerHTML = `
        <div class="empty-state">
          <i class="fas fa-wifi-slash"></i>
          <h3>No Connection</h3>
          <p>Press Ctrl+R to retry</p>
        </div>
      `;
    });
  }

  formatPrice(value) {
    return parseFloat(value || 0).toLocaleString('en-IN');
  }

  formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { 
        day: 'numeric', month: 'short', year: 'numeric' 
      });
    } catch {
      return 'N/A';
    }
  }

  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text?.toString().replace(/[&<>"']/g, m => map[m]) || '';
  }

  startAutoRefresh() {
    setInterval(() => {
      console.log('🔄 Auto-refresh v3.5...');
      this.loadData();
    }, 300000); // 5 minutes
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Market360V35());
} else {
  new Market360V35();
}

// Global error handling
window.onerror = (msg, url, line, col, error) => {
  console.error('Global error:', { msg, url, line, col, error });
  return false;
};
</script>
