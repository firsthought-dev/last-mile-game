// City-Specific Map Generator: Mumbai, New Delhi, Kolkata, Bengaluru, Pune
import { CONFIG } from './config.js';

export class GameMap {
  constructor(cityId = 'mumbai', worldWidth = CONFIG.WORLD_WIDTH, worldHeight = CONFIG.WORLD_HEIGHT) {
    this.cityId = cityId;
    this.cityConfig = CONFIG.CITIES[cityId] || CONFIG.CITIES.mumbai;
    this.width = worldWidth;
    this.height = worldHeight;

    this.roads = [];
    this.gulleys = [];
    this.houses = [];
    this.decorations = [];
    this.streetLamps = [];
    this.obstacles = [];
    this.cows = [];
    this.floodZones = [];
    this.mudPatches = [];
    this.wirePoles = [];
    this.tramTracks = [];
    this.roundabouts = [];

    this.generateMap();
  }

  generateMap(cityId = this.cityId) {
    this.cityId = cityId;
    this.cityConfig = CONFIG.CITIES[cityId] || CONFIG.CITIES.mumbai;

    this.roads = [];
    this.gulleys = [];
    this.houses = [];
    this.decorations = [];
    this.streetLamps = [];
    this.obstacles = [];
    this.cows = [];
    this.floodZones = [];
    this.mudPatches = [];
    this.wirePoles = [];
    this.tramTracks = [];
    this.roundabouts = [];

    // 1. CITY ROADS & INFRASTRUCTURE
    if (this.cityId === 'delhi') {
      // Delhi: Broad Avenues + Roundabouts + Chandni Chowk Gulleys
      this.roads.push({ x: 0, y: 1100, w: this.width, h: 180, type: 'highway', name: 'Rajpath / Janpath Express Marg', lanes: 6 });
      this.roads.push({ x: 0, y: 440, w: this.width, h: 130, type: 'bazaar', name: 'Chandni Chowk Main Road', lanes: 3 });
      this.roads.push({ x: 0, y: 1800, w: this.width, h: 120, type: 'sub', name: 'Ring Road South Extension', lanes: 3 });

      this.roads.push({ x: 600, y: 0, w: 120, h: this.height, type: 'cross', name: 'Barakhamba Road' });
      this.roads.push({ x: 1400, y: 0, w: 150, h: this.height, type: 'highway', name: 'Connaught Outer Circle' });
      this.roads.push({ x: 2200, y: 0, w: 120, h: this.height, type: 'cross', name: 'Lajpat Nagar Link' });

      // Lutyens Roundabouts
      this.roundabouts.push({ x: 1475, y: 1190, radius: 85, name: 'India Gate C-Hexagon' });
      this.roundabouts.push({ x: 660, y: 505, radius: 65, name: 'Mandi House Circle' });

    } else if (this.cityId === 'kolkata') {
      // Kolkata: Tram Tracks + College Street + North Kolkata Heritage Lanes
      this.roads.push({ x: 0, y: 1100, w: this.width, h: 160, type: 'highway', name: 'Chowringhee Road (J.L. Nehru)', lanes: 4 });
      this.roads.push({ x: 0, y: 440, w: this.width, h: 120, type: 'bazaar', name: 'College Street Boipara', lanes: 2 });
      this.roads.push({ x: 0, y: 1800, w: this.width, h: 110, type: 'sub', name: 'Shyambazar Five-Point Link', lanes: 2 });

      this.roads.push({ x: 550, y: 0, w: 110, h: this.height, type: 'cross', name: 'Rashbehari Avenue' });
      this.roads.push({ x: 1350, y: 0, w: 140, h: this.height, type: 'highway', name: 'Strand Road (Ganga Riverfront)' });
      this.roads.push({ x: 2150, y: 0, w: 110, h: this.height, type: 'cross', name: 'Gariahat Road' });

      // Tram Tracks down central Chowringhee & College Street
      this.tramTracks.push({ x: 0, y: 1175, w: this.width, h: 12 });
      this.tramTracks.push({ x: 0, y: 495, w: this.width, h: 12 });

    } else if (this.cityId === 'bangalore') {
      // Bengaluru: Tech Park Links + Lush Gulmohar Boulevards + Notorious Silk Board Style Traffic
      this.roads.push({ x: 0, y: 1100, w: this.width, h: 170, type: 'highway', name: 'Outer Ring Road (Silk Board - Marathahalli)', lanes: 4 });
      this.roads.push({ x: 0, y: 440, w: this.width, h: 120, type: 'bazaar', name: '100 Feet Road Indiranagar', lanes: 2 });
      this.roads.push({ x: 0, y: 1800, w: this.width, h: 110, type: 'sub', name: 'Malleshwaram 8th Cross', lanes: 2 });

      this.roads.push({ x: 550, y: 0, w: 110, h: this.height, type: 'cross', name: 'Koramangala 80 Feet Road' });
      this.roads.push({ x: 1350, y: 0, w: 140, h: this.height, type: 'highway', name: 'MG Road Boulevard' });
      this.roads.push({ x: 2150, y: 0, w: 110, h: this.height, type: 'cross', name: 'Whitefield Main Road' });

    } else if (this.cityId === 'pune') {
      // Pune: Historic Peths + Deccan + Swarms of Two-Wheelers
      this.roads.push({ x: 0, y: 1100, w: this.width, h: 150, type: 'highway', name: 'F.C. Road (Fergusson College Road)', lanes: 3 });
      this.roads.push({ x: 0, y: 440, w: this.width, h: 120, type: 'bazaar', name: 'Laxmi Road (Market Hub)', lanes: 2 });
      this.roads.push({ x: 0, y: 1800, w: this.width, h: 110, type: 'sub', name: 'Karve Road Deccan', lanes: 2 });

      this.roads.push({ x: 550, y: 0, w: 110, h: this.height, type: 'cross', name: 'J.M. Road' });
      this.roads.push({ x: 1350, y: 0, w: 140, h: this.height, type: 'highway', name: 'Tilak Road Link' });
      this.roads.push({ x: 2150, y: 0, w: 110, h: this.height, type: 'cross', name: 'Sinhagad Road' });

    } else {
      // Mumbai Default (Marine Drive, Western Express Highway, Chawls)
      this.roads.push({ x: 0, y: 1100, w: this.width, h: 160, type: 'highway', name: 'Western Express Highway (WEH)', lanes: 4 });
      this.roads.push({ x: 0, y: 440, w: this.width, h: 120, type: 'bazaar', name: 'Dadar Market Road', lanes: 2 });
      this.roads.push({ x: 0, y: 1800, w: this.width, h: 110, type: 'sub', name: 'Bandra Hill Road Promenade', lanes: 2 });

      this.roads.push({ x: 550, y: 0, w: 110, h: this.height, type: 'cross', name: 'S.V. Road' });
      this.roads.push({ x: 1350, y: 0, w: 140, h: this.height, type: 'highway', name: 'Marine Drive Coastal Link' });
      this.roads.push({ x: 2150, y: 0, w: 110, h: this.height, type: 'cross', name: 'Linking Road' });
    }

    // 2. TIGHT NARROW GULLEYS & GALIS
    const gulleyNames = this.cityId === 'pune' 
      ? ['Sadashiv Peth Gali', 'Tulshibaug Gulley', 'Kasba Peth', 'Raviwar Peth Lane', 'Shaniwar Wada Alley']
      : this.cityId === 'kolkata'
      ? ['Kumartuli Clay Lane', 'College Street Boipara', 'Shyambazar Gali', 'Sovabazar Rajbari Lane', 'Howrah Ghat Alley']
      : this.cityId === 'delhi'
      ? ['Paranthe Wali Gali', 'Ballimaran Mirza Ghalib Lane', 'Dariba Kalan (Jewel Gulley)', 'Kinari Bazaar', 'Chawri Bazaar Gali']
      : this.cityId === 'bangalore'
      ? ['Avenue Road Gulley', 'Chickpet Silk Lane', 'Malleshwaram Flower Gali', 'Gandhi Bazaar Lane', 'Commercial Street Alley']
      : ['Chor Bazaar Gulley', 'Zaveri Bazaar Gali', 'Dharavi Pottery Lane', 'Colaba Causeway Gali', 'Crawford Lane'];

    this.gulleys.push(
      { x: 2850, y: 0, w: 55, h: this.height, name: gulleyNames[0] },
      { x: 0, y: 800, w: 550, h: 50, name: gulleyNames[1] },
      { x: 660, y: 780, w: 690, h: 52, name: gulleyNames[2] },
      { x: 1490, y: 780, w: 660, h: 48, name: gulleyNames[3] },
      { x: 2260, y: 780, w: 590, h: 50, name: gulleyNames[4] },
      { x: 0, y: 1480, w: 550, h: 50, name: 'Old Town Gulley 1' },
      { x: 660, y: 1480, w: 690, h: 52, name: 'Old Town Gulley 2' },
      { x: 1490, y: 1480, w: 660, h: 48, name: 'Bazaar Back Alley' }
    );

    // 3. FLOODWATER ZONES (Mumbai has most severe floods, Kolkata has misty waterlogged ghats)
    if (this.cityId === 'mumbai') {
      this.floodZones.push(
        { x: 1100, y: 1100, w: 450, h: 160, name: 'Hindmata Flood Zone' },
        { x: 300, y: 440, w: 340, h: 120, name: 'Milan Subway Waterlogging' },
        { x: 1900, y: 1800, w: 380, h: 110, name: 'Gandhi Market Flood' }
      );
    } else {
      this.floodZones.push(
        { x: 1150, y: 1100, w: 320, h: 150, name: 'Monsoon Waterlogging' },
        { x: 400, y: 440, w: 260, h: 120, name: 'Street Puddle Zone' }
      );
    }

    // Mud Patches
    this.mudPatches.push(
      { x: 750, y: 470, rx: 45, ry: 20 },
      { x: 1600, y: 1150, rx: 60, ry: 25 },
      { x: 2400, y: 1830, rx: 50, ry: 22 }
    );

    // 4. HOUSES & ARCHITECTURE
    const blockBounds = [
      { x1: 60, y1: 60, x2: 480, y2: 380 },
      { x1: 700, y1: 60, x2: 1280, y2: 380 },
      { x1: 1520, y1: 60, x2: 2080, y2: 380 },
      { x1: 2300, y1: 60, x2: 2780, y2: 380 },

      { x1: 60, y1: 580, x2: 480, y2: 740 },
      { x1: 700, y1: 580, x2: 1280, y2: 740 },
      { x1: 1520, y1: 580, x2: 2080, y2: 740 },
      { x1: 2300, y1: 580, x2: 2780, y2: 740 },

      { x1: 60, y1: 880, x2: 480, y2: 1040 },
      { x1: 700, y1: 880, x2: 1280, y2: 1040 },
      { x1: 1520, y1: 880, x2: 2080, y2: 1040 },
      { x1: 2300, y1: 880, x2: 2780, y2: 1040 },

      { x1: 60, y1: 1300, x2: 480, y2: 1420 },
      { x1: 700, y1: 1300, x2: 1280, y2: 1420 },
      { x1: 1520, y1: 1300, x2: 2080, y2: 1420 },
      { x1: 2300, y1: 1300, x2: 2780, y2: 1420 },

      { x1: 60, y1: 1560, x2: 480, y2: 1740 },
      { x1: 700, y1: 1560, x2: 1280, y2: 1740 },
      { x1: 1520, y1: 1560, x2: 2080, y2: 1740 },
      { x1: 2300, y1: 1560, x2: 2780, y2: 1740 },

      { x1: 60, y1: 1940, x2: 480, y2: 2500 },
      { x1: 700, y1: 1940, x2: 1280, y2: 2500 },
      { x1: 1520, y1: 1940, x2: 2080, y2: 2500 },
      { x1: 2300, y1: 1940, x2: 2780, y2: 2500 }
    ];

    const customerNames = this.cityConfig.subscriberNames;
    let houseId = 1;

    blockBounds.forEach((b) => {
      const houseWidth = 120;
      const houseHeight = 95;
      for (let x = b.x1 + 15; x <= b.x2 - houseWidth; x += houseWidth + 35) {
        for (let y = b.y1 + 15; y <= b.y2 - houseHeight; y += houseHeight + 35) {
          const wallColor = CONFIG.COLORS.BUILDING_WALLS[houseId % CONFIG.COLORS.BUILDING_WALLS.length];
          const roofColor = CONFIG.COLORS.ROOF_COLORS[houseId % CONFIG.COLORS.ROOF_COLORS.length];
          const name = customerNames[(houseId - 1) % customerNames.length];
          
          let porchX = x + houseWidth / 2;
          let porchY = y + houseHeight + 16;
          let facing = 'south';

          if (y > 1200) {
            porchY = y - 16;
            facing = 'north';
          }

          this.houses.push({
            id: `house_${houseId}`,
            name: name,
            x: x,
            y: y,
            w: houseWidth,
            h: houseHeight,
            wallColor: wallColor,
            roofColor: roofColor,
            hasBalcony: houseId % 2 === 0,
            porch: {
              x: porchX,
              y: porchY,
              radius: 32,
              facing: facing
            },
            isSubscriber: true,
            deliveryState: 'pending'
          });

          houseId++;
        }
      }
    });

    // 5. CITY SHOPS & LOCAL LANDMARKS
    const shopList = this.cityConfig.shopNames;
    this.decorations.push(
      { type: 'chai_stall', x: 480, y: 410, name: shopList[0] || 'Chai Tapri' },
      { type: 'chai_stall', x: 1280, y: 1060, name: shopList[1] || 'Street Snacks' },
      { type: 'paan_shop', x: 620, y: 415, name: shopList[2] || 'Paan & Bidi' },
      { type: 'temple', x: 2280, y: 410, name: this.cityId === 'mumbai' ? 'Siddhi Vinayak Pandal 🚩' : 'City Mandir 🚩' }
    );

    // 6. OVERHEAD WIRE POLES
    for (let px = 80; px < this.width; px += 280) {
      this.wirePoles.push({ x: px, y: 430 });
      this.wirePoles.push({ x: px, y: 1090 });
      this.wirePoles.push({ x: px, y: 1790 });
    }

    // 7. RESTING COWS
    this.cows.push(
      { x: 740, y: 510, angle: 0.2, tailTimer: 0 },
      { x: 1850, y: 1180, angle: -0.5, tailTimer: 1.5 },
      { x: 1420, y: 1420, angle: 1.1, tailTimer: 2.3 },
      { x: 2850, y: 1200, angle: 1.57, tailTimer: 0.8 }
    );

    // 8. CITY TREES (Gulmohar in Bangalore/Mumbai, Banyan in Kolkata/Delhi)
    for (let i = 0; i < 55; i++) {
      const tx = 60 + Math.random() * (this.width - 120);
      const ty = 60 + Math.random() * (this.height - 120);
      const onRoad = this.roads.some(r => tx >= r.x && tx <= r.x + r.w && ty >= r.y && ty <= r.y + r.h);
      const onGulley = this.gulleys.some(g => tx >= g.x && tx <= g.x + g.w && ty >= g.y && ty <= g.y + g.h);
      if (!onRoad && !onGulley) {
        const isRedGulmohar = (this.cityId === 'bangalore' || this.cityId === 'pune') ? (i % 2 === 0) : (i % 3 === 0);
        this.decorations.push({
          type: 'tree',
          x: tx,
          y: ty,
          radius: 22 + Math.random() * 16,
          isGulmohar: isRedGulmohar,
          color: isRedGulmohar ? '#d90429' : (i % 2 === 0 ? '#2d6a4f' : '#40916c')
        });
      }
    }
  }

  render(ctx, camera, timeRatio = 0.2, isMonsoon = false) {
    // 1. Terrain Ground with City Flavor
    ctx.fillStyle = this.cityId === 'delhi' ? '#3d3a35' : (this.cityId === 'bangalore' ? '#1b4332' : (isMonsoon ? '#264653' : CONFIG.COLORS.GRASS));
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Mud Patches
    this.mudPatches.forEach(mp => {
      ctx.fillStyle = CONFIG.COLORS.MUD_PATCH;
      ctx.beginPath();
      ctx.ellipse(mp.x, mp.y, mp.rx, mp.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. Narrow Gulleys
    this.gulleys.forEach(g => {
      ctx.fillStyle = this.cityConfig.gulleyColor;
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.strokeStyle = '#332d28';
      ctx.lineWidth = 1;
      ctx.strokeRect(g.x, g.y, g.w, g.h);

      ctx.strokeStyle = '#5a5245';
      ctx.lineWidth = 1;
      if (g.w > g.h) {
        for (let gx = g.x; gx < g.x + g.w; gx += 20) {
          ctx.beginPath(); ctx.moveTo(gx, g.y); ctx.lineTo(gx, g.y + g.h); ctx.stroke();
        }
      } else {
        for (let gy = g.y; gy < g.y + g.h; gy += 20) {
          ctx.beginPath(); ctx.moveTo(g.x, gy); ctx.lineTo(g.x + g.w, gy); ctx.stroke();
        }
      }
    });

    // 4. Roads
    this.roads.forEach(road => {
      ctx.fillStyle = this.cityConfig.sidewalkColor;
      ctx.fillRect(road.x - 12, road.y - 12, road.w + 24, road.h + 24);

      ctx.fillStyle = road.type === 'highway' ? this.cityConfig.roadColor : '#383b47';
      ctx.fillRect(road.x, road.y, road.w, road.h);

      ctx.strokeStyle = CONFIG.COLORS.ROAD_MARKING;
      ctx.lineWidth = 3;
      ctx.setLineDash([22, 16]);

      if (road.w > road.h) {
        const laneH = road.h / (road.lanes || 2);
        for (let l = 1; l < (road.lanes || 2); l++) {
          ctx.beginPath();
          ctx.moveTo(road.x, road.y + l * laneH);
          ctx.lineTo(road.x + road.w, road.y + l * laneH);
          ctx.stroke();
        }
      } else {
        const laneW = road.w / (road.lanes || 2);
        for (let l = 1; l < (road.lanes || 2); l++) {
          ctx.beginPath();
          ctx.moveTo(road.x + l * laneW, road.y);
          ctx.lineTo(road.x + l * laneW, road.y + road.h);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    });

    // 5. Kolkata Tram Tracks
    this.tramTracks.forEach(tt => {
      ctx.fillStyle = '#495057';
      ctx.fillRect(tt.x, tt.y, tt.w, tt.h);
      ctx.strokeStyle = '#ced4da';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tt.x, tt.y + 3); ctx.lineTo(tt.x + tt.w, tt.y + 3);
      ctx.moveTo(tt.x, tt.y + 9); ctx.lineTo(tt.x + tt.w, tt.y + 9);
      ctx.stroke();
    });

    // 6. Delhi Roundabouts
    this.roundabouts.forEach(rb => {
      ctx.fillStyle = '#2d6a4f';
      ctx.beginPath(); ctx.arc(rb.x, rb.y, rb.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 8px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(rb.name, rb.x, rb.y + 3);
    });

    // 7. Floodwater Overlays
    this.floodZones.forEach(fz => {
      ctx.fillStyle = isMonsoon ? 'rgba(42, 111, 151, 0.75)' : 'rgba(70, 143, 175, 0.45)';
      ctx.fillRect(fz.x, fz.y, fz.w, fz.h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(fz.x, fz.y, fz.w, fz.h);
    });

    // 8. Houses & Targets
    this.houses.forEach(house => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.fillRect(house.x + 6, house.y + 8, house.w, house.h);

      ctx.fillStyle = house.wallColor;
      ctx.fillRect(house.x, house.y, house.w, house.h);

      ctx.fillStyle = house.roofColor;
      ctx.fillRect(house.x + 8, house.y + 8, house.w - 16, house.h * 0.55);

      if (house.hasBalcony) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(house.x + 18, house.y + house.h - 16, house.w - 36, 6);
      }

      ctx.fillStyle = '#1d3557';
      ctx.fillRect(house.x + 8, house.y + 10, house.w - 16, 16);
      ctx.fillStyle = '#f1faee';
      ctx.font = 'bold 8px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(house.name, house.x + house.w / 2, house.y + 22);

      const p = house.porch;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (house.deliveryState === 'pending') {
        ctx.strokeStyle = CONFIG.COLORS.ACCENT_SAFFRON;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255, 159, 28, 0.25)';
        ctx.beginPath(); ctx.arc(0, 0, p.radius * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff9f1c';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎯', 0, 4);
      } else if (house.deliveryState === 'delivered') {
        ctx.fillStyle = '#2ec4b6';
        ctx.beginPath(); ctx.arc(0, 0, p.radius * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓', 0, 5);
      }
      ctx.restore();
    });

    // 9. Street Vendors & Temples
    this.decorations.forEach(dec => {
      if (dec.type === 'chai_stall') {
        ctx.fillStyle = '#6f4e37';
        ctx.fillRect(dec.x - 30, dec.y - 25, 60, 50);
        ctx.fillStyle = '#ffb703';
        ctx.fillRect(dec.x - 28, dec.y - 23, 56, 12);
        ctx.fillStyle = '#023047';
        ctx.font = 'bold 7px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dec.name, dec.x, dec.y - 14);
      } else if (dec.type === 'paan_shop') {
        ctx.fillStyle = '#b7094c';
        ctx.fillRect(dec.x - 24, dec.y - 20, 48, 40);
        ctx.fillStyle = '#fca311';
        ctx.font = 'bold 6.5px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dec.name, dec.x, dec.y - 6);
      } else if (dec.type === 'temple') {
        ctx.fillStyle = '#ff9f1c';
        ctx.fillRect(dec.x - 25, dec.y - 25, 50, 50);
        ctx.fillStyle = '#d90429';
        ctx.font = 'bold 7px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dec.name, dec.x, dec.y - 12);
      } else if (dec.type === 'tree') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath(); ctx.arc(dec.x + 4, dec.y + 6, dec.radius, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = dec.color;
        ctx.beginPath(); ctx.arc(dec.x, dec.y, dec.radius, 0, Math.PI * 2); ctx.fill();
      }
    });

    // 10. Cows
    this.cows.forEach(cow => {
      ctx.save();
      ctx.translate(cow.x, cow.y);
      ctx.rotate(cow.angle);
      ctx.fillStyle = '#f8f9fa';
      ctx.beginPath(); ctx.ellipse(0, 0, 24, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ced4da'; ctx.stroke();
      ctx.fillStyle = '#e9ecef';
      ctx.beginPath(); ctx.arc(18, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // 11. Overhead Power Wires
    ctx.strokeStyle = CONFIG.COLORS.OVERHEAD_WIRES;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < this.wirePoles.length - 1; i++) {
      const p1 = this.wirePoles[i];
      const p2 = this.wirePoles[i + 1];
      if (Math.abs(p1.y - p2.y) < 10) {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2 + 18;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(midX, midY, p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  renderLighting(ctx, timeRatio, playerX, playerY, headlightRadius = 140) {
    let ambientDarkness = Math.max(0, 0.72 - timeRatio * 0.68);
    if (this.cityId === 'delhi') {
      // Delhi Winter Smog haze
      ambientDarkness = Math.max(0.25, 0.75 - timeRatio * 0.5);
    }
    if (ambientDarkness <= 0.05) return;

    ctx.save();
    ctx.fillStyle = this.cityConfig.ambientColor;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.globalCompositeOperation = 'destination-out';
    const pGrad = ctx.createRadialGradient(playerX, playerY, 15, playerX, playerY, headlightRadius);
    pGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
    pGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.6)');
    pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(playerX, playerY, headlightRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
