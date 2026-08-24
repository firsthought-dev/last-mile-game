// Storage and Game State Management
import { CONFIG } from './config.js';

const STORAGE_KEY = 'LAST_MILE_GAME_SAVE_V1';

class SaveManager {
  constructor() {
    this.state = this.loadDefaultState();
    this.load();
  }

  loadDefaultState() {
    return {
      money: 150, // Starting Rupees
      subscribers: 30,
      rating: 4.6,
      day: 1,
      selectedCity: 'mumbai',
      selectedVehicle: 'cycle',
      unlockedVehicles: ['cycle'],
      upgrades: {
        basket: 0,
        tires: 0,
        headlight: 0,
        bell: 0,
        treats: 3
      },
      unlockedTracks: ['newspaper'],
      trackStats: {
        newspaper: { completedRuns: 0, highEarning: 0, bestRating: 0 },
        milk: { completedRuns: 0, highEarning: 0, bestRating: 0 },
        ecommerce: { completedRuns: 0, highEarning: 0, bestRating: 0 },
        freeroam: { completedRuns: 0, highEarning: 0, bestRating: 0 }
      },
      customerRelations: {
        sharma: 85,
        vijay: 70,
        kapoor: 60,
        verma: 90
      }
    };
  }

  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.state = { ...this.loadDefaultState(), ...parsed };
      }
    } catch (e) {
      console.warn('LocalStorage load failed, using defaults:', e);
      this.state = this.loadDefaultState();
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  addMoney(amount) {
    this.state.money = Math.max(0, this.state.money + amount);
    this.save();
  }

  purchaseUpgrade(upgradeId) {
    const upg = CONFIG.UPGRADES[upgradeId.toUpperCase()];
    if (!upg) return false;

    if (upg.consumable) {
      if (this.state.money >= upg.cost) {
        this.state.money -= upg.cost;
        this.state.upgrades[upgradeId] = (this.state.upgrades[upgradeId] || 0) + (upg.quantity || 1);
        this.save();
        return true;
      }
      return false;
    }

    const currentLvl = this.state.upgrades[upgradeId] || 0;
    if (currentLvl >= upg.maxLevel) return false;

    const cost = upg.cost * (currentLvl + 1);
    if (this.state.money >= cost) {
      this.state.money -= cost;
      this.state.upgrades[upgradeId] = currentLvl + 1;
      this.save();
      return true;
    }
    return false;
  }

  purchaseVehicle(vehicleId) {
    const veh = CONFIG.VEHICLES[vehicleId.toUpperCase()];
    if (!veh || this.state.unlockedVehicles.includes(vehicleId)) return false;

    if (this.state.money >= veh.cost) {
      this.state.money -= veh.cost;
      this.state.unlockedVehicles.push(vehicleId);
      this.state.selectedVehicle = vehicleId;
      this.save();
      return true;
    }
    return false;
  }

  selectVehicle(vehicleId) {
    if (this.state.unlockedVehicles.includes(vehicleId)) {
      this.state.selectedVehicle = vehicleId;
      this.save();
      return true;
    }
    return false;
  }

  useTreat() {
    if ((this.state.upgrades.treats || 0) > 0) {
      this.state.upgrades.treats--;
      this.save();
      return true;
    }
    return false;
  }

  completeRun(trackId, earnings, deliveriesMade, totalTargets, perfectHits, spills, dogChases) {
    this.state.money += earnings;
    this.state.day++;
    
    // Calculate rating
    const accuracy = totalTargets > 0 ? (deliveriesMade / totalTargets) : 0;
    const runRating = Math.min(5, Math.max(1, (accuracy * 4.5) + (perfectHits * 0.2) - (spills * 0.4)));
    this.state.rating = Number(((this.state.rating * 0.7) + (runRating * 0.3)).toFixed(1));

    // Subscribers retention
    if (accuracy >= 0.8) {
      this.state.subscribers += Math.floor(Math.random() * 3) + 1;
    } else if (accuracy < 0.5) {
      this.state.subscribers = Math.max(10, this.state.subscribers - Math.floor(Math.random() * 2) - 1);
    }

    // Unlock next track if requirements met
    if (trackId === 'newspaper' && !this.state.unlockedTracks.includes('milk')) {
      this.state.unlockedTracks.push('milk');
    } else if (trackId === 'milk' && !this.state.unlockedTracks.includes('ecommerce')) {
      this.state.unlockedTracks.push('ecommerce');
    } else if (trackId === 'ecommerce' && !this.state.unlockedTracks.includes('freeroam')) {
      this.state.unlockedTracks.push('freeroam');
    }

    // Update track stats
    const stats = this.state.trackStats[trackId] || { completedRuns: 0, highEarning: 0, bestRating: 0 };
    stats.completedRuns++;
    stats.highEarning = Math.max(stats.highEarning, earnings);
    stats.bestRating = Math.max(stats.bestRating, runRating);
    this.state.trackStats[trackId] = stats;

    this.save();
    return {
      earnings,
      runRating,
      newSubscribers: this.state.subscribers,
      day: this.state.day
    };
  }

  resetProgress() {
    this.state = this.loadDefaultState();
    this.save();
  }
}

export const saveManager = new SaveManager();
