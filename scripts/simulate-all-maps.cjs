'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = [
  'data.js', 'world-data.js', 'catalog-data.js', 'jobs-data.js',
  'game.js', 'screens.js', 'systems.js', 'monster-art.js',
  'characters.js', 'facilities.js', 'equipment.js',
  'map-art.js', 'exploration-ui.js', 'formation.js', 'audio.js'
];

function createEnv() {
  const store = new Map();
  const noop = () => {};
  const ctx = new Proxy({ createRadialGradient: () => ({ addColorStop: noop }) }, { get: (t, k) => t[k] || noop });
  const box = {
    console, Date, Math, URL, structuredClone, confirm: () => true,
    setInterval: () => 1, clearInterval: noop,
    document: {
      getElementById: () => ({
        style: {}, dataset: {}, value: '1', textContent: '', innerHTML: '',
        open: false, tagName: 'DIV', getContext: () => ctx,
        showModal() { this.open = true; }, close() { this.open = false; }
      }),
      addEventListener: noop
    },
    localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) }
  };
  vm.createContext(box);
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), box, { filename: f });
  }
  vm.runInContext('boot(); s = fresh();', box);
  return box;
}

const env = createEnv();

const script = `
  function testMapLevel(mapId, partyLv, trials = 8) {
    const map = worldMap(mapId);
    let successCount = 0;
    let wipeCount = 0;
    let totalItems = 0;

    const matRank = partyLv >= 150 ? 'godcrystal' :
                    partyLv >= 110 ? 'adamant' :
                    partyLv >= 80 ? 'meteoric' :
                    partyLv >= 60 ? 'titanium' :
                    partyLv >= 40 ? 'obsidian' :
                    partyLv >= 28 ? 'mithril' :
                    partyLv >= 20 ? 'silver' :
                    partyLv >= 12 ? 'steel' :
                    partyLv >= 6 ? 'iron' :
                    partyLv >= 3 ? 'copper' : 'wood';
    const quality = Math.min(13, 1 + Math.floor(partyLv / 25));

    for (let t = 0; t < trials; t++) {
      stopAll();
      s = fresh();
      s.randomState = (10007 * (t + 1) + partyLv * 997) >>> 0;
      
      const jobs = ['warrior', 'explorer', 'tactician', 'ranger', 'mage', 'priest'];
      s.roster = jobs.map((job, i) => makeHero(i + 1, 'Hero ' + (i + 1), job, i < 3 ? 'front' : 'back'));
      s.active = s.roster.map(a => a.id);
      s.nextHero = 7;
      s.gear = [];
      s.nextGear = 1;

      for (const a of s.roster) {
        a.lv = partyLv;
        syncHero(a);
        const slots = ['weapon', 'shield', 'head', 'armor', 'arms', 'feet', 'acc1'];
        for (const slot of slots) {
          if (slot === 'shield' && a.job === 'ranger') continue;
          let type = slot === 'weapon' ? (a.job === 'ranger' ? 'bow' : ['mage', 'priest', 'tactician'].includes(a.job) ? 'staff' : 'sword') :
                     slot === 'shield' ? 'buckler' :
                     slot === 'head' ? 'helm' :
                     slot === 'armor' ? 'plate' :
                     slot === 'arms' ? 'gloves' :
                     slot === 'feet' ? 'boots' : 'ring';
          const g = {
            id: s.nextGear++,
            material: matRank,
            type,
            slot: slot.startsWith('acc') ? 'accessory' : slot,
            method: 'physical',
            quality,
            dur: 100,
            maxDur: 100,
            ownerId: a.id
          };
          s.gear.push(g);
          BRPGEquipment.enrich(g);
          a[slot] = g.id;
        }
        a.hp = stats(a).hp;
        a.mp = stats(a).mp;
        a.sp = maxSP(a);
      }

      s.items.potion = 10;
      s.items.ration = 10;
      s.items.ether = 10;
      s.items.antidote = 10;
      let itemsUsed = 0;

      enterMap(mapId);
      if (!s.dungeon) { wipeCount++; continue; }

      let cleared = false;
      let aborted = false;

      while (s.dungeon && !cleared && !aborted) {
        const d = s.dungeon;
        const curDepth = d.depth;
        const isLastFloor = curDepth >= map.depths;

        const targetX = 17, targetY = 11;
        const queue = [[d.x, d.y, []]];
        const visited = Array.from({ length: 13 }, () => Array(19).fill(false));
        visited[d.y][d.x] = true;
        let pathToGoal = null;

        while (queue.length > 0) {
          const [cx, cy, path] = queue.shift();
          if (cx === targetX && cy === targetY) {
            pathToGoal = path;
            break;
          }
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < 19 && ny >= 0 && ny < 13 && !visited[ny][nx] && d.map[ny][nx] !== '#') {
              visited[ny][nx] = true;
              queue.push([nx, ny, [...path, [dx, dy]]]);
            }
          }
        }

        if (!pathToGoal) { aborted = true; break; }

        for (const [dx, dy] of pathToGoal) {
          if (!s.dungeon || s.battle) break;
          step(dx, dy, true);

          if (s.battle) {
            let turnCount = 0;
            while (s.battle && turnCount < 100) {
              autoPlans();
              executeTurn();
              turnCount++;
            }
            if (!s.dungeon) { wipeCount++; aborted = true; break; }
          }

          for (const a of s.roster) {
            const maxHp = stats(a).hp;
            if (a.hp > 0 && a.hp < maxHp * 0.4 && s.items.potion > 0) {
              s.items.potion--;
              itemsUsed++;
              a.hp = Math.min(maxHp, a.hp + 50);
            }
            if (a.sp !== undefined && a.sp <= 2 && s.items.ration > 0) {
              s.items.ration--;
              itemsUsed++;
              a.sp = Math.min(maxSP(a), a.sp + 20);
            }
          }
        }

        if (aborted) break;

        if (d.x === targetX && d.y === targetY) {
          if (!isLastFloor) {
            descend();
          } else {
            bossChallenge();
            if (s.battle) {
              let bTurn = 0;
              while (s.battle && bTurn < 100) {
                for (const a of alive()) {
                  const maxHp = stats(a).hp;
                  if (a.hp < maxHp * 0.35 && s.items.potion > 0 && itemsUsed < 3) {
                    s.items.potion--;
                    itemsUsed++;
                    a.hp = Math.min(maxHp, a.hp + 50);
                  }
                }
                autoPlans();
                executeTurn();
                bTurn++;
              }
            }
            if (!s.battle && alive().length > 0) {
              cleared = true;
            } else {
              wipeCount++;
              aborted = true;
            }
          }
        }
      }

      if (cleared) {
        totalItems += itemsUsed;
        if (itemsUsed <= 3) successCount++;
      }
    }

    return {
      successRate: successCount / trials,
      avgItems: totalItems / (trials - wipeCount || 1)
    };
  }

  function findRecommendedLevel(mapId) {
    const map = worldMap(mapId);
    let start = Math.max(1, Math.round(map.level * 0.8));
    let end = Math.min(300, Math.round(map.level * 2.5 + 20));
    let found = end;
    // Step by larger amounts for high levels
    const stepSize = map.level >= 50 ? 5 : map.level >= 20 ? 2 : 1;
    for (let lv = start; lv <= end; lv += stepSize) {
      const res = testMapLevel(mapId, lv, 8);
      if (res.successRate >= 0.75) {
        found = lv;
        break;
      }
    }
    return { mapId, name: map.name, originalLevel: map.level, depths: map.depths, recommendedLevel: found };
  }

  const allMaps = DATA.maps.map(m => m.id);
  const res = allMaps.map(findRecommendedLevel);
  JSON.stringify(res);
`;

const res = JSON.parse(vm.runInContext(script, env));
console.table(res);
fs.writeFileSync(path.join(__dirname, 'all-maps-recommended-levels.json'), JSON.stringify(res, null, 2));
