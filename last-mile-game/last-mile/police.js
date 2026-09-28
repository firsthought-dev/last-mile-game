// ============================================================================
// Shiplyp — Police / Wanted system (phase 1)
//
// Self-contained module: wanted stars + HUD, offence detection, the
// encounter dialogue box, siren ambience (screen-edge red/blue glow +
// synthesized siren) and its two Settings controls. There are deliberately
// no police objects in the 3D world.
//
// game.js only calls a handful of thin hooks (all optional-chained, so the
// game still runs if this file fails to load):
//   ShiplypPolice.update(game, dt)        — once per playing frame
//   ShiplypPolice.isPaused()              — true while the encounter box is up
//   ShiplypPolice.reportOffence(type)     — from checkCrosserCollisions
//   ShiplypPolice.reset()                 — at the start of every drive
//   ShiplypPolice.settingsHTML()/bindSettings(root) — Settings modal
//
// All player-facing text lives in STRINGS below (one table, for localisation).
// ============================================================================
(function (global) {
  'use strict';

  // --------------------------------------------------------------------------
  // STRINGS — every user-facing string. {placeholders} are filled by fmt().
  // --------------------------------------------------------------------------
  const STRINGS = {
    hudLabel: 'WANTED',
    ranks: ['Constable', 'Constable', 'Constable', 'Sub-Inspector', 'Inspector', 'ACP'],
    surnames: ['Pandey', 'Yadav', 'Sharma', 'Deshmukh', 'Pillai', 'Rathore', 'Khan', 'Gill', 'Naidu', 'Chauhan'],
    context: { settle: 'settling up', caught: 'you are caught' },
    settleTag: 'SETTLE',
    settleKey: '[B]',
    settleAria: 'Wanted level {stars} stars. Settle with the police',
    nameTag: '{rank} {name} · {context}',
    offence: {
      redLight: 'Jumped a red light',
      hitPedestrian: 'Hit a pedestrian',
      crash: 'Crashed into the roadside barrier',
      speeding: 'Speeding over the {limit} km/h limit',
      speedOff: 'Sped off from the police',
      honestCop: 'Tried to bribe an honest officer'
    },
    starGained: 'WANTED {stars}★ · {reason}',
    starsCleared: 'Wanted level cleared',
    // Used instead of the star pool when 2+ red lights were run in 5 minutes.
    redLightsOpener: '{redsWord} red lights in five minutes, boss? Licence, registration, pollution certificate, everything.',
    // Opening lines by star level. 1–4★: the player chose to settle up.
    // 5★: caught mid-drive (harshest).
    openers: {
      1: [
        'Signal was red, sir. Red means red.',
        'Small matter only. But small matters become big matters, no?',
        'You came to me yourself? Very wise, very wise.'
      ],
      2: [
        'Two complaints already, boss. Licence and registration. Slowly.',
        'You are lucky you came before my senior did.',
        'Licence, registration, pollution certificate. Everything.'
      ],
      3: [
        'The whole thana is talking about your driving.',
        'Pedestrians are not bowling pins, sir.',
        'I followed you for three kilometres. Your customers are happy, I am not.'
      ],
      4: [
        'Four stars on a delivery run? Control room has your photo on the wall.',
        'Wireless is full of your number plate, sir.',
        'Even the traffic signals are filing complaints against you.'
      ],
      5: [
        'Five stars. Five! Even the Commissioner knows your name now. Step down. Now.',
        'Half the district was chasing one courier. You must be very proud. Hands where I can see them.',
        'Enough! Vehicle off, keys out. Today you are not delivering anything except yourself to the thana.'
      ]
    },
    teaHints: [
      '…or we can settle this over a cup of tea?',
      '…of course, a small chai-paani also solves many problems.',
      '…or maybe you are feeling generous today?'
    ],
    choices: {
      tea: 'Tea money ₹{cost}',
      teaNoFunds: 'Not enough cash (need ₹{cost}, have ₹{wallet})',
      teaPartial: 'Pay what you have ₹{wallet}',
      teaPartialHint: 'Full rate ₹{cost} • −2★',
      teaNoWallet: 'Wallet unavailable',
      argue: 'Argue (risky)',
      argueHint: 'Excuse duel · {rounds} rounds · up to {pct}% win',
      speedOff: 'Speed off (+1★)'
    },
    keyHint: 'Press 1 / 2 / 3',
    results: {
      teaPartial: 'That is all? Fine. Consider yourself lucky, and slow down.',
      teaOk: [
        'Chalo, chalo. Drive safe, okay?',
        'Very good. I did not see you, you did not see me.',
        'Chai is appreciated. Now go before my senior comes.'
      ],
      teaFiveStar: 'This much? For five stars? Don\'t insult me. …Fine. Go.',
      honest: 'Keep your money. Challan is being made.',
      argueOk: [
        'Hmm. Okay, okay. Warning this time only.',
        'Your mother must be very worried. Go.',
        'Fine, the signal was blinking. Go, go.'
      ],
      argueFail: [
        'Argument also? Now it is a bigger challan. ₹{fine}.',
        'You are teaching me the law? Now it is ₹{fine}.',
        'Very smart. Very expensive. ₹{fine}.'
      ],
      argueFailBroke: 'You cannot even pay the full challan? Fine, I will take whatever you have.',
      // The way out of an argument: your sob story. He melts and hands out
      // useless life advice.
      plea: [
        '"Sir, my mother is unwell and this is my last delivery before I go to her…"',
        '"Sir, first job, first week. If I lose it, what will I tell my family?"',
        '"Sir, I am saving for my sister\'s wedding. Every rupee counts…"',
        '"Sir, my father drove a rickshaw for thirty years so I could do better…"'
      ],
      pleaReply: [
        '(wipes his eyes) Okay, go. And listen: always carry an umbrella. Life is like that.',
        'You made me emotional. Go. And never eat at a dhaba with no trucks parked outside.',
        'You remind me of myself. Go. And buy vegetables in the evening. They are cheaper.',
        'My heart is melting. Go. And sleep before eleven. Nothing good happens after eleven.',
        'Arre, don\'t cry. Go. And never lend your scooter to a friend. Never.',
        'Okay, okay. Go. And always keep a spare pen. People respect a man with a pen.'
      ],
      pleaAgain: 'Same story again? My heart is stone now. Just go, before I change my mind.',
      // After a bribe he pockets it, then turns serious for a second.
      advice: [
        'You look like a good boy. Don\'t make this a habit. Think of your mother before you jump the next signal.',
        'Your father did not work his whole life so you could die on the road for a delivery. Slow down.',
        'Money you can earn again. A life you cannot. Remember that.',
        'Somebody\'s child crosses that road every day. Next time it could be yours.',
        'Work hard, beta. Shortcuts end at a hospital or at my table.',
        'I have seen boys like you on a stretcher. Don\'t become one of them.',
        'Your parents are waiting for you to come home tonight. Make sure you do.'
      ],
      speedOff: [
        'Oye! Stop! STOP! …Control room, control room!',
        'You think you can outrun the wireless?'
      ]
    },
    paid: '−₹{amt} from wallet',
    continueBtn: 'Continue',
    // ---- Excuse duel (Argue) ----
    duel: {
      patience: 'Patience',
      plea: 'Tell your story instead (way out)',
      pleaHint: 'Free • −1★ first time per drive',
      pleaUsedHint: 'He has heard it today • just leave',
      timeoutPick: '(…says nothing)',
      suspense: '…',
      offerLine: 'Hmm. Fine, one star less. …Or are you feeling lucky?',
      pushLuck: 'Push your luck: one more round to wipe the slate',
      pushLuckHint: 'Win: all stars cleared · Lose: double fine, star back',
      takeIt: 'Take it and go',
      doubleWin: 'Achha, achha. Clean slate. Now vanish before I change my mind.',
      doubleLose: 'Too greedy, boss. Double challan: ₹{fine}. And that star comes back.',
      doubleLoseBroke: 'Too greedy, boss. I will take what you have, and that star comes back.',
      roundTag: 'Round {n}/{total}',
      doubleTag: 'Final round'
    },
    // One personality per encounter. `hint` is appended to the opener so a
    // player can learn to read the officer.
    personalities: {
      tired: {
        hint: '(He stifles a yawn and keeps glancing at the chai stall.)',
        lines: ['*yawns* So? Why were you rushing?', 'Make it quick, my chai is getting cold.', 'Twelve-hour shift, boss. Give me one good reason.', 'Hmm. And? I am listening. Barely.']
      },
      book: {
        hint: '(He flips open a very thick rulebook and licks his pencil.)',
        lines: ['Section 184, dangerous driving. Your explanation?', 'Rules are rules. Explain yourself.', 'I will note down whatever you say. Carefully.', 'Anything else for the record?']
      },
      proud: {
        hint: '(He adjusts his cap slowly. He does not like being told whose uncle is who.)',
        lines: ['Speak. And choose your words carefully.', 'I have heard every story in this city. Surprise me.', 'You know who I am? Good. Now talk.', 'Last chance. Impress me.']
      }
    },
    excuses: {
      emergency: ["My customer's biryani is getting cold, sir. It is a medical emergency!", 'My phone is at 1%, sir. If it dies, my rating dies.', 'Customer wrote URGENT, sir. With three exclamation marks!', 'Sir, the parcel is medicine for an old uncle. Truly.'],
      family: ['My mother made me promise to be home by dinner, sir.', "My sister's wedding is next week, I am saving every rupee.", 'Sir, my grandmother is tracking my live location right now.', 'My kids are waiting for me to bring samosas, sir.'],
      documents: ['Licence, RC, PUC, insurance. All laminated, sir.', 'Everything is in DigiLocker, sir. See, see.', "My pollution certificate is fresher than today's milk.", 'Even my helmet has the ISI mark, sir. Check.'],
      honesty: ['Honestly, sir? I did not see the signal. My mistake.', 'You are right. I was too fast. Sorry.', 'I will not lie, sir. I was showing off a little.', 'Guilty, sir. Please be kind.'],
      drama: ['Sir, if you write a challan, I will cry right here on the road.', 'This is the worst day of my entire life!', 'Arrest me then! Arrest my dreams also!', 'Sir, the whole universe is against me today!'],
      namedrop: ['Do you know who my uncle is? MLA, sir.', 'Commissioner sahab and I play cricket on Sundays.', "My cousin's friend works in the CM's office.", 'One phone call, sir. Just one.'],
      confidence: ['I know the rules, sir. Write the challan if you must.', 'I made a mistake and I will own it. Your call, sir.', 'Look me in the eye, sir. I drive for a living. Carefully.', 'Fine me or free me, sir. I respect either.']
    },
    reactions: {
      liked: ['Hmm. Okay… that is fair.', 'Achha. Go on.', 'Now that I can understand.'],
      neutral: ['Hmm.', 'Okay. And?', 'I have heard better.'],
      hated: ["Don't try that with me!", 'Wrong answer, boss.', 'Now you are testing my patience.'],
      timeout: ['Nothing to say? Very suspicious.', 'Cat got your tongue?']
    },
    settings: {
      section: 'POLICE & SIREN',
      sirenVolume: 'Siren volume',
      reduceFlashing: 'Reduce flashing',
      on: 'ON',
      off: 'OFF'
    }
  };
  const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

  const fmt = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null) ? vars[k] : m);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (n) => Math.round(n).toLocaleString('en-IN');

  // --------------------------------------------------------------------------
  // TUNING
  // --------------------------------------------------------------------------
  const TUNE = {
    maxStars: 5,
    offenceStars: { redLight: 1, hitPedestrian: 2, crash: 1, speeding: 1, speedOff: 1, honestCop: 1 },
    repeatWindow: 60,          // s: an offence while an earlier one is still inside this window adds +1 extra (a +1 offence becomes +2)
    postedLimitKmh: 75,        // the posted limit on the speed-camera gantries
    speedingHold: 6,           // s continuously over the limit before it counts
    crashMinSpeed: 8,          // m/s at barrier contact to count as a crash
    crashDebounce: 10,
    redLightMemory: 300,       // s: "N red lights in five minutes"
    decayAfter: 30,            // s of clean driving before the first star drops
    decayEvery: 30,            // s per further star
    teaBase: [0, 50, 200, 500, 1500, 4000],
    bribeHistoryStep: 0.25,    // +25% per previous bribe
    bribeHistoryCap: 3.0,
    // Excuse duel. Per round each excuse costs the cop's patience (0–100):
    // liked / neutral / hated / timeout. Win if patience left ≥ duelWinLine.
    duelCost: { liked: 10, neutral: 30, hated: 55, timeout: 70 },
    duelWinLine: [0, 30, 45, 40, 45, 45],
    duelLikedChance: [0, 0.9, 0.8, 0.7, 0.55, 0.42],   // chance a round offers a liked excuse
    duelSeconds: [0, 10, 9.5, 9, 8.5, 8],
    duelDoubleTimeMult: 0.75,
    duelDoubleLikedDrop: 0.2,
    duelDoubleFineWalletCap: 0.5,
    // Shown on the Argue button: win chance for a player who reads the cop's
    // personality (from simulating the duel; random picks do far worse).
    duelShownChance: [0, 100, 95, 80, 55, 40],
    personalityWeights: [null, { tired: 6, book: 3, proud: 1 }, { tired: 5, book: 4, proud: 1 }, { tired: 2, book: 5, proud: 3 }, { tired: 1, book: 4, proud: 5 }, { tired: 1, book: 3, proud: 6 }],
    argueFineMult: 1.6,
    argueFineWalletCap: 0.25,  // a lost argument never takes more than 25% of the wallet
    honestChance: 0.12,
    shortGrace: 8,
    tickWindow: 15,            // s: order-clock ticks only in the last 15 s, building to the end
    tickFastBelow: 8,          // s: ticks twice a second from here
    missedFine: 25,            // ₹ taken from the wallet when an order's clock hits 0
    tickQuietAfterDelivery: 2,
    startGrace: 5,             // s after a drive starts before offences count
    caughtGrace: 45            // s after a 5★ box closes before 5★ can catch you again
  };

  // --------------------------------------------------------------------------
  // SETTINGS (per-device, localStorage, guarded)
  // --------------------------------------------------------------------------
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }
  };
  const prefersReduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
  const settings = {
    sirenVolume: Math.max(0, Math.min(1, parseFloat(LS.get('shiplyp_siren_volume', '0.5')) || 0)),
    reduceFlashing: LS.get('shiplyp_reduce_flashing', prefersReduced ? '1' : '0') === '1'
  };

  // --------------------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------------------
  const S = {
    stars: 0,
    offences: [],          // { type, t }
    cleanTime: 0,
    time: 0,               // module clock (s of playing time)
    driveStart: 0,
    bribes: parseInt(LS.get('shiplyp_police_bribes', '0'), 10) || 0,
    paused: false,
    speedingT: 0, speedingFlagged: false, lastCrash: -99,
    cooldown: 0,
    signalSides: new Map(),
    lastGain: -99,
    game: null
  };

  // --------------------------------------------------------------------------
  // CSS (injected so the module stays self-contained)
  // --------------------------------------------------------------------------
  const CSS = `
  #police-wanted{position:fixed;right:16px;top:64px;z-index:70;display:flex;align-items:center;gap:8px;cursor:pointer;color:inherit;min-height:36px;
    background:rgba(17,20,28,.92);border:2.5px solid #000;border-radius:10px;padding:6px 10px;box-shadow:3px 3px 0 #000;
    pointer-events:none;opacity:0;transform:translateY(-6px);transition:opacity .25s ease,transform .25s ease;font-family:var(--font-telemetry,'Chakra Petch',monospace)}
  #police-wanted.on{opacity:1;transform:none;pointer-events:auto}
  #police-wanted .pw-settle{font-size:10px;font-weight:800;letter-spacing:1px;color:#111;background:#ffd23f;border:1.5px solid #000;border-radius:6px;padding:2px 6px}
  #police-wanted .pw-key{opacity:.6}
  #police-wanted.compact{padding:5px 8px;gap:6px}
  #police-wanted.compact .pw-label{display:none}
  #police-wanted.compact .pw-star{font-size:15px}
  body.touch-controls-active #police-wanted .pw-key{display:none}
  #police-wanted:hover .pw-settle,#police-wanted:focus-visible .pw-settle{background:#fff}
  #police-wanted .pw-label{font-size:10px;font-weight:800;letter-spacing:2px;color:#ff5a7a}
  #police-wanted .pw-stars{display:flex;gap:2px}
  #police-wanted .pw-star{font-size:17px;line-height:1;color:rgba(255,255,255,.22);transition:color .2s,transform .2s}
  #police-wanted .pw-star.lit{color:#ffd23f;text-shadow:1px 1px 0 #000}
  #police-wanted.bump{animation:pwBump .45s ease}
  @keyframes pwBump{50%{transform:scale(1.15)}}
  #police-siren{position:fixed;inset:0;pointer-events:none;z-index:40;opacity:1}
  #police-siren .ps-l,#police-siren .ps-r{position:absolute;top:0;bottom:0;width:8%;opacity:0}
  #police-siren .ps-l{left:0;background:linear-gradient(to right,rgba(255,40,60,.85),rgba(255,40,60,0))}
  #police-siren .ps-r{right:0;background:linear-gradient(to left,rgba(40,110,255,.85),rgba(40,110,255,0))}
  #police-dialog-wrap{position:fixed;inset:0;z-index:9000;display:flex;align-items:flex-end;justify-content:center;
    background:rgba(0,0,0,0);transition:background .3s;pointer-events:auto}
  #police-dialog-wrap.on{background:rgba(0,0,0,.35)}
  .pd-box{box-sizing:border-box;width:min(640px,calc(100% - 24px));margin:0 0 max(12px,env(safe-area-inset-bottom));
    background:#FAEEDA;color:#412402;border:3px solid #412402;border-radius:12px;padding:14px 16px 14px;
    box-shadow:0 8px 30px rgba(0,0,0,.45);transform:translateY(120%);transition:transform .35s cubic-bezier(.2,.9,.3,1.1);
    font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-height:calc(100% - 16px);overflow:auto}
  #police-dialog-wrap.on .pd-box{transform:none}
  .pd-top{display:flex;gap:12px;align-items:flex-start}
  .pd-portrait{flex:0 0 64px;width:64px;height:64px;border-radius:10px;border:3px solid #412402;background:#e9d3ae;overflow:hidden}
  .pd-portrait svg{width:100%;height:100%;display:block}
  .pd-main{flex:1;min-width:0}
  .pd-tag{display:inline-block;background:#1f5fbf;color:#fff;font-weight:800;font-size:12px;letter-spacing:.3px;padding:3px 10px;border-radius:999px;border:2px solid #412402}
  .pd-stars{margin-left:6px;color:#b8860b;font-size:13px;letter-spacing:1px;white-space:nowrap}
  .pd-line{margin:8px 0 0;font-size:16px;line-height:1.35;font-weight:600}
  .pd-line.sub{font-style:italic;font-weight:500;opacity:.85;font-size:15px;margin-top:4px}
  .pd-choices{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
  .pd-btn{min-height:56px;border-radius:10px;border:3px solid #412402;background:#fff7e8;color:#412402;font-weight:800;font-size:15px;
    padding:8px 8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;touch-action:manipulation;text-align:center}
  .pd-btn .k{font-size:11px;opacity:.6;font-weight:700}
  .pd-btn .h{font-size:11px;font-weight:600;opacity:.75}
  .pd-btn:hover:not([disabled]),.pd-btn:focus-visible{background:#ffe9b8}
  .pd-btn.tea{background:#e6f4d7}
  .pd-btn.off{background:#fde0d8}
  .pd-btn[disabled]{opacity:.55;cursor:not-allowed}
  .pd-foot{margin-top:8px;font-size:12px;opacity:.7;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
  .pd-result{margin-top:10px;font-size:13px;font-weight:700}
  .pd-result span{display:inline-block;margin-right:10px;background:#412402;color:#FAEEDA;border-radius:6px;padding:2px 8px;margin-top:4px}
  .pd-continue{margin-top:12px;width:100%;min-height:52px}
  .pd-duel{display:block}
  .pdd-meta{display:flex;justify-content:space-between;font-size:12px;font-weight:800;opacity:.8;margin-bottom:4px}
  .pdd-patience{position:relative;height:10px;border:2px solid #412402;border-radius:6px;background:#f3dfc0;overflow:hidden}
  .pdd-pfill{height:100%;width:100%;background:#1f5fbf;transition:width .45s ease}
  .pdd-winline{position:absolute;top:-2px;bottom:-2px;width:2px;background:#412402}
  .pdd-timer{height:5px;margin:6px 0 8px;border-radius:3px;background:rgba(65,36,2,.15);overflow:hidden}
  .pdd-tfill{height:100%;width:100%;background:#c0392b}
  .pdd-opts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .pdd-opts.two{grid-template-columns:1fr 1fr}
  .pdd-opts .pd-btn{font-size:14px;font-weight:700;line-height:1.25}
  .pdd-plea{grid-column:1/-1;min-height:40px;background:#eef4ff}
  .pdd-opt.picked{background:#ffe9b8;outline:3px solid #1f5fbf}
  @media (max-width:520px){.pdd-opts,.pdd-opts.two{grid-template-columns:1fr}.pdd-opts .pd-btn{min-height:46px;font-size:13px}}
  @media (max-height:430px){.pdd-opts .pd-btn{min-height:44px;font-size:12px;padding:4px 6px}.pdd-timer{margin:4px 0 6px}}
  body:not(.touch-controls-active) .pd-foot .touch-only{display:none}
  @media (max-width:520px){.pd-choices{grid-template-columns:1fr}.pd-btn{min-height:50px;flex-direction:row;gap:8px}.pd-line{font-size:15px}}
  @media (max-height:430px){.pd-box{padding:10px 12px}.pd-portrait{flex-basis:48px;width:48px;height:48px}.pd-line{font-size:14px;margin-top:4px}.pd-line.sub{font-size:13px}.pd-choices{margin-top:8px}.pd-btn{min-height:48px;font-size:14px}.pd-foot{margin-top:4px}}
  .police-settings .ps-range{width:120px}
  `;

  // Flat police portrait (inline SVG, no asset). Cap colour by rank.
  function portraitSVG(stars) {
    const cap = stars >= 4 ? '#2b3a67' : '#6b4f2a';
    const band = stars >= 3 ? '#c0392b' : '#8b6b3d';
    const star = stars >= 3 ? '<circle cx="32" cy="15" r="2.4" fill="#ffd23f"/>' : '';
    return `<svg viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" fill="#e9d3ae"/>
      <path d="M8 64c2-14 12-18 24-18s22 4 24 18z" fill="#c8a870"/>
      <path d="M26 46h12l-6 10z" fill="#a8864f"/>
      <circle cx="32" cy="32" r="14" fill="#9c6b45"/>
      <path d="M22 37c3 3 17 3 20 0-1 4-5 6-10 6s-9-2-10-6z" fill="#2b1a0e"/>
      <circle cx="26.5" cy="30" r="1.8" fill="#2b1a0e"/><circle cx="37.5" cy="30" r="1.8" fill="#2b1a0e"/>
      <path d="M17 22c3-9 27-9 30 0l1 3H16z" fill="${cap}"/>
      <rect x="16" y="22" width="32" height="4" rx="1" fill="${band}"/>${star}
      <rect x="42" y="50" width="8" height="3" rx="1" fill="#ffd23f"/>
    </svg>`;
  }

  // --------------------------------------------------------------------------
  // DOM
  // --------------------------------------------------------------------------
  const el = {};
  function ensureDOM() {
    if (el.hud) return;
    const st = document.createElement('style');
    st.id = 'police-style';
    st.textContent = CSS;
    document.head.appendChild(st);

    el.hud = document.createElement('button');
    el.hud.type = 'button';
    el.hud.tabIndex = -1;
    el.hud.id = 'police-wanted';
    el.hud.setAttribute('aria-live', 'polite');
    el.hud.innerHTML = `<span class="pw-label">${esc(STRINGS.hudLabel)}</span><span class="pw-stars">${'<span class="pw-star">★</span>'.repeat(TUNE.maxStars)}</span><span class="pw-settle">${esc(STRINGS.settleTag)}<span class="pw-key"> ${esc(STRINGS.settleKey)}</span></span>`;
    el.hud.addEventListener('click', (e) => { e.stopPropagation(); settle(); });
    ['touchstart', 'pointerdown', 'mousedown'].forEach(ev => el.hud.addEventListener(ev, e => e.stopPropagation()));
    document.body.appendChild(el.hud);

    el.siren = document.createElement('div');
    el.siren.id = 'police-siren';
    el.siren.innerHTML = '<div class="ps-l"></div><div class="ps-r"></div>';
    document.body.appendChild(el.siren);
    el.sirenL = el.siren.firstChild;
    el.sirenR = el.siren.lastChild;


    window.addEventListener('resize', placeHUD);
  }

  // Top-right, tucked under whatever already sits there (desktop status
  // pills, the touch A-STEER/A-DRIVE/TOOLS row, the landscape/desktop
  // telemetry) so it never overlaps. Portrait phones have the telemetry in
  // the top-right corner, so there the meter goes compact under the
  // delivery capsule on the left instead.
  function placeHUD() {
    if (!el.hud) return;
    const W = window.innerWidth, H = window.innerHeight;
    const rects = (q) => Array.from(document.querySelectorAll(q)).map(n => n.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    const portraitPhone = W < 600 && H > W;
    el.hud.classList.toggle('compact', portraitPhone);
    let bottom = 8;
    if (portraitPhone) {
      rects('#delivery-mission-capsule').forEach(r => { if (r.top < H * 0.3) bottom = Math.max(bottom, r.bottom); });
      el.hud.style.left = '8px'; el.hud.style.right = 'auto';
    } else {
      const hudW = el.hud.offsetWidth || 260;
      rects('.slowroads-top-bar, .touch-util-btn, #touch-btn-tools, .telemetry-digits-box').forEach(r => {
        if (r.right > W - hudW - 16 && r.top < H * 0.35) bottom = Math.max(bottom, r.bottom);
      });
      el.hud.style.right = '16px'; el.hud.style.left = 'auto';
    }
    el.hud.style.top = Math.round(bottom + 8) + 'px';
  }

  function renderHUD(bump) {
    ensureDOM();
    el.hud.classList.toggle('on', S.stars > 0);
    el.hud.querySelectorAll('.pw-star').forEach((s, i) => s.classList.toggle('lit', i < S.stars));
    el.hud.setAttribute('aria-label', fmt(STRINGS.settleAria, { stars: S.stars }));
    if (bump) {
      el.hud.classList.remove('bump');
      void el.hud.offsetWidth;
      el.hud.classList.add('bump');
    }
    placeHUD();
  }

  // --------------------------------------------------------------------------
  // AUDIO — synthesized distant siren (no files). Routed through the game's
  // SoundEngine context so mute / menu-suspend apply.
  // --------------------------------------------------------------------------
  const A = { built: false, gain: null, swell: 0 };
  function buildAudio() {
    const snd = global.sound;
    const ctx = snd && snd.ctx;
    if (!ctx || A.built) return !!A.built;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 780;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.22;        // slow two-tone wail
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 170;          // ±170 Hz sweep
    lfo.connect(lfoGain).connect(osc.frequency);
    const lp = ctx.createBiquadFilter(); // "distant": dull highs
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(lp).connect(g).connect(snd.masterFilter || ctx.destination);
    osc.start(); lfo.start();
    A.gain = g; A.lp = lp; A.ctx = ctx; A.built = true;
    return true;
  }
  // Per-star siren "distance": louder and brighter (higher low-pass cutoff)
  // as the police close in. Index = stars.
  const SIREN_LEVEL = [0, 0.004, 0.007, 0.011, 0.016, 0.02];
  const SIREN_CUTOFF = [600, 650, 850, 1100, 1400, 1500];
  function updateAudio(dt, playing) {
    const snd = global.sound;
    if (!snd || !snd.ctx) return;
    if (!A.built && !(S.stars > 0 && buildAudio())) return;
    A.swell = Math.max(0, A.swell - dt / 3.5);
    const silent = !playing || snd.sfxMuted || snd.suspended || S.stars <= 0 || settings.sirenVolume <= 0;
    const st = Math.min(5, S.stars);
    const swell = 0.035 * Math.sin(Math.min(1, A.swell) * Math.PI / 2);
    const target = silent ? 0 : settings.sirenVolume * (SIREN_LEVEL[st] + swell);
    A.gain.gain.setTargetAtTime(target, A.ctx.currentTime, 0.4);
    A.lp.frequency.setTargetAtTime(SIREN_CUTOFF[st], A.ctx.currentTime, 1.0);
  }

  // --------------------------------------------------------------------------
  // SIREN EDGE PULSE
  // --------------------------------------------------------------------------
  // Heat build-up, subtle and never strobing:
  //   1★ faint occasional glow · 2★ steady soft pulse · 3★ clearer pulse ·
  //   4★+ constant glow with a slow breathe. "Reduce flashing" = steady glow.
  function updatePulse(playing) {
    if (!el.siren) return;
    const st = Math.min(5, S.stars);
    if (!playing || st <= 0) { el.sirenL.style.opacity = 0; el.sirenR.style.opacity = 0; return; }
    const t = performance.now() / 1000;
    let l, r;
    if (settings.reduceFlashing) {
      l = r = [0, 0.05, 0.09, 0.13, 0.17, 0.2][st];
    } else if (st === 1) {
      const cyc = t % 7;                                   // one soft bump every 7 s
      const e = cyc < 1.6 ? Math.sin(cyc / 1.6 * Math.PI) : 0;
      l = r = 0.14 * e * e;
    } else if (st <= 3) {
      const peak = st === 2 ? 0.17 : 0.26, period = st === 2 ? 3.2 : 2.6;
      const ph = t * Math.PI * 2 / period;
      l = peak * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(ph)));
      r = peak * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(ph + Math.PI)));
    } else {
      l = r = 0.3 * (0.9 + 0.1 * Math.sin(t * Math.PI * 2 / 4));
    }
    el.sirenL.style.opacity = l.toFixed(3);
    el.sirenR.style.opacity = r.toFixed(3);
  }

  // --------------------------------------------------------------------------
  // STARS
  // --------------------------------------------------------------------------
  function setStars(n, reason) {
    const prev = S.stars;
    S.stars = Math.max(0, Math.min(TUNE.maxStars, n | 0));
    S.cleanTime = 0;
    if (S.stars > prev) {
      if (S.stars >= 3) A.swell = 1;     // brief swell on each star gained from 3★
      S.lastGain = S.time;
      const g = S.game;
      if (reason && g && typeof g.addNotification === 'function') {
        g.addNotification(esc(fmt(STRINGS.starGained, { stars: S.stars, reason })), 'warning', 3500);
      }
    }
    renderHUD(S.stars !== prev);
  }

  function reportOffence(type) {
    if (S.paused) return;
    // A drive can start mid-crossing on a red; nothing counts until the
    // player has had a moment to take control.
    if (S.time - S.driveStart < TUNE.startGrace) return;
    const add = TUNE.offenceStars[type] || 1;
    const recent = S.offences.some(o => S.time - o.t < TUNE.repeatWindow);
    S.offences.push({ type, t: S.time });
    if (S.offences.length > 50) S.offences.shift();
    const escalate = recent ? 1 : 0;
    setStars(S.stars + add + escalate, fmt(STRINGS.offence[type] || type, { limit: TUNE.postedLimitKmh }));
    if (global.console && S.debugLog) console.log('[police] offence', type, '->', S.stars);
  }

  // --------------------------------------------------------------------------
  // RED-LIGHT DETECTION — the only traffic-control offence the world exposes.
  // A crossing is "run" when the vehicle passes its line (sign flip of the
  // along-road offset) while that signal shows STOP (phase 2).
  // --------------------------------------------------------------------------
  function checkRedLights(game) {
    const w = game.world, v = game.vehicle;
    if (!w || !w.crossingInfo || !v || !v.mesh) return;
    const p = v.mesh.position;
    const speed = Math.abs(v.speed || 0);
    for (const c of w.crossingInfo) {
      const dx = p.x - c.pt.x, dz = p.z - c.pt.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 40 * 40) { S.signalSides.delete(c); continue; }
      let tg = c._tg;
      if (!tg) {
        const u = Math.max(0, Math.min(1, c.s / w.curve.getLength()));
        const t = w.curve.getTangentAt(u);
        const l = Math.hypot(t.x, t.z) || 1;
        tg = c._tg = { x: t.x / l, z: t.z / l };
      }
      const along = dx * tg.x + dz * tg.z;
      const lateral = Math.abs(-dx * tg.z + dz * tg.x);
      const prev = S.signalSides.get(c);
      S.signalSides.set(c, along);
      if (prev == null || lateral > 7) continue;
      const crossed = (prev < 0 && along >= 0) || (prev > 0 && along <= 0);
      if (crossed && speed > 2 && c.signal && c.signal.phase === 2) reportOffence('redLight');
    }
  }

  // Sustained speeding over the posted limit (the 75 km/h on the speed-camera
  // gantries; the game has no other posted limits). One offence per spell:
  // it re-arms once you drop back under the limit.
  function checkSpeeding(game, dt) {
    const kmh = Math.abs(game.vehicle.speed || 0) * 3.6;
    if (kmh > TUNE.postedLimitKmh + 2) {
      S.speedingT += dt;
      if (!S.speedingFlagged && S.speedingT >= TUNE.speedingHold) { S.speedingFlagged = true; reportOffence('speeding'); }
    } else if (kmh < TUNE.postedLimitKmh - 3) {
      S.speedingT = 0; S.speedingFlagged = false;
    }
  }

  // Crashing into the roadside barrier: the only solid object the driving
  // model collides with (props, houses and trees are not solid, and there
  // are no parked vehicles yet). Contact = pinned at the lateral clamp.
  function checkBarrierCrash(game) {
    const w = game.world, v = game.vehicle;
    if (!w.getLateralClamp || typeof v.lateralOffset !== 'number' || typeof v.splineProgress !== 'number') return;
    const lat = v.lateralOffset, side = lat >= 0 ? 1 : -1;
    const bike = v.vehicleType === 'cycle' || v.isBicycle;
    const clamp = w.getLateralClamp(v.splineProgress, side) + (bike ? 0.65 : 0);
    const touching = Math.abs(lat) >= clamp - 0.05;
    if (touching && !S.wasTouching && Math.abs(v.speed || 0) > TUNE.crashMinSpeed && S.time - S.lastCrash > TUNE.crashDebounce) {
      S.lastCrash = S.time;
      reportOffence('crash');
    }
    S.wasTouching = touching;
  }

  // Order-clock tick: one soft blip per whole second, only in an order's last
  // 15 s, rising gently in pitch and volume, twice a second in the final 8 s. update() only runs while playing and unpaused, so menus, ad pauses
  // and the police box are silent by construction. A delivery resets the
  // clock upwards; that jump is treated as "stop" for a short beat.
  function orderClockTick(game) {
    const t = game.orderTimer;
    if (typeof t !== 'number') return;
    const prev = S.lastOrderTimer;
    S.lastOrderTimer = t;
    if (prev == null) return;
    if (t > prev + 0.5) { S.tickQuietUntil = S.time + TUNE.tickQuietAfterDelivery; return; }
    if (t <= 0 && prev > 0 && typeof game.addNotification === 'function') {
      // Missed-delivery fine: flat ₹25 from the wallet (or whatever it holds).
      const C = global.ShiplypSave;
      const w = C && typeof C.wallet === 'function' ? C.wallet() : 0;
      const fine = Math.min(TUNE.missedFine, Math.max(0, w || 0));
      if (fine > 0) spendWallet(fine);
      game.addNotification(`Time's up! Delivery missed: −₹${fine} fine, half pay and streak lost`, 'warning', 4000);
    }
    if (t <= 0 || t > TUNE.tickWindow || S.time < (S.tickQuietUntil || 0)) return;
    const rate = t <= TUNE.tickFastBelow ? 2 : 1;
    if (Math.ceil(t * rate) < Math.ceil(prev * rate)) {
      const k = 1 - t / TUNE.tickWindow; // 0 at window start, 1 at zero
      const snd = global.sound;
      if (snd && typeof snd.playTone === 'function') snd.playTone(720 + 280 * k, 'sine', 0.05, 0.01 + 0.035 * k); // honours mute + menu suspend
      S.ticks = (S.ticks || 0) + 1;
    }
  }

  function redsRecent() {
    return S.offences.filter(o => o.type === 'redLight' && S.time - o.t < TUNE.redLightMemory).length;
  }

  // --------------------------------------------------------------------------
  // ENCOUNTER DIALOGUE
  // --------------------------------------------------------------------------
  function teaCost(stars) {
    const mult = Math.min(TUNE.bribeHistoryCap, 1 + TUNE.bribeHistoryStep * S.bribes);
    return Math.round(TUNE.teaBase[Math.min(stars, 5)] * mult / 10) * 10;
  }
  // Spend from the career wallet and refresh the HUD ₹ so it never shows
  // money the player no longer has.
  function spendWallet(amt) {
    const C = global.ShiplypSave;
    if (!C || !(amt > 0) || !C.spend(amt)) return false;
    const g = (dlg && dlg.game) || S.game;
    if (g && typeof g.updateHUDStats === 'function') g.updateHUDStats();
    return true;
  }
  function wallet() {
    const C = global.ShiplypSave;
    return C && typeof C.wallet === 'function' ? C.wallet() : null;
  }

  const PREFS = {
    tired: { liked: ['emergency', 'family'], hated: ['documents', 'namedrop'] },
    book: { liked: ['documents', 'honesty'], hated: ['drama', 'namedrop'] },
    proud: { liked: ['confidence', 'documents'], hated: ['namedrop', 'drama'] }
  };
  const CATS = ['emergency', 'family', 'documents', 'honesty', 'drama', 'namedrop', 'confidence'];
  const verdictOf = (pers, cat) => PREFS[pers].liked.includes(cat) ? 'liked' : (PREFS[pers].hated.includes(cat) ? 'hated' : 'neutral');
  function pickPersonality(stars) {
    const w = TUNE.personalityWeights[Math.min(5, Math.max(1, stars))];
    let r = Math.random() * (w.tired + w.book + w.proud);
    for (const k of ['tired', 'book', 'proud']) { if ((r -= w[k]) < 0) return k; }
    return 'book';
  }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function fineFor(cost, capFrac, mult) {
    const w = wallet();
    const full = Math.round(cost * TUNE.argueFineMult * mult / 10) * 10;
    return w == null ? full : Math.min(full, Math.max(10, Math.round(w * capFrac / 10) * 10));
  }
  // Soft sting through the game's SoundEngine (so mute applies).
  function sting(kind) {
    const snd = global.sound;
    if (!snd || typeof snd.playTone !== 'function') return;
    const seq = kind === 'suspense' ? [[392, 0]] : kind === 'win' ? [[523, 0], [659, 120]] : [[330, 0], [247, 160]];
    seq.forEach(([f, d]) => setTimeout(() => snd.playTone(f, 'triangle', 0.22, 0.05), d));
  }

  let dlg = null;
  function openEncounter(game, where) {
    const officer = { rank: STRINGS.ranks[Math.min(5, Math.max(1, S.stars))], name: pick(STRINGS.surnames) };
    ensureDOM();
    if (dlg) return;
    S.paused = true;
    if (game.vehicle) game.vehicle.speed = 0;
    const stars = Math.max(1, S.stars);
    const cost = teaCost(stars);
    const w = wallet();
    const reds = redsRecent();
    let openerPool = STRINGS.openers[Math.min(5, stars)] || STRINGS.openers[1];
    if (reds >= 2 && stars < 5) openerPool = [STRINGS.redLightsOpener];
    const pers = pickPersonality(stars);
    const opener = fmt(pick(openerPool), { reds, redsWord: NUMBER_WORDS[reds] || reds }) + ' ' + STRINGS.personalities[pers].hint;
    const hint = pick(STRINGS.teaHints);
    const duelRounds = stars >= 3 ? 3 : 2;
    const full = w != null && w >= cost;
    // Short of the full rate: offer everything in the wallet for −2★ instead,
    // so a broke player at 5★ always has a way down.
    const partial = !full && w != null && w > 0;
    const canTea = full || partial;
    const teaLabel = partial ? fmt(STRINGS.choices.teaPartial, { wallet: money(w) }) : fmt(STRINGS.choices.tea, { cost: money(cost) });
    const teaSub = w == null ? STRINGS.choices.teaNoWallet
      : (full ? '' : partial ? fmt(STRINGS.choices.teaPartialHint, { cost: money(cost) })
        : fmt(STRINGS.choices.teaNoFunds, { cost: money(cost), wallet: money(w) }));
    const tag = fmt(STRINGS.nameTag, { rank: officer.rank, name: officer.name, context: STRINGS.context[where] || where });

    document.querySelectorAll('#police-dialog-wrap').forEach(n => n.remove()); // a closing one still fading out
    const wrap = document.createElement('div');
    wrap.id = 'police-dialog-wrap';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', tag);
    wrap.innerHTML = `
      <div class="pd-box">
        <div class="pd-top">
          <div class="pd-portrait">${portraitSVG(stars)}</div>
          <div class="pd-main">
            <span class="pd-tag">${esc(tag)}</span><span class="pd-stars">${'★'.repeat(stars)}</span>
            <p class="pd-line">${esc(opener)}</p>
            <p class="pd-line sub">${esc(hint)}</p>
          </div>
        </div>
        <div class="pd-choices">
          <button class="pd-btn tea" data-c="1" ${canTea ? '' : 'disabled'}><span><span class="k">1</span> ${esc(teaLabel)}</span>${teaSub ? `<span class="h">${esc(teaSub)}</span>` : ''}</button>
          <button class="pd-btn" data-c="2"><span><span class="k">2</span> ${esc(STRINGS.choices.argue)}</span><span class="h">${esc(fmt(STRINGS.choices.argueHint, { rounds: duelRounds, pct: TUNE.duelShownChance[Math.min(5, stars)] }))}</span></button>
          <button class="pd-btn off" data-c="3"><span><span class="k">3</span> ${esc(STRINGS.choices.speedOff)}</span></button>
        </div>
        <div class="pd-foot"><span class="desk-only">${esc(STRINGS.keyHint)}</span><span>₹${w == null ? '—' : money(w)}</span></div>
      </div>`;
    document.body.appendChild(wrap);
    if (document.body.classList.contains('touch-controls-active')) wrap.querySelector('.desk-only').style.visibility = 'hidden';
    requestAnimationFrame(() => wrap.classList.add('on'));
    dlg = { wrap, game, stars, cost, canTea, partial, officer, where, pers, duelRounds, done: false };
    wrap.querySelectorAll('.pd-btn').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); choose(+b.dataset.c); }));
    const first = wrap.querySelector('.pd-btn:not([disabled])');
    if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
  }

  function showResult(line, chips, extra) {
    const box = dlg.wrap.querySelector('.pd-box');
    const main = box.querySelector('.pd-line');
    main.textContent = line;
    box.querySelectorAll('.pd-line.sub').forEach(n => n.remove());
    const addLine = (text, where) => {
      const el = document.createElement('p');
      el.className = 'pd-line sub';
      el.textContent = text;
      main[where](el);
    };
    if (extra && extra.before) addLine(extra.before, 'before');
    if (extra && extra.after) addLine(extra.after, 'after');
    box.querySelector('.pd-choices').remove();
    const foot = box.querySelector('.pd-foot'); if (foot) foot.remove();
    const res = document.createElement('div');
    res.className = 'pd-result';
    res.innerHTML = chips.map(c => `<span>${esc(c)}</span>`).join('');
    box.appendChild(res);
    const btn = document.createElement('button');
    btn.className = 'pd-btn pd-continue';
    btn.innerHTML = `<span><span class="k">1</span> ${esc(STRINGS.continueBtn)}</span>`;
    btn.addEventListener('click', (e) => { e.stopPropagation(); closeEncounter(); });
    box.appendChild(btn);
    try { btn.focus({ preventScroll: true }); } catch (e) {}
    dlg.done = true;
  }

  function choose(c) {
    if (!dlg || dlg.done || dlg.duel) return;
    const game = dlg.game;
    const C = global.ShiplypSave;
    const chips = [];
    if (c === 1) {
      if (!dlg.canTea) return;
      if (Math.random() < TUNE.honestChance) {
        S.paused = false; reportOffence('honestCop'); S.paused = true;
        chips.push('+1★');
        return showResult(STRINGS.results.honest, chips);
      }
      if (dlg.partial) {
        const all = wallet() || 0;
        if (all <= 0 || !spendWallet(all)) return;
        S.bribes++; LS.set('shiplyp_police_bribes', S.bribes);
        chips.push(fmt(STRINGS.paid, { amt: money(all) }));
        setStars(Math.max(0, S.stars - 2));
        chips.push('−2★');
        return showResult(STRINGS.results.teaPartial, chips, { after: pick(STRINGS.results.advice) });
      }
      if (!spendWallet(dlg.cost)) return;
      S.bribes++; LS.set('shiplyp_police_bribes', S.bribes);
      chips.push(fmt(STRINGS.paid, { amt: money(dlg.cost) }));
      setStars(0);
      chips.push(STRINGS.starsCleared);
      return showResult(dlg.stars >= 5 ? STRINGS.results.teaFiveStar : pick(STRINGS.results.teaOk), chips, { after: pick(STRINGS.results.advice) });
    }
    if (c === 2) return startDuel();
    if (c === 3) {
      S.paused = false; reportOffence('speedOff'); S.paused = true;
      chips.push('+1★');
      return showResult(pick(STRINGS.results.speedOff), chips);
    }
  }

  // --------------------------------------------------------------------------
  // EXCUSE DUEL (Argue). The game stays paused throughout (dlg is open).
  // --------------------------------------------------------------------------
  function startDuel() {
    dlg.duel = {
      pers: dlg.pers, round: 0, rounds: dlg.duelRounds, patience: 100,
      usedLines: new Set(), usedExcuses: new Set(), phase: 'round', options: [], double: false, offered: false, raf: 0
    };
    const box = dlg.wrap.querySelector('.pd-box');
    const foot = box.querySelector('.pd-foot'); if (foot) foot.remove();
    const panel = box.querySelector('.pd-choices');
    panel.className = 'pd-choices pd-duel';
    const winPct = TUNE.duelWinLine[Math.min(5, dlg.stars)];
    panel.innerHTML = `
      <div class="pdd-meta"><span class="pdd-round"></span><span class="pdd-plabel">${esc(STRINGS.duel.patience)}</span></div>
      <div class="pdd-patience"><div class="pdd-pfill"></div><div class="pdd-winline" style="left:${winPct}%"></div></div>
      <div class="pdd-timer"><div class="pdd-tfill"></div></div>
      <div class="pdd-opts"></div>`;
    nextRound();
  }

  function duelEls() {
    const p = dlg.wrap.querySelector('.pd-duel');
    return {
      p, line: dlg.wrap.querySelector('.pd-line'), sub: dlg.wrap.querySelector('.pd-line.sub'), round: p.querySelector('.pdd-round'),
      pfill: p.querySelector('.pdd-pfill'), tfill: p.querySelector('.pdd-tfill'), opts: p.querySelector('.pdd-opts'), timer: p.querySelector('.pdd-timer')
    };
  }

  function nextRound() {
    const d = dlg.duel, E = duelEls(), st = Math.min(5, dlg.stars);
    d.round++;
    d.phase = 'round';
    const P = STRINGS.personalities[d.pers];
    let lines = P.lines.filter(l => !d.usedLines.has(l)); if (!lines.length) lines = P.lines;
    const line = pick(lines); d.usedLines.add(line);
    E.line.textContent = line;
    if (E.sub) E.sub.textContent = '';
    E.round.textContent = d.double ? STRINGS.duel.doubleTag : fmt(STRINGS.duel.roundTag, { n: d.round, total: d.rounds });
    // Three options: maybe one the cop likes, always one neutral, the rest
    // mostly tempting red herrings he hates.
    const likedP = d.double ? Math.max(0.3, TUNE.duelLikedChance[st] - TUNE.duelDoubleLikedDrop) : TUNE.duelLikedChance[st];
    const liked = CATS.filter(c => verdictOf(d.pers, c) === 'liked');
    const neutral = CATS.filter(c => verdictOf(d.pers, c) === 'neutral');
    const hated = CATS.filter(c => verdictOf(d.pers, c) === 'hated');
    const cats = [];
    if (Math.random() < likedP) cats.push(pick(liked));
    cats.push(pick(neutral));
    while (cats.length < 3) {
      const h = hated.filter(c => !cats.includes(c));
      const n = neutral.filter(c => !cats.includes(c));
      cats.push(h.length && (Math.random() < 0.7 || !n.length) ? pick(h) : pick(n));
    }
    d.options = shuffle(cats).map(cat => {
      let pool = STRINGS.excuses[cat].filter(t => !d.usedExcuses.has(t)); if (!pool.length) pool = STRINGS.excuses[cat];
      const text = pick(pool); d.usedExcuses.add(text);
      return { cat, text, verdict: verdictOf(d.pers, cat) };
    });
    E.opts.className = 'pdd-opts';
    E.opts.innerHTML = d.options.map((o, i) => `<button class="pd-btn pdd-opt" data-e="${i}"><span><span class="k">${i + 1}</span> ${esc(o.text)}</span></button>`).join('');
    E.opts.querySelectorAll('.pdd-opt').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); pickExcuse(+b.dataset.e); }));
    if (!d.double) {
      const plea = document.createElement('button');
      plea.className = 'pd-btn pdd-plea';
      plea.innerHTML = `<span><span class="k">4</span> ${esc(STRINGS.duel.plea)}</span><span class="h">${esc(S.pleaUsed ? STRINGS.duel.pleaUsedHint : STRINGS.duel.pleaHint)}</span>`;
      plea.addEventListener('click', (e) => { e.stopPropagation(); tellStory(); });
      E.opts.appendChild(plea);
    }
    E.pfill.style.width = d.patience + '%';
    E.timer.style.visibility = '';
    // Countdown on the wall clock (the simulation is paused anyway).
    const secs = TUNE.duelSeconds[st] * (d.double ? TUNE.duelDoubleTimeMult : 1);
    d.deadline = performance.now() + secs * 1000; d.secs = secs;
    cancelAnimationFrame(d.raf);
    const tick = () => {
      if (!dlg || dlg.duel !== d || d.phase !== 'round') return;
      const left = Math.max(0, d.deadline - performance.now());
      E.tfill.style.width = (left / (secs * 1000) * 100).toFixed(1) + '%';
      if (left <= 0) return pickExcuse(-1);
      d.raf = requestAnimationFrame(tick);
    };
    d.raf = requestAnimationFrame(tick);
  }

  function pickExcuse(i) {
    const d = dlg && dlg.duel;
    if (!d || d.phase !== 'round') return;
    const o = i >= 0 ? d.options[i] : null;
    if (i >= 0 && !o) return;
    d.phase = 'react';
    cancelAnimationFrame(d.raf);
    const E = duelEls();
    const verdict = o ? o.verdict : 'timeout';
    d.lastVerdict = verdict;
    E.opts.querySelectorAll('.pdd-opt').forEach((b, k) => { b.disabled = true; if (k === i) b.classList.add('picked'); });
    if (!o) E.line.textContent = STRINGS.duel.timeoutPick;
    if (E.sub) E.sub.textContent = pick(STRINGS.reactions[verdict]);
    if (!d.double) {
      d.patience = Math.max(0, d.patience - TUNE.duelCost[verdict]);
      E.pfill.style.width = d.patience + '%';
    }
    setTimeout(() => {
      if (!dlg || dlg.duel !== d) return;
      if (d.double) return finishDuel(verdict === 'liked');   // final round: only a liked excuse wins
      if (d.patience <= 0) return finishDuel(false);
      if (d.round < d.rounds) return nextRound();
      finishDuel(d.patience >= TUNE.duelWinLine[Math.min(5, dlg.stars)]);
    }, 900);
  }

  // Way out of the duel: tell your story. First time in a drive he melts
  // (−1★ and some useless life advice); after that he just waves you off.
  function tellStory() {
    const d = dlg && dlg.duel;
    if (!d || d.phase !== 'round' || d.double) return;
    d.phase = 'done';
    cancelAnimationFrame(d.raf);
    dlg.duel = null;
    if (S.pleaUsed) return showResult(STRINGS.results.pleaAgain, []);
    S.pleaUsed = true;
    setStars(S.stars - 1);
    return showResult(pick(STRINGS.results.pleaReply), ['−1★'], { before: pick(STRINGS.results.plea) });
  }

  function finishDuel(win) {
    const d = dlg.duel, E = duelEls();
    d.phase = 'suspense';
    d.won = win;
    E.opts.innerHTML = '';
    E.timer.style.visibility = 'hidden';
    E.line.textContent = STRINGS.duel.suspense;
    if (E.sub) E.sub.textContent = '';
    sting('suspense');
    setTimeout(() => {
      if (!dlg || dlg.duel !== d) return;
      sting(win ? 'win' : 'lose');
      const C = global.ShiplypSave;
      if (d.double) {
        if (win) { setStars(0); return duelResult(STRINGS.duel.doubleWin, [STRINGS.starsCleared]); }
        setStars(S.stars + 1);   // undo the −1★ from the first win
        const fine = fineFor(dlg.cost, TUNE.duelDoubleFineWalletCap, 2);
        return duelResult(...chargeFine(C, fine, STRINGS.duel.doubleLose, STRINGS.duel.doubleLoseBroke, ['+1★']));
      }
      if (win) {
        setStars(S.stars - 1);
        if (!d.offered && S.stars > 0) return offerDouble();
        return duelResult(pick(STRINGS.results.argueOk), ['−1★']);
      }
      const fine = fineFor(dlg.cost, TUNE.argueFineWalletCap, 1);
      return duelResult(...chargeFine(C, fine, null, STRINGS.results.argueFailBroke, []));
    }, 1000);
  }

  function chargeFine(C, fine, lineTpl, brokeLine, chips) {
    const w = wallet();
    const paid = w == null ? 0 : Math.min(w, fine);
    if (paid > 0) spendWallet(paid);
    if (paid > 0) chips.push(fmt(STRINGS.paid, { amt: money(paid) }));
    const line = paid >= fine ? fmt(lineTpl || pick(STRINGS.results.argueFail), { fine: money(fine) }) : brokeLine;
    return [line, chips];
  }

  function offerDouble() {
    const d = dlg.duel, E = duelEls();
    d.offered = true; d.phase = 'offer';
    E.line.textContent = STRINGS.duel.offerLine;
    if (E.sub) E.sub.textContent = '';
    E.round.textContent = '−1★';
    E.opts.className = 'pdd-opts two';
    E.opts.innerHTML = `
      <button class="pd-btn pdd-opt tea" data-o="1"><span><span class="k">1</span> ${esc(STRINGS.duel.pushLuck)}</span><span class="h">${esc(STRINGS.duel.pushLuckHint)}</span></button>
      <button class="pd-btn pdd-opt" data-o="2"><span><span class="k">2</span> ${esc(STRINGS.duel.takeIt)}</span></button>`;
    E.opts.querySelectorAll('.pdd-opt').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); answerOffer(+b.dataset.o); }));
  }

  function answerOffer(n) {
    const d = dlg && dlg.duel;
    if (!d || d.phase !== 'offer') return;
    if (n === 2) return duelResult(pick(STRINGS.results.argueOk), ['−1★']);
    if (n !== 1) return;
    d.double = true;
    nextRound();
  }

  function duelResult(line, chips) {
    const d = dlg.duel;
    d.phase = 'done';
    cancelAnimationFrame(d.raf);
    dlg.duel = null;
    showResult(line, chips);
  }

  function closeEncounter() {
    if (!dlg) return;
    if (dlg.duel) cancelAnimationFrame(dlg.duel.raf);
    const where = dlg.where;
    const wrap = dlg.wrap;
    wrap.classList.remove('on');
    setTimeout(() => wrap.remove(), 350);
    dlg = null;
    S.paused = false;
    S.cleanTime = 0;
    // Grace before 5★ can catch you (again): long after a 5★ box, short otherwise.
    S.cooldown = where === 'caught' ? TUNE.caughtGrace : TUNE.shortGrace;
  }

  // Number keys 1/2/3 while the box is up; swallow them (and driving keys)
  // so nothing leaks into the game underneath.
  window.addEventListener('keydown', (e) => {
    if (!dlg) {
      const tgt = e.target && e.target.tagName;
      if ((e.key === 'b' || e.key === 'B' || e.code === 'KeyB') && tgt !== 'INPUT' && tgt !== 'TEXTAREA' && !e.repeat) {
        if (settle()) { e.preventDefault(); e.stopImmediatePropagation(); }
      }
      return;
    }
    const k = e.key;
    if (dlg.duel && (k === '1' || k === '2' || k === '3' || k === '4')) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (dlg.duel.phase === 'round') { if (k === '4') tellStory(); else pickExcuse(+k - 1); }
      else if (dlg.duel.phase === 'offer') answerOffer(+k);
      return;
    }
    if (k === '1' || k === '2' || k === '3') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (dlg.done) { if (k === '1') closeEncounter(); } else choose(+k);
    } else if (k === 'Enter' && dlg.done) {
      e.preventDefault(); e.stopImmediatePropagation(); closeEncounter();
    } else if (k !== 'Tab') {
      e.stopImmediatePropagation();
    }
  }, true);

  // --------------------------------------------------------------------------
  // PER-FRAME (called by game.js while playing and not paused)
  // --------------------------------------------------------------------------
  function update(game, dt) {
    if (!game || !game.vehicle || !game.world) return;
    S.game = game;
    ensureDOM();
    S.time += dt;
    S.cooldown = Math.max(0, S.cooldown - dt);
    checkRedLights(game);
    checkSpeeding(game, dt);
    checkBarrierCrash(game);
    orderClockTick(game);

    // Decay with clean, moving driving.
    const moving = Math.abs(game.vehicle.speed || 0) > 1.5;
    if (S.stars > 0 && moving) {
      S.cleanTime += dt;
      if (S.cleanTime >= TUNE.decayAfter) { S.cleanTime = TUNE.decayAfter - TUNE.decayEvery; setStars(S.stars - 1); }
    }

    // What the stars lead to (no police in the 3D world, by design):
    //   1–4★ — quiet heat build-up only (edge glow + siren, see updatePulse /
    //          updateAudio). No box opens by itself; the player can settle
    //          any time by tapping the star meter or pressing B (price scales
    //          with stars, so settling early is cheaper).
    //   5★   — caught: the box opens immediately, mid-drive.
    //   TODO: chasing vehicle, road closures, faster order timer at high stars.
    const otherModal = game.modalContainer && game.modalContainer.childElementCount > 0;
    if (!dlg && !otherModal && S.stars >= 5 && S.cooldown <= 0) openEncounter(game, 'caught');
  }

  // Voluntary settle (star meter tap / B key).
  function settle() {
    const g = S.game || global.game;
    if (dlg || S.stars < 1 || !g || g.gameState !== 'playing' || !g.vehicle) return false;
    if (g.modalContainer && g.modalContainer.childElementCount) return false; // another modal is up
    openEncounter(g, S.stars >= 5 ? 'caught' : 'settle');
    return true;
  }

  // Ambience runs on its own rAF so the pulse/siren keep breathing while the
  // encounter box has the simulation paused.
  let lastT = performance.now();
  function ambience(t) {
    const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
    const g = global.game;
    const playing = !!(g && g.gameState === 'playing');
    if (el.hud) {
      if (playing && S.stars > 0 && (el._placeT = (el._placeT || 0) + dt) > 0.5) { el._placeT = 0; placeHUD(); }
      if (!playing) el.hud.classList.remove('on');
      else if (S.stars > 0 && !el.hud.classList.contains('on')) renderHUD(false);
    }
    if (!playing && dlg) closeEncounter();
    updatePulse(playing);
    updateAudio(dt, playing);
    requestAnimationFrame(ambience);
  }
  requestAnimationFrame(ambience);

  function reset() {
    if (dlg) { dlg.wrap.remove(); dlg = null; }
    S.paused = false;
    S.stars = 0; S.offences = []; S.cleanTime = 0; S.cooldown = 0; S.signalSides.clear();
    S.speedingT = 0; S.speedingFlagged = false; S.wasTouching = false;
    S.driveStart = S.time;
    S.lastOrderTimer = null;
    S.pleaUsed = false;
    renderHUD(false);
  }

  // --------------------------------------------------------------------------
  // SETTINGS UI (rendered into the game's Settings modal)
  // --------------------------------------------------------------------------
  function settingsHTML() {
    const s = STRINGS.settings;
    const vol = Math.round(settings.sirenVolume * 100);
    return `
      <div class="police-settings">
        <div class="settings-section-title" style="margin-top: 14px;"><span>${esc(s.section)}</span></div>
        <div class="settings-row">
          <span class="settings-label">${esc(s.sirenVolume)}</span>
          <div class="settings-control">
            <input type="range" class="settings-slider ps-range" id="set-siren-volume" min="0" max="100" step="5" value="${vol}">
            <span class="slider-val" id="val-siren-volume">${vol}%</span>
          </div>
        </div>
        <div class="settings-row">
          <span class="settings-label">${esc(s.reduceFlashing)}</span>
          <div class="settings-control">
            <button type="button" class="slider-val" id="set-reduce-flashing" aria-pressed="${settings.reduceFlashing}" style="cursor:pointer;min-width:56px;min-height:32px">${settings.reduceFlashing ? s.on : s.off}</button>
          </div>
        </div>
      </div>`;
  }
  function bindSettings(root) {
    const r = root || document;
    const vol = r.querySelector('#set-siren-volume');
    const val = r.querySelector('#val-siren-volume');
    if (vol) vol.oninput = () => {
      settings.sirenVolume = Math.max(0, Math.min(1, (+vol.value) / 100));
      LS.set('shiplyp_siren_volume', settings.sirenVolume);
      if (val) val.textContent = Math.round(settings.sirenVolume * 100) + '%';
    };
    const rf = r.querySelector('#set-reduce-flashing');
    if (rf) rf.onclick = () => {
      settings.reduceFlashing = !settings.reduceFlashing;
      LS.set('shiplyp_reduce_flashing', settings.reduceFlashing ? '1' : '0');
      rf.textContent = settings.reduceFlashing ? STRINGS.settings.on : STRINGS.settings.off;
      rf.setAttribute('aria-pressed', settings.reduceFlashing);
    };
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------
  global.ShiplypPolice = {
    STRINGS, TUNE, settings,
    update, reset, reportOffence, settle,
    isPaused: () => S.paused,
    stars: () => S.stars,
    settingsHTML, bindSettings,
    _audioGain: () => (A.gain ? +A.gain.gain.value.toFixed(4) : null),
    // Debug / QA hooks (console): ShiplypPolice.debug.setStars(3) etc.
    debug: {
      state: () => ({ stars: S.stars, paused: S.paused, bribes: S.bribes, dialogOpen: !!dlg, ticks: S.ticks || 0, offences: S.offences.slice(), cooldown: S.cooldown }),
      setStars: (n) => setStars(n, 'debug'),
      offence: (t) => reportOffence(t || 'redLight'),
      openEncounter: (n, where) => { if (n) setStars(n); openEncounter(global.game, where || (S.stars >= 5 ? 'caught' : 'settle')); },
      choose: (c) => choose(c),
      duel: () => dlg && dlg.duel ? { pers: dlg.duel.pers, round: dlg.duel.round, rounds: dlg.duel.rounds, patience: dlg.duel.patience, phase: dlg.duel.phase, double: dlg.duel.double, options: dlg.duel.options.map(o => ({ cat: o.cat, verdict: o.verdict })) } : null,
      pickExcuse: (i) => pickExcuse(i),
      answerOffer: (n) => answerOffer(n),
      close: () => closeEncounter(),
      resetBribes: () => { S.bribes = 0; LS.set('shiplyp_police_bribes', 0); },
      log: (on) => { S.debugLog = on !== false; }
    }
  };
})(typeof window !== 'undefined' ? window : this);
