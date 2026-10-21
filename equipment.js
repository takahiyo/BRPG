/* Personal equipment inventories. Classic script; old saves keep their item IDs. */
(() => {
  const SLOTS = ['weapon', 'shield', 'head', 'armor', 'arms', 'feet', 'acc1', 'acc2'];
  const LABELS = { weapon: '武器・右手', shield: '盾・左手', head: '頭', armor: '胴', arms: '腕', feet: '脚', acc1: '装飾品1', acc2: '装飾品2' };
  const TYPES = {
    club: { name: '棍棒', group: 'universal' },
    dagger: { name: '短剣', group: 'light' },
    sword: { name: '剣', group: 'martial' },
    greatsword: { name: '両手剣', group: 'martial' },
    axe: { name: '斧', group: 'martial' },
    spear: { name: '槍', group: 'martial' },
    bow: { name: '弓', group: 'ranged' },
    staff: { name: '杖', group: 'magic' },
    whip: { name: '鞭', group: 'light' },
    shield: { name: '盾', group: 'martial' },
    helmet: { name: '兜', group: 'armor' },
    hat: { name: '帽子', group: 'universal' },
    body: { name: '鎧', group: 'armor' },
    robe: { name: '衣', group: 'universal' },
    gloves: { name: '手甲', group: 'armor' },
    boots: { name: '脚甲', group: 'armor' },
    ring: { name: '指輪', group: 'universal' },
    amulet: { name: '護符', group: 'universal' }
  };
  for (const [id, type] of Object.entries(TYPES)) Object.assign(type, EQUIPMENT_RULES[id]);
  let normalizing = false, readingBase = false;
  const previousAttributes = attributes, previousGearValue = gearValue, previousEnchantPower = enchantPower;
  const previousStats = stats, previousName = gearName, previousProductName = equipmentProductName;

  function product(g) { return DATA.catalog?.products?.[g?.productId] || null; }
  function inferType(g) {
    const p = product(g), text = p ? `${p.name} ${p.section || ''} ${p.part || ''}` : '';
    // The catalog category takes priority over body words in names such as
    // bracelets and anklets, and also repairs old crafts labeled as weapons.
    if (p?.category === '装身具') return /護符|お守|祈|祭|香炉|供物|儀仗/.test(p.name) ? 'amulet' : 'ring';
    if (g.slot === 'weapon') {
      if (/両手剣|大剣|長大剣/.test(text)) return 'greatsword';
      if (/短剣|小刀|ナイフ|匕首/.test(text)) return 'dagger';
      if (/弓|弩|投石紐/.test(text)) return 'bow';
      if (/杖|魔導|宝珠/.test(text)) return 'staff';
      if (/鞭|鎖分銅/.test(text)) return 'whip';
      if (/槍|鉾|薙刀|長柄/.test(text)) return 'spear';
      if (/斧/.test(text)) return 'axe';
      if (/剣|刀|刃/.test(text)) return 'sword';
      if (/槌|棍|打撃/.test(text)) return 'club';
      if (g.material === 'hide') return 'whip';
      if (g.material === 'silk') return 'bow';
      if (DATA.materials[g.material]?.category === 'gem') return 'staff';
      if (DATA.materials[g.material]?.category === 'stone') return 'axe';
      return DATA.materials[g.material]?.category === 'wood' ? 'club' : 'dagger';
    }
    if (/盾/.test(text)) return 'shield';
    if (/頭|兜|冑|帽|冠|覆面|面頬/.test(text)) return /帽|布|頭巾|覆面/.test(text) ? 'hat' : 'helmet';
    if (/腕|手甲|手袋|篭手|籠手|肘/.test(text)) return 'gloves';
    if (/脚|足|靴|脛|膝|すね/.test(text)) return 'boots';
    if (/指輪|腕輪|装飾|首飾|護符|耳飾|腰帯|帯締/.test(text)) return /護符/.test(text) ? 'amulet' : 'ring';
    if (/衣|服|ローブ|外套|マント|陣羽織/.test(text) || ['silk', 'hide'].includes(g.material)) return 'robe';
    return DATA.materials[g.material]?.category === 'gem' ? 'amulet' : 'body';
  }
  function enrich(g) {
    if (!g) return g;
    if (!TYPES[g.type]) {
      const bySlot = { shield: 'shield', head: 'helmet', body: 'body', armor: 'body', arms: 'gloves', feet: 'boots', legs: 'boots', accessory: 'ring', acc1: 'ring', acc2: 'ring' };
      g.type = g.equipSlot && bySlot[g.equipSlot] ? bySlot[g.equipSlot] : inferType(g);
    }
    const t = TYPES[g.type];
    // The broad legacy class remains the enchant/crafting category.
    g.slot = t.slot === 'weapon' ? 'weapon' : 'armor';
    g.equipSlot = t.slot;
    g.hands = t.slot === 'weapon' && (g.hands === 2 || t.hands === 2) ? 2 : 1;
    return g;
  }
  function slotOf(g) { return g ? (TYPES[g.type]?.slot || enrich(g).equipSlot) : null; }
  function equippedOwner(g, value = s) { return g && value.roster.find(h => SLOTS.some(k => h[k] === g.id)) || null; }
  function inventoryOwner(g, value = s) { return g && value.roster.find(h => h.id === g.ownerId) || null; }
  function jobProfile(h) {
    const id = h.job, j = DATA.jobs[id], cat = DATA.catalog?.jobs?.[id];
    const chain = new Set([id]); let at = j;
    while (at?.requirements?.job && !chain.has(at.requirements.job)) { chain.add(at.requirements.job); at = DATA.jobs[at.requirements.job]; }
    const words = `${j?.name || ''} ${cat?.family || ''} ${cat?.role || ''}`;
    if (chain.has('merchant') || /商人|交易|運搬|荷運/.test(words)) return 'merchant';
    if ([...chain].some(k => ['explorer', 'scout', 'ranger', 'ninja', 'beastmaster'].includes(k)) || /探索|斥候|狩人|案内|旅人|盗賊/.test(words)) return 'explorer';
    if ([...chain].some(k => ['mage', 'priest', 'druid', 'warlock', 'elementalist', 'tactician', 'bard', 'jester'].includes(k)) || /魔法|魔導|術師|僧侶|司祭|祈祷|学者/.test(words)) return 'magic';
    if ([...chain].some(k => ['alchemist', 'runesmith', 'herbalist'].includes(k)) || /職人|工房|鍛冶|錬金|製作/.test(words)) return 'artisan';
    return 'martial';
  }
  function capacity(h) { return DATA.jobs[h.job]?.inventoryCapacity || ({ merchant: 20, explorer: 16, artisan: 14, martial: 12, magic: 8 })[jobProfile(h)]; }
  function accessorySlots(h) { return DATA.jobs[h.job]?.accessorySlots || (['magic', 'merchant', 'artisan'].includes(jobProfile(h)) ? 2 : 1); }
  function inventory(h) { return s.gear.filter(g => g.ownerId === h.id); }
  function usage(h) { return inventory(h).length; }
  function canReceive(h, count = 1) { return !!h && usage(h) + count <= capacity(h); }
  function receive(g, heroId = null) {
    enrich(g);
    if (!s.gear.some(a => a.id === g.id)) s.gear.push(g);
    const requested = s.roster.find(h => h.id === Number(heroId));
    const h = requested && canReceive(requested, g.ownerId === requested.id ? 0 : 1) ? requested : [...party(), ...s.roster].find(h => canReceive(h, g.ownerId === h.id ? 0 : 1));
    g.ownerId = h?.id ?? null;
    return true;
  }
  function normalizeState(value = s) {
    if (normalizing) return;
    normalizing = true;
    try {
      for (const h of value.roster) for (const k of SLOTS) if (h[k] === undefined) h[k] = null;
      for (const g of value.gear) {
        enrich(g);
        const owner = equippedOwner(g, value);
        if (owner) g.ownerId = owner.id;
        else if (g.ownerId === undefined) {
          const candidates = [...value.active.map(id => value.roster.find(h => h.id === id)).filter(Boolean), ...value.roster];
          const h = candidates.find(h => value.gear.filter(a => a.ownerId === h.id).length < capacity(h));
          g.ownerId = h?.id ?? null;
        }
      }
      // Old armor IDs sometimes refer to a named hat/shield. Move their link to
      // the inferred body part, retaining a displaced item in its owner's bag.
      for (const h of value.roster) {
        for (const k of SLOTS) {
          const g = value.gear.find(a => a.id === h[k]);
          if (!g) continue;
          const dest = slotOf(g) === 'accessory' ? (k.startsWith('acc') ? k : !h.acc1 ? 'acc1' : !h.acc2 ? 'acc2' : 'acc1') : slotOf(g);
          if (dest !== k) { h[k] = null; if (!h[dest]) h[dest] = g.id; }
        }
        if (value.gear.find(g => g.id === h.weapon)?.hands === 2) h.shield = null;
        if (accessorySlots(h) < 2) h.acc2 = null;
      }
      for (const c of value.corpses || []) for (const g of c.gear) enrich(g);
    } finally { normalizing = false; }
  }
  function withoutLegacyGear(h, fn) {
    const weapon = h.weapon, armor = h.armor;
    try { h.weapon = null; h.armor = null; return fn(); }
    finally { h.weapon = weapon; h.armor = armor; }
  }
  function bareAttributes(h) {
    const old = readingBase;
    try { readingBase = true; return withoutLegacyGear(h, () => previousAttributes(h)); }
    finally { readingBase = old; }
  }
  function suitability(h, g) {
    if (!h || !g) return { suitable: false, factor: 0, text: '装備なし' };
    const type = TYPES[g.type] || TYPES[enrich(g).type], profile = jobProfile(h);
    const explicit = g.preferredJobs || DATA.jobs[h.job]?.equipmentTypes;
    let suitable;
    if (g.preferredJobs) suitable = g.preferredJobs.includes(h.job);
    else if (explicit) suitable = explicit.includes(g.type);
    else if (type.group === 'universal') suitable = true;
    else if (type.group === 'magic') suitable = ['magic', 'artisan'].includes(profile);
    else if (type.group === 'ranged') suitable = ['explorer', 'martial'].includes(profile);
    else if (type.group === 'light') suitable = profile !== 'magic' || ['bard', 'jester', 'tactician'].includes(h.job);
    else if (type.group === 'armor') suitable = ['hide', 'silk', 'wood'].includes(g.material) || ['martial', 'explorer', 'artisan'].includes(profile);
    else suitable = ['martial', 'explorer'].includes(profile);
    return { suitable, factor: suitable ? 1 : .5, text: suitable ? '適性あり：性能100%・特殊効果有効' : '適性なし：性能50%・特殊効果無効' };
  }
  function requirementsMet(h, g) {
    const a = bareAttributes(h);
    return Object.entries(gearRequirements(g)).every(([k, n]) => a[k] >= n) && (typeof characterRestrictionAllowed !== 'function' || characterRestrictionAllowed(h, g, 'gear'));
  }
  function effectsActive(h, g) { return !!g?.dur && requirementsMet(h, g) && suitability(h, g).suitable; }
  canEquip = function(h, g) { return !!h && !!g && requirementsMet(h, enrich(g)); };
  attributes = function(h) {
    const a = bareAttributes(h);
    if (readingBase) return a;
    for (const id of new Set(SLOTS.map(k => h[k]).filter(Boolean))) {
      const g = item(id);
      if (!effectsActive(h, g)) continue;
      for (const [k, n] of Object.entries(g.bonusStats || {})) if (a[k] !== undefined) a[k] += n;
    }
    return a;
  };
  function valueFor(h, g) {
    if (!g?.dur || h && !requirementsMet(h, g)) return 0;
    enrich(g);
    const effective = !h || suitability(h, g).suitable;
    const copy = { ...g, id: -1 };
    // Ownerless copies avoid the old two-slot ownership search and recursive requirements.
    let n = effective ? previousGearValue(copy) : baseGearValue(copy);
    if (effective && h && g.method === 'magic') n = Math.round(n * (1 + Math.max(0, bareAttributes(h).WIZ - 10) * .01));
    const factor = ({ weapon: 1, shield: .7, head: .55, armor: 1, arms: .48, feet: .48, accessory: .35 })[slotOf(g)] || 1;
    return Math.max(1, Math.round(n * factor * (effective ? 1 : .5)));
  }
  gearValue = function(g) { return valueFor(equippedOwner(g), g); };
  enchantPower = function(g) {
    if (!g) return 0;
    const h = equippedOwner(g);
    if (h && !effectsActive(h, g)) return 0;
    return previousEnchantPower({ ...g, id: -1 });
  };
  stats = function(h) {
    const result = previousStats(h), fatigue = h.sp === 0 ? .5 : 1;
    let extraDefense = 0;
    for (const k of ['shield', 'head', 'arms', 'feet', 'acc1', 'acc2']) {
      const g = item(h[k]);
      if (g) extraDefense += valueFor(h, g) + enchantPower(g);
    }
    result.def += Math.floor(extraDefense * fatigue);
    return result;
  };
  function unequip(heroId, slot, quiet = false) {
    if (s.dungeon || s.battle) return false;
    const h = s.roster.find(a => a.id === Number(heroId));
    if (!h || !SLOTS.includes(slot) || !h[slot]) return false;
    h[slot] = null;
    if (!quiet) { tell(h.name + 'の装備を外した。'); render(); }
    return true;
  }
  function equipItem(id, heroId) {
    if (!townOnly()) return false;
    normalizeState();
    const h = s.roster.find(a => a.id === Number(heroId)), g = item(Number(id));
    if (!h || !g || !canEquip(h, g)) { if (g) { tell(gearRequirementText(g)); render(); } return false; }
    if (g.ownerId !== h.id && !canReceive(h)) { tell(h.name + 'の所持枠がいっぱいです。倉庫へ預けるか、仲間へ渡してください。'); render(); return false; }
    let slot = slotOf(g);
    if (slot === 'accessory') slot = h.acc1 === g.id ? 'acc1' : h.acc2 === g.id ? 'acc2' : !h.acc1 ? 'acc1' : accessorySlots(h) > 1 && !h.acc2 ? 'acc2' : 'acc1';
    for (const a of s.roster) for (const k of SLOTS) if (a[k] === g.id) a[k] = null;
    if (slot === 'weapon' && g.hands === 2) h.shield = null;
    if (slot === 'shield' && item(h.weapon)?.hands === 2) h.weapon = null;
    g.ownerId = h.id; h[slot] = g.id;
    tell(`${h.name}に${gearName(g)}を装備した。${suitability(h, g).text}。`); render();
    return true;
  }
  equip = equipItem;
  function transfer(id, heroId) {
    if (!townOnly()) return false;
    normalizeState();
    const g = item(Number(id)), h = heroId === null ? null : s.roster.find(a => a.id === Number(heroId));
    if (!g || heroId !== null && !h) return false;
    if (h && h.id !== g.ownerId && !canReceive(h)) { tell(h.name + 'の所持枠がいっぱいです。'); render(); return false; }
    for (const a of s.roster) for (const k of SLOTS) if (a[k] === g.id) a[k] = null;
    g.ownerId = h?.id ?? null;
    tell(gearName(g) + (h ? 'を' + h.name + 'に渡した。' : 'を街の倉庫へ預けた。')); render();
    return true;
  }
  equipmentProductName = function(g) { return TYPES[g?.type]?.name || previousProductName(g); };
  // Keep the existing identification mask, rarity labels, and multi-enchant names.
  gearName = function(g) { if (g) enrich(g); return previousName(g); };
  // Direct attack riders (element and life steal) must obey suitability as well as numeric bonuses.
  const previousAttack = heroAttack;
  heroAttack = function(h, ...args) {
    const g = item(h.weapon);
    if (!g || effectsActive(h, g)) return previousAttack(h, ...args);
    const enchant = g.enchant, enchants = g.enchants;
    try { g.enchant = null; g.enchants = []; return previousAttack(h, ...args); }
    finally { g.enchant = enchant; if (enchants === undefined) delete g.enchants; else g.enchants = enchants; }
  };
  function validateSave(value) {
    const all = [...value.gear, ...(value.corpses || []).flatMap(c => c.gear)];
    if (new Set(all.map(g => g.id)).size !== all.length) return false;
    for (const g of all) {
      if (g.type !== undefined && !TYPES[g.type]) return false;
      if (g.equipSlot !== undefined && !['weapon', 'shield', 'head', 'armor', 'arms', 'feet', 'accessory'].includes(g.equipSlot)) return false;
      if (g.hands !== undefined && ![1, 2].includes(g.hands)) return false;
      if (g.ownerId !== undefined && g.ownerId !== null && !value.roster.some(h => h.id === g.ownerId)) return false;
      if (g.type && (g.slot !== (TYPES[g.type].slot === 'weapon' ? 'weapon' : 'armor') || g.equipSlot !== undefined && g.equipSlot !== TYPES[g.type].slot)) return false;
    }
    const used = new Set();
    for (const h of value.roster) {
      for (const k of SLOTS) {
        const id = h[k]; if (id === undefined || id === null) continue;
        const g = value.gear.find(a => a.id === id);
        if (!g || used.has(id)) return false;
        used.add(id);
        const expected = g.type ? TYPES[g.type].slot : g.equipSlot;
        if (expected && expected !== (k.startsWith('acc') ? 'accessory' : k)) return false;
        if (g.ownerId !== undefined && g.ownerId !== h.id) return false;
      }
      const w = value.gear.find(g => g.id === h.weapon);
      if (h.shield && (w?.hands === 2 || TYPES[w?.type]?.hands === 2)) return false;
    }
    return true;
  }
  globalThis.BRPGEquipment = { slots: SLOTS, labels: LABELS, types: TYPES, enrich, slotOf, equippedOwner, inventoryOwner, capacity, accessorySlots, inventory, usage, canReceive, receive, normalizeState, suitability, effectsActive, valueFor, equip: equipItem, unequip, transfer, validateSave };
  const previousRender = render;
  render = function() { normalizeState(); return previousRender(); };
  const previousFresh = fresh;
  fresh = function() { const value = previousFresh(); normalizeState(value); return value; };
  normalizeState();
})();
