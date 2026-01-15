<script>
class Market360V3 {
  constructor() {
    this.webAppUrl = 'https://script.google.com/macros/s/AKfycbyqHc-e2FFfOeOgzgpnZoLQmal7DKVD8kMC_eZw8EFO3w_8ATE7QPSj1caWkZx0qnNI/exec';
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadData();
    this.startAutoRefresh();
  }

  bindEvents() {
    // Tab switching with smooth transitions
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.getElementById(e.currentTarget.dataset.tab).classList.add('active');
      });
    });

    // Keyboard shortcuts (Ctrl+R refresh)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        this.loadData();
      }
    });
  }

  async loadData() {
    try {
      console.log('🔄 Loading Market360 v3.0 data...');
      const response = await fetch(`${this.webAppUrl}?action=getAllStockData`);
      const data = await response.json();
      
      console.log('✅ Data loaded successfully:', {
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
      console.error('❌ Data load failed:', error);
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
    
    // Staggered animation for cards
    container.innerHTML = stocks.map((stock, index) => 
      this.createStockCard(stock, index)
    ).join('');
  }

  createStockCard(stock, index) {
    // Handle both array and object data formats
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
          <div class="status-badge">${statusText}</div>
        </div>
        
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
        
        <div class="stock-footer">
          <div>
            <i class="fas fa-user footer-icon"></i>
            ${this.escapeHtml(trader || 'Expert')}
          </div>
          <div>
            <i class="fas fa-calendar footer-icon"></i>
            ${this.formatDate(date)}
          </div>
        </div>
      </div>
    `;
  }

  updateStats(data) {
    // Calculate total calls
    const totalCalls = (data.intraday?.length || 0) + 
                      (data.shortterm?.length || 0) + 
                      (data.longterm?.length || 0);

    // Calculate active calls
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

    // Calculate win rate from P&L data
    let positivePnls = 0;
    let totalPnls = 0;
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

    const winRate = totalPnls > 0 ? ((positivePnls / totalPnls) * 100).toFixed(0) : 0;

    // Calculate unique traders
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

    // Update DOM elements
    document.getElementById('totalStocks').textContent = totalCalls;
    document.getElementById('activeStocks').textContent = activeCalls;
    document.getElementById('winRate').textContent = `${winRate}%`;
    document.getElementById('traders').textContent = uniqueTraders.size || 0;
  }

  getEmptyState(tab) {
    const tabNames = {
      intraday: 'Intraday',
      shortterm: 'Short Term',
      longterm: 'Long Term'
    };
    
    return `
      <div class="empty-state">
        <i class="fas fa-chart-line"></i>
        <h3>No ${tabNames[tab]} Calls</h3>
        <p>Expert recommendations will appear here soon</p>
      </div>
    `;
  }

  showErrorState() {
    ['intraday', 'shortterm', 'longterm'].forEach(tab => {
      const container = document.getElementById(`${tab}Stocks`);
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Data Loading Error</h3>
          <p>Press Ctrl+R to refresh data</p>
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
      if (isNaN(date.getTime())) return dateStr.toString().slice(0, 10);
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
    // Auto-refresh every 5 minutes (300,000 ms)
    setInterval(() => {
      console.log('🔄 Auto-refreshing Market360 v3.0 data...');
      this.loadData();
    }, 300000);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new Market360V3();
});

// Global error handling
window.onerror = function(msg, url, lineNo, columnNo, error) {
  console.error('Global error:', { msg, url, lineNo, columnNo, error });
  return false;
};

// Handle online/offline status
window.addEventListener('online', () => {
  console.log('🌐 Connection restored - refreshing data');
  setTimeout(() => new Market360V3().loadData(), 1000);
});
</script>
