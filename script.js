<script>
class Market360V215 {
  constructor() {
    this.webAppUrl = 'https://script.google.com/macros/s/AKfycbyqHc-e2FFfOeOgzgpnZoLQmal7DKVD8kMC_eZw8EFO3w_8ATE7QPSj1caWkZx0qnNI/exec';
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadData();
    this.startAutoRefresh();
  }

  bindEvents() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.getElementById(e.currentTarget.dataset.tab).classList.add('active');
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        this.loadData();
      }
    });
  }

  async loadData() {
    try {
      console.log('🔄 Loading Market360 data...');
      const response = await fetch(`${this.webAppUrl}?action=getAllStockData`);
      const data = await response.json();
      
      console.log('✅ Data loaded:', data);
      
      if (data.success) {
        this.renderAllTabs(data);
        this.updateStats(data);
      } else {
        this.showErrorState();
      }
    } catch (error) {
      console.error('❌ Load error:', error);
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
    // Handle both array and object formats
    const rowData = Array.isArray(stock) ? stock : Object.values(stock);
    const [
      date, symbol, company, entry, target, stopLoss, status, trader, 
      sector, currentPrice, profitLossRaw, remarks
    ] = rowData;

    const profitLoss = parseFloat(profitLossRaw) || 0;
    const isPositive = profitLoss >= 0;
    const pnlClass = isPositive ? 'pnl-positive' : 'pnl-negative';
    const statusText = status || 'ACTIVE';

    return `
      <div class="stock-card" style="animation-delay: ${index * 0.1}s">
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
            <div class="price-value">${isPositive ? '+' : ''}${profitLoss.toFixed(2)}%</div>
          </div>
        </div>
        
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
    `;
  }

  updateStats(data) {
    const totalCalls = (data.intraday?.length || 0) + 
                      (data.shortterm?.length || 0) + 
                      (data.longterm?.length || 0);
    
    const activeCalls = (data.intraday?.filter(s => 
      (s.Status || '').toString().toLowerCase().includes('active')
    ).length || 0);

    const allPnls = [];
    [data.intraday, data.shortterm, data.longterm].forEach(tab => {
      if (tab) {
        tab.forEach(stock => {
          const row = Array.isArray(stock) ? stock : Object.values(stock);
          const pnl = parseFloat(row[10]);
          if (!isNaN(pnl)) allPnls.push(pnl);
        });
      }
    });

    const winRate = allPnls.length ? 
      (allPnls.filter(p => p > 0).length / allPnls.length * 100).toFixed(0) : 0;
    
    const uniqueTraders = new Set();
    [data.intraday, data.shortterm, data.longterm].forEach(tab => {
      if (tab) {
        tab.forEach(stock => {
          const row = Array.isArray(stock) ? stock : Object.values(stock);
          uniqueTraders.add(row[7] || 'Unknown');
        });
      }
    });

    // Update DOM
    document.getElementById('totalStocks').textContent = totalCalls;
    document.getElementById('activeStocks').textContent = activeCalls;
    document.getElementById('winRate').textContent = `${winRate}%`;
    document.getElementById('traders').textContent = uniqueTraders.size;
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
        <p>Expert recommendations will appear here</p>
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
          <p>Press Ctrl+R to refresh or contact support</p>
        </div>
      `;
    });
  }

  formatPrice(value) {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('en-IN', { 
      maximumFractionDigits: 0 
    });
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
    // Auto-refresh every 5 minutes
    setInterval(() => {
      console.log('🔄 Auto-refreshing Market360 data...');
      this.loadData();
    }, 300000); // 5 minutes
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new Market360V215();
});

// Global error handler
window.onerror = function(msg, url, lineNo, columnNo, error) {
  console.error('Global error caught:', { msg, url, lineNo, columnNo, error });
  return false;
};

// Handle network errors
window.addEventListener('online', () => {
  console.log('🌐 Back online - refreshing data');
  new Market360V215().loadData();
});
</script>
