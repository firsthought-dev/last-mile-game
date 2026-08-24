// Upgrade Shop & Garage Management UI
import { CONFIG } from '../config.js';
import { saveManager } from '../storage.js';
import { sound } from '../audio.js';

export class ShopUI {
  constructor(onClose) {
    this.onClose = onClose;
  }

  render(container) {
    const s = saveManager.state;
    container.innerHTML = `
      <div class="modal-backdrop">
        <div class="shop-modal glass-card">
          <div class="shop-header">
            <h2>🛠️ GUPTA CYCLE & AUTO GARAGE</h2>
            <div class="money-badge">💰 ₹${s.money}</div>
            <button id="close-shop-btn" class="btn-close">✕</button>
          </div>

          <div class="shop-tabs">
            <button class="tab-btn active" data-tab="upgrades">Upgrades & Gear</button>
            <button class="tab-btn" data-tab="vehicles">Vehicles Showroom</button>
          </div>

          <div id="tab-upgrades" class="shop-tab-content active">
            <div class="upgrades-grid">
              ${Object.values(CONFIG.UPGRADES).map(upg => {
                const isConsumable = upg.consumable;
                const currentLvl = s.upgrades[upg.id] || 0;
                const cost = isConsumable ? upg.cost : upg.cost * (currentLvl + 1);
                const isMaxed = !isConsumable && currentLvl >= upg.maxLevel;
                const canAfford = s.money >= cost && !isMaxed;

                return `
                  <div class="shop-item-card">
                    <div class="item-title">${upg.name}</div>
                    <div class="item-desc">${upg.desc}</div>
                    <div class="item-status">
                      ${isConsumable ? `Current Stock: <strong>${currentLvl}</strong>` : `Level: <strong>${currentLvl} / ${upg.maxLevel}</strong>`}
                    </div>
                    <button class="btn-buy ${canAfford ? 'btn-primary' : 'btn-disabled'}" 
                            data-type="upgrade" 
                            data-id="${upg.id}" 
                            ${canAfford ? '' : 'disabled'}>
                      ${isMaxed ? 'MAX LEVEL' : `BUY ₹${cost}`}
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div id="tab-vehicles" class="shop-tab-content">
            <div class="vehicles-grid">
              ${Object.values(CONFIG.VEHICLES).map(veh => {
                const isUnlocked = s.unlockedVehicles.includes(veh.id);
                const isSelected = s.selectedVehicle === veh.id;
                const canAfford = s.money >= veh.cost && !isUnlocked;

                return `
                  <div class="shop-item-card ${isSelected ? 'selected-vehicle' : ''}">
                    <div class="vehicle-icon">${veh.icon}</div>
                    <div class="item-title">${veh.name}</div>
                    <div class="item-desc">${veh.desc}</div>
                    <div class="stats-bar">
                      <span>Speed: ${Math.round(veh.maxSpeed * 10)}</span> | 
                      <span>Capacity: ${veh.capacity}</span>
                    </div>
                    ${isSelected ? `
                      <button class="btn-buy btn-success" disabled>ACTIVE VEHICLE</button>
                    ` : isUnlocked ? `
                      <button class="btn-buy btn-accent" data-type="select-vehicle" data-id="${veh.id}">SELECT</button>
                    ` : `
                      <button class="btn-buy ${canAfford ? 'btn-primary' : 'btn-disabled'}" 
                              data-type="buy-vehicle" 
                              data-id="${veh.id}" 
                              ${canAfford ? '' : 'disabled'}>
                        UNLOCK ₹${veh.cost}
                      </button>
                    `}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents(container);
  }

  attachEvents(container) {
    // Close button
    container.querySelector('#close-shop-btn').onclick = () => {
      sound.playBell();
      this.onClose();
    };

    // Tab switching
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        container.querySelectorAll('.shop-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        container.querySelector(`#tab-${btn.dataset.tab}`).classList.add('active');
        sound.playBell();
      };
    });

    // Buy actions
    container.querySelectorAll('.btn-buy').forEach(btn => {
      btn.onclick = () => {
        const type = btn.dataset.type;
        const id = btn.dataset.id;
        if (type === 'upgrade') {
          if (saveManager.purchaseUpgrade(id)) {
            sound.playCoin();
            this.render(container);
          }
        } else if (type === 'buy-vehicle') {
          if (saveManager.purchaseVehicle(id)) {
            sound.playVictory();
            this.render(container);
          }
        } else if (type === 'select-vehicle') {
          if (saveManager.selectVehicle(id)) {
            sound.playBell();
            this.render(container);
          }
        }
      };
    });
  }
}
