// Full CHETNA-Road & OSM Environmental Pipeline Config
export const CONFIG = {
  CANVAS_WIDTH: 1060,
  CANVAS_HEIGHT: 680,
  WORLD_WIDTH: 3600,
  WORLD_HEIGHT: 2600,

  // 5 CITY PACKS (CHETNA-Road & OSM Archetypes)
  CITIES: {
    mumbai: {
      id: 'mumbai',
      name: 'Mumbai (Maximum City)',
      tagline: 'Dense Chawls, Kaali-Peeli Cabs & Monsoon Floods',
      icon: '🌊',
      bannerColor: '#0077b6',
      ambientColor: 'rgba(38, 70, 83, 0.70)',
      // CHETNA-Road Derived Environmental Metrics
      metrics: {
        traffic_baseline: 1.45,
        haze_baseline: 0.35,
        gali_score: 0.70,
        parking_pressure: 0.85,
        flood_susceptibility: 0.90,
        customer_patience: 0.80 // Short windows, high pressure
      },
      envState: 'Monsoon congestion',
      roadColor: '#2b2d42',
      gulleyColor: '#3a343b',
      sidewalkColor: '#6c757d',
      specialTraffic: 'kaali_peeli',
      subscriberNames: ['Mrs. Deshmukh (Chawl 4)', 'Ramesh Dabbawala', 'Dr. Batra Clinic', 'Khan Mansion (Bandra)', 'Shetty Lunch Home', 'Uncle Gokhale'],
      shopNames: ['Mumbai Cutting Chai', 'Ashok Vada Pav Center', 'Irani Cafe Bun Maska', 'Kala Ghoda Art Store']
    },
    delhi: {
      id: 'delhi',
      name: 'New Delhi (Dilwalon Ki Dilli)',
      tagline: 'Chandni Chowk Gulleys, Broad Avenues & Winter Smog',
      icon: '🏛️',
      bannerColor: '#d90429',
      ambientColor: 'rgba(50, 40, 30, 0.65)',
      metrics: {
        traffic_baseline: 1.50,
        haze_baseline: 0.88, // Heavy winter smog AQI 450 proxy
        gali_score: 0.65,
        parking_pressure: 0.70,
        flood_susceptibility: 0.25,
        customer_patience: 0.90
      },
      envState: 'Traffic haze',
      roadColor: '#212529',
      gulleyColor: '#4f443b',
      sidewalkColor: '#8d99ae',
      specialTraffic: 'cycle_rickshaw',
      subscriberNames: ['Choudhary Sahab (Civil Lines)', 'Sharma Sweets', 'Gupta Exporters', 'Sardarji Auto Spares', 'Batra Kothi', 'Malhotra Villa'],
      shopNames: ['Panditji Special Chole Bhature', 'Giani Falooda & Lassi', 'Old Delhi Chai & Jalebi', 'Khan Market Books']
    },
    kolkata: {
      id: 'kolkata',
      name: 'Kolkata (City of Joy)',
      tagline: 'Historic Trams, Yellow Ambassador Cabs & Heritage Balconies',
      icon: '🚊',
      bannerColor: '#ffb703',
      ambientColor: 'rgba(40, 35, 55, 0.55)',
      metrics: {
        traffic_baseline: 1.10,
        haze_baseline: 0.40,
        gali_score: 0.85, // Highly intricate old-city alleys
        parking_pressure: 0.75,
        flood_susceptibility: 0.60,
        customer_patience: 1.20 // Familiar recurring customers, more relaxed
      },
      envState: 'Post-rain air',
      roadColor: '#2d3142',
      gulleyColor: '#443f38',
      sidewalkColor: '#7b8794',
      specialTraffic: 'yellow_ambassador',
      subscriberNames: ['Banerjee Heritage House', 'Bose Babu (Flat 3B)', 'Mukherjee Mishti Store', 'Sen Dental Clinic', 'Chatterjee Library', 'Roy Villa'],
      shopNames: ['Kolkata Special Kulhad Bhar Chai', 'KC Das Rasgulla & Sandesh', 'Flurys Heritage Bakery', 'Kalighat Peda Stall']
    },
    pune: {
      id: 'pune',
      name: 'Pune (Vidyeche Maherghar)',
      tagline: 'Historic Peths, Wada Architecture & Puneri Signboards',
      icon: '🏰',
      bannerColor: '#fca311',
      ambientColor: 'rgba(45, 30, 25, 0.52)',
      metrics: {
        traffic_baseline: 1.25,
        haze_baseline: 0.30,
        gali_score: 0.80, // Labyrinthine Peths
        parking_pressure: 0.90, // Sarcastic Puneri parking rules!
        flood_susceptibility: 0.40,
        customer_patience: 1.00
      },
      envState: 'Dusty afternoon',
      roadColor: '#2c2e3b',
      gulleyColor: '#4d4239',
      sidewalkColor: '#858e99',
      specialTraffic: 'puneri_bike',
      subscriberNames: ['Kulkarni Wada', 'Joshi Kaku (Sadashiv Peth)', 'Gokhale Sweets', 'Deshpande Niwas', 'Patwardhan Bungalow', 'Inamdar Trust'],
      shopNames: ['Kattavaril Special Misal', 'Chitale Bandhu Bakarwadi', 'Poona Tea & Bun Maska', 'Deccan Sports & Cycles']
    },
    bangalore: {
      id: 'bangalore',
      name: 'Bengaluru (Silicon Garden)',
      tagline: 'Gulmohar Boulevards, Filter Kaapi & Tech Gridlocks',
      icon: '🌳',
      bannerColor: '#2ec4b6',
      ambientColor: 'rgba(25, 45, 40, 0.50)',
      metrics: {
        traffic_baseline: 1.55, // Notorious Silk Board traffic
        haze_baseline: 0.25,
        gali_score: 0.60,
        parking_pressure: 0.80,
        flood_susceptibility: 0.55,
        customer_patience: 0.75 // Time-sensitive tech office orders
      },
      envState: 'Clear morning',
      roadColor: '#252830',
      gulleyColor: '#3d4035',
      sidewalkColor: '#52b788',
      specialTraffic: 'ev_scooter',
      subscriberNames: ['Anand (404 Villa)', 'Iyengar Residence', 'Rao Tech Consulting', 'Dr. Swamy Clinic', 'Nataraj Apartments', 'Deepak Startup Office'],
      shopNames: ['Brahmin Coffee Bar (Filter Kaapi)', 'CTR Benne Dosa Corner', 'Indiranagar Craft Bakery', 'Malleshwaram Juice Stall']
    }
  },

  // Environmental States
  ENV_STATES: [
    { id: 'clear_morning', name: 'Clear morning', skyTint: 'rgba(255, 160, 60, 0.15)', rain: false },
    { id: 'dusty_afternoon', name: 'Dusty afternoon', skyTint: 'rgba(200, 160, 100, 0.35)', rain: false },
    { id: 'traffic_haze', name: 'Traffic haze', skyTint: 'rgba(80, 70, 65, 0.55)', rain: false },
    { id: 'monsoon_congestion', name: 'Monsoon congestion', skyTint: 'rgba(20, 35, 50, 0.65)', rain: true },
    { id: 'post_rain_air', name: 'Post-rain air', skyTint: 'rgba(50, 120, 140, 0.25)', rain: false },
    { id: 'festival_rush', name: 'Festival market rush', skyTint: 'rgba(255, 100, 50, 0.28)', rain: false }
  ],

  // Vehicles
  VEHICLES: {
    FOOT: {
      id: 'foot',
      name: 'On-Foot Delivery Agent',
      desc: 'Dismount and navigate ultra-narrow stairs, flooded doorsteps, and tight apartment corridors.',
      maxSpeed: 2.4,
      accel: 0.22,
      friction: 0.88,
      turnSpeed: 0.12,
      capacity: 15,
      theftRisk: 0.01,
      suspension: 1.0,
      unlocked: true,
      cost: 0,
      icon: '🚶'
    },
    CYCLE: {
      id: 'cycle',
      name: 'Atlas Standard Cycle',
      desc: 'Trusty steel bicycle. Fits through narrow gulleys, zero fuel cost.',
      maxSpeed: 5.0,
      accel: 0.20,
      friction: 0.96,
      turnSpeed: 0.055,
      capacity: 35,
      theftRisk: 0.05,
      suspension: 0.5,
      unlocked: true,
      cost: 0,
      icon: '🚲'
    },
    ECYCLE: {
      id: 'ecycle',
      name: 'Hero Lectro E-Cycle',
      desc: 'Motor-assisted throttle. Speed +40%, higher cargo capacity.',
      maxSpeed: 7.2,
      accel: 0.32,
      friction: 0.97,
      turnSpeed: 0.062,
      capacity: 65,
      theftRisk: 0.15,
      suspension: 0.7,
      unlocked: false,
      cost: 850,
      icon: '⚡🚲'
    },
    SCOOTER: {
      id: 'scooter',
      name: 'Bajaj Chetak Scooter',
      desc: 'Iconic Indian workhorse scooter. High speed, lane-splitting dash.',
      maxSpeed: 8.8,
      accel: 0.38,
      friction: 0.98,
      turnSpeed: 0.068,
      capacity: 90,
      theftRisk: 0.40,
      suspension: 0.8,
      unlocked: false,
      cost: 1800,
      icon: '🛵'
    }
  },

  TRAFFIC_TYPES: [
    { type: 'auto_rickshaw', name: 'Auto Rickshaw', w: 32, h: 18, speed: 4.2, color: '#fb8500', roof: '#2b9348', hornRate: 0.15 },
    { type: 'bus', name: 'City Transport Bus', w: 72, h: 26, speed: 3.4, color: '#d90429', roof: '#ef233c', hornRate: 0.25 },
    { type: 'kaali_peeli', name: 'Mumbai Kaali Peeli Taxi', w: 38, h: 20, speed: 4.5, color: '#111111', roof: '#ffd166', hornRate: 0.20 },
    { type: 'yellow_ambassador', name: 'Kolkata Ambassador Taxi', w: 40, h: 21, speed: 4.2, color: '#ffb703', roof: '#ffb703', hornRate: 0.18 },
    { type: 'truck', name: 'Tata Ace Chhota Hathi', w: 44, h: 22, speed: 3.8, color: '#ffb703', roof: '#023047', hornRate: 0.10 },
    { type: 'scooter', name: 'Delivery Bike / Scooter', w: 24, h: 10, speed: 5.4, color: '#3a86ff', roof: '#000000', hornRate: 0.20 },
    { type: 'thela', name: 'Handcart Vegetable Thela', w: 34, h: 20, speed: 1.2, color: '#6f4e37', roof: '#588157', hornRate: 0.0 }
  ],

  UPGRADES: {
    BASKET: {
      id: 'basket',
      name: 'Reinforced Front Basket',
      desc: '+15 extra cargo capacity',
      cost: 150,
      level: 0,
      maxLevel: 3,
      bonusPerLevel: 15
    },
    TIRES: {
      id: 'tires',
      name: 'MRF Monsoon Mud Grips',
      desc: 'Reduces pothole damage and prevents skidding in flooded waterlogged roads',
      cost: 220,
      level: 0,
      maxLevel: 2,
      bonusPerLevel: 0.45
    },
    HEADLIGHT: {
      id: 'headlight',
      name: 'High-Beam Halogen Fog Lamp',
      desc: 'Cuts through heavy morning fog, smog, and dark labyrinth gulleys',
      cost: 180,
      level: 0,
      maxLevel: 2,
      bonusPerLevel: 70
    },
    GUMBOOTS: {
      id: 'gumboots',
      name: 'Duckback Monsoon Gumboots',
      desc: 'Allows rapid on-foot wading through flooded knee-deep waters without speed penalty',
      cost: 130,
      level: 0,
      maxLevel: 1,
      bonusPerLevel: 1
    },
    BELL: {
      id: 'bell',
      name: 'Loud Air Horn / Double Bell',
      desc: 'Causes autos, taxis, and resting cows to clear the lane faster',
      cost: 110,
      level: 0,
      maxLevel: 1,
      bonusPerLevel: 1
    },
    TREATS: {
      id: 'treats',
      name: 'Parle-G Dog Biscuits (Pack of 5)',
      desc: 'Throw to instantly pacify chasing street dogs (Press T or Tap Treat)',
      cost: 40,
      consumable: true,
      quantity: 5
    }
  },

  TRACKS: [
    {
      id: 'newspaper',
      title: 'Track 1: Morning Newspaper Boy',
      subtitle: 'Early 4:30 AM delivery through chaotic gulleys and avenues',
      timeSlot: '4:00 AM - 6:00 AM',
      icon: '📰',
      vehicle: 'cycle',
      targetsCount: 14,
      timeLimit: 130,
      basePay: 200,
      targetType: 'doorstep',
      desc: 'Toss papers onto porches, dodge aggressive street dogs, avoid waterlogged craters, and dismount on foot for tight apartment stairs!'
    },
    {
      id: 'milk',
      title: 'Track 2: Doodhwala (Milk Delivery)',
      subtitle: 'Balance milk canisters and measure fresh milk drops',
      timeSlot: '5:30 AM - 7:00 AM',
      icon: '🥛',
      vehicle: 'cycle',
      targetsCount: 12,
      timeLimit: 145,
      basePay: 280,
      targetType: 'milk_can',
      desc: 'Keep milk cans level through bumper-to-bumper morning traffic, dismount to measure exact litres at customer doorsteps!'
    },
    {
      id: 'ecommerce',
      title: 'Track 3: Shiplyp Express Courier',
      subtitle: 'Rush e-commerce parcels with OTP verification in heavy traffic',
      timeSlot: '9:00 AM - 11:30 AM',
      icon: '📦',
      vehicle: 'scooter',
      targetsCount: 16,
      timeLimit: 150,
      basePay: 420,
      targetType: 'parcel',
      desc: 'Ride your scooter through busy avenues, split lanes between city buses and auto-rickshaws, and walk in with customer OTPs.'
    },
    {
      id: 'freeroam',
      title: 'Endless City Rush',
      subtitle: 'Dynamic infinite city orders with intense Indian street traffic',
      timeSlot: 'Dynamic Day / Weather Cycle',
      icon: '🏆',
      vehicle: 'cycle',
      targetsCount: 999,
      timeLimit: 200,
      basePay: 600,
      targetType: 'mixed',
      desc: 'Non-stop deliveries across the entire mega-city! Master high traffic, waterlogging, and on-foot deliveries.'
    }
  ],

  COLORS: {
    ROAD_MARKING: '#ffd166',
    MUD_PATCH: '#583e26',
    GRASS: '#2d6a4f',
    ACCENT_GOLD: '#fca311',
    ACCENT_SAFFRON: '#ff9f1c',
    TEAL: '#2ec4b6',
    BUILDING_WALLS: ['#f4a261', '#e76f51', '#e9c46a', '#2a9d8f', '#dda15e', '#bc6c25', '#e07a5f', '#81b29a'],
    ROOF_COLORS: ['#b7094c', '#892b64', '#5c4d7d', '#457b9d', '#1d3557', '#9e2a2b', '#6b705c'],
    OVERHEAD_WIRES: 'rgba(20, 20, 20, 0.85)'
  }
};
