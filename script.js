<script>
class Market360V31 {
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
    this.startAutoRefresh();
  }

  bindEvents() {
    // Bottom navigation tabs
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

    // Bouncy collapsible cards - tap anywhere to expand/collapse
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
    });
  }

  initPWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('✅ SW registered'))
        .catch(err => console.log('❌ SW failed'));
    }

    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      document.getElementById('installBtn').classList.add('show');
    });

    // Install button handler
    document.getElementById('installBtn').addEventListener('click', async () => {
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          document.getElementById('installBtn').classList.remove('show');
          console.log('🎉 App installed!');
        }
        this.deferredPrompt = null;
      }
    });

    // Hide install button if already PWA
    window.addEventListener('appinstalled', () => {
      document.getElementById('installBtn').classList.remove('show');
    });

    // Detect standalone mode
    if (this.isMobile && window.matchMedia('(display-mode: standalone)').matches) {
      document.getElementById('installBtn').style.display = 'none';
    }
  }

  async loadData() {
    try {
      console.log('🔄 Loading Market360 v3.1 data...');
      const response = await fetch(`${this.webAppUrl}?action=getAllStockData`);
      const data = await response.json();
      
      console.log('✅ Data loaded:', {
        intraday: data.intraday?.length || 0,
        shortterm: data.shortterm?.length || 0,
        longterm: data.longterm?.length || 0
      });
      
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
    
    // Staggered entrance animation
    container.innerHTML = stocks.map((stock, index) => 
      this.createStockCard(stock, index)
    ).join('');
  }

  createStockCard(stock, index) {
    const rowData = Array.isArray(stock) ? stock : Object.values(stock);
    const [
      date, symbol, company, entry, target, stopLoss, status, trader, 
      sector, currentPrice, profitLossRaw
    ] = rowData;

    const profitLoss = parseFloat(profitLossRaw) || 0;
    const isPositive = profitLoss >= 0;
    const pnlClass = isPositive ? 'pnl-positive' : 'pnl-negative';
    const statusText = (status || 'ACTIVE').toString().toUpperCase();

    return `
      <div class="stock-card" style="animation-delay: ${index * 0.05}s">
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
            <div>
              <i class="fas fa-user footer-icon"></i>
              ${this.escapeHtml(trader || 'Expert Trader')}
            </div>
            <div>
              <i class="fas fa-calendar footer-icon"></i>
              ${this.formatDate(date)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  updateStats(data) {
    const totalCalls = (data.intraday?.length || 0) + 
                      (data.shortterm?.length || 0) + 
                      (data.longterm?.length || 0);

    let activeCalls = 0;
    [data.intraday, data.shortterm, data.longterm].forEach(tabData => {
      if (tabData) {
        activeCalls += tabData.filter(stock => {
          const row = Array.isArray(stock) ? stock : Object.values(stock);
          const status = (row[6] || '').toString().toLowerCase();
          return status.includes('active') || status.includes('live');
        }).length;
      }
    });

    let positivePnls = 0, totalPnls = 0;
    [data.intraday, data.shortterm, data.longterm].forEach(tabData => {
      if (tabData) {
        tabData.forEach(stock => {
          const row = Array.isArray(stock) ? stock : Object.values(stock);
          const pnl = parseFloat(row[10]);
          if (!isNaN(pnl)) {
            totalPnls++;
            if (pnl > 0) positivePnls++;
          }
        });
      }
    });

    const winRate = totalPnls > 0 ? Math.round((positivePnls / totalPnls) * 100) : 0;
    const uniqueTraders = new Set();

    [data.intraday, data.shortterm, data.longterm].forEach(tabData => {
      if (tabData) {
        tabData.forEach(stock => {
          const row = Array.isArray(stock) ? stock : Object.values(stock);
          const trader = row[7];
          if (trader) uniqueTraders.add(trader.toString());
        });
      }
    });

    document.getElementById('totalStocks').textContent = totalCalls;
    document.getElementById('activeStocks').textContent = activeCalls;
    document.getElementById('winRate').textContent = `${winRate}%`;
    document.getElementById('traders').textContent = uniqueTraders.size || 0;
  }

  getEmptyState(tab) {
    const tabNames = { intraday: 'Intraday', shortterm: 'Short Term', longterm: 'Long Term' };
    return `
      <div class="empty-state">
        <i class="fas fa-chart-line"></i>
        <h3>No ${tabNames[tab]} Calls</h3>
        <p>Expert recommendations appear here</p>
      </div>
    `;
  }

  showErrorState() {
    ['intraday', 'shortterm', 'longterm'].forEach(tab => {
      const container = document.getElementById(`${tab}Stocks`);
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Connection Error</h3>
          <p>Press Ctrl+R to retry</p>
        </div>
      `;
    });
  }

  formatPrice(value) {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr.toString().slice(0, 10);
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
  }

  startAutoRefresh() {
    setInterval(() => {
      console.log('🔄 Auto-refreshing...');
      this.loadData();
    }, 300000); // 5 minutes
  }
}

// Initialize when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Market360V31());
} else {
  new Market360V31();
}

// Global error handler
window.onerror = (msg, url, lineNo, columnNo, error) => {
  console.error('Global error:', { msg, url, lineNo, columnNo, error });
  return false;
};

// Network status
window.addEventListener('online', () => {
  console.log('🌐 Online - refreshing...');
  setTimeout(() => new Market360V31().loadData(), 1000);
});
</script>
